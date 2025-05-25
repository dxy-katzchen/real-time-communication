export interface Participant {
  userId: string;
  socketId: string;
  stream?: MediaStream;
  peerConnection?: RTCPeerConnection;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
}

export interface SocketEvents {
  "user-joined": (data: { userId: string; socketId: string }) => void;
  "user-left": (data: { userId: string; socketId: string }) => void;
  "existing-participants": (data: { participants: Participant[] }) => void;
  offer: (data: {
    offer: RTCSessionDescriptionInit;
    fromSocket: string;
    fromUserId: string;
    msgId: string;
  }) => void;
  answer: (data: {
    answer: RTCSessionDescriptionInit;
    fromSocket: string;
    fromUserId: string;
    msgId: string;
  }) => void;
  "ice-candidate": (data: {
    candidate: RTCIceCandidateInit;
    fromSocket: string;
    fromUserId: string;
  }) => void;
  "meeting-ended": (data: { meetingId: string }) => void;
  "media-status-changed": (data: {
    userId: string;
    socketId: string;
    isMuted: boolean;
    isVideoOff: boolean;
    isScreenSharing: boolean;
  }) => void;
  "chat-message": (data: {
    id: string;
    userId: string;
    username: string;
    message: string;
    timestamp: string;
  }) => void;
}

export interface MainParticipantView {
  stream: MediaStream | null;
  userId: string | null;
  isLocal: boolean;
}
