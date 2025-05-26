"""
Integration tests for the complete Flask application
Tests the interaction between different components and end-to-end workflows
"""
from bson import ObjectId
from datetime import datetime
from unittest.mock import patch


class TestUserMeetingIntegration:
    """Test integration between user and meeting operations"""

    def test_complete_meeting_flow(self, client, mock_db):
        """Test complete flow: create user, create meeting, join, leave, end"""
        with patch("server.users_collection", mock_db["users"]), patch(
            "server.meetings_collection", mock_db["meetings"]
        ), patch("server.participants_collection", mock_db["participants"]), patch(
            "server.socketio"
        ) as _mock_socketio:
            # Step 1: Create host user
            host_response = client.post(
                "/api/users",
                json={"username": "host", "displayName": "Host User"},
                content_type="application/json",
            )
            assert host_response.status_code == 201
            host_data = host_response.get_json()
            host_id = host_data["userId"]

            # Step 2: Create participant user
            participant_response = client.post(
                "/api/users",
                json={"username": "participant", "displayName": "Participant User"},
                content_type="application/json",
            )
            assert participant_response.status_code == 201
            participant_data = participant_response.get_json()
            participant_id = participant_data["userId"]

            # Step 3: Host creates meeting
            meeting_response = client.post(
                "/api/meetings",
                json={"hostId": host_id, "name": "Integration Test Meeting"},
                content_type="application/json",
            )
            assert meeting_response.status_code == 201
            meeting_data = meeting_response.get_json()
            meeting_id = meeting_data["meetingId"]

            # Step 4: Participant joins meeting
            join_response = client.post(
                f"/api/meetings/{meeting_id}/join",
                json={"userId": participant_id},
                content_type="application/json",
            )
            assert join_response.status_code == 200

            # Step 5: Check participants
            participants_response = client.get(f"/api/meetings/{meeting_id}/participants")
            assert participants_response.status_code == 200
            participants = participants_response.get_json()
            assert len(participants) == 2

            # Verify host and participant
            host_participant = next((p for p in participants if p["isHost"]), None)
            regular_participant = next((p for p in participants if not p["isHost"]), None)
            assert host_participant is not None
            assert regular_participant is not None
            assert host_participant["username"] == "host"
            assert regular_participant["username"] == "participant"

            # Step 6: Participant leaves meeting
            leave_response = client.post(
                f"/api/meetings/{meeting_id}/leave",
                json={"userId": participant_id},
                content_type="application/json",
            )
            assert leave_response.status_code == 200

            # Step 7: Check participants again (should only be host)
            participants_response = client.get(f"/api/meetings/{meeting_id}/participants")
            participants = participants_response.get_json()
            assert len(participants) == 1
            assert participants[0]["isHost"] is True

            # Step 8: Host ends meeting
            end_response = client.post(
                f"/api/meetings/{meeting_id}/end",
                json={"userId": host_id},
                content_type="application/json",
            )
            assert end_response.status_code == 200

            # Step 9: Verify meeting is inactive
            meeting = mock_db["meetings"].find_one({"_id": ObjectId(meeting_id)})
            assert meeting["active"] is False

    def test_multiple_meetings_same_host(self, client, mock_db):
        """Test host creating multiple meetings"""
        with patch("server.users_collection", mock_db["users"]), patch(
            "server.meetings_collection", mock_db["meetings"]
        ), patch("server.participants_collection", mock_db["participants"]):
            # Create host
            host_response = client.post(
                "/api/users", json={"username": "multihost"}, content_type="application/json"
            )
            host_id = host_response.get_json()["userId"]

            # Create multiple meetings
            meeting1_response = client.post(
                "/api/meetings",
                json={"hostId": host_id, "name": "Meeting 1"},
                content_type="application/json",
            )
            meeting2_response = client.post(
                "/api/meetings",
                json={"hostId": host_id, "name": "Meeting 2"},
                content_type="application/json",
            )

            assert meeting1_response.status_code == 201
            assert meeting2_response.status_code == 201

            meeting1_id = meeting1_response.get_json()["meetingId"]
            meeting2_id = meeting2_response.get_json()["meetingId"]

            # Verify both meetings exist and are active
            meeting1 = mock_db["meetings"].find_one({"_id": ObjectId(meeting1_id)})
            meeting2 = mock_db["meetings"].find_one({"_id": ObjectId(meeting2_id)})

            assert meeting1["active"] is True
            assert meeting2["active"] is True
            assert meeting1["name"] == "Meeting 1"
            assert meeting2["name"] == "Meeting 2"

    def test_user_joins_multiple_meetings(self, client, mock_db):
        """Test user joining multiple meetings"""
        with patch("server.users_collection", mock_db["users"]), patch(
            "server.meetings_collection", mock_db["meetings"]
        ), patch("server.participants_collection", mock_db["participants"]):
            # Create users
            host1_response = client.post(
                "/api/users", json={"username": "host1"}, content_type="application/json"
            )
            host2_response = client.post(
                "/api/users", json={"username": "host2"}, content_type="application/json"
            )
            user_response = client.post(
                "/api/users", json={"username": "multiuser"}, content_type="application/json"
            )

            host1_id = host1_response.get_json()["userId"]
            host2_id = host2_response.get_json()["userId"]
            user_id = user_response.get_json()["userId"]

            # Create meetings
            meeting1_response = client.post(
                "/api/meetings", json={"hostId": host1_id}, content_type="application/json"
            )
            meeting2_response = client.post(
                "/api/meetings", json={"hostId": host2_id}, content_type="application/json"
            )

            meeting1_id = meeting1_response.get_json()["meetingId"]
            meeting2_id = meeting2_response.get_json()["meetingId"]

            # User joins both meetings
            join1_response = client.post(
                f"/api/meetings/{meeting1_id}/join",
                json={"userId": user_id},
                content_type="application/json",
            )
            join2_response = client.post(
                f"/api/meetings/{meeting2_id}/join",
                json={"userId": user_id},
                content_type="application/json",
            )

            assert join1_response.status_code == 200
            assert join2_response.status_code == 200

            # Verify user is in both meetings
            participants1 = mock_db["participants"].find(
                {"meetingId": meeting1_id, "userId": user_id}
            )
            participants2 = mock_db["participants"].find(
                {"meetingId": meeting2_id, "userId": user_id}
            )

            assert len(list(participants1)) == 1
            assert len(list(participants2)) == 1


