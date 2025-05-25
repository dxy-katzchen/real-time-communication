export const startMediaStream = async (): Promise<MediaStream> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    console.log("Media stream started successfully:", {
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
    });

    return stream;
  } catch (error) {
    console.error("Error accessing media devices:", error);
    throw error;
  }
};

export const toggleVideoTrack = (
  localStreamRef: React.MutableRefObject<MediaStream | null>,
  isVideoOff: boolean,
  setIsVideoOff: React.Dispatch<React.SetStateAction<boolean>>
) => {
  if (localStreamRef.current) {
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = isVideoOff;
      setIsVideoOff(!isVideoOff);
      console.log(`Video ${isVideoOff ? "enabled" : "disabled"}`);
    }
  }
};

export const toggleAudioTrack = (
  localStreamRef: React.MutableRefObject<MediaStream | null>,
  isMuted: boolean,
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>
) => {
  if (localStreamRef.current) {
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = isMuted;
      setIsMuted(!isMuted);
      console.log(`Audio ${isMuted ? "unmuted" : "muted"}`);
    }
  }
};

export const attachStreamToVideo = (
  stream: MediaStream,
  videoRef: React.MutableRefObject<HTMLVideoElement | null>
) => {
  if (videoRef.current) {
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(console.error);
  }
};

export const startScreenShare = async (): Promise<MediaStream> => {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1920, max: 2560 },
        height: { ideal: 1080, max: 1440 },
        frameRate: { ideal: 30, max: 60 },
      },
      audio: true, // Include system audio
    });

    console.log("Screen share started successfully:", {
      videoTracks: screenStream.getVideoTracks().length,
      audioTracks: screenStream.getAudioTracks().length,
    });

    return screenStream;
  } catch (error) {
    console.error("Error starting screen share:", error);
    throw error;
  }
};

export const stopScreenShare = (
  screenStreamRef: React.MutableRefObject<MediaStream | null>
) => {
  if (screenStreamRef.current) {
    console.log("Stopping screen share...");
    screenStreamRef.current.getTracks().forEach((track) => {
      console.log(`Stopping screen share ${track.kind} track`);
      track.stop();
    });
    screenStreamRef.current = null;
  }
};

export const replaceVideoTrack = async (
  peerConnections: Map<string, RTCPeerConnection>,
  newVideoTrack: MediaStreamTrack
): Promise<void> => {
  console.log("Replacing video track for all peer connections");

  const replacePromises = Array.from(peerConnections.entries()).map(
    async ([participantId, pc]) => {
      try {
        const senders = pc.getSenders();
        const videoSender = senders.find(
          (sender) => sender.track && sender.track.kind === "video"
        );

        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
          console.log(`Video track replaced for participant ${participantId}`);
        } else {
          console.warn(
            `No video sender found for participant ${participantId}`
          );
        }
      } catch (error) {
        console.error(
          `Error replacing video track for participant ${participantId}:`,
          error
        );
      }
    }
  );

  await Promise.all(replacePromises);
};
