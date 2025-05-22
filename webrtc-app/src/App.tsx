import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";

function App() {
  const [room, setRoom] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Not connected");
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    const newSocket = io("http://localhost:5000", {
      transports: ["polling", "websocket"],
      withCredentials: false,
      reconnectionAttempts: 5,
      autoConnect: true,
      forceNew: true,
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

  const handleJoinRoom = async () => {
    if (socketRef.current?.connected) {
      setInRoom(true);
      socketRef.current.emit("join", { room });

      socketRef.current.on("user-joined", async () => {
        peerConnection.current = createPeer();
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socketRef.current.emit("offer", { offer, room });
      });

      socketRef.current.on(
        "offer",
        async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
          peerConnection.current = createPeer();
          if (peerConnection.current) {
            await peerConnection.current.setRemoteDescription(
              new RTCSessionDescription(offer)
            );
          }
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          socketRef.current.emit("answer", { answer, room });
        }
      );

      socketRef.current.on(
        "answer",
        async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
          await peerConnection.current!.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
        }
      );

      socketRef.current.on(
        "ice-candidate",
        ({ candidate }: { candidate: RTCIceCandidateInit }) => {
          if (candidate && peerConnection.current) {
            peerConnection.current.addIceCandidate(
              new RTCIceCandidate(candidate)
            );
          }
        }
      );

      await startMedia();
    } else {
      alert("Socket not connected. Cannot join room.");
    }
  };

  function createPeer() {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
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
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = event.streams[0];
      }
    };

    (localVideo.current?.srcObject as MediaStream)
      ?.getTracks()
      .forEach((track: MediaStreamTrack) => {
        if (localVideo.current && localVideo.current.srcObject) {
          pc.addTrack(track, localVideo.current.srcObject as MediaStream);
        }
      });

    return pc;
  }

  async function startMedia() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    if (localVideo.current) {
      localVideo.current.srcObject = stream;
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
          <video autoPlay muted ref={localVideo} style={{ width: 300 }}></video>
          <video autoPlay ref={remoteVideo} style={{ width: 300 }}></video>
        </div>
      )}
    </div>
  );
}

export default App;