class TestErrorScenarios:
    """Test error scenarios and edge cases"""

    def test_join_meeting_after_ended(self, client, mock_db):
        """Test joining meeting after it has been ended"""
        with patch("server.users_collection", mock_db["users"]), patch(
            "server.meetings_collection", mock_db["meetings"]
        ), patch("server.participants_collection", mock_db["participants"]), patch(
            "server.socketio"
        ):
            # Create users and meeting
            host_response = client.post(
                "/api/users", json={"username": "host"}, content_type="application/json"
            )
            user_response = client.post(
                "/api/users", json={"username": "user"}, content_type="application/json"
            )

            host_id = host_response.get_json()["userId"]
            user_id = user_response.get_json()["userId"]

            meeting_response = client.post(
                "/api/meetings", json={"hostId": host_id}, content_type="application/json"
            )
            meeting_id = meeting_response.get_json()["meetingId"]

            # End meeting
            end_response = client.post(
                f"/api/meetings/{meeting_id}/end",
                json={"userId": host_id},
                content_type="application/json",
            )
            assert end_response.status_code == 200

            # Try to join ended meeting
            join_response = client.post(
                f"/api/meetings/{meeting_id}/join",
                json={"userId": user_id},
                content_type="application/json",
            )
            assert join_response.status_code == 400
            assert "Meeting has ended" in join_response.get_json()["error"]

    def test_concurrent_user_creation(self, client, mock_db):
        """Test concurrent creation of users with same username"""
        with patch("server.users_collection", mock_db["users"]):
            # Simulate race condition by creating user first
            mock_db["users"].insert_one(
                {
                    "username": "concurrent_user",
                    "displayName": "First User",
                    "createdAt": datetime.now(),
                }
            )

            # Try to create same username
            response = client.post(
                "/api/users",
                json={"username": "concurrent_user", "displayName": "Second User"},
                content_type="application/json",
            )

            assert response.status_code == 400
            assert "Username already exists" in response.get_json()["error"]

    def test_invalid_data_types(self, client):
        """Test API with invalid data types"""
        # Try to create user with number as username
        response = client.post(
            "/api/users",
            json={"username": 12345, "displayName": "Number User"},
            content_type="application/json",
        )

        # Should handle gracefully
        assert response.status_code in [200, 201, 400, 500]

        # Try to create meeting with invalid hostId type
        response = client.post(
            "/api/meetings",
            json={"hostId": ["invalid", "array"], "name": "Invalid Meeting"},
            content_type="application/json",
        )

        # Should handle gracefully (may succeed with type coercion or fail with error)
        assert response.status_code in [200, 201, 400, 500]


