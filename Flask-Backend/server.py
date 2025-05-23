from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
import os
from datetime import datetime

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# MongoDB setup
client = MongoClient('mongodb://localhost:27017/')
db = client['meeting_app']
users_collection = db['users']
meetings_collection = db['meetings']
participants_collection = db['participants']

# Simplified Socket.IO configuration
socketio = SocketIO(
    app, 
    cors_allowed_origins="*", 
    logger=True, 
    engineio_logger=True,
    async_mode='threading'
)

@app.route('/')
def index():
    return 'WebRTC Flask Server'

# User management endpoints
@app.route('/api/users', methods=['POST'])
def create_user():
    user_data = request.json
    # Check if user already exists
    existing_user = users_collection.find_one({'username': user_data['username']})
    if existing_user:
        return jsonify({'error': 'Username already exists'}), 400
    
    # Add new user
    user_id = users_collection.insert_one({
        'username': user_data['username'],
        'displayName': user_data.get('displayName', user_data['username']),
        'createdAt': datetime.now()
    }).inserted_id
    
    return jsonify({'userId': str(user_id), 'username': user_data['username']}), 201

@app.route('/api/users/<username>', methods=['GET'])
def get_user(username):
    user = users_collection.find_one({'username': username})
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    user['_id'] = str(user['_id'])
    return jsonify(user), 200

# Meeting management endpoints
@app.route('/api/meetings', methods=['POST'])
def create_meeting():
    meeting_data = request.json
    host_id = meeting_data['hostId']
    
    # Create new meeting
    meeting_id = meetings_collection.insert_one({
        'name': meeting_data.get('name', 'New Meeting'),
        'hostId': host_id,
        'createdAt': datetime.now(),
        'active': True
    }).inserted_id
    
    # Add host as participant
    participants_collection.insert_one({
        'meetingId': str(meeting_id),
        'userId': host_id,
        'joinedAt': datetime.now(),
        'isHost': True
    })
    
    return jsonify({
        'meetingId': str(meeting_id),
        'name': meeting_data.get('name', 'New Meeting')
    }), 201

@app.route('/api/meetings/<meeting_id>/join', methods=['POST'])
def join_meeting(meeting_id):
    user_data = request.json
    user_id = user_data['userId']
    
    # Check if meeting exists
    meeting = meetings_collection.find_one({'_id': ObjectId(meeting_id)})
    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404
    
    if not meeting['active']:
        return jsonify({'error': 'Meeting has ended'}), 400
    
    # Check if user is already in the meeting
    existing = participants_collection.find_one({
        'meetingId': meeting_id,
        'userId': user_id
    })
    
    if not existing:
        # Add user as participant
        participants_collection.insert_one({
            'meetingId': meeting_id,
            'userId': user_id,
            'joinedAt': datetime.now(),
            'isHost': meeting['hostId'] == user_id
        })
    
    return jsonify({'success': True}), 200

@app.route('/api/meetings/<meeting_id>/participants', methods=['GET'])
def get_participants(meeting_id):
    participants = list(participants_collection.find({'meetingId': meeting_id}))
    
    # Get user details for each participant
    result = []
    for participant in participants:
        user = users_collection.find_one({'_id': ObjectId(participant['userId'])})
        if user:
            result.append({
                'userId': str(user['_id']),
                'username': user['username'],
                'displayName': user.get('displayName', user['username']),
                'isHost': participant.get('isHost', False),
                'joinedAt': participant['joinedAt'].isoformat()
            })
    
    return jsonify(result), 200

# Socket.IO events for WebRTC signaling
@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('connected', {'data': 'Connected'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('join')
def on_join(data):
    room = data['room']
    join_room(room)
    socketio.emit('user-joined', to=room)

@socketio.on('offer')
def on_offer(data):
    socketio.emit('offer', data, to=data['room'])

@socketio.on('answer')
def on_answer(data):
    socketio.emit('answer', data, to=data['room'])

@socketio.on('ice-candidate')
def on_ice_candidate(data):
    socketio.emit('ice-candidate', data, to=data['room'])

if __name__ == '__main__':
    print("Starting Flask-SocketIO server...")
    socketio.run(app, host='0.0.0.0', port=5002, debug=True)
