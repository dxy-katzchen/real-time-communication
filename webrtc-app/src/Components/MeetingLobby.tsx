import React, { useState } from "react";
import { meetingAPI } from "../Service/api";

interface MeetingLobbyProps {
  userId: string;
  username: string;
  onJoinMeeting: (meetingId: string) => void;
  onCreateMeeting: (meetingId: string) => void;
  onLogout?: () => void;
}

const MeetingLobby: React.FC<MeetingLobbyProps> = ({
  userId,
  username,
  onJoinMeeting,
  onCreateMeeting,
  onLogout,
}) => {
  const [meetingId, setMeetingId] = useState("");
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
    <div
      style={{
        maxWidth: "600px",
        margin: "100px auto",
        padding: "30px",
        backgroundColor: "#282c34",
        borderRadius: "8px",
        color: "white",
      }}
    >
      {/* Add logout button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h2 style={{ margin: 0 }}>Welcome, {username}</h2>
        {onLogout && (
          <button
            onClick={onLogout}
            style={{
              padding: "5px 10px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Logout
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            backgroundColor: "#f8d7da",
            color: "#721c24",
            padding: "10px",
            borderRadius: "4px",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginBottom: "30px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>Name:</label>
        <input
          type="text"
          value={username}
          disabled
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "4px",
            border: "1px solid #555",
            backgroundColor: "#444",
            color: "white",
          }}
        />
      </div>

      <div
        style={{ display: "flex", alignItems: "center", marginBottom: "20px" }}
      >
        <div style={{ flex: 1, height: "1px", backgroundColor: "#555" }} />
        <span style={{ margin: "0 15px", color: "#aaa" }}>AND</span>
        <div style={{ flex: 1, height: "1px", backgroundColor: "#555" }} />
      </div>

      <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex" }}>
            <input
              type="text"
              placeholder="Meeting ID"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "4px 0 0 4px",
                border: "1px solid #555",
                borderRight: "none",
                backgroundColor: "#333",
                color: "white",
              }}
            />
            <button
              onClick={handleJoinMeeting}
              disabled={loading}
              style={{
                padding: "10px 15px",
                backgroundColor: "#8c52ff",
                color: "white",
                border: "none",
                borderRadius: "0 4px 4px 0",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              JOIN EXISTING MEETING
            </button>
          </div>
        </div>

        <div
          style={{ display: "flex", alignItems: "center", margin: "0 10px" }}
        >
          <span>OR</span>
        </div>

        <div style={{ flex: 1 }}>
          <input
            type="text"
            placeholder="Meeting Name (optional)"
            value={meetingName}
            onChange={(e) => setMeetingName(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "10px",
              borderRadius: "4px",
              border: "1px solid #555",
              backgroundColor: "#333",
              color: "white",
            }}
          />
          <button
            onClick={handleCreateMeeting}
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "#8c52ff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            CREATE A NEW MEETING
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeetingLobby;
