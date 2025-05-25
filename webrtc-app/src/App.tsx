import Auth from "./Components/Auth";
import MeetingLobby from "./Components/MeetingLobby";
import { ParticipantThumbnail } from "./Components/ParticipantThumbnail";
import { MainVideoComponent } from "./Components/MainVideoComponent";
import { useAppState } from "./hooks/useAppState";
import { useMediaControls } from "./hooks/useMediaControls";
import { useMeetingOperations } from "./hooks/useMeetingOperations";
import { useWebRTCConnection } from "./hooks/useWebRTCConnection";
import { useSocketSetup } from "./hooks/useSocketSetup";
import { useSocketEvents } from "./hooks/useSocketEvents";
import { useEffects } from "./hooks/useEffects";
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

  // Media controls
  const { startMedia, toggleAudio, toggleVideo, copyMeetingId } =
    useMediaControls({
      localStreamRef,
      localVideo,
      isMuted,
      setIsMuted,
      isVideoOff,
      setIsVideoOff,
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
    startMedia,
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span>
            Meeting ID: {meetingId} {isHost && "(Host)"}
          </span>
          <button
            onClick={() => copyMeetingId(meetingId)}
            className="copy-meeting-button"
            title="Copy Meeting ID"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              borderRadius: "4px",
              color: "white",
              padding: "4px 8px",
              fontSize: "12px",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "rgba(255, 255, 255, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                "rgba(255, 255, 255, 0.2)";
            }}
          >
            📋 Copy
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
              <video
                ref={localVideo}
                autoPlay
                muted
                playsInline
                className="main-video"
              />
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
            {Array.from(remoteParticipants.values()).map((participant) => {
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
                />
              );
            })}
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
          onClick={webRTCHandlers.handleReconnect}
          className="control-button control-button--reconnect"
          title="Reconnect all video streams"
        >
          🔄 Reconnect
        </button>

        <button
          onClick={handleLeaveMeeting}
          className="control-button control-button--leave"
        >
          {isHost ? "End Meeting" : "Leave"}
        </button>
      </div>
    </div>
  );
}

export default App;
