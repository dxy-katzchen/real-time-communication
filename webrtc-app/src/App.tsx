import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";

function App() {
  const [room, setRoom] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Not connected");
  const [iceStatus, setIceStatus] = useState("");
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const newSocket = io("http://localhost:5002", {
      transports: ["websocket", "polling", "flashsocket"],
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

  // Setup media stream early
  useEffect(() => {
    if (inRoom) {
      startMedia();
    }

    return () => {
      // Cleanup media when leaving room
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [inRoom]);

  // Setup WebRTC event listeners when in a room
  useEffect(() => {
    if (!inRoom || !socketRef.current) return;

    // Track message processing to avoid duplicates
    const processedMsgIds = new Set();

    // Setup event handlers for WebRTC signaling
    const handleUserJoined = async () => {
      console.log("User joined, creating offer");
      if (peerConnection.current) {
        peerConnection.current.close();
      }
      peerConnection.current = createPeer();
      setIceStatus("Setting up connection...");

      try {
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);

        // Add unique ID to each message
        const msgId = Date.now().toString();
        socketRef.current.emit("offer", { offer, room, msgId });
        processedMsgIds.add(msgId);
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
      // Skip if we've already processed this message
      if (processedMsgIds.has(msgId)) {
        console.log("Skipping duplicate offer");
        return;
      }
      processedMsgIds.add(msgId);

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

        // Add unique ID to the answer message
        const responseId = Date.now().toString();
        socketRef.current.emit("answer", { answer, room, msgId: responseId });
        processedMsgIds.add(responseId);
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
      // Skip if we've already processed this message
      if (processedMsgIds.has(msgId)) {
        console.log("Skipping duplicate answer");
        return;
      }
      processedMsgIds.add(msgId);

      console.log(
        "Received answer, signaling state:",
        peerConnection.current?.signalingState
      );

      try {
        // Check if peer connection exists and is in the correct state to receive an answer
        if (peerConnection.current) {
          const state = peerConnection.current.signalingState;

          if (state === "have-local-offer") {
            // This is the correct state to process an answer
            await peerConnection.current.setRemoteDescription(
              new RTCSessionDescription(answer)
            );
            setIceStatus(
              "Connection answer received, establishing connection..."
            );
          } else if (state === "stable") {
            // Already in stable state, just ignore the answer
            console.log("Ignoring answer - already in stable state");
          } else {
            console.warn(
              `Ignoring answer - connection in wrong state: ${state}`
            );
            setIceStatus(`Cannot process answer in state: ${state}`);

            // Reset connection if in an unexpected state
            if (
              state === "have-remote-offer" ||
              state === "have-remote-pranswer"
            ) {
              console.log("Resetting connection due to invalid state");
              peerConnection.current.close();
              peerConnection.current = createPeer();
              socketRef.current.emit("join", { room }); // Reinitiate connection
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

    // Register event handlers
    socketRef.current.on("user-joined", handleUserJoined);
    socketRef.current.on("offer", handleOffer);
    socketRef.current.on("answer", handleAnswer);
    socketRef.current.on("ice-candidate", handleIceCandidate);

    // Join the room
    socketRef.current.emit("join", { room });

    // Cleanup function to remove event listeners
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

        // If we have a connection but no remote video, try to restart
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
    // Add TURN servers to configuration
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
        remoteVideo.current.srcObject = event.streams[0];

        // Force play after a short delay to handle autoplay restrictions
        setTimeout(() => {
          if (remoteVideo.current) {
            remoteVideo.current
              .play()
              .then(() => console.log("Remote video playing"))
              .catch((err) => {
                console.error("Error playing remote video:", err);
                setIceStatus("Error playing remote video: " + err.message);
              });
          }
        }, 1000);

        // Monitor track status for debugging
        event.track.onunmute = () =>
          console.log("Track unmuted:", event.track.kind);
        event.track.onmute = () =>
          console.log("Track muted:", event.track.kind);
        event.track.onended = () =>
          console.log("Track ended:", event.track.kind);
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

          // Try ICE restart
          if (peerConnection.current) {
            const restartConnection = async () => {
              try {
                if (peerConnection.current?.signalingState === "stable") {
                  // Create a new offer with iceRestart flag
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
                  processedMsgIds.add(restartMsgId);
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

    // Add local tracks to the peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    return pc;
  }

  async function startMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;

      if (localVideo.current) {
        localVideo.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing media devices:", error);
      alert("Failed to access camera or microphone. Please check permissions.");
    }
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
