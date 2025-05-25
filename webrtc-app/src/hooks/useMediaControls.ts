import { useCallback } from "react";
import {
  startMediaStream,
  toggleAudioTrack,
  attachStreamToVideo,
} from "../utils/mediaUtils";

interface UseMediaControlsProps {
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  localVideo: React.MutableRefObject<HTMLVideoElement | null>;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  isVideoOff: boolean;
  setIsVideoOff: React.Dispatch<React.SetStateAction<boolean>>;
  setIsCopied: React.Dispatch<React.SetStateAction<boolean>>;
  broadcastMediaStatus?: (isMuted: boolean, isVideoOff: boolean) => void;
}

export const useMediaControls = ({
  localStreamRef,
  localVideo,
  isMuted,
  setIsMuted,
  isVideoOff,
  setIsVideoOff,
  setIsCopied,
  broadcastMediaStatus,
}: UseMediaControlsProps) => {
  const startMedia = useCallback(async () => {
    try {
      const stream = await startMediaStream();
      localStreamRef.current = stream;

      if (localVideo.current) {
        await attachStreamToVideo(stream, localVideo);
      }

      console.log("Local media started successfully");
    } catch (error) {
      console.error("Error starting local media:", error);
      throw error;
    }
  }, [localStreamRef, localVideo]);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      toggleAudioTrack(localStreamRef, isMuted, setIsMuted);

      // Broadcast the new audio status to other participants
      if (broadcastMediaStatus) {
        broadcastMediaStatus(!isMuted, isVideoOff);
      }
    }
  }, [localStreamRef, isMuted, setIsMuted, broadcastMediaStatus, isVideoOff]);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);

      // Broadcast the new video status to other participants
      if (broadcastMediaStatus) {
        broadcastMediaStatus(isMuted, !isVideoOff);
      }
    }
  }, [
    localStreamRef,
    isVideoOff,
    setIsVideoOff,
    broadcastMediaStatus,
    isMuted,
  ]);

  const switchToMainView = useCallback((participantId: string | null) => {
    // This will be handled by the parent component that uses this hook
    return participantId;
  }, []);

  const copyMeetingId = useCallback(
    (meetingId: string | null) => {
      if (meetingId) {
        navigator.clipboard.writeText(meetingId);
        setIsCopied(true);
        // Reset the copied state after 2 seconds
        setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      }
    },
    [setIsCopied]
  );

  return {
    startMedia,
    toggleAudio,
    toggleVideo,
    switchToMainView,
    copyMeetingId,
  };
};
