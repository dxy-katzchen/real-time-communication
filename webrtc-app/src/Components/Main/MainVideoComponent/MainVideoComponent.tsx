import React, { useRef, useEffect, useState } from "react";
import "./MainVideoComponent.css";

// Component for the main video display when showing a remote participant
export const MainVideoComponent: React.FC<{ stream: MediaStream | null }> = ({
  stream,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const streamIdRef = useRef<string | null>(null);
  const playAttemptRef = useRef<number>(0);
  const maxPlayAttempts = 5;

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !stream) {
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

    console.log(`Setting up main video display, stream: ${currentStreamId}`);
    streamIdRef.current = currentStreamId;
    setHasError(false);
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
    videoElement.muted = false;
    videoElement.volume = 0.8;

    // Enhanced play function with retry logic
    const playVideo = async () => {
      if (
        !videoElement ||
        !stream ||
        playAttemptRef.current >= maxPlayAttempts
      ) {
        if (playAttemptRef.current >= maxPlayAttempts) {
          console.error(`Max play attempts reached for main video`);
          setHasError(true);
        }
        setIsLoading(false);
        return;
      }

      playAttemptRef.current++;
      console.log(
        `Main video play attempt ${playAttemptRef.current}, readyState: ${videoElement.readyState}`
      );

      try {
        await videoElement.play();
        console.log(`Main video started playing`);
        setHasError(false);
        setIsLoading(false);
        playAttemptRef.current = 0; // Reset on success
      } catch (playError) {
        console.warn(
          `Main video play attempt ${playAttemptRef.current} failed:`,
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

          setTimeout(playVideo, 500); // Fixed delay instead of increasing
        } else {
          console.error(`All play attempts failed for main video`);
          setHasError(true);
          setIsLoading(false);

          // Last resort: wait for user interaction
          const playOnInteraction = async () => {
            try {
              await videoElement.play();
              setHasError(false);
              console.log(`Main video started after user interaction`);
              // Remove listeners after successful play
              document.removeEventListener("click", playOnInteraction);
              document.removeEventListener("touchstart", playOnInteraction);
              document.removeEventListener("keydown", playOnInteraction);
            } catch (interactionError) {
              console.error(
                `Failed to play main video after interaction:`,
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
    };

    // Add comprehensive event listeners
    const handleLoadedMetadata = () => {
      console.log(`Main video metadata loaded`);
    };

    const handleCanPlay = () => {
      console.log(
        `Main video can play, readyState: ${videoElement?.readyState}`
      );
      setIsLoading(false); // Clear loading state when video can play
      playVideo();
    };

    const handlePlay = () => {
      console.log(`Main video play event`);
      setHasError(false);
      setIsLoading(false);
      // Restore volume if it was lowered
      if (videoElement && videoElement.volume < 0.8) {
        videoElement.volume = 0.8;
      }
      // Unmute if it was muted for play strategy
      if (videoElement && videoElement.muted) {
        videoElement.muted = false;
      }
    };

    const handlePause = () => {
      console.log(`Main video pause event`);
    };

    const handleError = (error: Event) => {
      console.error(`Main video error:`, error);
      setHasError(true);
      setIsLoading(false);
    };

    const handleLoadStart = () => {
      console.log(`Main video load started`);
      setIsLoading(true);
    };

    const handleWaiting = () => {
      console.log(`Main video waiting`);
      setIsLoading(true);
    };

    const handleCanPlayThrough = () => {
      console.log(`Main video can play through`);
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
        console.log("Main video loading timeout - clearing loading state");
        setIsLoading(false);
        // Try to play anyway
        playVideo();
      }
    }, 3000); // 3 second timeout

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
  }, [stream]);

  if (!stream) {
    return <div className="main-video-no-stream">No video available</div>;
  }

  return (
    <div className="main-video-container">
      <video ref={videoRef} playsInline className="main-video" />

      {/* Loading overlay */}
      {isLoading && (
        <div className="main-video-loading-overlay">Loading video...</div>
      )}

      {/* Error overlay */}
      {hasError && (
        <div className="main-video-error-overlay">
          <div>Video playback error</div>
          <div className="main-video-error-subtitle">
            Click anywhere to retry
          </div>
        </div>
      )}
    </div>
  );
};
