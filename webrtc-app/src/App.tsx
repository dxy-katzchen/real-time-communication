import { useRef, useEffect, useState } from "react";
import io, { Socket } from "socket.io-client";
import Auth from "./Components/Auth";
import MeetingLobby from "./Components/MeetingLobby";
import { ParticipantThumbnail } from "./Components/ParticipantThumbnail";
import { MainVideoComponent } from "./Components/MainVideoComponent";
import { meetingAPI, getSocketURL } from "./Service/api";

interface Participant {
  userId: string;
  socketId: string;
  stream?: MediaStream;
  peerConnection?: RTCPeerConnection;
}

function App() {
  // User and Meeting state
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isHost, setIsHost] = useState(false);

  // Multi-participant state
  const [remoteParticipants, setRemoteParticipants] = useState<
    Map<string, Participant>
  >(new Map());
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

  // Zoom-like UI state
  const [mainParticipant, setMainParticipant] = useState<string | null>(null);

  const [inRoom, setInRoom] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Not connected");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const localVideo = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);

  // Add connection tracking state
  const [connectionTimeouts, setConnectionTimeouts] = useState<
    Map<string, NodeJS.Timeout>
  >(new Map());
  const connectionStartTimes = useRef<Map<string, number>>(new Map());

  // Handle user creation/login
  const handleUserCreated = (userId: string, username: string) => {
    setUserId(userId);
    setUsername(username);

    const storedMeetingId = localStorage.getItem("lastMeetingId");
    if (storedMeetingId) {
      setMeetingId(storedMeetingId);
    }
  };

  // Handle meeting creation
  const handleCreateMeeting = (newMeetingId: string) => {
    setMeetingId(newMeetingId);

    setInRoom(true);
    setIsHost(true);
    localStorage.setItem("lastMeetingId", newMeetingId);
  };

  // Handle joining a meeting
  const handleJoinMeeting = async (meetingIdToJoin: string) => {
    setMeetingId(meetingIdToJoin);

    setInRoom(true);

    // Check if user is host using API service
    try {
      const data = await meetingAPI.isHost(meetingIdToJoin, userId!);
      setIsHost(data.isHost);
    } catch (err) {
      console.error("Error checking host status:", err);
    }

    localStorage.setItem("lastMeetingId", meetingIdToJoin);
  };

  // Create peer connection for a specific participant
  const createPeerConnection = (
    participantSocketId: string,
    isInitiator: boolean = false
  ) => {
    console.log(
      `Creating peer connection for ${participantSocketId}, isInitiator: ${isInitiator}`
    );

    // Clear any existing timeout for this participant
    const existingTimeout = connectionTimeouts.get(participantSocketId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Record connection start time
    connectionStartTimes.current.set(participantSocketId, Date.now());

    // Set up 10-second timeout for connection
    const timeout = setTimeout(() => {
      const startTime = connectionStartTimes.current.get(participantSocketId);
      if (startTime && Date.now() - startTime >= 5000) {
        console.log(
          `Connection timeout for ${participantSocketId}, attempting reconnect...`
        );
        handleConnectionTimeout(participantSocketId);
      }
    }, 5000);

    setConnectionTimeouts((prev) => {
      const updated = new Map(prev);
      updated.set(participantSocketId, timeout);
      return updated;
    });

    const pc = new RTCPeerConnection({
      iceServers: [
        // Google STUN servers
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },

        // Additional public STUN servers
        { urls: "stun:stun.relay.metered.ca:80" },
        { urls: "stun:global.stun.twilio.com:3478" },

        // Metered TURN servers (multiple protocols and ports)
        {
          urls: "turn:global.relay.metered.ca:80",
          username: "92c0c0f3362e3c6f2f20a86d",
          credential: "aK0V47jdAT0iaI4a",
        },
        {
          urls: "turn:global.relay.metered.ca:80?transport=tcp",
          username: "92c0c0f3362e3c6f2f20a86d",
          credential: "aK0V47jdAT0iaI4a",
        },
        {
          urls: "turn:global.relay.metered.ca:443",
          username: "92c0c0f3362e3c6f2f20a86d",
          credential: "aK0V47jdAT0iaI4a",
        },
        {
          urls: "turns:global.relay.metered.ca:443?transport=tcp",
          username: "92c0c0f3362e3c6f2f20a86d",
          credential: "aK0V47jdAT0iaI4a",
        },

        // Additional TURN servers for better connectivity
        {
          urls: "turn:relay1.expressturn.com:3478",
          username: "ef4BIXR2JUZ0JJ2HFPZ",
          credential: "K5BdZjHHmKITB7xP",
        },
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
      iceTransportPolicy: "all",
    });

    // Track connection attempt and retry count
    let connectionAttempts = 0;
    const maxAttempts = 3;

    // Add local stream tracks - ensure they exist first
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getTracks();
      console.log(
        `Adding ${tracks.length} tracks to peer connection for ${participantSocketId}`
      );

      tracks.forEach((track) => {
        console.log(`Adding ${track.kind} track to ${participantSocketId}`);
        pc.addTrack(track, localStreamRef.current!);
      });
    } else {
      console.warn(
        `No local stream available when creating peer connection for ${participantSocketId}`
      );
    }

    // Handle ICE candidates with better error handling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`Sending ICE candidate to ${participantSocketId}:`, {
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
        });
        if (socketRef.current) {
          socketRef.current.emit("ice-candidate", {
            candidate: event.candidate,
            targetSocket: participantSocketId,
            fromUserId: userId,
          });
        }
      } else {
        console.log(`ICE gathering complete for ${participantSocketId}`);
      }
    };

    // Handle remote stream with enhanced error handling
    pc.ontrack = (event) => {
      console.log(
        `Received track from ${participantSocketId}:`,
        event.track.kind,
        event.track.readyState
      );

      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];

        // Clear connection timeout on successful track reception
        clearConnectionTimeout(participantSocketId);

        // Add stream event listeners
        stream.getTracks().forEach((track) => {
          track.onended = () => {
            console.log(`Track ended for ${participantSocketId}:`, track.kind);
          };

          track.onmute = () => {
            console.log(`Track muted for ${participantSocketId}:`, track.kind);
          };

          track.onunmute = () => {
            console.log(
              `Track unmuted for ${participantSocketId}:`,
              track.kind
            );
          };
        });

        setRemoteParticipants((prev) => {
          const updated = new Map(prev);
          const participant = updated.get(participantSocketId);
          if (participant) {
            participant.stream = stream;
            updated.set(participantSocketId, participant);
            console.log(`Updated stream for ${participantSocketId}`, {
              videoTracks: stream.getVideoTracks().length,
              audioTracks: stream.getAudioTracks().length,
            });
          }
          return updated;
        });
      }
    };

    // Enhanced ICE connection state handling with timeout clearing
    pc.oniceconnectionstatechange = () => {
      console.log(
        `ICE connection state with ${participantSocketId}:`,
        pc.iceConnectionState
      );

      switch (pc.iceConnectionState) {
        case "connected":
        case "completed":
          console.log(`Successfully connected to ${participantSocketId}`);
          connectionAttempts = 0;
          // Clear connection timeout on successful connection
          clearConnectionTimeout(participantSocketId);
          break;

        case "failed":
          console.log(
            `Connection failed with ${participantSocketId}, attempt ${
              connectionAttempts + 1
            }/${maxAttempts}`
          );

          // Clear timeout since we're handling the failure
          clearConnectionTimeout(participantSocketId);

          if (connectionAttempts < maxAttempts) {
            connectionAttempts++;
            setTimeout(async () => {
              try {
                console.log(
                  `Attempting ICE restart for ${participantSocketId} (attempt ${connectionAttempts})`
                );
                await pc.restartIce();

                if (isInitiator) {
                  const offer = await pc.createOffer({ iceRestart: true });
                  await pc.setLocalDescription(offer);

                  socketRef.current?.emit("offer", {
                    offer,
                    targetSocket: participantSocketId,
                    fromUserId: userId,
                    msgId: Date.now().toString(),
                    isRestart: true,
                  });
                }
              } catch (restartError) {
                console.error(
                  `ICE restart failed for ${participantSocketId}:`,
                  restartError
                );

                if (connectionAttempts >= maxAttempts) {
                  console.log(
                    `Max attempts reached, recreating connection for ${participantSocketId}`
                  );
                  setTimeout(() => {
                    recreateConnection(participantSocketId);
                  }, 2000);
                }
              }
            }, Math.pow(2, connectionAttempts) * 1000);
          } else {
            console.log(
              `Max connection attempts reached for ${participantSocketId}, recreating connection`
            );
            setTimeout(() => {
              recreateConnection(participantSocketId);
            }, 5000);
          }
          break;

        case "disconnected":
          console.log(
            `Disconnected from ${participantSocketId}, waiting for reconnection...`
          );
          break;

        case "checking":
          // Reset timeout when connection checking starts
          console.log(`Connection checking for ${participantSocketId}`);
          connectionStartTimes.current.set(participantSocketId, Date.now());
          break;
      }
    };

    // Add connection state change handler
    pc.onconnectionstatechange = () => {
      console.log(
        `Connection state with ${participantSocketId}:`,
        pc.connectionState
      );

      if (pc.connectionState === "failed") {
        console.log(`Overall connection failed with ${participantSocketId}`);
        clearConnectionTimeout(participantSocketId);
        if (connectionAttempts < maxAttempts) {
          setTimeout(() => {
            recreateConnection(participantSocketId);
          }, 3000);
        }
      } else if (pc.connectionState === "connected") {
        // Clear timeout on successful connection
        clearConnectionTimeout(participantSocketId);
      }
    };

    // Add ICE gathering state handler
    pc.onicegatheringstatechange = () => {
      console.log(
        `ICE gathering state with ${participantSocketId}:`,
        pc.iceGatheringState
      );
    };

    // Add signaling state change handler
    pc.onsignalingstatechange = () => {
      console.log(
        `Signaling state with ${participantSocketId}:`,
        pc.signalingState
      );
    };

    peerConnections.current.set(participantSocketId, pc);
    return pc;
  };

  // Function to clear connection timeout
  const clearConnectionTimeout = (participantSocketId: string) => {
    const timeout = connectionTimeouts.get(participantSocketId);
    if (timeout) {
      clearTimeout(timeout);
      setConnectionTimeouts((prev) => {
        const updated = new Map(prev);
        updated.delete(participantSocketId);
        return updated;
      });
    }
    connectionStartTimes.current.delete(participantSocketId);
  };

  // Handle connection timeout (10+ seconds of connecting)
  const handleConnectionTimeout = async (participantSocketId: string) => {
    console.log(`Handling connection timeout for ${participantSocketId}`);

    const pc = peerConnections.current.get(participantSocketId);
    if (!pc) return;

    // Check current connection state
    const connectionState = pc.iceConnectionState;
    console.log(`Connection state during timeout: ${connectionState}`);

    // Only proceed if still connecting/checking
    if (connectionState === "checking" || connectionState === "new") {
      console.log(
        `Connection stuck in ${connectionState} state, forcing reconnect...`
      );

      // Force reconnection for this specific participant
      await recreateConnection(participantSocketId);
    } else if (
      connectionState === "failed" ||
      connectionState === "disconnected"
    ) {
      console.log(`Connection in ${connectionState} state, recreating...`);
      await recreateConnection(participantSocketId);
    } else {
      console.log(
        `Connection state ${connectionState} is acceptable, clearing timeout`
      );
      clearConnectionTimeout(participantSocketId);
    }
  };

  // Enhanced recreateConnection function
  const recreateConnection = async (participantSocketId: string) => {
    console.log(`Recreating connection for ${participantSocketId}`);

    // Clear any existing timeout
    clearConnectionTimeout(participantSocketId);

    // Close and remove old connection
    const oldPc = peerConnections.current.get(participantSocketId);
    if (oldPc) {
      oldPc.close();
      peerConnections.current.delete(participantSocketId);
    }

    // Get participant info
    const participant = remoteParticipants.get(participantSocketId);
    if (!participant) {
      console.log(`No participant found for ${participantSocketId}`);
      return;
    }

    // Wait a bit before recreating
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Create new connection
    const pc = createPeerConnection(participantSocketId, true);

    // Update participant with new connection
    setRemoteParticipants((prev) => {
      const updated = new Map(prev);
      const existingParticipant = updated.get(participantSocketId);
      if (existingParticipant) {
        existingParticipant.peerConnection = pc;
        existingParticipant.stream = undefined; // Reset stream
        updated.set(participantSocketId, existingParticipant);
      }
      return updated;
    });

    // Wait a bit then create offer
    setTimeout(async () => {
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);

        socketRef.current?.emit("offer", {
          offer,
          targetSocket: participantSocketId,
          fromUserId: userId,
          msgId: Date.now().toString(),
          isRecreate: true,
        });

        console.log("Recreate offer sent to:", participantSocketId);
      } catch (error) {
        console.error("Error creating recreate offer:", error);
      }
    }, 2000);
  };

  // Enhanced handleReconnect function
  const handleReconnect = async () => {
    console.log("Force reconnecting all peer connections...");

    try {
      // Clear all connection timeouts
      connectionTimeouts.forEach((timeout) => clearTimeout(timeout));
      setConnectionTimeouts(new Map());
      connectionStartTimes.current.clear();

      // Close all existing peer connections
      peerConnections.current.forEach((pc, socketId) => {
        console.log(`Closing peer connection for ${socketId}`);
        pc.close();
      });
      peerConnections.current.clear();

      // Clear remote participants streams
      setRemoteParticipants((prev) => {
        const updated = new Map();
        prev.forEach((participant, socketId) => {
          updated.set(socketId, {
            ...participant,
            stream: undefined,
            peerConnection: undefined,
          });
        });
        return updated;
      });

      // Ensure we have fresh local media
      if (localStreamRef.current) {
        console.log("Stopping current local stream for reconnect...");
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      // Get fresh media stream
      await startMedia();

      // Wait a bit for media to be ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Re-emit join to get fresh participant list and trigger new connections
      if (socketRef.current && userId && meetingId) {
        console.log("Re-joining room to trigger fresh connections...");
        socketRef.current.emit("leave", { room: meetingId, userId });

        // Wait a bit before rejoining
        setTimeout(() => {
          if (socketRef.current) {
            socketRef.current.emit("join", { room: meetingId, userId });
          }
        }, 500);
      }

      console.log("Reconnect initiated successfully");
    } catch (error) {
      console.error("Error during reconnect:", error);
      alert("Failed to reconnect. Please try again.");
    }
  };

  // Handle when a new user joins
  const handleUserJoined = async (data: {
    userId: string;
    socketId: string;
  }) => {
    console.log("User joined:", data);

    // Ensure we have local media before creating peer connection
    if (!localStreamRef.current) {
      console.log("Waiting for local media before creating offer");
      await startMedia();
    }

    // Create peer connection for new participant
    const pc = createPeerConnection(data.socketId, true);

    // Add to participants
    setRemoteParticipants((prev) => {
      const updated = new Map(prev);
      updated.set(data.socketId, {
        userId: data.userId,
        socketId: data.socketId,
        peerConnection: pc,
      });
      return updated;
    });

    // Wait a bit to ensure everything is set up
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Create and send offer
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current!.emit("offer", {
        offer,
        targetSocket: data.socketId,
        fromUserId: userId,
        msgId: Date.now().toString(),
      });

      console.log("Offer sent to new participant:", data.socketId);
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  };

  // Handle when a user leaves
  const handleUserLeft = (data: { userId: string; socketId: string }) => {
    console.log("User left:", data);

    // Close peer connection
    const pc = peerConnections.current.get(data.socketId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(data.socketId);
    }

    // Remove from participants
    setRemoteParticipants((prev) => {
      const updated = new Map(prev);
      updated.delete(data.socketId);
      return updated;
    });
  };

  // Handle existing participants when joining
  const handleExistingParticipants = async (data: {
    participants: Participant[];
  }) => {
    console.log("Existing participants:", data.participants);

    // IMPORTANT: Ensure we have local media before creating any peer connections
    if (!localStreamRef.current) {
      console.log(
        "Getting local media before creating peer connections for existing participants"
      );
      await startMedia();
    }

    data.participants.forEach((participant) => {
      const pc = createPeerConnection(participant.socketId, false);

      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        updated.set(participant.socketId, {
          ...participant,
          peerConnection: pc,
        });
        return updated;
      });
    });
  };

  // Handle incoming offers
  const handleOffer = async (data: {
    offer: RTCSessionDescriptionInit;
    fromSocket: string;
    fromUserId: string;
    msgId: string;
  }) => {
    console.log("Received offer from:", data.fromSocket);

    // Ensure we have local media before handling offer
    if (!localStreamRef.current) {
      console.log("Getting local media before handling offer");
      await startMedia();
    }

    let pc = peerConnections.current.get(data.fromSocket);
    if (!pc) {
      pc = createPeerConnection(data.fromSocket, false);

      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        updated.set(data.fromSocket, {
          userId: data.fromUserId,
          socketId: data.fromSocket,
          peerConnection: pc,
        });
        return updated;
      });
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current!.emit("answer", {
        answer,
        targetSocket: data.fromSocket,
        fromUserId: userId,
        msgId: data.msgId,
      });

      console.log("Answer sent to:", data.fromSocket);
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  };

  // Handle incoming answers
  const handleAnswer = async (data: {
    answer: RTCSessionDescriptionInit;
    fromSocket: string;
    fromUserId: string;
    msgId: string;
  }) => {
    console.log("Received answer from:", data.fromSocket);

    const pc = peerConnections.current.get(data.fromSocket);
    if (pc && pc.signalingState === "have-local-offer") {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      } catch (error) {
        console.error("Error handling answer:", error);
      }
    }
  };

  // Handle ICE candidates
  const handleIceCandidate = async (data: {
    candidate: RTCIceCandidateInit;
    fromSocket: string;
    fromUserId: string;
  }) => {
    const pc = peerConnections.current.get(data.fromSocket);
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    }
  };

  // Enhanced leave meeting for hosts
  const handleLeaveMeeting = async () => {
    // Clear all connection timeouts
    connectionTimeouts.forEach((timeout) => clearTimeout(timeout));
    setConnectionTimeouts(new Map());
    connectionStartTimes.current.clear();

    if (isHost && meetingId) {
      // Host must end meeting for all
      const confirmEnd = window.confirm(
        "As the host, leaving will end the meeting for all participants. Do you want to continue?"
      );

      if (confirmEnd) {
        await handleEndMeeting();
        return;
      } else {
        return; // Don't leave if host cancels
      }
    }

    // Regular participant leave using API service
    if (userId && meetingId) {
      try {
        await meetingAPI.leaveMeeting(meetingId, userId);
      } catch (err) {
        console.error("Error leaving meeting:", err);
      }
    }

    // Clean up connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    setRemoteParticipants(new Map());

    // ENHANCED: Properly stop all media tracks and clear video element
    if (localStreamRef.current) {
      console.log("Stopping all media tracks...");
      localStreamRef.current.getTracks().forEach((track) => {
        console.log(`Stopping ${track.kind} track`);
        track.stop();
      });
      localStreamRef.current = null;
    }

    // ENHANCED: Clear the local video element
    if (localVideo.current) {
      console.log("Clearing local video element...");
      localVideo.current.srcObject = null;
      localVideo.current.pause();
      localVideo.current.removeAttribute("src");
      localVideo.current.load(); // Reset the video element
    }

    // Reset video/audio states
    setIsMuted(false);
    setIsVideoOff(false);

    socketRef.current?.emit("leave", { room: meetingId, userId });

    setInRoom(false);
    setMeetingId(null);
    setIsHost(false);
    setMainParticipant(null); // Reset main participant view
    localStorage.removeItem("lastMeetingId");

    console.log("Successfully left meeting and stopped all media");
  };

  const handleEndMeeting = async () => {
    if (!meetingId || !userId || !isHost) return;

    setIsEndingMeeting(true);

    try {
      // Use API service
      await meetingAPI.endMeeting(meetingId, userId);

      socketRef.current?.emit("end-meeting", { room: meetingId, userId });
      alert("Meeting ended successfully");

      // Clean up and leave
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      setRemoteParticipants(new Map());

      // ENHANCED: Properly stop all media tracks and clear video element
      if (localStreamRef.current) {
        console.log("Stopping all media tracks...");
        localStreamRef.current.getTracks().forEach((track) => {
          console.log(`Stopping ${track.kind} track`);
          track.stop();
        });
        localStreamRef.current = null;
      }

      // ENHANCED: Clear the local video element
      if (localVideo.current) {
        console.log("Clearing local video element...");
        localVideo.current.srcObject = null;
        localVideo.current.pause();
        localVideo.current.removeAttribute("src");
        localVideo.current.load(); // Reset the video element
      }

      // Reset video/audio states
      setIsMuted(false);
      setIsVideoOff(false);

      setInRoom(false);
      setMeetingId(null);
      setIsHost(false);
      setMainParticipant(null); // Reset main participant view
      localStorage.removeItem("lastMeetingId");

      console.log("Successfully ended meeting and stopped all media");
    } catch (err) {
      console.error("Error ending meeting:", err);
      if (err instanceof Error) {
        alert(`Failed to end meeting: ${err.message}`);
      } else {
        alert("Network error when ending meeting.");
      }
      setIsEndingMeeting(false);
    }
  };

  // Socket setup using API service for URL
  useEffect(() => {
    const newSocket = io(getSocketURL(), {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    newSocket.on("connect", () => {
      console.log("Connected to Socket.IO server");
      setConnectionStatus("Connected");
    });

    newSocket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setConnectionStatus(`Error: ${error.message}`);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("Disconnected:", reason);
      setConnectionStatus(`Disconnected: ${reason}`);
    });

    socketRef.current = newSocket;

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Event listeners that depend on state
  useEffect(() => {
    if (!socketRef.current) return;

    const socket = socketRef.current;

    // Multi-participant event listeners
    socket.on("user-joined", handleUserJoined);
    socket.on("user-left", handleUserLeft);
    socket.on("existing-participants", handleExistingParticipants);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);

    const handleMeetingEnded = (data: { meetingId: string }) => {
      if (data.meetingId === meetingId && !isEndingMeeting) {
        alert("This meeting has been ended by the host");
        handleLeaveMeeting();
      }
    };

    socket.on("meeting-ended", handleMeetingEnded);

    // Cleanup previous listeners
    return () => {
      socket.off("user-joined", handleUserJoined);
      socket.off("user-left", handleUserLeft);
      socket.off("existing-participants", handleExistingParticipants);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("meeting-ended", handleMeetingEnded);
    };
  }, [
    meetingId,
    isEndingMeeting,
    handleUserJoined,
    handleUserLeft,
    handleExistingParticipants,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handleLeaveMeeting,
  ]);

  // Start media when joining room
  useEffect(() => {
    if (inRoom && !localStreamRef.current) {
      console.log("Starting media for room join");
      startMedia();
    }

    // ENHANCED: Cleanup function for component unmount or when leaving room
    return () => {
      if (localStreamRef.current) {
        console.log("Cleanup: Stopping all media tracks...");
        localStreamRef.current.getTracks().forEach((track) => {
          console.log(`Cleanup: Stopping ${track.kind} track`);
          track.stop();
        });
        localStreamRef.current = null;
      }

      const videoEl = localVideo.current;
      if (videoEl) {
        console.log("Cleanup: Clearing local video element...");
        videoEl.srcObject = null;
        videoEl.pause();
      }
    };
  }, [inRoom]);

  // Join room when inRoom changes
  useEffect(() => {
    if (inRoom && socketRef.current && userId) {
      socketRef.current.emit("join", { room: meetingId, userId });
    }
  }, [inRoom, meetingId, userId]);

  // Fetch participants periodically using API service
  useEffect(() => {
    if (meetingId) {
      const fetchParticipants = async () => {
        try {
          const data = await meetingAPI.getParticipants(meetingId);
          setParticipants(data);
        } catch (err) {
          console.error("Error fetching participants:", err);
        }
      };

      fetchParticipants();
      const intervalId = setInterval(fetchParticipants, 10000);
      return () => clearInterval(intervalId);
    }
  }, [meetingId, inRoom]);

  // Enhanced toggle video function with audio state fix
  const toggleVideo = async () => {
    if (!localStreamRef.current) return;

    if (isVideoOff) {
      // Turning video back on - need to get new video stream
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true, // Always get audio, we'll control it with enabled property
        });

        // Stop old tracks first
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => track.stop());
        }

        // Update local stream reference
        localStreamRef.current = newStream;

        // Apply current audio mute state to new audio tracks
        const audioTracks = newStream.getAudioTracks();
        audioTracks.forEach((track) => {
          track.enabled = !isMuted; // Apply current mute state
        });

        // Update local video element
        if (localVideo.current) {
          localVideo.current.srcObject = newStream;
          try {
            await localVideo.current.play();
            console.log("Local video restarted successfully");
          } catch (playError) {
            console.warn("Could not autoplay restarted video:", playError);
            // Try to play manually after a short delay
            setTimeout(async () => {
              try {
                if (localVideo.current) {
                  await localVideo.current.play();
                }
              } catch (retryError) {
                console.error(
                  "Failed to restart video after retry:",
                  retryError
                );
              }
            }, 100);
          }
        }

        // Update all existing peer connections with new video track
        const videoTrack = newStream.getVideoTracks()[0];
        const audioTrack = newStream.getAudioTracks()[0];

        peerConnections.current.forEach(async (pc, socketId) => {
          try {
            // Replace video track
            const videoSender = pc
              .getSenders()
              .find((sender) => sender.track && sender.track.kind === "video");
            if (videoSender && videoTrack) {
              await videoSender.replaceTrack(videoTrack);
              console.log(`Replaced video track for ${socketId}`);
            } else if (videoTrack) {
              // Add video track if it doesn't exist
              pc.addTrack(videoTrack, newStream);
              console.log(`Added video track for ${socketId}`);
            }

            // Replace audio track
            const audioSender = pc
              .getSenders()
              .find((sender) => sender.track && sender.track.kind === "audio");
            if (audioSender && audioTrack) {
              await audioSender.replaceTrack(audioTrack);
              console.log(`Replaced audio track for ${socketId}`);
            } else if (audioTrack) {
              // Add audio track if it doesn't exist
              pc.addTrack(audioTrack, newStream);
              console.log(`Added audio track for ${socketId}`);
            }
          } catch (error) {
            console.error(`Error updating tracks for ${socketId}:`, error);
          }
        });

        setIsVideoOff(false);
      } catch (error) {
        console.error("Error restarting video:", error);
        alert("Failed to restart camera. Please check permissions.");
      }
    } else {
      // Turning video off - just disable the track
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = false;
      });
      setIsVideoOff(true);
    }
  };

  // Fixed toggle audio function
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const newMutedState = !isMuted; // Use the React state as the source of truth

      audioTracks.forEach((track) => {
        track.enabled = !newMutedState; // Set track.enabled to opposite of muted state
      });

      setIsMuted(newMutedState);

      console.log(`Audio ${newMutedState ? "muted" : "unmuted"}`);
    }
  };

  // Enhanced startMedia function with initial audio state
  async function startMedia() {
    try {
      if (localStreamRef.current) {
        console.log("Local stream already exists");
        return localStreamRef.current;
      }

      console.log("Requesting access to local media");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Add these enhanced audio settings
          sampleRate: 48000,
          sampleSize: 16,
          channelCount: 1, // Use mono to reduce bandwidth and noise
        },
      });

      console.log(
        "Local media obtained:",
        stream.getTracks().map((t) => t.kind)
      );

      // Apply initial mute state to audio tracks
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !isMuted; // Apply current mute state
      });

      localStreamRef.current = stream;

      if (localVideo.current) {
        localVideo.current.srcObject = stream;

        // Add event listeners for better debugging
        localVideo.current.onloadedmetadata = () => {
          console.log("Video metadata loaded");
        };

        localVideo.current.oncanplay = () => {
          console.log("Video can play");
        };

        localVideo.current.onerror = (error) => {
          console.error("Video element error:", error);
        };

        try {
          // Set video properties before playing - ENSURE MUTED IS TRUE
          localVideo.current.muted = true; // This is critical!
          localVideo.current.playsInline = true;
          localVideo.current.autoplay = true;
          localVideo.current.volume = 0; // Extra safety

          await localVideo.current.play();
          console.log("Local video playing");
        } catch (playError) {
          console.warn("Could not autoplay local video:", playError);

          // Fallback: try to play after user interaction
          const playVideoOnInteraction = async () => {
            try {
              if (localVideo.current) {
                await localVideo.current.play();
                console.log("Video started after user interaction");
                // Remove event listeners after successful play
                document.removeEventListener("click", playVideoOnInteraction);
                document.removeEventListener(
                  "touchstart",
                  playVideoOnInteraction
                );
              }
            } catch (interactionError) {
              console.error(
                "Failed to play video after interaction:",
                interactionError
              );
            }
          };

          // Wait for user interaction
          document.addEventListener("click", playVideoOnInteraction, {
            once: true,
          });
          document.addEventListener("touchstart", playVideoOnInteraction, {
            once: true,
          });
        }
      }

      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      alert("Failed to access camera or microphone. Please check permissions.");
      return null;
    }
  }

  // Switch main participant view
  const switchToMainView = (participantId: string | null) => {
    setMainParticipant(participantId);
  };

  // Handle logout
  const handleLogout = () => {
    // Clean up any active meeting first
    if (inRoom) {
      handleLeaveMeeting();
    }

    // Stop any remaining media tracks
    if (localStreamRef.current) {
      console.log("Logout: Stopping all media tracks...");
      localStreamRef.current.getTracks().forEach((track) => {
        console.log(`Logout: Stopping ${track.kind} track`);
        track.stop();
      });
      localStreamRef.current = null;
    }

    // Clear video element
    if (localVideo.current) {
      console.log("Logout: Clearing local video element...");
      localVideo.current.srcObject = null;
      localVideo.current.pause();
    }

    // Reset all states
    setUserId(null);
    setUsername(null);
    setMeetingId(null);
    setInRoom(false);
    setIsHost(false);
    setMainParticipant(null);
    setIsMuted(false);
    setIsVideoOff(false);

    console.log("User logged out and all media stopped");
  };

  // Network diagnostics function
  const runNetworkDiagnostics = async () => {
    console.log("Running network diagnostics...");

    try {
      // Test STUN server connectivity
      const stunTest = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      stunTest.createDataChannel("test");
      const offer = await stunTest.createOffer();
      await stunTest.setLocalDescription(offer);

      return new Promise((resolve) => {
        let stunWorking = false;
        let turnWorking = false;

        stunTest.onicecandidate = (event) => {
          if (event.candidate) {
            console.log("ICE candidate found:", {
              type: event.candidate.type,
              protocol: event.candidate.protocol,
              address: event.candidate.address,
            });

            if (event.candidate.type === "srflx") {
              stunWorking = true;
            } else if (event.candidate.type === "relay") {
              turnWorking = true;
            }
          } else {
            console.log("ICE gathering complete");
            console.log("Network diagnostics results:", {
              stunWorking,
              turnWorking,
              recommendation: stunWorking
                ? turnWorking
                  ? "Network should work well"
                  : "Network should work for most cases"
                : "Network may have issues, check firewall settings",
            });
            stunTest.close();
            resolve({ stunWorking, turnWorking });
          }
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          console.log("Network diagnostics timeout");
          stunTest.close();
          resolve({ stunWorking, turnWorking });
        }, 10000);
      });
    } catch (error) {
      console.error("Network diagnostics failed:", error);
      return { stunWorking: false, turnWorking: false };
    }
  };

  // Call this when the app starts
  useEffect(() => {
    // Run diagnostics when app loads
    runNetworkDiagnostics();
  }, []);

  // If not authenticated, show login
  if (!userId || !username) {
    return <Auth onUserCreated={handleUserCreated} />;
  }

  // If authenticated but not in a meeting, show meeting lobby
  if (!inRoom || !meetingId) {
    return (
      <MeetingLobby
        userId={userId}
        username={username}
        onJoinMeeting={handleJoinMeeting}
        onCreateMeeting={handleCreateMeeting}
        onLogout={handleLogout}
      />
    );
  }

  // Get the main participant to display
  const getMainParticipantStream = () => {
    if (mainParticipant) {
      // If a remote participant is selected as main
      const found = Array.from(remoteParticipants.values()).find(
        (p) => p.userId === mainParticipant
      );
      if (found && found.stream) {
        return { stream: found.stream, isLocal: false, userId: found.userId };
      }
    }

    // Default to local user if no main participant selected or not found
    return { stream: localStreamRef.current, isLocal: true, userId: userId };
  };

  const mainView = getMainParticipantStream();
  const mainParticipantInfo = mainView.isLocal
    ? { displayName: username, isHost }
    : participants.find((p) => p.userId === mainView.userId);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Status bar */}
      <div
        style={{
          padding: "10px",
          backgroundColor:
            connectionStatus === "Connected" ? "#d4edda" : "#f8d7da",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>
          Meeting ID: {meetingId} {isHost && "(Host)"}
        </span>
        <span>Status: {connectionStatus}</span>
      </div>

      {/* Main content area */}
      <div
        style={{
          display: "flex",
          flex: 1,
          height: "calc(100vh - 130px)",
          overflow: "hidden",
        }}
      >
        {/* Main video display */}
        <div
          style={{
            flex: 1,
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          <div
            style={{
              flex: 1,
              backgroundColor: "#000",
              borderRadius: "8px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Main participant name */}
            <div
              style={{
                position: "absolute",
                bottom: "20px",
                left: "20px",
                backgroundColor: "rgba(0,0,0,0.5)",
                color: "white",
                padding: "5px 10px",
                borderRadius: "4px",
                zIndex: 2,
              }}
            >
              {mainView.isLocal
                ? `You (${username})`
                : mainParticipantInfo?.displayName || "Unknown"}{" "}
              {mainParticipantInfo?.isHost && " (Host)"}
            </div>

            {/* Main video */}
            {mainView.isLocal ? (
              <video
                ref={localVideo}
                autoPlay
                muted
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scaleX(-1)", // Mirror local video
                }}
              />
            ) : (
              <MainVideoComponent stream={mainView.stream} />
            )}
          </div>
        </div>

        {/* Participant sidebar */}
        <div
          style={{
            width: "220px",
            backgroundColor: "#f8f9fa",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "10px",
              borderBottom: "1px solid #dee2e6",
            }}
          >
            <h5 style={{ margin: "0 0 10px 0" }}>
              Participants ({participants.length})
            </h5>
          </div>

          {/* Local user thumbnail */}
          <div style={{ padding: "10px" }}>
            <ParticipantThumbnail
              isLocal={true}
              stream={localStreamRef.current}
              userId={userId || ""}
              displayName={username || "You"}
              isHost={isHost}
              isActive={mainParticipant === null}
              onClick={() => switchToMainView(null)}
              isMuted={isMuted}
              isVideoOff={isVideoOff}
            />
          </div>

          {/* Remote participants */}
          <div style={{ padding: "0 10px" }}>
            {Array.from(remoteParticipants.values()).map((participant) => {
              const info = participants.find(
                (p) => p.userId === participant.userId
              );
              const displayName =
                info?.displayName || info?.username || "Unknown";
              return (
                <ParticipantThumbnail
                  key={participant.socketId}
                  isLocal={false}
                  stream={participant.stream}
                  userId={participant.userId}
                  displayName={displayName}
                  isHost={info?.isHost || false}
                  isActive={mainParticipant === participant.userId}
                  onClick={() => switchToMainView(participant.userId)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          padding: "15px",
          backgroundColor: "#343a40",
          display: "flex",
          justifyContent: "center",
          gap: "15px",
        }}
      >
        <button
          onClick={toggleAudio}
          style={{
            padding: "10px",
            borderRadius: "50%",
            border: "none",
            width: "50px",
            height: "50px",
            backgroundColor: isMuted ? "#dc3545" : "#6c757d",
            color: "white",
            cursor: "pointer",
          }}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? "🔇" : "🎤"}
        </button>

        <button
          onClick={toggleVideo}
          style={{
            padding: "10px",
            borderRadius: "50%",
            border: "none",
            width: "50px",
            height: "50px",
            backgroundColor: isVideoOff ? "#dc3545" : "#6c757d",
            color: "white",
            cursor: "pointer",
          }}
          title={isVideoOff ? "Start Video" : "Stop Video"}
        >
          {isVideoOff ? "📵" : "📹"}
        </button>

        <button
          onClick={handleReconnect}
          style={{
            padding: "10px 15px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
          title="Reconnect all video streams"
        >
          🔄 Reconnect
        </button>

        <button
          onClick={handleLeaveMeeting}
          style={{
            padding: "10px 20px",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          {isHost ? "End Meeting" : "Leave"}
        </button>
      </div>
    </div>
  );
}

export default App;
