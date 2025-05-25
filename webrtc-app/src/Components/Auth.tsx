import React, { useState } from "react";
import { userAPI } from "../Service/api";

interface AuthProps {
  onUserCreated: (userId: string, username: string) => void;
}

const Auth: React.FC<AuthProps> = ({ onUserCreated }) => {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // First check if user exists
      try {
        const userData = await userAPI.getUser(username);
        onUserCreated(userData._id, userData.username);
      } catch {
        // If user doesn't exist, create new user
        const userData = await userAPI.createUser({ username });
        onUserCreated(userData.userId, userData.username);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Network error. Please try again.";
      setError(errorMessage);
      console.error("Auth error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth-container"
      style={{
        maxWidth: "500px",
        margin: "100px auto",
        padding: "30px",
        backgroundColor: "#282c34",
        borderRadius: "8px",
        color: "white",
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: "30px" }}>
        Welcome to Video Meeting
      </h2>

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

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "20px" }}>
          <label
            htmlFor="username"
            style={{ display: "block", marginBottom: "5px" }}
          >
            Name:
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "4px",
              border: "1px solid #555",
              backgroundColor: "#333",
              color: "white",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px",
            backgroundColor: "#8c52ff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Loading..." : "Continue"}
        </button>
      </form>
    </div>
  );
};

export default Auth;
