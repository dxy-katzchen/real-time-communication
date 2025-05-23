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

  const [room, setRoom] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Not connected");

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

  async function startMedia() {
    try {
      if (localStreamRef.current) {
        console.log("Local stream already exists");
        return localStreamRef.current;
      }

      console.log("Requesting access to local media");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      console.log(
        "Local media obtained:",
        stream.getTracks().map((t) => t.kind)
      );
      localStreamRef.current = stream;

      if (localVideo.current) {
        localVideo.current.srcObject = stream;
        try {
          await localVideo.current.play();
          console.log("Local video playing");
        } catch (playError) {
          console.warn("Could not autoplay local video:", playError);
        }
      }

      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      alert("Failed to access camera or microphone. Please check permissions.");
      return null;
    }
  }

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

  return (
    <div>
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
        <span>Socket Status: {connectionStatus}</span>
        <span>
          Meeting: {meetingId} {isHost && "(Host)"}
        </span>
      </div>

      <div style={{ padding: "20px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h4>Participants ({participants.length})</h4>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {participants.map((p) => (
              <li key={p.userId}>
                {p.displayName || p.username}
                {p.isHost && " (Host)"}
                {p.userId === userId && " (You)"}
              </li>
            ))}
          </ul>
        </div>

        {/* Video Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "20px",
            marginBottom: "20px",
          }}
        >
          {/* Local Video */}
          <div>
            <h4>You ({username})</h4>
            <video
              autoPlay
              muted
              ref={localVideo}
              style={{
                width: "100%",
                maxWidth: "300px",
                border: "2px solid #007bff",
                borderRadius: "8px",
              }}
            />
          </div>

          {/* Remote Videos */}
          {Array.from(remoteParticipants.values()).map((participant) => (
            <RemoteVideoComponent
              key={participant.socketId}
              participant={participant}
              participants={participants}
            />
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
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
            {isHost ? "End Meeting For All" : "Leave Meeting"}
          </button>

          {isHost && (
            <button
              onClick={handleEndMeeting}
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
              Force End Meeting
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Component for rendering remote participant videos
const RemoteVideoComponent: React.FC<{
  participant: Participant;
  participants: any[];
}> = ({ participant, participants }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
      videoRef.current.play().catch(console.error);
    }
  }, [participant.stream]);

  const participantInfo = participants.find(
    (p) => p.userId === participant.userId
  );
  const displayName =
    participantInfo?.displayName || participantInfo?.username || "Unknown";

  return (
    <div>
      <h4>
        {displayName} {participantInfo?.isHost && "(Host)"}
      </h4>

      {/* Show video if stream exists */}
      {participant.stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            width: "100%",
            maxWidth: "300px",
            border: "1px solid #ccc",
            borderRadius: "8px",
            backgroundColor: "#000",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            maxWidth: "300px",
            height: "200px",
            backgroundColor: "#f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #ccc",
            borderRadius: "8px",
          }}
        >
          Connecting...
        </div>
      )}
    </div>
  );
};

export default App;
