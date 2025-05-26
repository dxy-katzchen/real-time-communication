"""
Unit tests for User Management API endpoints
Tests the user creation and retrieval functionality
"""
import pytest
import json
from bson import ObjectId
from datetime import datetime
from unittest.mock import patch, MagicMock


class TestUserAPI:
    """Test cases for user management endpoints"""
    
    def test_create_user_success(self, client, mock_db):
        """Test successful user creation"""
        with patch('server.users_collection', mock_db['users']):
            response = client.post('/api/users', 
                                 json={'username': 'testuser', 'displayName': 'Test User'},
                                 content_type='application/json')
            
            assert response.status_code == 201
            data = response.get_json()
            assert 'userId' in data
            assert data['username'] == 'testuser'
            
            # Verify user was saved to database
            user = mock_db['users'].find_one({'username': 'testuser'})
            assert user is not None
            assert user['displayName'] == 'Test User'
    
    def test_create_user_without_display_name(self, client, mock_db):
        """Test user creation with only username"""
        with patch('server.users_collection', mock_db['users']):
            response = client.post('/api/users', 
                                 json={'username': 'testuser2'},
                                 content_type='application/json')
            
            assert response.status_code == 201
            data = response.get_json()
            assert data['username'] == 'testuser2'
            
            # Check default displayName
            user = mock_db['users'].find_one({'username': 'testuser2'})
            assert user['displayName'] == 'testuser2'
    
    def test_create_user_duplicate_username(self, client, mock_db):
        """Test creating user with existing username"""
        with patch('server.users_collection', mock_db['users']):
            # Create first user
            mock_db['users'].insert_one({
                'username': 'existinguser',
                'displayName': 'Existing User',
                'createdAt': datetime.now()
            })
            
            # Try to create duplicate
            response = client.post('/api/users', 
                                 json={'username': 'existinguser'},
                                 content_type='application/json')
            
            assert response.status_code == 400
            data = response.get_json()
            assert 'error' in data
            assert 'Username already exists' in data['error']
    
    def test_create_user_missing_username(self, client):
        """Test user creation without username"""
        response = client.post('/api/users', 
                             json={'displayName': 'Test User'},
                             content_type='application/json')
        
        # This should cause an error since username is required
        assert response.status_code in [400, 500]
    
    def test_get_user_success(self, client, mock_db):
        """Test successful user retrieval"""
        with patch('server.users_collection', mock_db['users']):
            # Insert test user
            user_id = mock_db['users'].insert_one({
                'username': 'getuser',
                'displayName': 'Get User',
                'createdAt': datetime.now()
            }).inserted_id
            
            response = client.get('/api/users/getuser')
            
            assert response.status_code == 200
            data = response.get_json()
            assert data['username'] == 'getuser'
            assert data['displayName'] == 'Get User'
            assert '_id' in data
    
    def test_get_user_not_found(self, client, mock_db):
        """Test retrieving non-existent user"""
        with patch('server.users_collection', mock_db['users']):
            response = client.get('/api/users/nonexistent')
            
            assert response.status_code == 404
            data = response.get_json()
            assert 'error' in data
            assert 'User not found' in data['error']
    
    def test_get_user_empty_username(self, client):
        """Test retrieving user with empty username"""
        response = client.get('/api/users/')
        
        # Should return 404 for empty username
        assert response.status_code == 404


class TestUserDataValidation:
    """Test data validation for user operations"""
    
    def test_user_creation_with_special_characters(self, client, mock_db):
        """Test user creation with special characters in username"""
        with patch('server.users_collection', mock_db['users']):
            response = client.post('/api/users', 
                                 json={'username': 'user@123!', 'displayName': 'Special User'},
                                 content_type='application/json')
            
            # Should handle special characters
            assert response.status_code == 201
    
    def test_user_creation_long_username(self, client, mock_db):
        """Test user creation with very long username"""
        with patch('server.users_collection', mock_db['users']):
            long_username = 'a' * 100
            response = client.post('/api/users', 
                                 json={'username': long_username},
                                 content_type='application/json')
            
            assert response.status_code == 201
    
    def test_user_creation_with_none_values(self, client):
        """Test user creation with None values"""
        response = client.post('/api/users', 
                             json={'username': None, 'displayName': None},
                             content_type='application/json')
        
        # Should handle None values gracefully
        assert response.status_code in [400, 500]
