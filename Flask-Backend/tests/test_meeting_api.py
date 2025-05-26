"""
Unit tests for Meeting Management API endpoints
Tests meeting creation, joining, ending, and participant management
"""
import pytest
import json
from bson import ObjectId
from datetime import datetime
from unittest.mock import patch, MagicMock


class TestMeetingAPI:
    """Test cases for meeting management endpoints"""
    
    def test_create_meeting_success(self, client, mock_db):
        """Test successful meeting creation"""
        with patch('server.meetings_collection', mock_db['meetings']), \
             patch('server.participants_collection', mock_db['participants']):
            
            response = client.post('/api/meetings', 
                                 json={'hostId': 'host123', 'name': 'Test Meeting'},
                                 content_type='application/json')
            
            assert response.status_code == 201
            data = response.get_json()
            assert 'meetingId' in data
            assert data['name'] == 'Test Meeting'
            
            # Verify meeting was saved
            meeting = mock_db['meetings'].find_one({'name': 'Test Meeting'})
            assert meeting is not None
            assert meeting['hostId'] == 'host123'
            assert meeting['active'] is True
            
            # Verify host was added as participant
            participant = mock_db['participants'].find_one({'userId': 'host123'})
            assert participant is not None
            assert participant['isHost'] is True
    
    def test_create_meeting_without_name(self, client, mock_db):
        """Test meeting creation without name (should use default)"""
        with patch('server.meetings_collection', mock_db['meetings']), \
             patch('server.participants_collection', mock_db['participants']):
            
            response = client.post('/api/meetings', 
                                 json={'hostId': 'host123'},
                                 content_type='application/json')
            
            assert response.status_code == 201
            data = response.get_json()
            assert data['name'] == 'New Meeting'  # Default name
    
    def test_create_meeting_missing_host_id(self, client):
        """Test meeting creation without hostId"""
        response = client.post('/api/meetings', 
                             json={'name': 'Test Meeting'},
                             content_type='application/json')
        
        # Should fail without hostId
        assert response.status_code in [400, 500]
    
    def test_join_meeting_success(self, client, mock_db):
        """Test successful meeting join"""
        with patch('server.meetings_collection', mock_db['meetings']), \
             patch('server.participants_collection', mock_db['participants']):
            
            # Create active meeting
            meeting_id = mock_db['meetings'].insert_one({
                'name': 'Test Meeting',
                'hostId': 'host123',
                'createdAt': datetime.now(),
                'active': True
            }).inserted_id
            
            response = client.post(f'/api/meetings/{meeting_id}/join',
                                 json={'userId': 'user456'},
                                 content_type='application/json')
            
            assert response.status_code == 200
            data = response.get_json()
            assert data['success'] is True
            
            # Verify participant was added
            participant = mock_db['participants'].find_one({
                'meetingId': str(meeting_id),
                'userId': 'user456'
            })
            assert participant is not None
            assert participant['isHost'] is False
    
    def test_join_meeting_already_participant(self, client, mock_db):
        """Test joining meeting when already a participant"""
        with patch('server.meetings_collection', mock_db['meetings']), \
             patch('server.participants_collection', mock_db['participants']):
            
            # Create meeting and add participant
            meeting_id = mock_db['meetings'].insert_one({
                'name': 'Test Meeting',
                'hostId': 'host123',
                'createdAt': datetime.now(),
                'active': True
            }).inserted_id
            
            mock_db['participants'].insert_one({
                'meetingId': str(meeting_id),
                'userId': 'user456',
                'joinedAt': datetime.now(),
                'isHost': False
            })
            
            response = client.post(f'/api/meetings/{meeting_id}/join',
                                 json={'userId': 'user456'},
                                 content_type='application/json')
            
            # Should still succeed
            assert response.status_code == 200
    
    def test_join_nonexistent_meeting(self, client, mock_db):
        """Test joining non-existent meeting"""
        with patch('server.meetings_collection', mock_db['meetings']):
            fake_id = ObjectId()
            response = client.post(f'/api/meetings/{fake_id}/join',
                                 json={'userId': 'user456'},
                                 content_type='application/json')
            
            assert response.status_code == 404
            data = response.get_json()
            assert 'error' in data
            assert 'Meeting not found' in data['error']
    
    def test_join_inactive_meeting(self, client, mock_db):
        """Test joining inactive meeting"""
        with patch('server.meetings_collection', mock_db['meetings']):
            # Create inactive meeting
            meeting_id = mock_db['meetings'].insert_one({
                'name': 'Ended Meeting',
                'hostId': 'host123',
                'createdAt': datetime.now(),
                'active': False,
                'endedAt': datetime.now()
            }).inserted_id
            
            response = client.post(f'/api/meetings/{meeting_id}/join',
                                 json={'userId': 'user456'},
                                 content_type='application/json')
            
            assert response.status_code == 400
            data = response.get_json()
            assert 'Meeting has ended' in data['error']
    
    def test_end_meeting_success(self, client, mock_db):
        """Test successful meeting termination by host"""
        with patch('server.meetings_collection', mock_db['meetings']), \
             patch('server.socketio') as mock_socketio:
            
            # Create active meeting
            meeting_id = mock_db['meetings'].insert_one({
                'name': 'Test Meeting',
                'hostId': 'host123',
                'createdAt': datetime.now(),
                'active': True
            }).inserted_id
            
            response = client.post(f'/api/meetings/{meeting_id}/end',
                                 json={'userId': 'host123'},
                                 content_type='application/json')
            
            assert response.status_code == 200
            data = response.get_json()
            assert data['success'] is True
            assert 'Meeting ended successfully' in data['message']
            
            # Verify meeting was marked inactive
            meeting = mock_db['meetings'].find_one({'_id': meeting_id})
            assert meeting['active'] is False
            assert 'endedAt' in meeting
    
    def test_end_meeting_non_host(self, client, mock_db):
        """Test meeting termination by non-host user"""
        with patch('server.meetings_collection', mock_db['meetings']):
            # Create meeting with different host
            meeting_id = mock_db['meetings'].insert_one({
                'name': 'Test Meeting',
                'hostId': 'host123',
                'createdAt': datetime.now(),
                'active': True
            }).inserted_id
            
            response = client.post(f'/api/meetings/{meeting_id}/end',
                                 json={'userId': 'user456'},  # Different user
                                 content_type='application/json')
            
            assert response.status_code == 403
            data = response.get_json()
            assert 'Only the host can end the meeting' in data['error']
    
    def test_leave_meeting_success(self, client, mock_db):
        """Test successful meeting leave"""
        with patch('server.participants_collection', mock_db['participants']):
            # Add participant first
            meeting_id = str(ObjectId())
            mock_db['participants'].insert_one({
                'meetingId': meeting_id,
                'userId': 'user456',
                'joinedAt': datetime.now(),
                'isHost': False
            })
            
            response = client.post(f'/api/meetings/{meeting_id}/leave',
                                 json={'userId': 'user456'},
                                 content_type='application/json')
            
            assert response.status_code == 200
            data = response.get_json()
            assert data['success'] is True
            
            # Verify participant was removed
            participant = mock_db['participants'].find_one({
                'meetingId': meeting_id,
                'userId': 'user456'
            })
            assert participant is None
    
    def test_get_participants_success(self, client, mock_db):
        """Test getting meeting participants"""
        with patch('server.participants_collection', mock_db['participants']), \
             patch('server.users_collection', mock_db['users']):
            
            meeting_id = str(ObjectId())
            
            # Add users
            user1_id = mock_db['users'].insert_one({
                'username': 'host',
                'displayName': 'Host User',
                'createdAt': datetime.now()
            }).inserted_id
            
            user2_id = mock_db['users'].insert_one({
                'username': 'participant',
                'displayName': 'Participant User',
                'createdAt': datetime.now()
            }).inserted_id
            
            # Add participants
            mock_db['participants'].insert_one({
                'meetingId': meeting_id,
                'userId': str(user1_id),
                'joinedAt': datetime.now(),
                'isHost': True
            })
            
            mock_db['participants'].insert_one({
                'meetingId': meeting_id,
                'userId': str(user2_id),
                'joinedAt': datetime.now(),
                'isHost': False
            })
            
            response = client.get(f'/api/meetings/{meeting_id}/participants')
            
            assert response.status_code == 200
            data = response.get_json()
            assert len(data) == 2
            
            # Check host
            host = next((p for p in data if p['isHost']), None)
            assert host is not None
            assert host['username'] == 'host'
            
            # Check participant
            participant = next((p for p in data if not p['isHost']), None)
            assert participant is not None
            assert participant['username'] == 'participant'
    
    def test_is_host_check_true(self, client, mock_db):
        """Test host check returning true"""
        with patch('server.meetings_collection', mock_db['meetings']):
            meeting_id = mock_db['meetings'].insert_one({
                'name': 'Test Meeting',
                'hostId': 'host123',
                'createdAt': datetime.now(),
                'active': True
            }).inserted_id
            
            response = client.get(f'/api/meetings/{meeting_id}/is-host/host123')
            
            assert response.status_code == 200
            data = response.get_json()
            assert data['isHost'] is True
    
    def test_is_host_check_false(self, client, mock_db):
        """Test host check returning false"""
        with patch('server.meetings_collection', mock_db['meetings']):
            meeting_id = mock_db['meetings'].insert_one({
                'name': 'Test Meeting',
                'hostId': 'host123',
                'createdAt': datetime.now(),
                'active': True
            }).inserted_id
            
            response = client.get(f'/api/meetings/{meeting_id}/is-host/user456')
            
            assert response.status_code == 200
            data = response.get_json()
            assert data['isHost'] is False


class TestMeetingEdgeCases:
    """Test edge cases and error conditions for meeting API"""
    
    def test_invalid_meeting_id_format(self, client):
        """Test with invalid ObjectId format"""
        response = client.post('/api/meetings/invalid_id/join',
                             json={'userId': 'user456'},
                             content_type='application/json')
        
        # Should handle invalid ObjectId gracefully
        assert response.status_code in [400, 500]
    
    def test_empty_user_id_join(self, client, mock_db):
        """Test joining meeting with empty userId"""
        with patch('server.meetings_collection', mock_db['meetings']):
            meeting_id = mock_db['meetings'].insert_one({
                'name': 'Test Meeting',
                'hostId': 'host123',
                'createdAt': datetime.now(),
                'active': True
            }).inserted_id
            
            response = client.post(f'/api/meetings/{meeting_id}/join',
                                 json={'userId': ''},
                                 content_type='application/json')
            
            # Should handle empty userId
            assert response.status_code in [400, 500]
