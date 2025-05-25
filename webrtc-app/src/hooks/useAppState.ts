import { useState, useRef } from "react";
import { Socket } from "socket.io-client";
import type { Participant } from "../types";

export const useAppState = () => {
  // User and Meeting state
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<
    Array<{
      userId: string;
      username?: string;
      displayName?: string;
      isHost?: boolean;
    }>
  >([]);
  const [isHost, setIsHost] = useState(false);

  // Multi-participant state
  const [remoteParticipants, setRemoteParticipants] = useState<
    Map<string, Participant>
  >(new Map());
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

  // UI state
  const [mainParticipant, setMainParticipant] = useState<string | null>(null);
  const [inRoom, setInRoom] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Not connected");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);

  // Refs
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Connection tracking state
  const [connectionTimeouts, setConnectionTimeouts] = useState<
    Map<string, NodeJS.Timeout>
  >(new Map());
  const connectionStartTimes = useRef<Map<string, number>>(new Map());

  return {
    // User and Meeting state
    userId,
    setUserId,
    username,
    setUsername,
    meetingId,
    setMeetingId,
    participants,
    setParticipants,
    isHost,
    setIsHost,

    // Multi-participant state
    remoteParticipants,
    setRemoteParticipants,
    peerConnections,

    // UI state
    mainParticipant,
    setMainParticipant,
    inRoom,
    setInRoom,
    connectionStatus,
    setConnectionStatus,
    isMuted,
    setIsMuted,
    isVideoOff,
    setIsVideoOff,
    isEndingMeeting,
    setIsEndingMeeting,

    // Refs
    localVideo,
    socketRef,
    localStreamRef,

    // Connection tracking
    connectionTimeouts,
    setConnectionTimeouts,
    connectionStartTimes,
  };
};
