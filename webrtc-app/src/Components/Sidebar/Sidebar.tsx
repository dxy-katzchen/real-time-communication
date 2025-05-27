import React from "react";
import { ParticipantThumbnail } from "../ParticipantThumbnail/ParticipantThumbnail";
import type { Participant } from "../../types";
import "./Sidebar.css";

interface ParticipantInfo {
  userId: string;
  username?: string;
  displayName?: string;
  isHost?: boolean;
}

interface SidebarProps {
  // Participant data
  participants: ParticipantInfo[];
  remoteParticipants: Map<string, Participant>;

  // Local user data
  userId: string | null;
  username: string | null;
  isHost: boolean;
  localStreamRef: React.RefObject<MediaStream | null>;

  // Local user states
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;

  // Main view management
  mainParticipant: string | null;
  switchToMainView: (participantId: string | null) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  participants,
  remoteParticipants,
  userId,
  username,
  isHost,
  localStreamRef,
  isMuted,
  isVideoOff,
  isScreenSharing,
  mainParticipant,
  switchToMainView,
}) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h5>Participants ({participants.length})</h5>
      </div>

      {/* Local user thumbnail */}
      <div className="local-participant-container">
        <ParticipantThumbnail
          isLocal={true}
          stream={localStreamRef.current}
          userId={userId || ""}
          displayName={username || "You"}
          isHost={isHost}
          isActive={mainParticipant === null}
          onClick={() => switchToMainView(null)}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isScreenSharing={isScreenSharing}
        />
      </div>

      {/* Remote participants */}
      <div className="remote-participants-container">
        {(() => {
          const remoteParticipantList = Array.from(remoteParticipants.values());
          console.log(
            "Rendering remote participants:",
            remoteParticipantList.map((p) => ({
              userId: p.userId,
              socketId: p.socketId,
              hasStream: !!p.stream,
              streamId: p.stream?.id,
              videoTracks: p.stream?.getVideoTracks().length || 0,
              audioTracks: p.stream?.getAudioTracks().length || 0,
            }))
          );

          return remoteParticipantList.map((participant) => {
            // Enhanced fallback mechanism for participant lookup (sidebar)
            let info = participants.find(
              (p) => p.userId === participant.userId
            );

            // Fallback 1: Try matching by socketId if userId lookup fails
            if (!info) {
              info = participants.find(
                (p) => p.userId === participant.socketId
              );
            }

            // Fallback 2: Try to find any participant that might match
            if (!info) {
              info = participants.find(
                (p) =>
                  p.username === participant.userId ||
                  p.displayName === participant.userId
              );
            }

            // Generate display name with improved fallbacks
            let displayName = info?.displayName || info?.username;

            // If still no name found, create a more user-friendly fallback
            if (!displayName) {
              const identifier = participant.userId || participant.socketId;
              if (identifier) {
                // If it looks like a MongoDB ObjectId or similar, create a friendly name
                if (
                  /^[a-f\d]{24}$/i.test(identifier) ||
                  identifier.length > 15
                ) {
                  displayName = `User ${identifier.slice(-4).toUpperCase()}`;
                } else {
                  displayName = identifier;
                }
              } else {
                displayName = "Guest";
              }
            }
            return (
              <ParticipantThumbnail
                key={participant.socketId}
                isLocal={false}
                stream={participant.stream}
                userId={participant.userId}
                displayName={displayName}
                isHost={info?.isHost || false}
                isActive={mainParticipant === participant.userId}
                onClick={() => switchToMainView(participant.userId)}
                isMuted={participant.isMuted || false}
                isVideoOff={participant.isVideoOff || false}
                isScreenSharing={participant.isScreenSharing || false}
              />
            );
          });
        })()}
      </div>
    </div>
  );
};

export default Sidebar;
