import { useCallback, useRef } from "react";
import { Socket } from "socket.io-client";
import type { Participant } from "../types";

interface UseMediaStatusSyncProps {
  socketRef: React.MutableRefObject<Socket | null>;
  meetingId: string | null;
  userId: string | null;
  setRemoteParticipants: React.Dispatch<
    React.SetStateAction<Map<string, Participant>>
  >;
}

export const useMediaStatusSync = ({
  socketRef,
  meetingId,
  userId,
  setRemoteParticipants,
}: UseMediaStatusSyncProps) => {
  // Track the last emitted status to avoid unnecessary broadcasts
  const lastEmittedStatus = useRef<{ isMuted: boolean; isVideoOff: boolean }>({
    isMuted: false,
    isVideoOff: false,
  });

  // Emit media status update to other participants
  const broadcastMediaStatus = useCallback(
    (isMuted: boolean, isVideoOff: boolean) => {
      if (
        !socketRef.current ||
        !meetingId ||
        !userId ||
        (lastEmittedStatus.current.isMuted === isMuted &&
          lastEmittedStatus.current.isVideoOff === isVideoOff)
      ) {
        return;
      }

      console.log(
        `Broadcasting media status: muted=${isMuted}, video_off=${isVideoOff}`
      );

      socketRef.current.emit("media-status-update", {
        room: meetingId,
        userId: userId,
        isMuted: isMuted,
        isVideoOff: isVideoOff,
      });

      // Update last emitted status
      lastEmittedStatus.current = { isMuted, isVideoOff };
    },
    [socketRef, meetingId, userId]
  );

  // Handle incoming media status changes from other participants
  const handleMediaStatusChanged = useCallback(
    (data: {
      userId: string;
      socketId: string;
      isMuted: boolean;
      isVideoOff: boolean;
    }) => {
      console.log(
        `Received media status update from ${data.userId}: muted=${data.isMuted}, video_off=${data.isVideoOff}`
      );

      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        const participant = updated.get(data.socketId);

        if (participant) {
          participant.isMuted = data.isMuted;
          participant.isVideoOff = data.isVideoOff;
          updated.set(data.socketId, participant);
          console.log(`Updated media status for participant ${data.userId}`);
        } else {
          console.warn(
            `Participant ${data.socketId} not found for media status update`
          );
        }

        return updated;
      });
    },
    [setRemoteParticipants]
  );

  return {
    broadcastMediaStatus,
    handleMediaStatusChanged,
  };
};
