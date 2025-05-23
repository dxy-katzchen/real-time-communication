# WebRTC Video Chat Architecture

## System Overview

```mermaid
graph TB
    subgraph "Frontend (React App)"
        A[User A Browser]
        B[User B Browser]
        C[User C Browser]

        subgraph "User A Components"
            A1[Auth Component]
            A2[MeetingLobby Component]
            A3[VideoMeeting Component]
            A4[Local Video Stream]
            A5[Remote Video Components]
        end

        subgraph "User B Components"
            B1[Auth Component]
            B2[MeetingLobby Component]
            B3[VideoMeeting Component]
            B4[Local Video Stream]
            B5[Remote Video Components]
        end
    end

    subgraph "Backend (Flask + Socket.IO)"
        S[Socket.IO Server]
        API[REST API]
        DB[(MongoDB)]

        subgraph "Socket Events"
            E1[join/leave room]
            E2[offer/answer/ice-candidate]
            E3[user-joined/user-left]
            E4[meeting-ended]
        end

        subgraph "API Endpoints"
            R1["/api/users"]
            R2["/api/meetings"]
            R3["/api/meetings/:id/join"]
            R4["/api/meetings/:id/end"]
        end
    end

    subgraph "WebRTC P2P Connections"
        P1[Peer Connection A-B]
        P2[Peer Connection A-C]
        P3[Peer Connection B-C]
    end

    %% Authentication Flow
    A1 -->|Create/Login User| R1
    R1 -->|Store User| DB

    %% Meeting Creation/Join Flow
    A2 -->|Create Meeting| R2
    A2 -->|Join Meeting| R3
    R2 -->|Store Meeting| DB
    R3 -->|Add Participant| DB

    %% Socket Connections
    A -.->|Socket.IO| S
    B -.->|Socket.IO| S
    C -.->|Socket.IO| S

    %% WebRTC Signaling through Socket.IO
    S -->|Relay Signals| E1
    S -->|Relay Signals| E2
    S -->|Relay Signals| E3

    %% Direct P2P Media Streams
    A4 -.->|Direct RTP/SRTP| P1
    A4 -.->|Direct RTP/SRTP| P2
    B4 -.->|Direct RTP/SRTP| P1
    B4 -.->|Direct RTP/SRTP| P3

    %% Media Display
    P1 -->|Remote Stream| A5
    P1 -->|Remote Stream| B5
    P2 -->|Remote Stream| A5
    P3 -->|Remote Stream| B5

    style A fill:#e1f5fe
    style B fill:#e8f5e8
    style C fill:#fff3e0
    style S fill:#f3e5f5
    style DB fill:#ffebee
    style P1 fill:#fff9c4
    style P2 fill:#fff9c4
    style P3 fill:#fff9c4
```

## WebRTC Signaling Flow

```mermaid
sequenceDiagram
    participant A as User A
    participant S as Socket.IO Server
    participant B as User B

    Note over A,B: User A joins meeting first
    A->>S: emit('join', {room, userId})
    S->>A: emit('existing-participants', [])

    Note over A,B: User B joins meeting
    B->>S: emit('join', {room, userId})
    S->>B: emit('existing-participants', [A])
    S->>A: emit('user-joined', {userId: B, socketId})

    Note over A,B: WebRTC Handshake
    A->>A: createPeerConnection()
    A->>A: createOffer()
    A->>S: emit('offer', {offer, targetSocket: B})
    S->>B: emit('offer', {offer, fromSocket: A})

    B->>B: createPeerConnection()
    B->>B: setRemoteDescription(offer)
    B->>B: createAnswer()
    B->>S: emit('answer', {answer, targetSocket: A})
    S->>A: emit('answer', {answer, fromSocket: B})

    A->>A: setRemoteDescription(answer)

    Note over A,B: ICE Candidate Exchange
    A->>S: emit('ice-candidate', {candidate, targetSocket: B})
    S->>B: emit('ice-candidate', {candidate, fromSocket: A})
    B->>S: emit('ice-candidate', {candidate, targetSocket: A})
    S->>A: emit('ice-candidate', {candidate, fromSocket: B})

    Note over A,B: Direct P2P Connection Established
    A-.->B: Direct Media Stream (RTP/SRTP)
    B-.->A: Direct Media Stream (RTP/SRTP)
```

## Key Components Explained

### 1. Authentication & User Management

- Users authenticate through the Auth component
- User data is stored in MongoDB via REST API
- Each user gets a unique userId for session management

### 2. Meeting Management

- **Host**: Creates meeting → Gets meetingId → Joins room
- **Participants**: Join meeting with meetingId → Verify access → Join room
- Meeting state is managed through REST API and Socket.IO

### 3. WebRTC Connection Process

1. **Signaling**: Socket.IO handles offer/answer/ICE candidate exchange
2. **Peer Connections**: Direct RTCPeerConnection between browsers
3. **Media Streams**: Video/audio flows directly P2P (bypasses server)

### 4. Real-time Communication Flow

```
User Action → Socket.IO Event → Server Relay → Other Users → UI Update
```

### 5. Data Flow Architecture

- **Control Data**: REST API ↔ MongoDB (persistent)
- **Real-time Events**: Socket.IO (ephemeral)
- **Media Streams**: Direct P2P WebRTC (real-time)

## Technologies Used

- **Frontend**: React, TypeScript, WebRTC API
- **Backend**: Flask, Socket.IO, MongoDB
- **Real-time**: Socket.IO for signaling, WebRTC for media
- **Infrastructure**: STUN/TURN servers for NAT traversal
