export interface Participant {
  userId: string;
  socketId: string;
  stream?: MediaStream;
  peerConnection?: RTCPeerConnection;
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
}

export interface MainParticipantView {
  stream: MediaStream | null;
  userId: string | null;
  isLocal: boolean;
}
