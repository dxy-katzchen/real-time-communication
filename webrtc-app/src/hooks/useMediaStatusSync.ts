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
  const lastEmittedStatus = useRef<{
    isMuted: boolean;
    isVideoOff: boolean;
    isScreenSharing: boolean;
  }>({
    isMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
  });

  // Emit media status update to other participants
  const broadcastMediaStatus = useCallback(
    (
      isMuted: boolean,
      isVideoOff: boolean,
      isScreenSharing: boolean = false
    ) => {
      if (
        !socketRef.current ||
        !meetingId ||
        !userId ||
        (lastEmittedStatus.current.isMuted === isMuted &&
          lastEmittedStatus.current.isVideoOff === isVideoOff &&
          lastEmittedStatus.current.isScreenSharing === isScreenSharing)
      ) {
        return;
      }

      console.log(
        `Broadcasting media status: muted=${isMuted}, video_off=${isVideoOff}, screen_sharing=${isScreenSharing}`
      );

      socketRef.current.emit("media-status-update", {
        room: meetingId,
        userId: userId,
        isMuted: isMuted,
        isVideoOff: isVideoOff,
        isScreenSharing: isScreenSharing,
      });

      // Update last emitted status
      lastEmittedStatus.current = { isMuted, isVideoOff, isScreenSharing };
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
      isScreenSharing?: boolean;
    }) => {
      console.log(
        `Received media status update from ${data.userId}: muted=${
          data.isMuted
        }, video_off=${data.isVideoOff}, screen_sharing=${
          data.isScreenSharing || false
        }`
      );

      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        const participant = updated.get(data.socketId);

        if (participant) {
          participant.isMuted = data.isMuted;
          participant.isVideoOff = data.isVideoOff;
          participant.isScreenSharing = data.isScreenSharing || false;
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
