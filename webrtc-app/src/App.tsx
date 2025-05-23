import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";
import Auth from "./Components/Auth";
import MeetingLobby from "./Components/MeetingLobby";

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
  const [room, setRoom] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Not connected");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const localVideo = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);

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
    setRoom(newMeetingId);
    setInRoom(true);
    setIsHost(true);
    localStorage.setItem("lastMeetingId", newMeetingId);
  };

  // Handle joining a meeting
  const handleJoinMeeting = async (meetingIdToJoin: string) => {
    setMeetingId(meetingIdToJoin);
    setRoom(meetingIdToJoin);
    setInRoom(true);

    // Check if user is host
    try {
      const response = await fetch(
        `http://localhost:5002/api/meetings/${meetingIdToJoin}/is-host/${userId}`
      );
      if (response.ok) {
        const data = await response.json();
        setIsHost(data.isHost);
      }
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

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.relay.metered.ca:80" },
        {
          urls: "turn:global.relay.metered.ca:443",
          username: "92c0c0f3362e3c6f2f20a86d",
          credential: "aK0V47jdAT0iaI4a",
        },
      ],
      iceCandidatePoolSize: 10,
    });

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

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("ice-candidate", {
          candidate: event.candidate,
          targetSocket: participantSocketId,
          fromUserId: userId,
        });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log(
        `Received track from ${participantSocketId}:`,
        event.track.kind
      );

      if (event.streams && event.streams[0]) {
        setRemoteParticipants((prev) => {
          const updated = new Map(prev);
          const participant = updated.get(participantSocketId);
          if (participant) {
            participant.stream = event.streams[0];
            updated.set(participantSocketId, participant);
            console.log(`Updated stream for ${participantSocketId}`);
          }
          return updated;
        });
      }
    };

    // Handle connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log(
        `ICE connection state with ${participantSocketId}:`,
        pc.iceConnectionState
      );

      if (pc.iceConnectionState === "failed") {
        console.log(
          `Connection failed with ${participantSocketId}, attempting restart`
        );
      }
    };

    peerConnections.current.set(participantSocketId, pc);
    return pc;
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

      socketRef.current.emit("offer", {
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

      socketRef.current.emit("answer", {
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

    // Regular participant leave
    if (userId && meetingId) {
      try {
        await fetch(`http://localhost:5002/api/meetings/${meetingId}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
      } catch (err) {
        console.error("Error leaving meeting:", err);
      }
    }

    // Clean up connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    setRemoteParticipants(new Map());

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    socketRef.current.emit("leave", { room: meetingId, userId });

    setInRoom(false);
    setMeetingId(null);
    setIsHost(false);
    localStorage.removeItem("lastMeetingId");
  };

  const handleEndMeeting = async () => {
    if (!meetingId || !userId || !isHost) return;

    setIsEndingMeeting(true);

    try {
      const response = await fetch(
        `http://localhost:5002/api/meetings/${meetingId}/end`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        alert(`Failed to end meeting: ${errorData.error}`);
        setIsEndingMeeting(false);
        return;
      }

      socketRef.current.emit("end-meeting", { room: meetingId, userId });
      alert("Meeting ended successfully");

      // Clean up and leave
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      setRemoteParticipants(new Map());

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      setInRoom(false);
      setMeetingId(null);
      setIsHost(false);
      localStorage.removeItem("lastMeetingId");
    } catch (err) {
      console.error("Error ending meeting:", err);
      alert("Network error when ending meeting.");
      setIsEndingMeeting(false);
    }
  };

  // Socket setup
  useEffect(() => {
    const newSocket = io("http://localhost:5002", {
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

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [inRoom]);

  // Join room when inRoom changes
  useEffect(() => {
    if (inRoom && socketRef.current && userId) {
      socketRef.current.emit("join", { room: meetingId, userId });
    }
  }, [inRoom, meetingId, userId]);

  // Fetch participants periodically
  useEffect(() => {
    if (meetingId) {
      const fetchParticipants = async () => {
        try {
          const response = await fetch(
            `http://localhost:5002/api/meetings/${meetingId}/participants`
          );
          if (response.ok) {
            const data = await response.json();
            setParticipants(data);
          }
        } catch (err) {
          console.error("Error fetching participants:", err);
        }
      };

      fetchParticipants();
      const intervalId = setInterval(fetchParticipants, 10000);
      return () => clearInterval(intervalId);
    }
  }, [meetingId, inRoom]);

  // Enhanced toggle video function
  const toggleVideo = async () => {
    if (!localStreamRef.current) return;

    if (isVideoOff) {
      // Turning video back on - need to get new video stream
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        // Stop old tracks first
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => track.stop());
        }

        // Update local stream reference
        localStreamRef.current = newStream;

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

  // Enhanced toggle audio function
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // Enhanced startMedia function with better error handling
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
        },
      });

      console.log(
        "Local media obtained:",
        stream.getTracks().map((t) => t.kind)
      );
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
          // Set video properties before playing
          localVideo.current.muted = true;
          localVideo.current.playsInline = true;
          localVideo.current.autoplay = true;

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

// Component for the main video display when showing a remote participant
const MainVideoComponent: React.FC<{ stream: MediaStream | null }> = ({
  stream,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    }
  }, [stream]);

  if (!stream) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#343a40",
          color: "white",
        }}
      >
        No video available
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
};

