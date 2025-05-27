import React, { useEffect, useRef } from "react";
import { Drawer } from "antd";
import "./ChatMobile.css";

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
}

export interface ChatMobileProps {
  isOpen: boolean;
  onClose: () => void;
  chatMessages: ChatMessage[];
  onSendMessage: (message: string) => void;
  currentUserId: string | null;
  participantsCount: number;
}

export const ChatMobile: React.FC<ChatMobileProps> = ({
  isOpen,
  onClose,
  chatMessages,
  onSendMessage,
  currentUserId,
  participantsCount,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isOpen]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const message = formData.get("message") as string;

    if (message && message.trim()) {
      onSendMessage(message.trim());
      e.currentTarget.reset();
    }
  };

  return (
    <Drawer
      title={`Chat (${participantsCount})`}
      placement="bottom"
      height="80vh"
      open={isOpen}
      onClose={onClose}
      className="chat-mobile-drawer"
      styles={{
        body: { padding: "0" },
        header: { borderBottom: "1px solid #f0f0f0" },
      }}
    >
      <div className="chat-mobile-container">
        {/* Messages Container */}
        <div className="chat-mobile-messages">
          {chatMessages.length === 0 ? (
            <div className="chat-mobile-empty">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <>
              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`chat-mobile-message ${
                    message.userId === currentUserId
                      ? "own-message"
                      : "other-message"
                  }`}
                >
                  <div className="chat-mobile-message-bubble">
                    <div className="chat-mobile-message-header">
                      <span className="chat-mobile-message-sender">
                        {message.userId === currentUserId
                          ? "You"
                          : message.username}
                      </span>
                      <span className="chat-mobile-message-time">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="chat-mobile-message-content">
                      {message.message}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Message Input */}
        <form onSubmit={handleSubmit} className="chat-mobile-input-form">
          <div className="chat-mobile-input-container">
            <input
              type="text"
              name="message"
              placeholder="Type a message..."
              className="chat-mobile-input"
              maxLength={500}
              autoComplete="off"
            />
            <button type="submit" className="chat-mobile-send-button">
              Send
            </button>
          </div>
        </form>
      </div>
    </Drawer>
  );
};
