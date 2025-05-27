import React from "react";
import { isScreenShareSupported } from "../../utils/deviceUtils";
import "./Control.css";

export interface ControlProps {
  // Audio/Video controls
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;

  // Chat controls
  isChatOpen: boolean;
  unreadMessagesCount: number;
  toggleChat: () => void;

  // Participants controls
  isParticipantsSheetOpen: boolean;
  participantsCount: number;
  openParticipantsSheet: () => void;

  // Meeting controls
  isHost: boolean;
  handleLeaveMeeting: () => void;
}

export const Control: React.FC<ControlProps> = ({
  isMuted,
  isVideoOff,
  isScreenSharing,
  toggleAudio,
  toggleVideo,
  toggleScreenShare,
  isChatOpen,
  unreadMessagesCount,
  toggleChat,
  isParticipantsSheetOpen,
  participantsCount,
  openParticipantsSheet,
  isHost,
  handleLeaveMeeting,
}) => {
  return (
    <div className="controls">
      <button
        onClick={toggleAudio}
        className={`control-button control-button--circular control-button--mute ${
          isMuted ? "muted" : ""
        }`}
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? "🔇" : "🎤"}
      </button>

      <button
        onClick={toggleVideo}
        className={`control-button control-button--circular control-button--video ${
          isVideoOff ? "video-off" : ""
        }`}
        title={isVideoOff ? "Start Video" : "Stop Video"}
      >
        {isVideoOff ? "📵" : "📹"}
      </button>

      {isScreenShareSupported() && (
        <button
          onClick={toggleScreenShare}
          className={`control-button control-button--circular control-button--screen-share ${
            isScreenSharing ? "screen-sharing" : ""
          }`}
          title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
        >
          {isScreenSharing ? "🔳" : "🖥️"}
        </button>
      )}

      <button
        onClick={openParticipantsSheet}
        className={`control-button control-button--circular control-button--participants ${
          isParticipantsSheetOpen ? "active" : ""
        }`}
        title="Show Participants"
      >
        👥
        {participantsCount > 1 && (
          <span className="participants-badge">{participantsCount}</span>
        )}
      </button>

      <button
        onClick={toggleChat}
        className={`control-button control-button--circular control-button--chat ${
          isChatOpen ? "active" : ""
        }`}
        title="Toggle Chat"
      >
        💬
        {unreadMessagesCount > 0 && (
          <span className="unread-badge">{unreadMessagesCount}</span>
        )}
      </button>

      <button
        onClick={handleLeaveMeeting}
        className="control-button control-button--leave"
      >
        {isHost ? "End Meeting" : "Leave"}
      </button>
    </div>
  );
};
