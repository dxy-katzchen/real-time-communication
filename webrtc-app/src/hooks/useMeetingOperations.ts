import { useCallback } from "react";
import { Socket } from "socket.io-client";
import { meetingAPI } from "../Service/api";
import type { Participant } from "../types";
import { cleanupMediaTracks, clearVideoElement } from "../utils/webrtcUtils";

interface UseMeetingOperationsProps {
  userId: string | null;
  meetingId: string | null;
  isHost: boolean;
  socketRef: React.MutableRefObject<Socket | null>;
  peerConnections: React.MutableRefObject<Map<string, RTCPeerConnection>>;
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  localVideo: React.MutableRefObject<HTMLVideoElement | null>;
  connectionTimeouts: Map<string, NodeJS.Timeout>;
  setConnectionTimeouts: React.Dispatch<
    React.SetStateAction<Map<string, NodeJS.Timeout>>
  >;
  connectionStartTimes: React.MutableRefObject<Map<string, number>>;
  setRemoteParticipants: React.Dispatch<
    React.SetStateAction<Map<string, Participant>>
  >;
  setInRoom: React.Dispatch<React.SetStateAction<boolean>>;
  setMeetingId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsHost: React.Dispatch<React.SetStateAction<boolean>>;
  setMainParticipant: React.Dispatch<React.SetStateAction<string | null>>;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  setIsVideoOff: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEndingMeeting: React.Dispatch<React.SetStateAction<boolean>>;
  setUserId: React.Dispatch<React.SetStateAction<string | null>>;
  setUsername: React.Dispatch<React.SetStateAction<string | null>>;
}

export const useMeetingOperations = ({
  userId,
  meetingId,
  isHost,
  socketRef,
  peerConnections,
  localStreamRef,
  localVideo,
  connectionTimeouts,
  setConnectionTimeouts,
  connectionStartTimes,
  setRemoteParticipants,
  setInRoom,
  setMeetingId,
  setIsHost,
  setMainParticipant,
  setIsMuted,
  setIsVideoOff,
  setIsEndingMeeting,
  setUserId,
  setUsername,
}: UseMeetingOperationsProps) => {
  // Handle user creation/login
  const handleUserCreated = useCallback(
    (userId: string, username: string) => {
      setUserId(userId);
      setUsername(username);

      const storedMeetingId = localStorage.getItem("lastMeetingId");
      if (storedMeetingId) {
        setMeetingId(storedMeetingId);
      }
    },
    [setUserId, setUsername, setMeetingId]
  );

  // Handle meeting creation
  const handleCreateMeeting = useCallback(
    (newMeetingId: string) => {
      setMeetingId(newMeetingId);
      setInRoom(true);
      setIsHost(true);
      localStorage.setItem("lastMeetingId", newMeetingId);
      
      // Update URL with new meeting ID
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("meetingId", newMeetingId);
      window.history.replaceState({}, document.title, currentUrl.toString());
    },
    [setMeetingId, setInRoom, setIsHost]
  );

  // Handle joining a meeting
  const handleJoinMeeting = useCallback(
    async (meetingIdToJoin: string) => {
      setMeetingId(meetingIdToJoin);
      setInRoom(true);

      // Check if user is host using API service
      try {
        const data = await meetingAPI.isHost(meetingIdToJoin, userId!);
        setIsHost(data.isHost);
      } catch (err) {
        console.error("Error checking host status:", err);
      }

      localStorage.setItem("lastMeetingId", meetingIdToJoin);
      
      // Update URL with meeting ID
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("meetingId", meetingIdToJoin);
      window.history.replaceState({}, document.title, currentUrl.toString());
    },
    [setMeetingId, setInRoom, setIsHost, userId]
  );
  const handleEndMeeting = useCallback(async () => {
    if (!meetingId || !userId || !isHost) return;

    setIsEndingMeeting(true);

    try {
      await meetingAPI.endMeeting(meetingId, userId);
      socketRef.current?.emit("end-meeting", { room: meetingId, userId });
      alert("Meeting ended successfully");

      // Clean up and leave
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      setRemoteParticipants(new Map());
      setInRoom(false);
      setMeetingId(null);
      setIsHost(false);
      setMainParticipant(null);
      localStorage.removeItem("lastMeetingId");
      
      // Remove meeting ID from URL
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete("meetingId");
      window.history.replaceState({}, document.title, currentUrl.toString());
    } catch (err) {
      console.error("Error ending meeting:", err);
      alert("Failed to end meeting");
    }

    setIsEndingMeeting(false);
  }, [
    meetingId,
    userId,
    isHost,
    setIsEndingMeeting,
    socketRef,
    peerConnections,
    setRemoteParticipants,
    setInRoom,
    setMeetingId,
    setIsHost,
    setMainParticipant,
  ]);

  const handleLeaveMeeting = useCallback(async () => {
    // Clear all connection timeouts
    connectionTimeouts.forEach((timeout) => clearTimeout(timeout));
    setConnectionTimeouts(new Map());
    connectionStartTimes.current.clear();

    if (isHost && meetingId) {
      const confirmEnd = window.confirm(
        "As the host, leaving will end the meeting for all participants. Do you want to continue?"
      );

      if (confirmEnd) {
        await handleEndMeeting();
        return;
      } else {
        return;
      }
    }

    // Regular participant leave
    if (userId && meetingId) {
      try {
        await meetingAPI.leaveMeeting(meetingId, userId);
      } catch (err) {
        console.error("Error leaving meeting:", err);
      }
    }

    // Clean up connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    setRemoteParticipants(new Map());

    // Clean up media
    cleanupMediaTracks(localStreamRef);
    clearVideoElement(localVideo);

    // Reset states
    setIsMuted(false);
    setIsVideoOff(false);

    socketRef.current?.emit("leave", { room: meetingId, userId });

    setInRoom(false);
    setMeetingId(null);
    setIsHost(false);
    setMainParticipant(null);
    localStorage.removeItem("lastMeetingId");
    
    // Remove meeting ID from URL
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete("meetingId");
    window.history.replaceState({}, document.title, currentUrl.toString());

    console.log("Successfully left meeting and stopped all media");
  }, [
    connectionTimeouts,
    setConnectionTimeouts,
    connectionStartTimes,
    isHost,
    meetingId,
    handleEndMeeting,
    userId,
    peerConnections,
    setRemoteParticipants,
    localStreamRef,
    localVideo,
    setIsMuted,
    setIsVideoOff,
    socketRef,
    setInRoom,
    setMeetingId,
    setIsHost,
    setMainParticipant,
  ]);

  return {
    handleUserCreated,
    handleCreateMeeting,
    handleJoinMeeting,
    handleLeaveMeeting,
    handleEndMeeting,
  };
};
