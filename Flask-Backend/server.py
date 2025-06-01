from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
import os
from datetime import datetime

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# MongoDB setup
client = MongoClient("mongodb://localhost:27017/")
db = client["meeting_app"]
users_collection = db["users"]
meetings_collection = db["meetings"]
participants_collection = db["participants"]

# Simplified Socket.IO configuration
socketio = SocketIO(
    app, cors_allowed_origins="*", logger=True, engineio_logger=True, async_mode="threading"
)

# Store active connections
active_connections = {}


@app.route("/")
def index():
    return "WebRTC Flask Server"


# User management endpoints
@app.route("/api/users", methods=["POST"])
def create_user():
    user_data = request.json

    # Validate input data
    if not user_data or "username" not in user_data:
        return jsonify({"error": "Username is required"}), 400

    if not user_data["username"] or user_data["username"] == "":
        return jsonify({"error": "Username cannot be empty"}), 400

    # Check if user already exists
    existing_user = users_collection.find_one({"username": user_data["username"]})
    if existing_user:
        return jsonify({"error": "Username already exists"}), 400

    # Add new user
    user_id = users_collection.insert_one(
        {
            "username": user_data["username"],
            "displayName": user_data.get("displayName", user_data["username"]),
            "createdAt": datetime.now(),
        }
    ).inserted_id

    return jsonify({"userId": str(user_id), "username": user_data["username"]}), 201


@app.route("/api/users/<username>", methods=["GET"])
def get_user(username):
    user = users_collection.find_one({"username": username})
    if not user:
        return jsonify({"error": "User not found"}), 404

    user["_id"] = str(user["_id"])
    return jsonify(user), 200


# Meeting management endpoints
@app.route("/api/meetings", methods=["POST"])
def create_meeting():
    meeting_data = request.json

    # Validate input data
    if not meeting_data or "hostId" not in meeting_data:
        return jsonify({"error": "Host ID is required"}), 400

    host_id = meeting_data["hostId"]

    # Create new meeting
    meeting_id = meetings_collection.insert_one(
        {
            "name": meeting_data.get("name", "New Meeting"),
            "hostId": host_id,
            "createdAt": datetime.now(),
            "active": True,
        }
    ).inserted_id

    # Add host as participant
    participants_collection.insert_one(
        {
            "meetingId": str(meeting_id),
            "userId": host_id,
            "joinedAt": datetime.now(),
            "isHost": True,
        }
    )

    return (
        jsonify({"meetingId": str(meeting_id), "name": meeting_data.get("name", "New Meeting")}),
        201,
    )


@app.route("/api/meetings/<meeting_id>/join", methods=["POST"])
def join_meeting(meeting_id):
    user_data = request.json

    # Validate input data
    if not user_data or "userId" not in user_data:
        return jsonify({"error": "User ID is required"}), 400

    user_id = user_data["userId"]

    # Validate user ID is not empty
    if not user_id or user_id == "":
        return jsonify({"error": "User ID cannot be empty"}), 400

    # Validate meeting ID format
    try:
        meeting_obj_id = ObjectId(meeting_id)
    except Exception:
        return jsonify({"error": "Invalid meeting ID format"}), 400

    # Check if meeting exists
    meeting = meetings_collection.find_one({"_id": meeting_obj_id})
    if not meeting:
        return jsonify({"error": "Meeting not found"}), 404

    if not meeting["active"]:
        return jsonify({"error": "Meeting has ended"}), 400

    # Check if user is already in the meeting
    existing = participants_collection.find_one({"meetingId": meeting_id, "userId": user_id})

    if not existing:
        # Add user as participant
        participants_collection.insert_one(
            {
                "meetingId": meeting_id,
                "userId": user_id,
                "joinedAt": datetime.now(),
                "isHost": meeting["hostId"] == user_id,
                
            }
        )

    return jsonify({"success": True}), 200


