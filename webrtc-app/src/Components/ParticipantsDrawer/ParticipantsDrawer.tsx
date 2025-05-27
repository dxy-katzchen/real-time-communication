import React from "react";
import { Drawer } from "antd";
import type { Participant } from "../../types";
import "./ParticipantsDrawer.css";

// Define the participant info type that matches what's used in App.tsx
interface ParticipantInfo {
  userId: string;
  username?: string;
  displayName?: string;
  isHost?: boolean;
}

export interface ParticipantsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  participants: ParticipantInfo[];
  remoteParticipants: Map<string, Participant>;
  userId: string | null;
  mainParticipant: string | null;
  setMainParticipant: (participantId: string | null) => void;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
}

const ParticipantsDrawer: React.FC<ParticipantsDrawerProps> = ({
  isOpen,
  onClose,
  participants,
  remoteParticipants,
  userId,
  mainParticipant,
  setMainParticipant,
  isMuted,
  isVideoOff,
  isScreenSharing,
}) => {
  const handleParticipantClick = (participantUserId: string) => {
    const isLocalUser = participantUserId === userId;

    if (isLocalUser) {
      setMainParticipant(null);
    } else {
      setMainParticipant(participantUserId);
    }
    onClose();
  };

  return (
    <Drawer
      title={`Participants (${participants.length})`}
      placement="bottom"
      height="auto"
      open={isOpen}
      onClose={onClose}
      className="participants-drawer"
      styles={{
        body: { padding: "16px" },
        header: { borderBottom: "1px solid #f0f0f0" },
      }}
    >
      <div className="drawer-participants">
        {/* All participants from the participants array */}
        {participants.map((participant) => {
          const isLocalUser = participant.userId === userId;
          const remoteParticipant = isLocalUser
            ? null
            : Array.from(remoteParticipants.values()).find(
                (p) => p.userId === participant.userId
              );

          return (
            <div
              key={participant.userId}
              className={`participant-item ${
                isLocalUser
                  ? mainParticipant === null
                    ? "active"
                    : ""
                  : mainParticipant === participant.userId
                  ? "active"
                  : ""
              }`}
              onClick={() => handleParticipantClick(participant.userId)}
            >
              <div
                className={`participant-avatar ${isLocalUser ? "local" : ""} ${
                  participant.isHost ? "host" : ""
                }`}
              >
                {(participant.displayName || participant.username || "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>
              <div className="participant-info">
                <div
                  className={`participant-name ${
                    participant.isHost ? "host" : ""
                  } ${isLocalUser ? "local" : ""}`}
                >
                  {participant.displayName || participant.username || "Unknown"}
                </div>
                <div className="participant-status">
                  {isLocalUser ? (
                    <>
                      {isMuted && (
                        <span className="status-indicator muted">🔇 Muted</span>
                      )}
                      {isVideoOff && (
                        <span className="status-indicator video-off">
                          📹 Video Off
                        </span>
                      )}
                      {isScreenSharing && (
                        <span className="status-indicator screen-sharing">
                          🖥️ Screen Sharing
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      {remoteParticipant?.isMuted && (
                        <span className="status-indicator muted">🔇 Muted</span>
                      )}
                      {remoteParticipant?.isVideoOff && (
                        <span className="status-indicator video-off">
                          📹 Video Off
                        </span>
                      )}
                      {remoteParticipant?.isScreenSharing && (
                        <span className="status-indicator screen-sharing">
                          🖥️ Screen Sharing
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Drawer>
  );
};

export default ParticipantsDrawer;
