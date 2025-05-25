import React, { useCallback } from "react";
import {
  startMediaStream,
  toggleAudioTrack,
  attachStreamToVideo,
  startScreenShare,
  stopScreenShare,
  replaceVideoTrack,
} from "../utils/mediaUtils";

interface UseMediaControlsProps {
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  localVideo: React.MutableRefObject<HTMLVideoElement | null>;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  isVideoOff: boolean;
  setIsVideoOff: React.Dispatch<React.SetStateAction<boolean>>;
  setIsCopied: React.Dispatch<React.SetStateAction<boolean>>;
  isScreenSharing: boolean;
  setIsScreenSharing: React.Dispatch<React.SetStateAction<boolean>>;
  peerConnections: React.MutableRefObject<Map<string, RTCPeerConnection>>;
  broadcastMediaStatus?: (
    isMuted: boolean,
    isVideoOff: boolean,
    isScreenSharing: boolean
  ) => void;
}

export const useMediaControls = ({
  localStreamRef,
  localVideo,
  isMuted,
  setIsMuted,
  isVideoOff,
  setIsVideoOff,
  setIsCopied,
  isScreenSharing,
  setIsScreenSharing,
  peerConnections,
  broadcastMediaStatus,
}: UseMediaControlsProps) => {
  const screenStreamRef = React.useRef<MediaStream | null>(null);
  const originalStreamRef = React.useRef<MediaStream | null>(null);
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
        broadcastMediaStatus(!isMuted, isVideoOff, isScreenSharing);
      }
    }
  }, [
    localStreamRef,
    isMuted,
    setIsMuted,
    broadcastMediaStatus,
    isVideoOff,
    isScreenSharing,
  ]);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);

      // Broadcast the new video status to other participants
      if (broadcastMediaStatus) {
        broadcastMediaStatus(isMuted, !isVideoOff, isScreenSharing);
      }
    }
  }, [
    localStreamRef,
    isVideoOff,
    setIsVideoOff,
    broadcastMediaStatus,
    isMuted,
    isScreenSharing,
  ]);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (!isScreenSharing) {
        // Start screen sharing
        console.log("Starting screen share...");

        // Store original stream
        if (localStreamRef.current) {
          originalStreamRef.current = localStreamRef.current;
        }

        const screenStream = await startScreenShare();
        screenStreamRef.current = screenStream;

        // Get the screen video track
        const screenVideoTrack = screenStream.getVideoTracks()[0];

        if (screenVideoTrack) {
          // Replace video track in all peer connections
          await replaceVideoTrack(peerConnections.current, screenVideoTrack);

          // Create new stream with screen video and original audio
          const newStream = new MediaStream();
          newStream.addTrack(screenVideoTrack);

          // Add original audio tracks if they exist
          if (originalStreamRef.current) {
            originalStreamRef.current.getAudioTracks().forEach((track) => {
              newStream.addTrack(track);
            });
          }

          // Update local stream
          localStreamRef.current = newStream;

          // Update local video display
          if (localVideo.current) {
            await attachStreamToVideo(newStream, localVideo);
          }

          setIsScreenSharing(true);

          // Listen for screen share ending
          screenVideoTrack.onended = async () => {
            console.log("Screen share ended by user");
            await stopScreenSharing();
          };

          console.log("Screen share started successfully");
        }
      } else {
        // Stop screen sharing
        await stopScreenSharing();
      }

      // Broadcast the new screen sharing status
      if (broadcastMediaStatus) {
        broadcastMediaStatus(isMuted, isVideoOff, !isScreenSharing);
      }
    } catch (error) {
      console.error("Error toggling screen share:", error);
      // If screen share failed, make sure we're not in a broken state
      if (isScreenSharing) {
        await stopScreenSharing();
      }
    }
  }, [
    isScreenSharing,
    localStreamRef,
    localVideo,
    peerConnections,
    setIsScreenSharing,
    broadcastMediaStatus,
    isMuted,
    isVideoOff,
  ]);

  const stopScreenSharing = useCallback(async () => {
    console.log("Stopping screen share...");

    try {
      // Stop screen stream
      stopScreenShare(screenStreamRef);

      // Restore original camera stream
      if (originalStreamRef.current) {
        const cameraVideoTrack = originalStreamRef.current.getVideoTracks()[0];

        if (cameraVideoTrack) {
          // Replace screen track with camera track in all peer connections
          await replaceVideoTrack(peerConnections.current, cameraVideoTrack);
        }

        // Restore local stream
        localStreamRef.current = originalStreamRef.current;

        // Update local video display
        if (localVideo.current) {
          await attachStreamToVideo(originalStreamRef.current, localVideo);
        }

        originalStreamRef.current = null;
      } else {
        // If no original stream, restart camera
        console.log("No original stream found, restarting camera...");
        const newStream = await startMediaStream();
        localStreamRef.current = newStream;

        if (localVideo.current) {
          await attachStreamToVideo(newStream, localVideo);
        }

        // Replace tracks for all peer connections
        const videoTrack = newStream.getVideoTracks()[0];
        if (videoTrack) {
          await replaceVideoTrack(peerConnections.current, videoTrack);
        }
      }

      setIsScreenSharing(false);
      console.log("Screen share stopped successfully");
    } catch (error) {
      console.error("Error stopping screen share:", error);
      setIsScreenSharing(false);
    }
  }, [localStreamRef, localVideo, peerConnections, setIsScreenSharing]);

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
    toggleScreenShare,
    switchToMainView,
    copyMeetingId,
  };
};
