import React from "react";
import "./StatusBar.css";

export interface StatusBarProps {
  connectionStatus: string;
  meetingId: string | null;
  isHost: boolean;
  isCopied: boolean;
  copyMeetingLink: (meetingId: string | null) => void;
}

const StatusBar: React.FC<StatusBarProps> = ({
  connectionStatus,
  meetingId,
  isHost,
  isCopied,
  copyMeetingLink,
}) => {
  return (
    <div className="status-bar">
      <div className="status-bar-content">
        <div className="connection-status-indicator">
          <div
            className={`status-dot ${
              connectionStatus === "Connected"
                ? "status-dot--connected"
                : connectionStatus === "Connecting"
                ? "status-dot--connecting"
                : "status-dot--disconnected"
            }`}
          ></div>
          <span className="status-label">{connectionStatus}</span>
        </div>
        <span className="meeting-id-text">
          Meeting ID: {meetingId} {isHost && "(Host)"}
        </span>
      </div>
      <button
        onClick={() => copyMeetingLink(meetingId)}
        className="copy-meeting-button"
        title="Copy Meeting Link"
      >
        {isCopied ? "✅ Copied!" : "🔗 Copy Link"}
      </button>
    </div>
  );
};

export default StatusBar;
