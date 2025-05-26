import pytest
import mongomock
from unittest.mock import patch, MagicMock
from server import app, socketio, users_collection, meetings_collection, participants_collection


@pytest.fixture
def client():
    """Create a test client for the Flask application."""
    app.config['TESTING'] = True
    app.config['WTF_CSRF_ENABLED'] = False
    
    with app.test_client() as client:
        with app.app_context():
            yield client


@pytest.fixture
def mock_db():
    """Mock MongoDB collections for testing."""
    with patch('server.users_collection') as mock_users, \
         patch('server.meetings_collection') as mock_meetings, \
         patch('server.participants_collection') as mock_participants:
        
        # Use mongomock for realistic database behavior
        mock_client = mongomock.MongoClient()
        mock_db = mock_client['test_meeting_app']
        
        mock_users.return_value = mock_db['users']
        mock_meetings.return_value = mock_db['meetings']
        mock_participants.return_value = mock_db['participants']
        
        yield {
            'users': mock_db['users'],
            'meetings': mock_db['meetings'],
            'participants': mock_db['participants']
        }


@pytest.fixture
def sample_user():
    """Sample user data for testing."""
    return {
        'username': 'testuser',
        'displayName': 'Test User'
    }


@pytest.fixture
def sample_meeting():
    """Sample meeting data for testing."""
    return {
        'name': 'Test Meeting',
        'hostId': 'test_host_id'
    }


@pytest.fixture
def socket_client():
    """Create a test client for Socket.IO."""
    return socketio.test_client(app)