// Component for participant thumbnails in the sidebar
const ParticipantThumbnail: React.FC<{
  isLocal: boolean;
  stream: MediaStream | null | undefined;
  userId: string;
  displayName: string;
  isHost: boolean;
  isActive: boolean;
  onClick: () => void;
  isMuted?: boolean;
  isVideoOff?: boolean;
}> = ({
  isLocal,
  stream,
  userId,
  displayName,
  isHost,
  isActive,
  onClick,
  isMuted,
  isVideoOff,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;

      if (!isLocal) {
        // Add error handling for remote video
        videoRef.current.onloadedmetadata = () => {
          console.log(`Remote video metadata loaded for ${displayName}`);
        };

        videoRef.current.onerror = (error) => {
          console.error(`Remote video error for ${displayName}:`, error);
        };

        videoRef.current.play().catch((error) => {
          console.error(
            `Failed to play remote video for ${displayName}:`,
            error
          );
        });
      } else {
        // For local video, ensure it's muted and auto-plays
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.autoplay = true;
      }
    }
  }, [stream, isLocal, displayName]);

  // Handle video visibility for local video when toggled off
  const showVideo = stream && (!isVideoOff || !isLocal);

  return (
    <div
      onClick={onClick}
      style={{
        marginBottom: "10px",
        cursor: "pointer",
        border: isActive ? "2px solid #0d6efd" : "1px solid #dee2e6",
        borderRadius: "4px",
        overflow: "hidden",
        backgroundColor: "#000",
        position: "relative",
        height: "120px",
      }}
    >
      {/* Video thumbnail */}
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: isLocal ? "scaleX(-1)" : "none", // Mirror only local video
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#6c757d",
            color: "white",
            fontSize: "24px",
          }}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Name label */}
      <div
        style={{
          position: "absolute",
          bottom: "0",
          left: "0",
          right: "0",
          backgroundColor: "rgba(0,0,0,0.5)",
          color: "white",
          padding: "2px 5px",
          fontSize: "12px",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {isLocal ? "You" : displayName} {isHost && "👑"}
      </div>

      {/* Status indicators */}
      <div
        style={{
          position: "absolute",
          top: "5px",
          left: "5px",
          display: "flex",
          gap: "5px",
        }}
      >
        {/* Audio status indicator */}
        {isLocal && isMuted && (
          <div
            style={{
              backgroundColor: "rgba(220,53,69,0.8)",
              color: "white",
              borderRadius: "50%",
              width: "20px",
              height: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
            }}
          >
            🔇
          </div>
        )}

        {/* Video status indicator */}
        {isLocal && isVideoOff && (
          <div
            style={{
              backgroundColor: "rgba(220,53,69,0.8)",
              color: "white",
              borderRadius: "50%",
              width: "20px",
              height: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
            }}
          >
            📵
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
