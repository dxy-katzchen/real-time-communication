import React from "react";
import { Drawer } from "antd";
import type { ChatMessage } from "../../types";
import "./ChatDrawer.css";

// Define the participant info type that matches what's used in App.tsx
interface ParticipantInfo {
  userId: string;
  username?: string;
  displayName?: string;
  isHost?: boolean;
}

export interface ChatDrawerProps {
  shouldUseDrawer: boolean;
  isChatOpen: boolean;
  toggleChat: () => void;
  participants: ParticipantInfo[];
  chatMessages: ChatMessage[];
  userId: string | null;
  sendChatMessage: (message: string) => void;
}

const ChatDrawer: React.FC<ChatDrawerProps> = ({
  shouldUseDrawer,
  isChatOpen,
  toggleChat,
  participants,
  chatMessages,
  userId,
  sendChatMessage,
}) => {
  if (!shouldUseDrawer) {
    return null;
  }

  return (
    <Drawer
      title={`Chat (${participants.length})`}
      placement="bottom"
      height="80vh"
      open={isChatOpen}
      onClose={toggleChat}
      className="chat-drawer"
      styles={{
        body: { padding: "0" },
        header: { borderBottom: "1px solid #f0f0f0" },
      }}
    >
      <div className="drawer-chat">
        {/* Messages Container */}
        <div className="drawer-chat-messages">
          {chatMessages.length === 0 ? (
            <div className="chat-empty">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            chatMessages.map((message) => (
              <div
                key={message.id}
                className={`chat-message ${
                  message.userId === userId ? "own-message" : "other-message"
                }`}
              >
                <div className="message-bubble">
                  <div className="message-header">
                    <span className="message-sender">
                      {message.userId === userId ? "You" : message.username}
                    </span>
                    <span className="message-time">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="message-content">{message.message}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Message Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const message = formData.get("message") as string;
            if (message.trim()) {
              sendChatMessage(message.trim());
              e.currentTarget.reset();
            }
          }}
          className="drawer-chat-input-form"
        >
          <div className="drawer-chat-input-container">
            <input
              type="text"
              name="message"
              placeholder="Type a message..."
              className="drawer-chat-input"
              maxLength={500}
              autoComplete="off"
            />
            <button type="submit" className="drawer-chat-send-button">
              Send
            </button>
          </div>
        </form>
      </div>
    </Drawer>
  );
};

export default ChatDrawer;
