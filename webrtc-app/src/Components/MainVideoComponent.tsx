import React, { useRef, useEffect } from "react";

// Component for the main video display when showing a remote participant
export const MainVideoComponent: React.FC<{ stream: MediaStream | null }> = ({
  stream,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    }
  }, [stream]);

  if (!stream) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#343a40",
          color: "white",
        }}
      >
        No video available
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
};
