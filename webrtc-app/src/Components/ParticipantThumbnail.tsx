import React, { useRef, useEffect, useState } from "react";

// Component for participant thumbnails in the sidebar
export const ParticipantThumbnail: React.FC<{
  isLocal: boolean;
  stream: MediaStream | null | undefined;
  userId: string;
  displayName: string;
  isHost: boolean;
  isActive: boolean;
  onClick: () => void;
  isMuted?: boolean;
  isVideoOff?: boolean;
}> = ({
  isLocal,
  stream,
  userId,
  displayName,
  isHost,
  isActive,
  onClick,
  isMuted,
  isVideoOff,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const streamIdRef = useRef<string | null>(null);
  const playAttemptRef = useRef<number>(0);
  const maxPlayAttempts = 5;

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !stream) {
      setIsPlaying(false);
      setIsLoading(false);
      return;
    }

    // Check if this is a different stream
    const currentStreamId = stream.id;
    if (
      streamIdRef.current === currentStreamId &&
      videoElement.srcObject === stream
    ) {
      return; // Same stream, no need to update
    }

    console.log(
      `Setting up video for ${displayName} (${userId}), stream: ${currentStreamId}`
    );
    streamIdRef.current = currentStreamId;
    setHasError(false);
    setIsPlaying(false);
    setIsLoading(true);
    playAttemptRef.current = 0;

    // Clear any existing stream first
    if (videoElement.srcObject) {
      videoElement.pause();
      videoElement.srcObject = null;
    }

    // Set up new stream
    videoElement.srcObject = stream;

    // Configure video element
    videoElement.playsInline = true;
    videoElement.autoplay = true;

    if (isLocal) {
      videoElement.muted = true;
    } else {
      videoElement.muted = false;
      videoElement.volume = 0.8; // Set reasonable volume for remote videos
    }

    // Enhanced play function with retry logic
    const playVideo = async () => {
      if (
        !videoElement ||
        !stream ||
        playAttemptRef.current >= maxPlayAttempts
      ) {
        if (playAttemptRef.current >= maxPlayAttempts) {
          console.error(`Max play attempts reached for ${displayName}`);
          setHasError(true);
        }
        setIsLoading(false);
        return;
      }

      // Check if video is ready
      if (videoElement.readyState < 2) {
        console.log(`Video not ready for ${displayName}, waiting...`);
        setTimeout(playVideo, 200);
        return;
      }

      playAttemptRef.current++;
      console.log(`Play attempt ${playAttemptRef.current} for ${displayName}`);

      try {
        await videoElement.play();
        console.log(`Video started playing for ${displayName}`);
        setIsPlaying(true);
        setHasError(false);
        setIsLoading(false);
        playAttemptRef.current = 0; // Reset on success
      } catch (playError) {
        console.warn(
          `Play attempt ${playAttemptRef.current} failed for ${displayName}:`,
          playError
        );

        if (playAttemptRef.current < maxPlayAttempts) {
          // Try different strategies
          if (playAttemptRef.current === 1) {
            // Strategy 1: Try with very low volume
            videoElement.volume = 0.01;
          } else if (playAttemptRef.current === 2) {
            // Strategy 2: Try muted first, then unmute
            videoElement.muted = true;
          }

          setTimeout(playVideo, playAttemptRef.current * 500); // Increasing delay
        } else {
          console.error(`All play attempts failed for ${displayName}`);
          setHasError(true);
          setIsLoading(false);

          // Last resort: wait for user interaction
          if (!isLocal) {
            const playOnInteraction = async () => {
              try {
                await videoElement.play();
                setIsPlaying(true);
                setHasError(false);
                console.log(
                  `Video started after user interaction for ${displayName}`
                );
                // Remove listeners after successful play
                document.removeEventListener("click", playOnInteraction);
                document.removeEventListener("touchstart", playOnInteraction);
                document.removeEventListener("keydown", playOnInteraction);
              } catch (interactionError) {
                console.error(
                  `Failed to play video after interaction for ${displayName}:`,
                  interactionError
                );
              }
            };

            document.addEventListener("click", playOnInteraction, {
              once: true,
            });
            document.addEventListener("touchstart", playOnInteraction, {
              once: true,
            });
            document.addEventListener("keydown", playOnInteraction, {
              once: true,
            });
          }
        }
      }
    };

    // Add comprehensive event listeners
    const handleLoadedMetadata = () => {
      console.log(`Video metadata loaded for ${displayName}`);
    };

    const handleCanPlay = () => {
      console.log(`Video can play for ${displayName}`);
      if (!isLocal || playAttemptRef.current === 0) {
        playVideo();
      }
    };

    const handlePlay = () => {
      console.log(`Video play event for ${displayName}`);
      setIsPlaying(true);
      setHasError(false);
      setIsLoading(false);
      // Restore volume if it was lowered
      if (!isLocal && videoElement.volume < 0.8) {
        videoElement.volume = 0.8;
      }
      // Unmute if it was muted for play strategy
      if (!isLocal && videoElement.muted) {
        videoElement.muted = false;
      }
    };

    const handlePause = () => {
      console.log(`Video pause event for ${displayName}`);
      setIsPlaying(false);
    };

    const handleError = (error: Event) => {
      console.error(`Video error for ${displayName}:`, error);
      setHasError(true);
      setIsPlaying(false);
      setIsLoading(false);
    };

    const handleLoadStart = () => {
      console.log(`Video load started for ${displayName}`);
      setIsLoading(true);
    };

    const handleWaiting = () => {
      console.log(`Video waiting for ${displayName}`);
      setIsLoading(true);
    };

    const handleCanPlayThrough = () => {
      console.log(`Video can play through for ${displayName}`);
      setIsLoading(false);
    };

    // Add all event listeners
    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);
    videoElement.addEventListener("canplay", handleCanPlay);
    videoElement.addEventListener("play", handlePlay);
    videoElement.addEventListener("pause", handlePause);
    videoElement.addEventListener("error", handleError);
    videoElement.addEventListener("loadstart", handleLoadStart);
    videoElement.addEventListener("waiting", handleWaiting);
    videoElement.addEventListener("canplaythrough", handleCanPlayThrough);

    // For local video, start playing immediately
    if (isLocal) {
      playVideo();
    }

    // Cleanup function
    return () => {
      if (videoElement) {
        videoElement.removeEventListener(
          "loadedmetadata",
          handleLoadedMetadata
        );
        videoElement.removeEventListener("canplay", handleCanPlay);
        videoElement.removeEventListener("play", handlePlay);
        videoElement.removeEventListener("pause", handlePause);
        videoElement.removeEventListener("error", handleError);
        videoElement.removeEventListener("loadstart", handleLoadStart);
        videoElement.removeEventListener("waiting", handleWaiting);
        videoElement.removeEventListener(
          "canplaythrough",
          handleCanPlayThrough
        );
      }
    };
  }, [stream, isLocal, displayName, userId]);

  // Handle video visibility for local video when toggled off
  const showVideo = stream && (!isVideoOff || !isLocal);

  return (
    <div
      onClick={onClick}
      style={{
        marginBottom: "10px",
        cursor: "pointer",
        border: isActive ? "2px solid #0d6efd" : "1px solid #dee2e6",
        borderRadius: "4px",
        overflow: "hidden",
        backgroundColor: "#000",
        position: "relative",
        height: "120px",
      }}
    >
      {/* Video thumbnail */}
      {showVideo ? (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <video
            ref={videoRef}
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: isLocal ? "scaleX(-1)" : "none", // Mirror only local video
              backgroundColor: "#000",
            }}
          />

          {/* Loading indicator */}
          {(isLoading || (!isPlaying && !hasError)) && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                color: "white",
                fontSize: "12px",
                backgroundColor: "rgba(0,0,0,0.7)",
                padding: "5px 10px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  border: "2px solid #ffffff",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              Loading...
            </div>
          )}

          {/* Error indicator */}
          {hasError && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                color: "white",
                fontSize: "12px",
                backgroundColor: "rgba(220,53,69,0.8)",
                padding: "5px 10px",
                borderRadius: "4px",
                textAlign: "center",
              }}
            >
              Video Error
              <br />
              <small>Click to retry</small>
            </div>
          )}

          {/* Click to play indicator for failed videos */}
          {hasError && !isLocal && (
            <div
              style={{
                position: "absolute",
                bottom: "5px",
                right: "5px",
                color: "white",
                fontSize: "16px",
                cursor: "pointer",
              }}
              onClick={(e) => {
                e.stopPropagation();
                const video = videoRef.current;
                if (video) {
                  video.play().catch(console.error);
                }
              }}
            >
              ▶️
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#6c757d",
            color: "white",
            fontSize: "24px",
          }}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Name label */}
      <div
        style={{
          position: "absolute",
          bottom: "0",
          left: "0",
          right: "0",
          backgroundColor: "rgba(0,0,0,0.5)",
          color: "white",
          padding: "2px 5px",
          fontSize: "12px",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {isLocal ? "You" : displayName} {isHost && "👑"}
      </div>

      {/* Status indicators */}
      <div
        style={{
          position: "absolute",
          top: "5px",
          left: "5px",
          display: "flex",
          gap: "5px",
        }}
      >
        {/* Audio status indicator */}
        {isLocal && isMuted && (
          <div
            style={{
              backgroundColor: "rgba(220,53,69,0.8)",
              color: "white",
              borderRadius: "50%",
              width: "20px",
              height: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
            }}
          >
            🔇
          </div>
        )}

        {/* Video status indicator */}
        {isLocal && isVideoOff && (
          <div
            style={{
              backgroundColor: "rgba(220,53,69,0.8)",
              color: "white",
              borderRadius: "50%",
              width: "20px",
              height: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
            }}
          >
            📵
          </div>
        )}

        {/* Connection status for remote videos */}
        {!isLocal && (
          <div
            style={{
              backgroundColor: isPlaying
                ? "rgba(40,167,69,0.8)"
                : hasError
                ? "rgba(220,53,69,0.8)"
                : "rgba(255,193,7,0.8)",
              color: "white",
              borderRadius: "50%",
              width: "8px",
              height: "8px",
            }}
          />
        )}
      </div>

      {/* Add CSS animation for loading spinner */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};
