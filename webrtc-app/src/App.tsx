import { useEffect, useState, useCallback } from "react";
import { Drawer } from "antd";
import Auth from "./Components/Auth/Auth";
import MeetingLobby from "./Components/MeetingLobby/MeetingLobby";
import Chat from "./Components/Chat/Chat";
import { ParticipantThumbnail } from "./Components/ParticipantThumbnail/ParticipantThumbnail";
import { MainVideoComponent } from "./Components/MainVideoComponent/MainVideoComponent";
import { useAppState } from "./hooks/useAppState";
import { useMediaControls } from "./hooks/useMediaControls";
import { useMeetingOperations } from "./hooks/useMeetingOperations";
import { useWebRTCConnection } from "./hooks/useWebRTCConnection";
import { useSocketSetup } from "./hooks/useSocketSetup";
import { useSocketEvents } from "./hooks/useSocketEvents";
import { useEffects } from "./hooks/useEffects";
import { useMediaStatusSync } from "./hooks/useMediaStatusSync";
import { useChat } from "./hooks/useChat";
import { isScreenShareSupported } from "./utils/deviceUtils";
import "./App.css";

function App() {
  // Application state
  const {
    userId,
    setUserId,
    username,
    setUsername,
    meetingId,
    setMeetingId,
    participants,
    setParticipants,
    isHost,
    setIsHost,
    remoteParticipants,
    setRemoteParticipants,
    mainParticipant,
    setMainParticipant,
    inRoom,
    setInRoom,
    isMuted,
    setIsMuted,
    isVideoOff,
    setIsVideoOff,
    isScreenSharing,
    setIsScreenSharing,
    localVideo,
    localStreamRef,
    isEndingMeeting,
    setIsEndingMeeting,
    isCopied,
    setIsCopied,
    chatMessages,
    setChatMessages,
    isChatOpen,
    setIsChatOpen,
    unreadMessagesCount,
    setUnreadMessagesCount,
  } = useAppState();

  // Participants bottom sheet state
  const [isParticipantsSheetOpen, setIsParticipantsSheetOpen] = useState(false);

  // Function to open participants sheet
  const openParticipantsSheet = () => {
    setIsParticipantsSheetOpen(true);
  };

  // Function to close participants sheet
  const closeParticipantsSheet = useCallback(() => {
    setIsParticipantsSheetOpen(false);
  }, []);

  // Check for meeting link in URL parameters and sync with URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlMeetingId = urlParams.get("meetingId");
    
    // If URL has a meeting ID and it's different from current state, update state
    if (urlMeetingId && urlMeetingId !== meetingId) {
      setMeetingId(urlMeetingId);
    }
  }, [meetingId, setMeetingId]);

  // Update URL when meeting ID changes (when joining/creating a meeting)
  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const currentMeetingIdInUrl = currentUrl.searchParams.get("meetingId");

    if (inRoom && meetingId) {
      // Add meeting ID to URL when in a meeting
      if (currentMeetingIdInUrl !== meetingId) {
        currentUrl.searchParams.set("meetingId", meetingId);
        window.history.replaceState({}, document.title, currentUrl.toString());
      }
    } else {
      // Remove meeting ID from URL when not in a meeting
      if (currentMeetingIdInUrl) {
        currentUrl.searchParams.delete("meetingId");
        window.history.replaceState({}, document.title, currentUrl.toString());
      }
    }
  }, [meetingId, inRoom]);

  // Handle participants sheet close on escape key
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isParticipantsSheetOpen) {
        closeParticipantsSheet();
      }
    };

    document.addEventListener("keydown", handleEscapeKey);
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isParticipantsSheetOpen, closeParticipantsSheet]);

  // Socket setup
  const { socketRef, connectionStatus } = useSocketSetup();

  // WebRTC connection management
  const webRTCHandlers = useWebRTCConnection({
    localStreamRef,
    socketRef,
    userId,
    setRemoteParticipants,
  });

  // Media status synchronization
  const { broadcastMediaStatus, handleMediaStatusChanged } = useMediaStatusSync(
    {
      socketRef,
      meetingId,
      userId,
      setRemoteParticipants,
    }
  );

  // Media controls
  const {
    startMedia,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    copyMeetingLink,
  } = useMediaControls({
    localStreamRef,
    localVideo,
    isMuted,
    setIsMuted,
    isVideoOff,
    setIsVideoOff,
    setIsCopied,
    isScreenSharing,
    setIsScreenSharing,
    peerConnections: webRTCHandlers.peerConnections,
    broadcastMediaStatus,
  });

  // Meeting operations
  const {
    handleUserCreated,
    handleCreateMeeting,
    handleJoinMeeting,
    handleLeaveMeeting,
  } = useMeetingOperations({
    userId,
    meetingId,
    isHost,
    socketRef,
    peerConnections: webRTCHandlers.peerConnections,
    localStreamRef,
    localVideo,
    connectionTimeouts: webRTCHandlers.connectionTimeouts,
    setConnectionTimeouts: webRTCHandlers.setConnectionTimeouts,
    connectionStartTimes: webRTCHandlers.connectionStartTimes,
    setRemoteParticipants,
    setInRoom,
    setMeetingId,
    setIsHost,
    setMainParticipant,
    setIsMuted,
    setIsVideoOff,
    setIsEndingMeeting,
    setUserId,
    setUsername,
  });

  // Chat functionality
  const { sendChatMessage, handleChatMessage, clearUnreadMessages } = useChat({
    socketRef,
    meetingId,
    userId,
    username,
    chatMessages,
    setChatMessages,
    isChatOpen,
    setUnreadMessagesCount,
  });

  // Socket events
  const { joinRoom } = useSocketEvents({
    socketRef,
    meetingId,
    userId,
    isEndingMeeting,
    onUserJoined: webRTCHandlers.handleUserJoined,
    onUserLeft: webRTCHandlers.handleUserLeft,
    onExistingParticipants: webRTCHandlers.handleExistingParticipants,
    onOffer: webRTCHandlers.handleOffer,
    onAnswer: webRTCHandlers.handleAnswer,
    onIceCandidate: webRTCHandlers.handleIceCandidate,
    onLeaveMeeting: handleLeaveMeeting,
    onMediaStatusChanged: handleMediaStatusChanged,
    onChatMessage: handleChatMessage,
  });

  // Effects management
  useEffects({
    inRoom,
    meetingId,
    userId,
    localStreamRef,
    startMedia,
    joinRoom,
    setParticipants,
  });

  // Switch main participant view
  const switchToMainView = (participantId: string | null) => {
    setMainParticipant(participantId);
  };

  // Chat functionality
  const toggleChat = () => {
    if (!isChatOpen) {
      // Opening chat - clear unread messages
      clearUnreadMessages();
    }
    setIsChatOpen(!isChatOpen);
  };

  // Ensure local video has stream when it becomes main view
  useEffect(() => {
    if (
      mainParticipant === null &&
      localVideo.current &&
      localStreamRef.current
    ) {
      // User has switched to themselves as main view
      if (localVideo.current.srcObject !== localStreamRef.current) {
        console.log("Setting local stream to main video element");
        const videoElement = localVideo.current;
        const stream = localStreamRef.current;

        // Clear any existing stream first
        if (videoElement.srcObject) {
          videoElement.pause();
          videoElement.srcObject = null;
        }

        // Set up new stream
        videoElement.srcObject = stream;
        videoElement.playsInline = true;
        videoElement.muted = true; // Local video should always be muted

        // Enhanced play function for local video
        const playLocalVideo = async () => {
          if (!videoElement || !stream) return;

          try {
            await videoElement.play();
            console.log("Local main video started playing");
          } catch (playError) {
            console.warn("Local main video autoplay failed:", playError);

            // For local video, we can be more aggressive with retry
            setTimeout(async () => {
              try {
                await videoElement.play();
                console.log("Local main video started playing after retry");
              } catch (retryError) {
                console.error(
                  "Local main video play retry failed:",
                  retryError
                );

                // Set up click listener to play on user interaction
                const playOnClick = async () => {
                  try {
                    await videoElement.play();
                    console.log(
                      "Local main video started after user interaction"
                    );
                    document.removeEventListener("click", playOnClick);
                  } catch (interactionError) {
                    console.error(
                      "Local main video play after interaction failed:",
                      interactionError
                    );
                  }
                };
                document.addEventListener("click", playOnClick, { once: true });
              }
            }, 500);
          }
        };

        // Wait for metadata to be loaded before playing
        if (videoElement.readyState >= 1) {
          playLocalVideo();
        } else {
          const handleLoadedMetadata = () => {
            playLocalVideo();
            videoElement.removeEventListener(
              "loadedmetadata",
              handleLoadedMetadata
            );
          };
          videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);
        }
      }
    }
  }, [mainParticipant, localStreamRef, localVideo]);

  // Handle logout
  const handleLogout = () => {
    if (inRoom) {
      handleLeaveMeeting();
    }

    if (localStreamRef.current) {
      console.log("Logout: Stopping all media tracks...");
      localStreamRef.current.getTracks().forEach((track) => {
        console.log(`Logout: Stopping ${track.kind} track`);
        track.stop();
      });
      localStreamRef.current = null;
    }

    if (localVideo.current) {
      console.log("Logout: Clearing local video element...");
      localVideo.current.srcObject = null;
      localVideo.current.pause();
    }

    setUserId(null);
    setUsername(null);
    setMeetingId(null);
    setInRoom(false);
    setIsHost(false);
    setMainParticipant(null);
    setIsMuted(false);
    setIsVideoOff(false);

    // Clear meeting ID from URL on logout
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.get("meetingId")) {
      currentUrl.searchParams.delete("meetingId");
      window.history.replaceState({}, document.title, currentUrl.toString());
    }

    console.log("User logged out and all media stopped");
  };

  // If not authenticated, show login
  if (!userId || !username) {
    return <Auth onUserCreated={handleUserCreated} />;
  }

  // If authenticated but not in a meeting, show meeting lobby
  if (!inRoom) {
    return (
      <MeetingLobby
        userId={userId}
        username={username}
        onJoinMeeting={handleJoinMeeting}
        onCreateMeeting={handleCreateMeeting}
        onLogout={handleLogout}
        initialMeetingId={meetingId || undefined}
      />
    );
  }

  // Get the main participant to display
  const getMainParticipantStream = () => {
    if (mainParticipant) {
      // If a remote participant is selected as main
      const found = Array.from(remoteParticipants.values()).find(
        (p) => p.userId === mainParticipant
      );
      if (found && found.stream) {
        return { stream: found.stream, isLocal: false, userId: found.userId };
      }
    }

    // Default to local user if no main participant selected or not found
    return { stream: localStreamRef.current, isLocal: true, userId: userId };
  };

  const mainView = getMainParticipantStream();
  const mainParticipantInfo = mainView.isLocal
    ? { displayName: username, isHost }
    : participants.find((p) => p.userId === mainView.userId);

  return (
    <div className="app-container">
      {/* Status bar with connection indicator */}
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

      {/* Main content area */}
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
                    {isMuted && (
                      <div className="muted-indicator-overlay">🔇</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <MainVideoComponent stream={mainView.stream} />
            )}
          </div>
        </div>

        {/* Participant sidebar */}
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
              const remoteParticipantList = Array.from(
                remoteParticipants.values()
              );
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
                      displayName = `User ${identifier
                        .slice(-4)
                        .toUpperCase()}`;
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
                    isMuted={participant.isMuted}
                    isVideoOff={participant.isVideoOff}
                    isScreenSharing={participant.isScreenSharing}
                  />
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* Controls */}
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
          {participants.length > 1 && (
            <span className="participants-badge">{participants.length}</span>
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

      {/* Chat Component - Desktop */}
      <div className="chat-desktop">
        {isChatOpen && (
          <Chat
            chatMessages={chatMessages}
            onSendMessage={sendChatMessage}
            isOpen={isChatOpen}
            onClose={toggleChat}
            currentUserId={userId}
            participantsCount={participants.length}
          />
        )}
      </div>

      {/* Chat Drawer - Mobile */}
      <Drawer
        title={`Chat (${participants.length})`}
        placement="bottom"
        height="75vh"
        open={isChatOpen}
        onClose={toggleChat}
        className="chat-drawer"
        styles={{
          body: { padding: "0" },
          header: { borderBottom: "1px solid #f0f0f0" },
        }}
      >
        <div className="drawer-chat">
          {/* Messages Container */}
          <div className="drawer-chat-messages">
            {chatMessages.length === 0 ? (
              <div className="chat-empty">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`chat-message ${
                    message.userId === userId ? "own-message" : "other-message"
                  }`}
                >
                  <div className="message-bubble">
                    <div className="message-header">
                      <span className="message-sender">
                        {message.userId === userId ? "You" : message.username}
                      </span>
                      <span className="message-time">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="message-content">{message.message}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Message Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const message = formData.get("message") as string;
              if (message.trim()) {
                sendChatMessage(message.trim());
                e.currentTarget.reset();
              }
            }}
            className="drawer-chat-input-form"
          >
            <div className="drawer-chat-input-container">
              <input
                type="text"
                name="message"
                placeholder="Type a message..."
                className="drawer-chat-input"
                maxLength={500}
                autoComplete="off"
              />
              <button type="submit" className="drawer-chat-send-button">
                Send
              </button>
            </div>
          </form>
        </div>
      </Drawer>

      {/* Participants Drawer */}
      <Drawer
        title={`Participants (${participants.length})`}
        placement="bottom"
        height="auto"
        open={isParticipantsSheetOpen}
        onClose={closeParticipantsSheet}
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
                onClick={() => {
                  if (isLocalUser) {
                    setMainParticipant(null);
                  } else {
                    setMainParticipant(participant.userId);
                  }
                  closeParticipantsSheet();
                }}
              >
                <div
                  className={`participant-avatar ${
                    isLocalUser ? "local" : ""
                  } ${participant.isHost ? "host" : ""}`}
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
                    {participant.displayName ||
                      participant.username ||
                      "Unknown"}
                  </div>
                  <div className="participant-status">
                    {isLocalUser ? (
                      <>
                        {isMuted && (
                          <span className="status-indicator muted">
                            🔇 Muted
                          </span>
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
                          <span className="status-indicator muted">
                            🔇 Muted
                          </span>
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
    </div>
  );
}

export default App;
