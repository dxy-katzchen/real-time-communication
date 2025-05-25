import { useEffect } from "react";
import Auth from "./Components/Auth/Auth";
import MeetingLobby from "./Components/MeetingLobby/MeetingLobby";
import Chat from "./Components/Chat/Chat";
import { ParticipantThumbnail } from "./Components/ParticipantThumbnail";
import { MainVideoComponent } from "./Components/MainVideoComponent";
import { useAppState } from "./hooks/useAppState";
import { useMediaControls } from "./hooks/useMediaControls";
import { useMeetingOperations } from "./hooks/useMeetingOperations";
import { useWebRTCConnection } from "./hooks/useWebRTCConnection";
import { useSocketSetup } from "./hooks/useSocketSetup";
import { useSocketEvents } from "./hooks/useSocketEvents";
import { useEffects } from "./hooks/useEffects";
import { useMediaStatusSync } from "./hooks/useMediaStatusSync";
import { useChat } from "./hooks/useChat";
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
  const { startMedia, toggleAudio, toggleVideo, copyMeetingId } =
    useMediaControls({
      localStreamRef,
      localVideo,
      isMuted,
      setIsMuted,
      isVideoOff,
      setIsVideoOff,
      setIsCopied,
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
        localVideo.current.srcObject = localStreamRef.current;
        localVideo.current.play().catch(console.error);
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

    console.log("User logged out and all media stopped");
  };

  // If not authenticated, show login
  if (!userId || !username) {
    return <Auth onUserCreated={handleUserCreated} />;
  }

  // If authenticated but not in a meeting, show meeting lobby
  if (!inRoom || !meetingId) {
    return (
      <MeetingLobby
        userId={userId}
        username={username}
        onJoinMeeting={handleJoinMeeting}
        onCreateMeeting={handleCreateMeeting}
        onLogout={handleLogout}
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
      {/* Status bar */}
      <div
        className={`status-bar ${
          connectionStatus === "Connected"
            ? "status-bar--connected"
            : "status-bar--disconnected"
        }`}
      >
        <div className="status-bar-content">
          <span>
            Meeting ID: {meetingId} {isHost && "(Host)"}
          </span>
          <button
            onClick={() => copyMeetingId(meetingId)}
            className="copy-meeting-button"
            title="Copy Meeting ID"
          >
            {isCopied ? "✅ Copied!" : "📋 Copy"}
          </button>
        </div>
        <span>Status: {connectionStatus}</span>
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
                  autoPlay
                  muted
                  playsInline
                  className="main-video"
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
                const info = participants.find(
                  (p) => p.userId === participant.userId
                );
                const displayName =
                  info?.displayName || info?.username || "Unknown";
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

      {/* Chat Component */}
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
  );
}

export default App;
