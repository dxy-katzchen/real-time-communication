import { useCallback } from "react";
import { Socket } from "socket.io-client";
import type { Participant } from "../types";
import { CONNECTION_CONFIG } from "../constants/webrtc";
import { clearConnectionTimeout } from "../utils/webrtcUtils";

interface UseConnectionManagementProps {
  socketRef: React.MutableRefObject<Socket | null>;
  userId: string | null;
  peerConnections: React.MutableRefObject<Map<string, RTCPeerConnection>>;
  remoteParticipants: Map<string, Participant>;
  setRemoteParticipants: React.Dispatch<
    React.SetStateAction<Map<string, Participant>>
  >;
  connectionTimeouts: Map<string, NodeJS.Timeout>;
  setConnectionTimeouts: React.Dispatch<
    React.SetStateAction<Map<string, NodeJS.Timeout>>
  >;

  connectionStartTimes: React.MutableRefObject<Map<string, number>>;
  createPeerConnection: (
    participantSocketId: string,
    isInitiator?: boolean
  ) => RTCPeerConnection;
}

export const useConnectionManagement = ({
  socketRef,
  userId,
  peerConnections,
  remoteParticipants,
  setRemoteParticipants,
  connectionTimeouts,
  setConnectionTimeouts,
  connectionStartTimes,
  createPeerConnection,
}: UseConnectionManagementProps) => {
  const handleConnectionTimeout = useCallback(
    async (participantSocketId: string) => {
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
        clearConnectionTimeout(
          participantSocketId,
          connectionTimeouts,
          setConnectionTimeouts,
          connectionStartTimes
        );
      }
    },
    [
      peerConnections,
      connectionTimeouts,
      setConnectionTimeouts,
      connectionStartTimes,
    ]
  );

  const recreateConnection = useCallback(
    async (participantSocketId: string) => {
      console.log(`Recreating connection for ${participantSocketId}`);

      // Clear any existing timeout
      clearConnectionTimeout(
        participantSocketId,
        connectionTimeouts,
        setConnectionTimeouts,
        connectionStartTimes
      );

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
      await new Promise((resolve) =>
        setTimeout(resolve, CONNECTION_CONFIG.RECREATE_DELAY)
      );

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
      }, CONNECTION_CONFIG.OFFER_DELAY);
    },
    [
      connectionTimeouts,
      setConnectionTimeouts,
      connectionStartTimes,
      peerConnections,
      remoteParticipants,
      setRemoteParticipants,
      createPeerConnection,
      socketRef,
      userId,
    ]
  );

  return {
    handleConnectionTimeout,
    recreateConnection,
  };
};
