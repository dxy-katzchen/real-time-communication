export const ICE_SERVERS = [
  // Google STUN servers
  // { urls: "stun:stun.l.google.com:19302" },
  // { urls: "stun:stun1.l.google.com:19302" },
  // { urls: "stun:stun2.l.google.com:19302" },
  // { urls: "stun:stun3.l.google.com:19302" },
  // { urls: "stun:stun4.l.google.com:19302" },

  // Additional public STUN servers
  { urls: "stun:stun.relay.metered.ca:80" },
  // { urls: "stun:global.stun.twilio.com:3478" },

  // Metered TURN servers (multiple protocols and ports)
  {
    urls: "turn:global.relay.metered.ca:80",
    username: "92c0c0f3362e3c6f2f20a86d",
    credential: "aK0V47jdAT0iaI4a",
  },
  {
    urls: "turn:global.relay.metered.ca:80?transport=tcp",
    username: "92c0c0f3362e3c6f2f20a86d",
    credential: "aK0V47jdAT0iaI4a",
  },
  {
    urls: "turn:global.relay.metered.ca:443",
    username: "92c0c0f3362e3c6f2f20a86d",
    credential: "aK0V47jdAT0iaI4a",
  },
  {
    urls: "turns:global.relay.metered.ca:443?transport=tcp",
    username: "92c0c0f3362e3c6f2f20a86d",
    credential: "aK0V47jdAT0iaI4a",
  },

  // Additional TURN servers for better connectivity
  // {
  //   urls: "turn:relay1.expressturn.com:3478",
  //   username: "ef4BIXR2JUZ0JJ2HFPZ",
  //   credential: "K5BdZjHHmKITB7xP",
  // },
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
