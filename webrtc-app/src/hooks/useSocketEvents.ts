import { useEffect, useCallback } from "react";
import { Socket } from "socket.io-client";
import type { Participant } from "../types";

interface UseSocketEventsProps {
  socketRef: React.MutableRefObject<Socket | null>;
  meetingId: string | null;
  userId: string | null;
  isEndingMeeting: boolean;
  onUserJoined: (data: { userId: string; socketId: string }) => void;
  onUserLeft: (data: { userId: string; socketId: string }) => void;
  onExistingParticipants: (data: { participants: Participant[] }) => void;
  onOffer: (data: {
    offer: RTCSessionDescriptionInit;
    fromSocket: string;
    fromUserId: string;
    msgId: string;
  }) => void;

  onAnswer: (data: {
    answer: RTCSessionDescriptionInit;
    fromSocket: string;
    fromUserId: string;
    msgId: string;
  }) => void;
  onIceCandidate: (data: {
    candidate: RTCIceCandidateInit;
    fromSocket: string;
    fromUserId: string;
  }) => void;
  onLeaveMeeting: () => void;
  onMediaStatusChanged?: (data: {
    userId: string;
    socketId: string;
    isMuted: boolean;
    isVideoOff: boolean;
    isScreenSharing?: boolean;
  }) => void;
  onChatMessage?: (data: {
    id: string;
    userId: string;
    username: string;
    message: string;
    timestamp: string;
  }) => void;
}

export const useSocketEvents = ({
  socketRef,
  meetingId,
  userId,
  isEndingMeeting,
  onUserJoined,
  onUserLeft,
  onExistingParticipants,
  onOffer,
  onAnswer,
  onIceCandidate,
  onLeaveMeeting,
  onMediaStatusChanged,
  onChatMessage,
}: UseSocketEventsProps) => {
  const handleMeetingEnded = useCallback(
    (data: { meetingId: string }) => {
      if (data.meetingId === meetingId && !isEndingMeeting) {
        alert("This meeting has been ended by the host");
        onLeaveMeeting();
      }
    },
    [meetingId, isEndingMeeting, onLeaveMeeting]
  );

  // Setup socket event listeners
  useEffect(() => {
    if (!socketRef.current) return;

    const socket = socketRef.current;

    // Multi-participant event listeners
    socket.on("user-joined", onUserJoined);
    socket.on("user-left", onUserLeft);
    socket.on("existing-participants", onExistingParticipants);
    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIceCandidate);
    socket.on("meeting-ended", handleMeetingEnded);

    // Media status event listener
    if (onMediaStatusChanged) {
      socket.on("media-status-changed", onMediaStatusChanged);
    }

    // Chat message event listener
    if (onChatMessage) {
      socket.on("chat-message", onChatMessage);
    }

    // Cleanup previous listeners
    return () => {
      socket.off("user-joined", onUserJoined);
      socket.off("user-left", onUserLeft);
      socket.off("existing-participants", onExistingParticipants);
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("ice-candidate", onIceCandidate);
      socket.off("meeting-ended", handleMeetingEnded);

      if (onMediaStatusChanged) {
        socket.off("media-status-changed", onMediaStatusChanged);
      }

      if (onChatMessage) {
        socket.off("chat-message", onChatMessage);
      }
    };
  }, [
    socketRef,
    meetingId,
    isEndingMeeting,
    onUserJoined,
    onUserLeft,
    onExistingParticipants,
    onOffer,
    onAnswer,
    onIceCandidate,
    handleMeetingEnded,
    onMediaStatusChanged,
    onChatMessage,
  ]);

  // Join room when called
  const joinRoom = useCallback(() => {
    if (socketRef.current && userId && meetingId) {
      socketRef.current.emit("join", { room: meetingId, userId });
    }
  }, [socketRef, meetingId, userId]);

  return {
    joinRoom,
  };
};
