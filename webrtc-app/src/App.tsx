import { useEffect, useState, useCallback } from "react";
import Auth from "./Components/Auth/Auth";
import MeetingLobby from "./Components/MeetingLobby/MeetingLobby";
import Chat from "./Components/Chat/Chat";
import { Control } from "./Components/Control/Control";
import { ChatMobile } from "./Components/ChatMobile/ChatMobile";
import ParticipantsDrawer from "./Components/ParticipantsDrawer/ParticipantsDrawer";
import StatusBar from "./Components/StatusBar/StatusBar";
import MainContent from "./Components/Main/MainContent/MainContent";
import { useAppState } from "./hooks/useAppState";
import { useMediaControls } from "./hooks/useMediaControls";
import { useMeetingOperations } from "./hooks/useMeetingOperations";
import { useWebRTCConnection } from "./hooks/useWebRTCConnection";
import { useSocketSetup } from "./hooks/useSocketSetup";
import { useSocketEvents } from "./hooks/useSocketEvents";
import { useEffects } from "./hooks/useEffects";
import { useMediaStatusSync } from "./hooks/useMediaStatusSync";
import { useChat } from "./hooks/useChat";
import { useResponsive } from "./hooks/useResponsive";
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

  // Responsive layout detection - true if drawer should be used (mobile device OR small viewport)
  // Updated: Chat drawer now conditionally renders instead of using CSS display properties
  const shouldUseDrawer = useResponsive(768);

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
      <StatusBar
        connectionStatus={connectionStatus}
        meetingId={meetingId}
        isHost={isHost}
        isCopied={isCopied}
        copyMeetingLink={copyMeetingLink}
      />

      {/* Main content area */}
      <MainContent
        mainView={mainView}
        mainParticipantInfo={mainParticipantInfo}
        userId={userId}
        username={username}
        isHost={isHost}
        localVideo={localVideo}
        localStreamRef={localStreamRef}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        participants={participants}
        remoteParticipants={remoteParticipants}
        mainParticipant={mainParticipant}
        switchToMainView={switchToMainView}
      />

      {/* Controls */}
      <Control
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        toggleAudio={toggleAudio}
        toggleVideo={toggleVideo}
        toggleScreenShare={toggleScreenShare}
        isChatOpen={isChatOpen}
        unreadMessagesCount={unreadMessagesCount}
        toggleChat={toggleChat}
        isParticipantsSheetOpen={isParticipantsSheetOpen}
        participantsCount={participants.length}
        openParticipantsSheet={openParticipantsSheet}
        isHost={isHost}
        handleLeaveMeeting={handleLeaveMeeting}
      />

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

      {/* Chat Mobile - Mobile and Small Viewports */}
      {shouldUseDrawer && (
        <ChatMobile
          isOpen={isChatOpen}
          onClose={toggleChat}
          chatMessages={chatMessages}
          onSendMessage={sendChatMessage}
          currentUserId={userId}
          participantsCount={participants.length}
        />
      )}

      {/* Participants Drawer */}
      <ParticipantsDrawer
        isOpen={isParticipantsSheetOpen}
        onClose={closeParticipantsSheet}
        participants={participants}
        remoteParticipants={remoteParticipants}
        userId={userId}
        mainParticipant={mainParticipant}
        setMainParticipant={setMainParticipant}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
      />
    </div>
  );
}

export default App;