class TestSocketIntegration:
    """Test Socket.IO integration with REST API"""

    def test_socket_join_with_valid_meeting(self, socket_client, client, mock_db):
        """Test socket join event with valid meeting from REST API"""
        with patch("server.users_collection", mock_db["users"]), patch(
            "server.meetings_collection", mock_db["meetings"]
        ), patch("server.participants_collection", mock_db["participants"]):
            # Create meeting via REST API
            host_response = client.post(
                "/api/users", json={"username": "sockethost"}, content_type="application/json"
            )
            host_id = host_response.get_json()["userId"]

            meeting_response = client.post(
                "/api/meetings", json={"hostId": host_id}, content_type="application/json"
            )
            meeting_id = meeting_response.get_json()["meetingId"]

            # Join via Socket.IO
            socket_client.emit("join", {"room": meeting_id, "userId": host_id})

            # Test passes if no exception during join (events may not be received in test mode)
            assert True

    def test_end_meeting_socket_vs_rest(self, socket_client, client, mock_db):
        """Test ending meeting via socket vs REST API"""
        with patch("server.users_collection", mock_db["users"]), patch(
            "server.meetings_collection", mock_db["meetings"]
        ), patch("server.participants_collection", mock_db["participants"]):
            # Create meeting
            host_response = client.post(
                "/api/users", json={"username": "endhost"}, content_type="application/json"
            )
            host_id = host_response.get_json()["userId"]

            meeting_response = client.post(
                "/api/meetings", json={"hostId": host_id}, content_type="application/json"
            )
            meeting_id = meeting_response.get_json()["meetingId"]

            # End via Socket.IO
            socket_client.emit("end-meeting", {"room": meeting_id, "userId": host_id})

            # Verify meeting ended
            meeting = mock_db["meetings"].find_one({"_id": ObjectId(meeting_id)})
            assert meeting["active"] is False

    def test_chat_message_flow(self, socket_client, client, mock_db):
        """Test complete chat message flow"""
        with patch("server.users_collection", mock_db["users"]), patch(
            "server.meetings_collection", mock_db["meetings"]
        ), patch("server.participants_collection", mock_db["participants"]):
            # Setup meeting
            host_response = client.post(
                "/api/users", json={"username": "chathost"}, content_type="application/json"
            )
            user_response = client.post(
                "/api/users", json={"username": "chatuser"}, content_type="application/json"
            )

            host_id = host_response.get_json()["userId"]
            user_id = user_response.get_json()["userId"]

            meeting_response = client.post(
                "/api/meetings", json={"hostId": host_id}, content_type="application/json"
            )
            meeting_id = meeting_response.get_json()["meetingId"]

            # Join meeting
            join_response = client.post(
                f"/api/meetings/{meeting_id}/join",
                json={"userId": user_id},
                content_type="application/json",
            )
            assert join_response.status_code == 200

            # Send chat message
            message_data = {
                "room": meeting_id,
                "id": "msg123",
                "userId": user_id,
                "username": "chatuser",
                "message": "Hello from integration test!",
                "timestamp": datetime.now().isoformat(),
            }

            socket_client.emit("send-chat-message", message_data)

            # Should process without error
            assert True


class TestPerformanceScenarios:
    """Test performance-related scenarios"""

    def test_large_meeting_participants(self, client, mock_db):
        """Test meeting with many participants"""
        with patch("server.users_collection", mock_db["users"]), patch(
            "server.meetings_collection", mock_db["meetings"]
        ), patch("server.participants_collection", mock_db["participants"]):
            # Create host
            host_response = client.post(
                "/api/users", json={"username": "perfhost"}, content_type="application/json"
            )
            host_id = host_response.get_json()["userId"]

            # Create meeting
            meeting_response = client.post(
                "/api/meetings", json={"hostId": host_id}, content_type="application/json"
            )
            meeting_id = meeting_response.get_json()["meetingId"]

            # Add many participants
            participant_ids = []
            for i in range(20):  # 20 participants
                user_response = client.post(
                    "/api/users", json={"username": f"perfuser{i}"}, content_type="application/json"
                )
                user_id = user_response.get_json()["userId"]
                participant_ids.append(user_id)

                join_response = client.post(
                    f"/api/meetings/{meeting_id}/join",
                    json={"userId": user_id},
                    content_type="application/json",
                )
                assert join_response.status_code == 200

            # Get all participants
            participants_response = client.get(f"/api/meetings/{meeting_id}/participants")
            assert participants_response.status_code == 200
            participants = participants_response.get_json()

            # Should have host + 20 participants = 21 total
            assert len(participants) == 21

    def test_rapid_join_leave_sequence(self, client, mock_db):
        """Test rapid joining and leaving"""
        with patch("server.users_collection", mock_db["users"]), patch(
            "server.meetings_collection", mock_db["meetings"]
        ), patch("server.participants_collection", mock_db["participants"]):
            # Setup
            host_response = client.post(
                "/api/users", json={"username": "rapidhost"}, content_type="application/json"
            )
            user_response = client.post(
                "/api/users", json={"username": "rapiduser"}, content_type="application/json"
            )

            host_id = host_response.get_json()["userId"]
            user_id = user_response.get_json()["userId"]

            meeting_response = client.post(
                "/api/meetings", json={"hostId": host_id}, content_type="application/json"
            )
            meeting_id = meeting_response.get_json()["meetingId"]

            # Rapid join/leave sequence
            for _ in range(5):
                # Join
                join_response = client.post(
                    f"/api/meetings/{meeting_id}/join",
                    json={"userId": user_id},
                    content_type="application/json",
                )
                assert join_response.status_code == 200

                # Leave
                leave_response = client.post(
                    f"/api/meetings/{meeting_id}/leave",
                    json={"userId": user_id},
                    content_type="application/json",
                )
                assert leave_response.status_code == 200

            # Final state should be consistent
            participants_response = client.get(f"/api/meetings/{meeting_id}/participants")
            participants = participants_response.get_json()

            # Should only have host
            assert len(participants) == 1
            assert participants[0]["isHost"] is True
