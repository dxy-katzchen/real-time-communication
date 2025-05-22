import monkey_patch

# Now import Flask and other modules
from flask import Flask
from flask_socketio import SocketIO, emit, join_room
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Simplified Socket.IO configuration
socketio = SocketIO(
    app,
    cors_allowed_origins="*",  # Try with wildcard for testing
    async_mode=None
)

@app.route('/')
def index():
    return 'WebRTC Flask Server'

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
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
