import { useCallback } from "react";
import { Socket } from "socket.io-client";
import type { Participant } from "../types";
import { RTC_CONFIGURATION, CONNECTION_CONFIG } from "../constants/webrtc";
import {
  clearConnectionTimeout,
  setupStreamEventListeners,
  updateParticipantStream,
  addLocalTracksToConnection,
} from "../utils/webrtcUtils";

interface UseWebRTCConnectionProps {
  socketRef: React.MutableRefObject<Socket | null>;
  userId: string | null;
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  setRemoteParticipants: React.Dispatch<
    React.SetStateAction<Map<string, Participant>>
  >;
  connectionTimeouts: Map<string, NodeJS.Timeout>;
  setConnectionTimeouts: React.Dispatch<
    React.SetStateAction<Map<string, NodeJS.Timeout>>
  >;
  connectionStartTimes: React.MutableRefObject<Map<string, number>>;
  peerConnections: React.MutableRefObject<Map<string, RTCPeerConnection>>;
  handleConnectionTimeout: (participantSocketId: string) => Promise<void>;
  recreateConnection: (participantSocketId: string) => Promise<void>;
}

export const useWebRTCConnection = ({
  socketRef,
  userId,
  localStreamRef,
  setRemoteParticipants,
  connectionTimeouts,
  setConnectionTimeouts,
  connectionStartTimes,
  peerConnections,
  handleConnectionTimeout,
  recreateConnection,
}: UseWebRTCConnectionProps) => {
  const createPeerConnection = useCallback(
    (participantSocketId: string, isInitiator: boolean = false) => {
      console.log(
        `Creating peer connection for ${participantSocketId}, isInitiator: ${isInitiator}`
      );

      // Clear any existing timeout for this participant
      const existingTimeout = connectionTimeouts.get(participantSocketId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Record connection start time
      connectionStartTimes.current.set(participantSocketId, Date.now());

      // Set up timeout for connection
      const timeout = setTimeout(() => {
        const startTime = connectionStartTimes.current.get(participantSocketId);
        if (
          startTime &&
          Date.now() - startTime >= CONNECTION_CONFIG.TIMEOUT_DURATION
        ) {
          console.log(
            `Connection timeout for ${participantSocketId}, attempting reconnect...`
          );
          handleConnectionTimeout(participantSocketId);
        }
      }, CONNECTION_CONFIG.TIMEOUT_DURATION);

      setConnectionTimeouts((prev) => {
        const updated = new Map(prev);
        updated.set(participantSocketId, timeout);
        return updated;
      });

      const pc = new RTCPeerConnection(RTC_CONFIGURATION);

      // Track connection attempt and retry count
      let connectionAttempts = 0;

      // Add local stream tracks
      addLocalTracksToConnection(
        pc,
        localStreamRef.current,
        participantSocketId
      );

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(`Sending ICE candidate to ${participantSocketId}:`, {
            type: event.candidate.type,
            protocol: event.candidate.protocol,
            address: event.candidate.address,
          });
          if (socketRef.current) {
            socketRef.current.emit("ice-candidate", {
              candidate: event.candidate,
              targetSocket: participantSocketId,
              fromUserId: userId,
            });
          }
        } else {
          console.log(`ICE gathering complete for ${participantSocketId}`);
        }
      };

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log(
          `Received track from ${participantSocketId}:`,
          event.track.kind,
          event.track.readyState
        );

        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];

          // Clear connection timeout on successful track reception
          clearConnectionTimeout(
            participantSocketId,
            connectionTimeouts,
            setConnectionTimeouts,
            connectionStartTimes
          );

          // Add stream event listeners
          setupStreamEventListeners(stream, participantSocketId);

          // Update participant stream
          updateParticipantStream(
            participantSocketId,
            stream,
            setRemoteParticipants
          );
        }
      };

      // ICE connection state handling
      pc.oniceconnectionstatechange = () => {
        console.log(
          `ICE connection state with ${participantSocketId}:`,
          pc.iceConnectionState
        );

        switch (pc.iceConnectionState) {
          case "connected":
          case "completed":
            console.log(`Successfully connected to ${participantSocketId}`);
            connectionAttempts = 0;
            clearConnectionTimeout(
              participantSocketId,
              connectionTimeouts,
              setConnectionTimeouts,
              connectionStartTimes
            );
            break;

          case "failed":
            console.log(
              `Connection failed with ${participantSocketId}, attempt ${
                connectionAttempts + 1
              }/${CONNECTION_CONFIG.MAX_ATTEMPTS}`
            );

            clearConnectionTimeout(
              participantSocketId,
              connectionTimeouts,
              setConnectionTimeouts,
              connectionStartTimes
            );

            if (connectionAttempts < CONNECTION_CONFIG.MAX_ATTEMPTS) {
              connectionAttempts++;
              setTimeout(async () => {
                try {
                  console.log(
                    `Attempting ICE restart for ${participantSocketId} (attempt ${connectionAttempts})`
                  );
                  await pc.restartIce();

                  if (isInitiator) {
                    const offer = await pc.createOffer({ iceRestart: true });
                    await pc.setLocalDescription(offer);

                    socketRef.current?.emit("offer", {
                      offer,
                      targetSocket: participantSocketId,
                      fromUserId: userId,
                      msgId: Date.now().toString(),
                      isRestart: true,
                    });
                  }
                } catch (restartError) {
                  console.error(
                    `ICE restart failed for ${participantSocketId}:`,
                    restartError
                  );

                  if (connectionAttempts >= CONNECTION_CONFIG.MAX_ATTEMPTS) {
                    console.log(
                      `Max attempts reached, recreating connection for ${participantSocketId}`
                    );
                    setTimeout(() => {
                      recreateConnection(participantSocketId);
                    }, CONNECTION_CONFIG.OFFER_DELAY);
                  }
                }
              }, Math.pow(2, connectionAttempts) * CONNECTION_CONFIG.RECONNECT_DELAY);
            } else {
              console.log(
                `Max connection attempts reached for ${participantSocketId}, recreating connection`
              );
              setTimeout(() => {
                recreateConnection(participantSocketId);
              }, 5000);
            }
            break;

          case "disconnected":
            console.log(
              `Disconnected from ${participantSocketId}, waiting for reconnection...`
            );
            break;

          case "checking":
            console.log(`Connection checking for ${participantSocketId}`);
            connectionStartTimes.current.set(participantSocketId, Date.now());
            break;
        }
      };

      // Connection state change handler
      pc.onconnectionstatechange = () => {
        console.log(
          `Connection state with ${participantSocketId}:`,
          pc.connectionState
        );

        if (pc.connectionState === "failed") {
          console.log(`Overall connection failed with ${participantSocketId}`);
          clearConnectionTimeout(
            participantSocketId,
            connectionTimeouts,
            setConnectionTimeouts,
            connectionStartTimes
          );
          if (connectionAttempts < CONNECTION_CONFIG.MAX_ATTEMPTS) {
            setTimeout(() => {
              recreateConnection(participantSocketId);
            }, 3000);
          }
        } else if (pc.connectionState === "connected") {
          clearConnectionTimeout(
            participantSocketId,
            connectionTimeouts,
            setConnectionTimeouts,
            connectionStartTimes
          );
        }
      };

      // ICE gathering state handler
      pc.onicegatheringstatechange = () => {
        console.log(
          `ICE gathering state with ${participantSocketId}:`,
          pc.iceGatheringState
        );
      };

      // Signaling state change handler
      pc.onsignalingstatechange = () => {
        console.log(
          `Signaling state with ${participantSocketId}:`,
          pc.signalingState
        );
      };

      peerConnections.current.set(participantSocketId, pc);
      return pc;
    },
    [
      connectionTimeouts,
      setConnectionTimeouts,
      connectionStartTimes,
      handleConnectionTimeout,
      localStreamRef,
      peerConnections,
      setRemoteParticipants,
      socketRef,
      userId,
      recreateConnection,
    ]
  );

  return { createPeerConnection };
};
