// Environment-aware BASE_URL configuration
const getBaseURL = () => {
  // Check if we're in development mode
  if (import.meta.env.DEV) {
    return "http://localhost:5002";
  }

  // In production, use environment variable or default to relative URLs
  return import.meta.env.VITE_API_BASE_URL || "";
};

const BASE_URL = getBaseURL();

// Common headers for all requests
const getHeaders = (includeContentType = true) => {
  const headers: Record<string, string> = {};

  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
};

// Generic fetch wrapper with error handling
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${BASE_URL}${endpoint}`;

  const defaultOptions: RequestInit = {
    headers: getHeaders(!options.body || typeof options.body === "string"),
    ...options,
  };

  try {
    const response = await fetch(url, defaultOptions);

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error);
    throw error;
  }
};

// User API methods
export const userAPI = {
  // Create a new user
  createUser: async (userData: { username: string; displayName?: string }) => {
    return apiRequest("/api/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  },

  // Get user by username
  getUser: async (username: string) => {
    return apiRequest(`/api/users/${username}`);
  },
};

// Meeting API methods
export const meetingAPI = {
  // Create a new meeting
  createMeeting: async (meetingData: { hostId: string; name?: string }) => {
    return apiRequest("/api/meetings", {
      method: "POST",
      body: JSON.stringify(meetingData),
    });
  },

  // Join an existing meeting
  joinMeeting: async (meetingId: string, userId: string) => {
    return apiRequest(`/api/meetings/${meetingId}/join`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  },

  // End a meeting (host only)
  endMeeting: async (meetingId: string, userId: string) => {
    return apiRequest(`/api/meetings/${meetingId}/end`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  },

  // Leave a meeting
  leaveMeeting: async (meetingId: string, userId: string) => {
    return apiRequest(`/api/meetings/${meetingId}/leave`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  },

  // Get meeting participants
  getParticipants: async (meetingId: string) => {
    return apiRequest(`/api/meetings/${meetingId}/participants`);
  },

  // Check if user is host
  isHost: async (meetingId: string, userId: string) => {
    return apiRequest(`/api/meetings/${meetingId}/is-host/${userId}`);
  },
};

// Export the base URL for socket connections
export const getSocketURL = () => {
  // For Socket.IO, use the same logic as API
  if (import.meta.env.DEV) {
    return "http://localhost:5002";
  }

  // In production, use environment variable or current origin
  return import.meta.env.VITE_SOCKET_URL || window.location.origin;
};

// Export types for better TypeScript support
export interface User {
  _id: string;
  username: string;
  displayName: string;
  createdAt: string;
}

export interface Meeting {
  meetingId: string;
  name: string;
  hostId: string;
  active: boolean;
  createdAt: string;
}

export interface Participant {
  userId: string;
  username: string;
  displayName: string;
  isHost: boolean;
  joinedAt: string;
}

export interface APIResponse<T = any> {
  success?: boolean;
  error?: string;
  data?: T;
}
