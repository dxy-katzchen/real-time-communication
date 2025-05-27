import React from "react";
import { MainVideoComponent } from "../MainVideoComponent/MainVideoComponent";
import Sidebar from "../../Sidebar/Sidebar";
import type { Participant } from "../../../types";
import "./MainContent.css";

interface MainContentProps {
  // Main view data
  mainView: {
    stream: MediaStream | null;
    isLocal: boolean;
    userId: string;
  };
  mainParticipantInfo:
    | {
        userId?: string;
        username?: string;
        displayName?: string;
        isHost?: boolean;
      }
    | undefined;

  // User data
  userId: string;
  username: string;
  isHost: boolean;

  // Video refs and state
  localVideo: React.RefObject<HTMLVideoElement | null>;
  localStreamRef: React.MutableRefObject<MediaStream | null>;

  // Media state
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;

  // Participants data
  participants: Array<{
    userId: string;
    username?: string;
    displayName?: string;
    isHost?: boolean;
  }>;
  remoteParticipants: Map<string, Participant>;
  mainParticipant: string | null;

  // Functions
  switchToMainView: (participantId: string | null) => void;
}

const MainContent: React.FC<MainContentProps> = ({
  mainView,
  mainParticipantInfo,
  userId,
  username,
  isHost,
  localVideo,
  localStreamRef,
  isMuted,
  isVideoOff,
  isScreenSharing,
  participants,
  remoteParticipants,
  mainParticipant,
  switchToMainView,
}) => {
  return (
    <div className="main-content">
      {/* Main video display */}
      <div className="main-video-container">
        <div className="main-video-wrapper">
          {/* Main participant name */}
          <div className="main-participant-name">
            {mainView.isLocal
              ? `You (${username})`
              : mainParticipantInfo?.displayName || "Unknown"}{" "}
            {mainParticipantInfo?.isHost && " (Host)"}
          </div>

          {/* Main video */}
          {mainView.isLocal ? (
            <div className="local-video-container">
              <video
                ref={localVideo}
                muted
                playsInline
                className="main-video"
                style={{
                  transform: isScreenSharing ? "none" : "scaleX(-1)", // Don't mirror when screen sharing
                }}
                key="local-main-video"
              />
              {/* Video off overlay for local video */}
              {isVideoOff && (
                <div className="video-off-overlay">
                  <div className="avatar-large">
                    {username ? username.charAt(0).toUpperCase() : "Y"}
                  </div>
                  {isMuted && <div className="muted-indicator-overlay">🔇</div>}
                </div>
              )}
            </div>
          ) : (
            <MainVideoComponent stream={mainView.stream} />
          )}
        </div>
      </div>

      {/* Participant sidebar */}
      <Sidebar
        participants={participants}
        remoteParticipants={remoteParticipants}
        userId={userId}
        username={username}
        isHost={isHost}
        localStreamRef={localStreamRef}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        mainParticipant={mainParticipant}
        switchToMainView={switchToMainView}
      />
    </div>
  );
};

export default MainContent;
