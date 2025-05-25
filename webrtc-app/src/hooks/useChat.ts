import { useCallback } from "react";
import { Socket } from "socket.io-client";
import type { ChatMessage } from "../types";

interface UseChatProps {
  socketRef: React.MutableRefObject<Socket | null>;
  meetingId: string | null;
  userId: string | null;
  username: string | null;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isChatOpen: boolean;
  setUnreadMessagesCount: React.Dispatch<React.SetStateAction<number>>;
}

export const useChat = ({
  socketRef,
  meetingId,
  userId,
  username,
  chatMessages,
  setChatMessages,
  isChatOpen,
  setUnreadMessagesCount,
}: UseChatProps) => {
  // Send a chat message
  const sendChatMessage = useCallback(
    (message: string) => {
      if (!socketRef.current || !meetingId || !userId || !username) {
        console.error("Cannot send message: missing required data");
        return;
      }

      const chatMessage = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        userId,
        username,
        message,
        timestamp: new Date().toISOString(),
      };

      // Emit the message to the server
      socketRef.current.emit("send-chat-message", {
        room: meetingId,
        ...chatMessage,
      });

      console.log("Sent chat message:", chatMessage);
    },
    [socketRef, meetingId, userId, username]
  );

  // Handle incoming chat message
  const handleChatMessage = useCallback(
    (data: {
      id: string;
      userId: string;
      username: string;
      message: string;
      timestamp: string;
    }) => {
      console.log("Received chat message:", data);

      const newMessage: ChatMessage = {
        ...data,
        timestamp: new Date(data.timestamp),
      };

      setChatMessages((prev) => [...prev, newMessage]);

      // Increment unread count if chat is closed and message is not from current user
      if (!isChatOpen && data.userId !== userId) {
        setUnreadMessagesCount((prev) => prev + 1);
      }
    },
    [setChatMessages, isChatOpen, userId, setUnreadMessagesCount]
  );

  // Clear unread messages count when chat is opened
  const clearUnreadMessages = useCallback(() => {
    setUnreadMessagesCount(0);
  }, [setUnreadMessagesCount]);

  return {
    sendChatMessage,
    handleChatMessage,
    clearUnreadMessages,
  };
};