@app.route("/api/meetings/<meeting_id>/end", methods=["POST"])
def end_meeting(meeting_id):
    user_data = request.json
    user_id = user_data["userId"]

    # Check if meeting exists
    meeting = meetings_collection.find_one({"_id": ObjectId(meeting_id)})
    if not meeting:
        return jsonify({"error": "Meeting not found"}), 404

    # Verify the user is the host
    if meeting["hostId"] != user_id:
        return jsonify({"error": "Only the host can end the meeting"}), 403

    # Update meeting status to inactive
    meetings_collection.update_one(
        {"_id": ObjectId(meeting_id)}, {"$set": {"active": False, "endedAt": datetime.now()}}
    )

    # Notify all participants through socket
    socketio.emit("meeting-ended", {"meetingId": meeting_id}, to=meeting_id)

    return (
        jsonify(
            {"success": True, "meetingId": meeting_id, "message": "Meeting ended successfully"}
        ),
        200,
    )


@app.route("/api/meetings/<meeting_id>/participants", methods=["GET"])
def get_participants(meeting_id):
    participants = list(participants_collection.find({"meetingId": meeting_id}))

    # Get user details for each participant
    result = []
    for participant in participants:
        user = users_collection.find_one({"_id": ObjectId(participant["userId"])})
        if user:
            result.append(
                {
                    "userId": str(user["_id"]),
                    "username": user["username"],
                    "displayName": user.get("displayName", user["username"]),
                    "isHost": participant.get("isHost", False),
                    "joinedAt": participant["joinedAt"].isoformat(),
                }
            )

    return jsonify(result), 200


# check if user is host
@app.route("/api/meetings/<meeting_id>/is-host/<user_id>", methods=["GET"])
def is_host(meeting_id, user_id):
    meeting = meetings_collection.find_one({"_id": ObjectId(meeting_id)})
    if not meeting:
        return jsonify({"error": "Meeting not found"}), 404

    return jsonify({"isHost": meeting["hostId"] == user_id}), 200


# remove participant when they leave
@app.route("/api/meetings/<meeting_id>/leave", methods=["POST"])
def leave_meeting_api(meeting_id):
    user_data = request.json
    user_id = user_data["userId"]

    # Remove participant from meeting
    participants_collection.delete_one({"meetingId": meeting_id, "userId": user_id})

    return jsonify({"success": True}), 200


# Socket.IO events for WebRTC signaling
@socketio.on("connect")
def handle_connect():
    print(f"Client connected: {request.sid}")
    emit("connected", {"data": "Connected"})


# Update the disconnect handler
@socketio.on("disconnect")
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")

    # Clean up active connections
    if request.sid in active_connections:
        room_info = active_connections[request.sid]
        room = room_info["room"]
        user_id = room_info["userId"]

        # Leave the room
        leave_room(room)

        # Notify other participants that this user left
        socketio.emit(
            "user-left", {"userId": user_id, "socketId": request.sid}, to=room, include_self=False
        )

        # Remove from database
        participants_collection.delete_one({"meetingId": room, "userId": user_id})

        print(f"User {user_id} left room {room}")
        del active_connections[request.sid]

@socketio.on("leave")
def on_leave(data):
    room = data["room"]
    user_id = data.get("userId")

    print(f"User {user_id} explicitly leaving room {room}")

    leave_room(room)

    # Notify other participants
    socketio.emit(
        "user-left", {"userId": user_id, "socketId": request.sid}, to=room, include_self=False
    )

    # Remove from database
    participants_collection.delete_one({"meetingId": room, "userId": user_id})

    # Clean up connection
    if request.sid in active_connections:
        del active_connections[request.sid]


@socketio.on("join")
def on_join(data):
    try:
        # Validate input data
        if not data or "room" not in data:
            socketio.emit("error", {"message": "Room is required"}, to=request.sid)
            return

        room = data["room"]
        user_id = data.get("userId")

        # Store connection info
        active_connections[request.sid] = {"room": room, "userId": user_id, "socketId": request.sid}

        join_room(room)

        # Get all existing participants in the room
        existing_participants = []
        for sid, conn_info in active_connections.items():
            if conn_info["room"] == room and sid != request.sid:
                existing_participants.append({"userId": conn_info["userId"], "socketId": sid})

        # Send existing participants to the new user
        emit("existing-participants", {"participants": existing_participants})

        # Notify other participants that a new user joined
        socketio.emit(
            "user-joined", {"userId": user_id, "socketId": request.sid}, to=room, include_self=False
        )

        print(f"User {user_id} joined room {room}")

    except Exception as e:
        print(f"Error in join event: {e}")
        socketio.emit("error", {"message": "Failed to join room"}, to=request.sid)


