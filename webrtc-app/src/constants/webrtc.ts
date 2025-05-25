export const ICE_SERVERS = [
  // Google STUN servers
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  {
    urls: ["turn:real-time-chat.com:3478", "turns:real-time-chat.com:5349"],
    username: "webrtcuser",
    credential: "securepassword",
  },
];

export const RTC_CONFIGURATION = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle" as RTCBundlePolicy,
  rtcpMuxPolicy: "require" as RTCRtcpMuxPolicy,
  iceTransportPolicy: "all" as RTCIceTransportPolicy,
};

export const CONNECTION_CONFIG = {
  TIMEOUT_DURATION: 5000,
  MAX_ATTEMPTS: 3,
  RECONNECT_DELAY: 1000,
  OFFER_DELAY: 2000,
  RECREATE_DELAY: 1000,
};

export const SOCKET_CONFIG = {
  transports: ["websocket", "polling"],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
};
