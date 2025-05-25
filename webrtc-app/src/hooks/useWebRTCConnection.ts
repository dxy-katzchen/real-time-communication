import { useRef, useCallback, useState } from "react";
import type { Participant } from "../types";

interface UseWebRTCConnectionProps {
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  socketRef: React.MutableRefObject<any>;
  userId: string | null;
  setRemoteParticipants: React.Dispatch<
    React.SetStateAction<Map<string, Participant>>
  >;
}

export const useWebRTCConnection = ({
  localStreamRef,
  socketRef,
  userId,
  setRemoteParticipants,
}: UseWebRTCConnectionProps) => {
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [connectionTimeouts, setConnectionTimeouts] = useState<
    Map<string, NodeJS.Timeout>
  >(new Map());
  const connectionStartTimes = useRef<Map<string, number>>(new Map());

  // Function to clear connection timeout
  const clearConnectionTimeout = useCallback(
    (participantSocketId: string) => {
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
    },
    [connectionTimeouts]
  );

  // Recreate connection function
  const recreateConnection = useCallback(
    async (participantSocketId: string) => {
      console.log(`Recreating connection for ${participantSocketId}`);

      clearConnectionTimeout(participantSocketId);

      const oldPc = peerConnections.current.get(participantSocketId);
      if (oldPc) {
        oldPc.close();
        peerConnections.current.delete(participantSocketId);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const pc = createPeerConnection(participantSocketId, true);

      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        const existingParticipant = updated.get(participantSocketId);
        if (existingParticipant) {
          existingParticipant.peerConnection = pc;
          existingParticipant.stream = undefined;
          updated.set(participantSocketId, existingParticipant);
        }
        return updated;
      });

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
    },
    [clearConnectionTimeout, socketRef, userId, setRemoteParticipants]
  );

  // Handle connection timeout
  const handleConnectionTimeout = useCallback(
    async (participantSocketId: string) => {
      console.log(`Handling connection timeout for ${participantSocketId}`);

      const pc = peerConnections.current.get(participantSocketId);
      if (!pc) return;

      const connectionState = pc.iceConnectionState;
      console.log(`Connection state during timeout: ${connectionState}`);

      if (connectionState === "checking" || connectionState === "new") {
        console.log(
          `Connection stuck in ${connectionState} state, forcing reconnect...`
        );
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
    },
    [clearConnectionTimeout, recreateConnection]
  );

  const createPeerConnection = useCallback(
    (participantSocketId: string, isInitiator: boolean = false) => {
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

      // Set up 5-second timeout for connection
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
          
          console.log(`Stream details for ${participantSocketId}:`, {
            streamId: stream.id,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            active: stream.active,
            tracks: stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState }))
          });

          // Clear connection timeout on successful track reception
          clearConnectionTimeout(participantSocketId);

          // Add stream event listeners
          stream.getTracks().forEach((track) => {
            track.onended = () => {
              console.log(
                `Track ended for ${participantSocketId}:`,
                track.kind
              );
            };

            track.onmute = () => {
              console.log(
                `Track muted for ${participantSocketId}:`,
                track.kind
              );
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
            let participant = updated.get(participantSocketId);
            
            // If participant doesn't exist, create a basic entry
            // This handles race conditions where stream arrives before participant setup
            if (!participant) {
              console.log(`Creating participant entry for ${participantSocketId} due to incoming stream`);
              participant = {
                userId: participantSocketId, // Will be updated later when we get proper user info
                socketId: participantSocketId,
                peerConnection: pc,
                stream: stream,
              };
              updated.set(participantSocketId, participant);
            } else {
              // Update existing participant with stream
              participant.stream = stream;
              updated.set(participantSocketId, participant);
            }
            
            console.log(`Updated stream for ${participantSocketId}`, {
              videoTracks: stream.getVideoTracks().length,
              audioTracks: stream.getAudioTracks().length,
              participantExists: !!participant,
            });
            
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
            clearConnectionTimeout(participantSocketId);
            break;

          case "failed":
            console.log(
              `Connection failed with ${participantSocketId}, attempt ${
                connectionAttempts + 1
              }/${maxAttempts}`
            );
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
    },
    [
      localStreamRef,
      socketRef,
      userId,
      setRemoteParticipants,
      connectionTimeouts,
      handleConnectionTimeout,
      clearConnectionTimeout,
      recreateConnection,
    ]
  );

  const handleOffer = useCallback(
    async (data: {
      offer: RTCSessionDescriptionInit;
      fromSocket: string;
      fromUserId: string;
      msgId: string;
    }) => {
      console.log("Received offer from:", data.fromSocket);

      let pc = peerConnections.current.get(data.fromSocket);
      if (!pc) {
        pc = createPeerConnection(data.fromSocket, false);
      }

      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        const existingParticipant = updated.get(data.fromSocket);
        
        if (existingParticipant) {
          // Update existing participant with proper user info and peer connection
          console.log(`Updating existing participant ${data.fromSocket} with offer data`);
          existingParticipant.userId = data.fromUserId;
          existingParticipant.peerConnection = pc;
          updated.set(data.fromSocket, existingParticipant);
        } else {
          // Create new participant
          updated.set(data.fromSocket, {
            userId: data.fromUserId,
            socketId: data.fromSocket,
            peerConnection: pc,
          });
        }
        
        return updated;
      });

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
    },
    [createPeerConnection, setRemoteParticipants, socketRef, userId]
  );

  const handleAnswer = useCallback(
    async (data: {
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
    },
    []
  );

  const handleIceCandidate = useCallback(
    async (data: {
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
    },
    []
  );

  const handleUserJoined = useCallback(
    async (data: { userId: string; socketId: string }) => {
      console.log("User joined:", data);

      const pc = createPeerConnection(data.socketId, true);

      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        const existingParticipant = updated.get(data.socketId);
        
        if (existingParticipant) {
          // Merge with existing participant (keep existing stream if present)
          console.log(`Updating existing participant ${data.socketId} with proper user info`);
          existingParticipant.userId = data.userId;
          existingParticipant.peerConnection = pc;
          updated.set(data.socketId, existingParticipant);
        } else {
          // Create new participant
          updated.set(data.socketId, {
            userId: data.userId,
            socketId: data.socketId,
            peerConnection: pc,
          });
        }
        
        return updated;
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

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
    },
    [createPeerConnection, setRemoteParticipants, socketRef, userId]
  );

  const handleUserLeft = useCallback(
    (data: { userId: string; socketId: string }) => {
      console.log("User left:", data);

      const pc = peerConnections.current.get(data.socketId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(data.socketId);
      }

      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        updated.delete(data.socketId);
        return updated;
      });
    },
    [setRemoteParticipants]
  );

  const handleExistingParticipants = useCallback(
    async (data: { participants: Participant[] }) => {
      console.log("Existing participants:", data.participants);

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
    },
    [createPeerConnection, setRemoteParticipants]
  );

  const handleReconnect = useCallback(async () => {
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

      console.log("Reconnect initiated successfully");
    } catch (error) {
      console.error("Error during reconnect:", error);
      alert("Failed to reconnect. Please try again.");
    }
  }, [connectionTimeouts, setRemoteParticipants]);

  const cleanupConnections = useCallback(() => {
    // Clear all connection timeouts
    connectionTimeouts.forEach((timeout) => clearTimeout(timeout));
    setConnectionTimeouts(new Map());
    connectionStartTimes.current.clear();

    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
  }, [connectionTimeouts]);

  return {
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handleUserJoined,
    handleUserLeft,
    handleExistingParticipants,
    handleReconnect,
    cleanupConnections,
    peerConnections,
    connectionTimeouts,
    setConnectionTimeouts,
    connectionStartTimes,
  };
};
