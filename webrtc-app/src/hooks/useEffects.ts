import { useEffect } from "react";
import { meetingAPI } from "../Service/api";

interface UseEffectsProps {
  inRoom: boolean;
  meetingId: string | null;
  userId: string | null;
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  startMedia: () => Promise<void>;
  joinRoom: () => void;
  setParticipants: React.Dispatch<
    React.SetStateAction<
      Array<{
        userId: string;
        username?: string;
        displayName?: string;
        isHost?: boolean;
      }>
    >
  >;
}

export const useEffects = ({
  inRoom,
  meetingId,
  userId,
  localStreamRef,
  startMedia,
  joinRoom,
  setParticipants,
}: UseEffectsProps) => {
  // Start media when joining room
  useEffect(() => {
    if (inRoom && !localStreamRef.current) {
      console.log("Starting media for room join");
      startMedia();
    }

    // Cleanup function for component unmount or when leaving room
    return () => {
      if (localStreamRef.current) {
        console.log("Cleanup: Stopping all media tracks...");
        localStreamRef.current.getTracks().forEach((track) => {
          console.log(`Cleanup: Stopping ${track.kind} track`);
          track.stop();
        });
        localStreamRef.current = null;
      }
    };
  }, [inRoom, localStreamRef, startMedia]);

  // Join room when inRoom changes
  useEffect(() => {
    if (inRoom && userId) {
      joinRoom();
    }
  }, [inRoom, joinRoom, userId]);

  // Fetch participants periodically using API service
  useEffect(() => {
    if (meetingId) {
      const fetchParticipants = async () => {
        try {
          const data = await meetingAPI.getParticipants(meetingId);
          setParticipants(data);
        } catch (err) {
          console.error("Error fetching participants:", err);
        }
      };

      fetchParticipants();
      const intervalId = setInterval(fetchParticipants, 10000);
      return () => clearInterval(intervalId);
    }
  }, [meetingId, inRoom, setParticipants]);

  // Network diagnostics on app start
  useEffect(() => {
    const runNetworkDiagnostics = async () => {
      console.log("Running network diagnostics...");

      try {
        const stunTest = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });

        stunTest.createDataChannel("test");
        const offer = await stunTest.createOffer();
        await stunTest.setLocalDescription(offer);

        return new Promise((resolve) => {
          let stunWorking = false;
          let turnWorking = false;

          stunTest.onicecandidate = (event) => {
            if (event.candidate) {
              console.log("ICE candidate found:", {
                type: event.candidate.type,
                protocol: event.candidate.protocol,
                address: event.candidate.address,
              });

              if (event.candidate.type === "srflx") {
                stunWorking = true;
              } else if (event.candidate.type === "relay") {
                turnWorking = true;
              }
            } else {
              console.log("ICE gathering complete");
              console.log("Network diagnostics results:", {
                stunWorking,
                turnWorking,
                recommendation: stunWorking
                  ? turnWorking
                    ? "Network should work well"
                    : "Network should work for most cases"
                  : "Network may have issues, check firewall settings",
              });
              stunTest.close();
              resolve({ stunWorking, turnWorking });
            }
          };

          // Timeout after 10 seconds
          setTimeout(() => {
            console.log("Network diagnostics timeout");
            stunTest.close();
            resolve({ stunWorking, turnWorking });
          }, 10000);
        });
      } catch (error) {
        console.error("Network diagnostics failed:", error);
        return { stunWorking: false, turnWorking: false };
      }
    };

    runNetworkDiagnostics();
  }, []);
};
