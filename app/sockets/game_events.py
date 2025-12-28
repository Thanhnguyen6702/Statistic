"""
WebSocket events for real-time game communication.
"""

from flask import session
from flask_socketio import emit, join_room, leave_room
from app.extensions import socketio
from app.services import GameRoomService, UserService


# Store connected users by room
room_users = {}  # {room_code: {user_id: True}}


@socketio.on('connect')
def handle_connect():
    """Handle new WebSocket connection."""
    user_id = session.get('user_id')
    if not user_id:
        return False  # Reject connection
    emit('connected', {'user_id': user_id})


@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection."""
    user_id = session.get('user_id')
    if user_id:
        # Clean up room_users
        for room_code, users in list(room_users.items()):
            if user_id in users:
                del users[user_id]
                # Notify others in room
                emit('player_disconnected', {'user_id': user_id}, room=room_code)


@socketio.on('join_game_room')
def handle_join_room(data):
    """Join a game room WebSocket channel."""
    room_code = data.get('room_code', '').upper()
    user_id = session.get('user_id')

    if not user_id or not room_code:
        emit('error', {'message': 'Invalid request'})
        return

    room = GameRoomService.get_room_by_code(room_code)
    if not room:
        emit('error', {'message': 'Room not found'})
        return

    # Check if user is part of this room
    if user_id not in [room.host_id, room.guest_id]:
        emit('error', {'message': 'Not in this room'})
        return

    # Join the socket room
    join_room(room_code)

    # Track user
    if room_code not in room_users:
        room_users[room_code] = {}
    room_users[room_code][user_id] = True

    # Notify room
    user = UserService.get_by_id(user_id)
    emit('player_joined', {
        'user': user.to_dict(include_stats=False),
        'room': room.to_dict()
    }, room=room_code)


@socketio.on('leave_game_room')
def handle_leave_room(data):
    """Leave a game room WebSocket channel."""
    room_code = data.get('room_code', '').upper()
    user_id = session.get('user_id')

    if room_code and user_id:
        leave_room(room_code)
        if room_code in room_users and user_id in room_users[room_code]:
            del room_users[room_code][user_id]

        emit('player_left', {'user_id': user_id}, room=room_code)


@socketio.on('make_choice')
def handle_make_choice(data):
    """Handle player choice (rock/paper/scissors)."""
    room_code = data.get('room_code', '').upper()
    choice = data.get('choice', '').lower()
    user_id = session.get('user_id')

    if not all([room_code, choice, user_id]):
        emit('error', {'message': 'Invalid request'})
        return

    room = GameRoomService.get_room_by_code(room_code)
    if not room:
        emit('error', {'message': 'Room not found'})
        return

    try:
        result = GameRoomService.make_choice(room.id, user_id, choice)

        # Emit choice made (without revealing what it is)
        emit('choice_made', {
            'user_id': user_id,
            'ready': True
        }, room=room_code)

        # If round/match complete, emit result
        if result['status'] == 'round_complete':
            emit('round_result', result, room=room_code)
        elif result['status'] == 'match_complete':
            emit('match_result', result, room=room_code)

    except ValueError as e:
        emit('error', {'message': str(e)})


@socketio.on('request_rematch')
def handle_rematch(data):
    """Handle rematch request."""
    room_code = data.get('room_code', '').upper()
    user_id = session.get('user_id')

    old_room = GameRoomService.get_room_by_code(room_code)
    if not old_room or old_room.status != 'finished':
        emit('error', {'message': 'Cannot rematch'})
        return

    new_room = GameRoomService.create_room(user_id, old_room.best_of)

    emit('rematch_requested', {
        'new_room_code': new_room.room_code,
        'requested_by': user_id
    }, room=room_code)


@socketio.on('get_room_state')
def handle_get_room_state(data):
    """Get current room state."""
    room_code = data.get('room_code', '').upper()
    user_id = session.get('user_id')

    if not room_code or not user_id:
        emit('error', {'message': 'Invalid request'})
        return

    room = GameRoomService.get_room_by_code(room_code)
    if not room:
        emit('error', {'message': 'Room not found'})
        return

    current_round = GameRoomService.get_current_round(room.id)

    emit('room_state', {
        'room': room.to_dict(),
        'current_round': current_round.to_dict() if current_round else None
    })
