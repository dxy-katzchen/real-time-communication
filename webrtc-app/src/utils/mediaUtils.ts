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
