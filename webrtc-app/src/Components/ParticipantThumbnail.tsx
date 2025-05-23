import React, { useRef, useEffect } from "react";

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

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;

      if (!isLocal) {
        // Add error handling for remote video
        videoRef.current.onloadedmetadata = () => {
          console.log(`Remote video metadata loaded for ${displayName}`);
        };

        videoRef.current.onerror = (error) => {
          console.error(`Remote video error for ${displayName}:`, error);
        };

        videoRef.current.play().catch((error) => {
          console.error(
            `Failed to play remote video for ${displayName}:`,
            error
          );
        });
      } else {
        // For local video, ensure it's muted and auto-plays
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.autoplay = true;
      }
    }
  }, [stream, isLocal, displayName]);

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
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: isLocal ? "scaleX(-1)" : "none", // Mirror only local video
          }}
        />
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
      </div>
    </div>
  );
};
