import React, { useState } from "react";
import { meetingAPI } from "../../Service/api";
import "./MeetingLobby.css";

interface MeetingLobbyProps {
  userId: string;
  username: string;
  onJoinMeeting: (meetingId: string) => void;
  onCreateMeeting: (meetingId: string) => void;
  onLogout?: () => void;
  initialMeetingId?: string;
}

const MeetingLobby: React.FC<MeetingLobbyProps> = ({
  userId,
  username,
  onJoinMeeting,
  onCreateMeeting,
  onLogout,
  initialMeetingId,
}) => {
  const [meetingId, setMeetingId] = useState(initialMeetingId || "");
  const [meetingName, setMeetingName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreateMeeting = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await meetingAPI.createMeeting({
        hostId: userId,
        name: meetingName || `${username}'s Meeting`,
      });
      onCreateMeeting(data.meetingId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create meeting";
      setError(errorMessage);
      console.error("Create meeting error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMeeting = async () => {
    if (!meetingId.trim()) {
      setError("Meeting ID is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await meetingAPI.joinMeeting(meetingId, userId);
      onJoinMeeting(meetingId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to join meeting";
      setError(errorMessage);
      console.error("Join meeting error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="meeting-lobby-container">
      {/* Header with logout button */}
      <div className="meeting-lobby-header">
        <h2 className="meeting-lobby-title">Welcome, {username}</h2>
        {onLogout && (
          <button onClick={onLogout} className="meeting-lobby-logout">
            Logout
          </button>
        )}
      </div>

      {error && <div className="meeting-lobby-error">{error}</div>}

      {initialMeetingId && (
        <div className="meeting-lobby-link-notice">
          🔗 Meeting link detected! Meeting ID has been pre-filled below.
        </div>
      )}

      <div className="meeting-lobby-user-info">
        <label className="meeting-lobby-label">Name:</label>
        <input
          type="text"
          value={username}
          disabled
          className="meeting-lobby-user-input"
        />
      </div>

      <div className="meeting-lobby-divider">
        <div className="meeting-lobby-divider-line" />
        <span className="meeting-lobby-divider-text">Choose an option</span>
        <div className="meeting-lobby-divider-line" />
      </div>

      <div className="meeting-lobby-actions">
        <div className="meeting-lobby-action-section meeting-lobby-join-section">
          <div className="meeting-lobby-input-group">
            <input
              type="text"
              placeholder="Meeting ID"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
              className="meeting-lobby-input"
            />
            <button
              onClick={handleJoinMeeting}
              disabled={loading}
              className="meeting-lobby-join-button"
            >
              Join Meeting
            </button>
          </div>
        </div>

        <div className="meeting-lobby-or">
          <span>OR</span>
        </div>

        <div className="meeting-lobby-action-section meeting-lobby-create-section">
          <input
            type="text"
            placeholder="Meeting Name (optional)"
            value={meetingName}
            onChange={(e) => setMeetingName(e.target.value)}
            className="meeting-lobby-create-input"
          />
          <button
            onClick={handleCreateMeeting}
            disabled={loading}
            className="meeting-lobby-create-button"
          >
            Create Meeting
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeetingLobby;
