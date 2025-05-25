import React, { useState } from "react";
import { userAPI } from "../../Service/api";
import "./Auth.css";

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
    <div className="auth-container">
      <h2 className="auth-title">Welcome to Video Meeting</h2>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-form-group">
          <label htmlFor="username" className="auth-label">
            Name:
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
            className="auth-input"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`auth-submit-button ${
            loading ? "auth-submit-button--loading" : ""
          }`}
        >
          {loading ? "Loading..." : "Continue"}
        </button>
      </form>
    </div>
  );
};

export default Auth;
