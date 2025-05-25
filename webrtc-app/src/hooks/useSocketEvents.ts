import { useCallback } from "react";
import { Socket } from "socket.io-client";
import type { Participant } from "../types";

interface UseSocketEventsProps {
  socketRef: React.MutableRefObject<Socket | null>;
  userId: string | null;
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  peerConnections: React.MutableRefObject<Map<string, RTCPeerConnection>>;
  setRemoteParticipants: React.Dispatch<
    React.SetStateAction<Map<string, Participant>>
  >;
  createPeerConnection: (
    participantSocketId: string,
    isInitiator?: boolean
  ) => RTCPeerConnection;
  startMedia: () => Promise<void>;
}

export const useSocketEvents = ({
  socketRef,
  userId,
  localStreamRef,
  peerConnections,
  setRemoteParticipants,
  createPeerConnection,
  startMedia,
}: UseSocketEventsProps) => {
  const handleUserJoined = useCallback(
    async (data: { userId: string; socketId: string }) => {
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
    },
    [
      localStreamRef,
      startMedia,
      createPeerConnection,
      setRemoteParticipants,
      socketRef,
      userId,
    ]
  );

  const handleUserLeft = useCallback(
    (data: { userId: string; socketId: string }) => {
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
    },
    [peerConnections, setRemoteParticipants]
  );

  const handleExistingParticipants = useCallback(
    async (data: { participants: Participant[] }) => {
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
    },
    [localStreamRef, startMedia, createPeerConnection, setRemoteParticipants]
  );

  const handleOffer = useCallback(
    async (data: {
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
    },
    [
      localStreamRef,
      startMedia,
      peerConnections,
      createPeerConnection,
      setRemoteParticipants,
      socketRef,
      userId,
    ]
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
    [peerConnections]
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
    [peerConnections]
  );

  return {
    handleUserJoined,
    handleUserLeft,
    handleExistingParticipants,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
  };
};