# Add this with the other socket.io events
@socketio.on("end-meeting")
def on_end_meeting(data):
    room = data["room"]
    user_id = data["userId"]

    # Check if meeting exists and user is host
    meeting = meetings_collection.find_one({"_id": ObjectId(room)})
    if meeting and meeting["hostId"] == user_id:
        # Update meeting status to inactive
        meetings_collection.update_one(
            {"_id": ObjectId(room)}, {"$set": {"active": False, "endedAt": datetime.now()}}
        )

        # Notify all participants
        socketio.emit("meeting-ended", {"meetingId": room}, to=room)


# WebRTC signaling events - now include target socket ID
@socketio.on("offer")
def on_offer(data):
    target_socket = data.get("targetSocket")
    if target_socket:
        emit(
            "offer",
            {
                "offer": data["offer"],
                "fromSocket": request.sid,
                "fromUserId": data.get("fromUserId"),
                "msgId": data.get("msgId"),
            },
            to=target_socket,
        )


@socketio.on("answer")
def on_answer(data):
    target_socket = data.get("targetSocket")
    if target_socket:
        emit(
            "answer",
            {
                "answer": data["answer"],
                "fromSocket": request.sid,
                "fromUserId": data.get("fromUserId"),
                "msgId": data.get("msgId"),
            },
            to=target_socket,
        )


@socketio.on("ice-candidate")
def on_ice_candidate(data):
    target_socket = data.get("targetSocket")
    if target_socket:
        emit(
            "ice-candidate",
            {
                "candidate": data["candidate"],
                "fromSocket": request.sid,
                "fromUserId": data.get("fromUserId"),
            },
            to=target_socket,
        )


@socketio.on("media-status-update")
def on_media_status_update(data):
    room = data.get("room")
    user_id = data.get("userId")
    is_muted = data.get("isMuted", False)
    is_video_off = data.get("isVideoOff", False)
    is_screen_sharing = data.get("isScreenSharing", False)

    print(
        f"Media status update from {user_id}: muted={is_muted}, "
        f"video_off={is_video_off}, screen_sharing={is_screen_sharing}"
    )

    if room:
        # Broadcast the media status to all other participants in the room
        socketio.emit(
            "media-status-changed",
            {
                "userId": user_id,
                "socketId": request.sid,
                "isMuted": is_muted,
                "isVideoOff": is_video_off,
                "isScreenSharing": is_screen_sharing,
            },
            to=room,
            include_self=False,
        )


@socketio.on("send-chat-message")
def on_send_chat_message(data):
    room = data.get("room")
    message_id = data.get("id")
    user_id = data.get("userId")
    username = data.get("username")
    message = data.get("message")
    timestamp = data.get("timestamp")

    print(f"Chat message from {username} ({user_id}): {message}")

    if room and message:
        # Broadcast the chat message to all participants in the room (including sender)
        socketio.emit(
            "chat-message",
            {
                "id": message_id,
                "userId": user_id,
                "username": username,
                "message": message,
                "timestamp": timestamp,
            },
            to=room,
        )


if __name__ == "__main__":
    print("Starting Flask-SocketIO server...")

    # Check if running in production
    is_production = os.environ.get("FLASK_ENV") == "production"

    if is_production:
        # In production, don't run the development server directly
        # This will be handled by Gunicorn
        print("Production mode detected. Use Gunicorn to run this application.")
        print("Example: gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:5002 server:app")
    else:
        # Development mode with security considerations
        # Only bind to localhost in development unless explicitly overridden
        dev_host = os.getenv("DEV_HOST", "127.0.0.1")  # Default to localhost for security
        dev_debug = os.getenv("DEV_DEBUG", "false").lower() == "true"  # Default debug off

        print(f"Development mode: host={dev_host}, debug={dev_debug}")
        socketio.run(
            app, host=dev_host, port=5002, debug=dev_debug, allow_unsafe_werkzeug=dev_debug
        )
