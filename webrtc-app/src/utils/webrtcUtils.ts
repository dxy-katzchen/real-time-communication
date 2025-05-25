import type { Participant } from "../types";

export const clearConnectionTimeout = (
  participantSocketId: string,
  connectionTimeouts: Map<string, NodeJS.Timeout>,
  setConnectionTimeouts: React.Dispatch<
    React.SetStateAction<Map<string, NodeJS.Timeout>>
  >,
  connectionStartTimes: React.MutableRefObject<Map<string, number>>
) => {
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
};

export const setupStreamEventListeners = (
  stream: MediaStream,
  participantSocketId: string
) => {
  stream.getTracks().forEach((track) => {
    track.onended = () => {
      console.log(`Track ended for ${participantSocketId}:`, track.kind);
    };

    track.onmute = () => {
      console.log(`Track muted for ${participantSocketId}:`, track.kind);
    };

    track.onunmute = () => {
      console.log(`Track unmuted for ${participantSocketId}:`, track.kind);
    };
  });
};

export const updateParticipantStream = (
  participantSocketId: string,
  stream: MediaStream,
  setRemoteParticipants: React.Dispatch<
    React.SetStateAction<Map<string, Participant>>
  >
) => {
  setRemoteParticipants((prev) => {
    const updated = new Map(prev);
    const participant = updated.get(participantSocketId);
    if (participant) {
      participant.stream = stream;
      updated.set(participantSocketId, participant);
      console.log(`Updated stream for ${participantSocketId}`, {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
      });
    }
    return updated;
  });
};

export const addLocalTracksToConnection = (
  pc: RTCPeerConnection,
  localStream: MediaStream | null,
  participantSocketId: string
) => {
  if (localStream) {
    const tracks = localStream.getTracks();
    console.log(
      `Adding ${tracks.length} tracks to peer connection for ${participantSocketId}`
    );

    tracks.forEach((track) => {
      console.log(`Adding ${track.kind} track to ${participantSocketId}`);
      pc.addTrack(track, localStream);
    });
  } else {
    console.warn(
      `No local stream available when creating peer connection for ${participantSocketId}`
    );
  }
};

export const cleanupMediaTracks = (
  localStreamRef: React.MutableRefObject<MediaStream | null>
) => {
  if (localStreamRef.current) {
    console.log("Stopping all media tracks...");
    localStreamRef.current.getTracks().forEach((track) => {
      console.log(`Stopping ${track.kind} track`);
      track.stop();
    });
    localStreamRef.current = null;
  }
};

export const clearVideoElement = (
  videoRef: React.MutableRefObject<HTMLVideoElement | null>
) => {
  if (videoRef.current) {
    console.log("Clearing local video element...");
    videoRef.current.srcObject = null;
    videoRef.current.pause();
    videoRef.current.removeAttribute("src");
    videoRef.current.load();
  }
};
