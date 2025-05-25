import React, { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "../../types";
import "./Chat.css";

interface ChatProps {
  chatMessages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string | null;
  participantsCount: number;
}

const Chat: React.FC<ChatProps> = ({
  chatMessages,
  onSendMessage,
  isOpen,
  onClose,
  currentUserId,
  participantsCount,
}) => {
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage("");
    }
  };

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="chat-overlay">
      <div className="chat-container">
        {/* Chat Header */}
        <div className="chat-header">
          <div className="chat-title">
            <h3>Chat</h3>
            <span className="participants-count">
              {participantsCount} participant
              {participantsCount !== 1 ? "s" : ""}
            </span>
          </div>
          <button onClick={onClose} className="chat-close-button">
            ✕
          </button>
        </div>

        {/* Messages Container */}
        <div className="chat-messages">
          {chatMessages.length === 0 ? (
            <div className="chat-empty">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            chatMessages.map((message) => (
              <div
                key={message.id}
                className={`chat-message ${
                  message.userId === currentUserId
                    ? "own-message"
                    : "other-message"
                }`}
              >
                <div className="message-bubble">
                  <div className="message-header">
                    <span className="message-sender">
                      {message.userId === currentUserId
                        ? "You"
                        : message.username}
                    </span>
                    <span className="message-time">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                  <div className="message-content">{message.message}</div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="chat-input-form">
          <div className="chat-input-container">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="chat-input"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="chat-send-button"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Chat;
