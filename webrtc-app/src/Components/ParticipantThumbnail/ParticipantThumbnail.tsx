import React, { useRef, useEffect, useState } from "react";
import "./ParticipantThumbnail.css";

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
  isScreenSharing?: boolean;
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
  isScreenSharing,
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

      playAttemptRef.current++;
      console.log(
        `Play attempt ${playAttemptRef.current} for ${displayName}, readyState: ${videoElement.readyState}`
      );

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
            if (!isLocal) videoElement.volume = 0.01;
          } else if (playAttemptRef.current === 2) {
            // Strategy 2: Try muted first, then unmute
            videoElement.muted = true;
          }

          setTimeout(playVideo, 500); // Fixed delay
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
      console.log(
        `Video can play for ${displayName}, readyState: ${videoElement?.readyState}`
      );
      setIsLoading(false); // Clear loading state when video can play
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

    // Set a timeout to clear loading state if it gets stuck
    const loadingTimeout = setTimeout(() => {
      if (videoElement && stream) {
        console.log(
          `Video loading timeout for ${displayName} - clearing loading state`
        );
        setIsLoading(false);
        // Try to play anyway
        playVideo();
      }
    }, 3000); // 3 second timeout

    // For local video, start playing immediately
    if (isLocal) {
      playVideo();
    }

    // Cleanup function
    return () => {
      clearTimeout(loadingTimeout);
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

  // Handle video visibility - always show video element if stream exists
  // We'll handle the visual state of disabled video with an overlay
  const showVideo = !!stream;

  return (
    <div
      onClick={onClick}
      className={`participant-thumbnail ${isActive ? "active" : ""}`}
    >
      {/* Video thumbnail */}
      {showVideo ? (
        <div className="participant-thumbnail-video-container">
          <video
            ref={videoRef}
            playsInline
            className={`participant-thumbnail-video ${
              isLocal && !isScreenSharing ? "mirrored" : ""
            }`}
          />

          {/* Video off overlay */}
          {isVideoOff && (
            <div className="participant-thumbnail-video-off-overlay">
              <div className="participant-thumbnail-avatar">
                {displayName.charAt(0).toUpperCase()}
              </div>
              {isMuted && (
                <div className="participant-thumbnail-muted-indicator">🔇</div>
              )}
            </div>
          )}

          {/* Loading indicator */}
          {(isLoading || (!isPlaying && !hasError)) && (
            <div className="participant-thumbnail-loading-indicator">
              <div className="participant-thumbnail-loading-spinner" />
              Loading...
            </div>
          )}

          {/* Error indicator */}
          {hasError && (
            <div className="participant-thumbnail-error-indicator">
              Video Error
              <br />
              <small>Click to retry</small>
            </div>
          )}

          {/* Click to play indicator for failed videos */}
          {hasError && !isLocal && (
            <div
              className="participant-thumbnail-play-button"
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
        <div className="participant-thumbnail-no-video">
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Name label */}
      <div className="participant-thumbnail-name-label">
        {isLocal ? "You" : displayName} {isHost && "👑"}
      </div>

      {/* Status indicators */}
      <div className="participant-thumbnail-status-indicators">
        {/* Audio status indicator */}
        {isMuted && (
          <div
            className="participant-thumbnail-status-indicator"
            title={isLocal ? "You are muted" : `${displayName} is muted`}
          >
            🔇
          </div>
        )}

        {/* Video status indicator */}
        {isVideoOff && (
          <div
            className="participant-thumbnail-status-indicator"
            title={
              isLocal ? "Your video is off" : `${displayName}'s video is off`
            }
          >
            📵
          </div>
        )}

        {/* Screen sharing status indicator */}
        {isScreenSharing && (
          <div
            className="participant-thumbnail-status-indicator screen-sharing"
            title={
              isLocal
                ? "You are sharing screen"
                : `${displayName} is sharing screen`
            }
          >
            🖥️
          </div>
        )}

        {/* Connection status for remote videos */}
        {!isLocal && (
          <div
            className={`participant-thumbnail-connection-status ${
              isPlaying ? "connected" : hasError ? "error" : "loading"
            }`}
          />
        )}
      </div>
    </div>
  );
};
