import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";
import Auth from "./Components/Auth";
import MeetingLobby from "./Components/MeetingLobby";

function App() {
  // User and Meeting state
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);

  const processedMsgIdsRef = useRef<Set<string>>(new Set());
  const [room, setRoom] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Not connected");
  const [iceStatus, setIceStatus] = useState("");
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);

  // Handle user creation/login
  const handleUserCreated = (userId: string, username: string) => {
    setUserId(userId);
    setUsername(username);

    // Load from localStorage if available
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
    localStorage.setItem("lastMeetingId", newMeetingId);
  };

  // Handle joining a meeting
  const handleJoinMeeting = (meetingIdToJoin: string) => {
    setMeetingId(meetingIdToJoin);
    setRoom(meetingIdToJoin);
    setInRoom(true);
    localStorage.setItem("lastMeetingId", meetingIdToJoin);
  };

  const handleEndMeeting = async () => {
    if (!meetingId || !userId) return;

    setIsEndingMeeting(true);

    try {
      // First try the REST endpoint
      const response = await fetch(
        `http://localhost:5002/api/meetings/${meetingId}/end`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error ending meeting:", errorData.error);
        alert(`Failed to end meeting: ${errorData.error}`);
        setIsEndingMeeting(false); // Reset flag on error
        return;
      }

      // Also emit a socket event as a backup mechanism
      socketRef.current.emit("end-meeting", {
        room: meetingId,
        userId,
      });

      // Handle UI updates
      alert("Meeting ended successfully");
      handleLeaveMeeting(); // Reuse leave meeting logic
    } catch (err) {
      console.error("Error ending meeting:", err);
      alert("Network error when ending meeting. Please try again.");
      setIsEndingMeeting(false); // Reset flag on error
    }
  };
  // Leave meeting handler
  const handleLeaveMeeting = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    setInRoom(false);
    setMeetingId(null);
    localStorage.removeItem("lastMeetingId");
  };

  useEffect(() => {
    if (!socketRef.current) return;

    const handleMeetingEnded = (data: { meetingId: string }) => {
      if (data.meetingId === meetingId) {
        // Only show the alert if we're not the one ending the meeting
        if (!isEndingMeeting) {
          alert("This meeting has been ended by the host");
        }
        handleLeaveMeeting();
      }
    };

    socketRef.current.on("meeting-ended", handleMeetingEnded);

    return () => {
      if (socketRef.current) {
        socketRef.current.off("meeting-ended", handleMeetingEnded);
      }
    };
  }, [meetingId, isEndingMeeting]);

  // Load participants when meeting is joined
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
      // Set up an interval to periodically refresh the participant list
      const intervalId = setInterval(fetchParticipants, 10000);

      return () => clearInterval(intervalId);
    }
  }, [meetingId, inRoom]);

  useEffect(() => {
    // Try to reconnect socket if it fails
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

  useEffect(() => {
    if (inRoom) {
      startMedia();
    }

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [inRoom]);

  useEffect(() => {
    if (!inRoom || !socketRef.current) return;

    processedMsgIdsRef.current.clear();

    const handleUserJoined = async () => {
      console.log("User joined, creating offer");

      // Ensure media is ready before proceeding
      if (!localStreamRef.current) {
        console.log("Waiting for local media before creating offer");
        await startMedia();
      }

      // Create new peer connection
      if (peerConnection.current) {
        peerConnection.current.close();
      }
      peerConnection.current = createPeer();
      setIceStatus("Setting up connection...");

      // Small delay to ensure peer connection is fully initialized
      await new Promise((resolve) => setTimeout(resolve, 500));

      try {
        // Explicitly check that tracks are added
        if (localStreamRef.current) {
          const trackCount = localStreamRef.current.getTracks().length;
          console.log(`Adding ${trackCount} tracks to peer connection`);
        }

        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);

        const msgId = Date.now().toString();
        socketRef.current.emit("offer", { offer, room, msgId });
        processedMsgIdsRef.current.add(msgId);
      } catch (error) {
        console.error("Error creating offer:", error);
        setIceStatus("Failed to create connection offer");
      }
    };

    const handleOffer = async ({
      offer,
      msgId,
    }: {
      offer: RTCSessionDescriptionInit;
      msgId: string;
    }) => {
      if (processedMsgIdsRef.current.has(msgId)) {
        console.log("Skipping duplicate offer");
        return;
      }
      processedMsgIdsRef.current.add(msgId);

      console.log("Received offer, creating answer", {
        signalingState: peerConnection.current?.signalingState,
      });
      if (peerConnection.current) {
        peerConnection.current.close();
      }
      peerConnection.current = createPeer();
      setIceStatus("Received connection offer...");

      try {
        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(offer)
        );
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);

        const responseId = Date.now().toString();
        socketRef.current.emit("answer", { answer, room, msgId: responseId });
        processedMsgIdsRef.current.add(responseId);
      } catch (error) {
        console.error("Error handling offer:", error);
        setIceStatus("Failed to create connection answer");
      }
    };

    const handleAnswer = async ({
      answer,
      msgId,
    }: {
      answer: RTCSessionDescriptionInit;
      msgId: string;
    }) => {
      if (processedMsgIdsRef.current.has(msgId)) {
        console.log("Skipping duplicate answer");
        return;
      }
      processedMsgIdsRef.current.add(msgId);

      console.log(
        "Received answer, signaling state:",
        peerConnection.current?.signalingState
      );

      try {
        if (peerConnection.current) {
          const state = peerConnection.current.signalingState;

          if (state === "have-local-offer") {
            await peerConnection.current.setRemoteDescription(
              new RTCSessionDescription(answer)
            );
            setIceStatus(
              "Connection answer received, establishing connection..."
            );
          } else if (state === "stable") {
            console.log("Ignoring answer - already in stable state");
          } else {
            console.warn(
              `Ignoring answer - connection in wrong state: ${state}`
            );
            setIceStatus(`Cannot process answer in state: ${state}`);

            if (
              state === "have-remote-offer" ||
              state === "have-remote-pranswer"
            ) {
              console.log("Resetting connection due to invalid state");
              peerConnection.current.close();
              peerConnection.current = createPeer();
              socketRef.current.emit("join", { room });
            }
          }
        } else {
          console.warn("Ignoring answer - no peer connection");
        }
      } catch (error) {
        console.error("Error handling answer:", error);
        if (error instanceof Error) {
          setIceStatus(`Failed to process connection answer: ${error.message}`);
        } else {
          setIceStatus("Failed to process connection answer: Unknown error");
        }
      }
    };

    const handleIceCandidate = ({
      candidate,
    }: {
      candidate: RTCIceCandidateInit;
    }) => {
      if (candidate && peerConnection.current) {
        try {
          peerConnection.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    };

    socketRef.current.on("user-joined", handleUserJoined);
    socketRef.current.on("offer", handleOffer);
    socketRef.current.on("answer", handleAnswer);
    socketRef.current.on("ice-candidate", handleIceCandidate);

    socketRef.current.emit("join", { room });

    return () => {
      socketRef.current.off("user-joined", handleUserJoined);
      socketRef.current.off("offer", handleOffer);
      socketRef.current.off("answer", handleAnswer);
      socketRef.current.off("ice-candidate", handleIceCandidate);

      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
      setIceStatus("");
    };
  }, [inRoom, room]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && inRoom) {
        console.log("Tab became visible, checking connection...");

        if (
          peerConnection.current &&
          peerConnection.current.connectionState !== "connected" &&
          (!remoteVideo.current || !remoteVideo.current.srcObject)
        ) {
          console.log("No remote video, attempting reconnection");
          socketRef.current.emit("join", { room });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [inRoom, room]);

  const handleJoinRoom = () => {
    if (socketRef.current?.connected) {
      setInRoom(true);
    } else {
      alert("Socket not connected. Cannot join room.");
    }
  };

  function createPeer() {
    const pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.relay.metered.ca:80",
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
      ],
      iceCandidatePoolSize: 10,
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("ice-candidate", {
          candidate: event.candidate,
          room,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("Received remote track:", event.track.kind, event.streams);

      if (remoteVideo.current && event.streams && event.streams[0]) {
        console.log("Setting remote stream");

        // Store the remote stream for reconnection purposes
        if (event.track.kind === "video") {
          console.log("Remote video track received");

          // Set srcObject and immediately attempt to play
          remoteVideo.current.srcObject = event.streams[0];

          // Try playing immediately and also with a backup timeout
          remoteVideo.current
            .play()
            .then(() => console.log("Remote video playing immediately"))
            .catch((err) => {
              console.log("Will retry playing in timeout", err);
              // Continue with the timeout approach as fallback
            });

          // Backup timeout for browsers with autoplay restrictions
          setTimeout(() => {
            if (remoteVideo.current && remoteVideo.current.paused) {
              console.log(
                "Attempting to play remote video again after timeout"
              );
              remoteVideo.current
                .play()
                .then(() => console.log("Remote video playing after timeout"))
                .catch((err) => {
                  console.error(
                    "Error playing remote video after timeout:",
                    err
                  );
                  setIceStatus("Error playing remote video: " + err.message);
                });
            }
          }, 1000);
        }

        // Monitor track status for debugging
        event.track.onunmute = () => {
          console.log("Track unmuted:", event.track.kind);
          // Try to play again when unmuted
          if (
            event.track.kind === "video" &&
            remoteVideo.current &&
            remoteVideo.current.paused
          ) {
            remoteVideo.current
              .play()
              .then(() => console.log("Video playing after unmute"))
              .catch((err) =>
                console.error("Failed to play after unmute:", err)
              );
          }
        };
      } else {
        console.warn("Remote video element or stream not available", {
          videoElement: !!remoteVideo.current,
          streams: !!event.streams,
          hasStream: event.streams && event.streams.length > 0,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log("ICE connection state:", state);

      switch (state) {
        case "checking":
          setIceStatus("Connecting...");
          break;
        case "connected":
          setIceStatus("Connected");
          break;
        case "completed":
          setIceStatus("Connection established");
          break;
        case "failed":
          setIceStatus("Connection failed - attempting to reconnect");
          console.warn(
            "ICE Connection failed. Attempting to restart connection."
          );

          if (peerConnection.current) {
            const restartConnection = async () => {
              try {
                if (peerConnection.current?.signalingState === "stable") {
                  const restartOffer = await peerConnection.current.createOffer(
                    {
                      iceRestart: true,
                    }
                  );
                  await peerConnection.current.setLocalDescription(
                    restartOffer
                  );

                  const restartMsgId = `restart-${Date.now()}`;
                  socketRef.current.emit("offer", {
                    offer: restartOffer,
                    room,
                    msgId: restartMsgId,
                  });
                  processedMsgIdsRef.current.add(restartMsgId);
                }
              } catch (err) {
                console.error("Failed to restart ICE:", err);
                setIceStatus("Connection failed - please refresh the page");
              }
            };

            restartConnection();
          }
          break;
        case "disconnected":
          setIceStatus("Disconnected - attempting to reconnect");
          break;
        case "closed":
          setIceStatus("Connection closed");
          break;
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    return pc;
  }

  async function startMedia() {
    try {
      // Check if we already have media
      if (localStreamRef.current) {
        console.log("Using existing local stream");
        return localStreamRef.current;
      }

      console.log("Requesting access to local media");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      console.log(
        "Local media obtained",
        stream.getTracks().map((t) => t.kind)
      );
      localStreamRef.current = stream;

      if (localVideo.current) {
        localVideo.current.srcObject = stream;
        try {
          await localVideo.current.play();
          console.log("Local video playing");
        } catch (err) {
          console.warn("Could not autoplay local video:", err);
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
        }}
      >
        Socket Status: {connectionStatus}
      </div>
      {!inRoom ? (
        <div>
          <h2>Enter Room Number</h2>
          <input value={room} onChange={(e) => setRoom(e.target.value)} />
          <button
            onClick={handleJoinRoom}
            disabled={connectionStatus !== "Connected"}
          >
            Join Room
          </button>
        </div>
      ) : (
        <div>
          <h3>Room: {room}</h3>

          <div
            style={{
              padding: "8px",
              marginBottom: "10px",
              backgroundColor:
                iceStatus === "Connection established" ||
                iceStatus === "Connected"
                  ? "#d4edda"
                  : iceStatus.includes("failed")
                  ? "#f8d7da"
                  : "#fff3cd",
            }}
          >
            WebRTC Status: {iceStatus}
          </div>
          <div style={{ marginTop: "20px" }}>
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
          <div style={{ display: "flex", gap: "20px" }}>
            <div>
              <h4>Local Video</h4>
              <video
                autoPlay
                muted
                ref={localVideo}
                style={{ width: 300, border: "1px solid #ccc" }}
              ></video>
            </div>
            <div>
              <h4>Remote Video</h4>
              <video
                autoPlay
                playsInline
                ref={remoteVideo}
                style={{ width: 300, border: "1px solid #ccc" }}
              ></video>
            </div>
          </div>
          <div style={{ marginTop: "15px" }}>
            <button
              onClick={handleLeaveMeeting}
              style={{
                padding: "8px 15px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Leave Room
            </button>
            {participants.some((p) => p.userId === userId && p.isHost) && (
              <button
                onClick={handleEndMeeting}
                style={{
                  padding: "8px 15px",
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  marginLeft: "10px",
                }}
              >
                End Meeting For All
              </button>
            )}
            <button
              style={{
                padding: "8px 15px",
                backgroundColor: "#9fdc35",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
              onClick={() => {
                if (peerConnection.current) {
                  peerConnection.current.close();
                  peerConnection.current = createPeer();
                }
                socketRef.current.emit("join", { room });
                setIceStatus("Reconnecting...");
              }}
            >
              Reconnect Video
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
