"""
WebSocket events for real-time game communication.
Optimized for low RAM (500MB) and maximum performance.
Game state is stored in memory - only save to DB when match ends.
"""

import time
import random
import string
from flask import session, request
from flask_socketio import emit, join_room, leave_room
from app.extensions import socketio
from app.services import UserService


# ============ IN-MEMORY GAME STATE ============
# All game logic runs in memory for maximum speed

# Active game rooms: {room_code: {host_id, guest_id, host_username, guest_username,
#                                  best_of, host_score, guest_score, current_round,
#                                  host_choice, guest_choice, status, created_at}}
active_games = {}

# Store connected users by room
room_users = {}  # {room_code: {user_id: sid}}

# Store online users in lobby
lobby_users = {}  # {user_id: {username, avatar_url, sid}}

# Store pending invites
pending_invites = {}  # {invite_id: {...}}
INVITE_TIMEOUT = 60

# Constants
VALID_CHOICES = {'rock', 'paper', 'scissors'}
CHOICE_BEATS = {'rock': 'scissors', 'paper': 'rock', 'scissors': 'paper'}


def generate_room_code():
    """Generate a random 6-character room code."""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def cleanup_old_invites():
    """Remove expired invites."""
    now = time.time()
    expired = [k for k, v in pending_invites.items() if now - v.get('timestamp', 0) > INVITE_TIMEOUT]
    for k in expired:
        del pending_invites[k]


def cleanup_old_games():
    """Remove stale games (older than 1 hour)."""
    now = time.time()
    expired = [k for k, v in active_games.items() if now - v.get('created_at', 0) > 3600]
    for k in expired:
        del active_games[k]
        room_users.pop(k, None)


def get_game_state(room_code):
    """Get game state from memory."""
    return active_games.get(room_code)


def create_game(room_code, host_id, host_username, best_of=3):
    """Create a new game in memory."""
    active_games[room_code] = {
        'host_id': host_id,
        'guest_id': None,
        'host_username': host_username,
        'guest_username': None,
        'best_of': best_of,
        'host_score': 0,
        'guest_score': 0,
        'current_round': 0,
        'host_choice': None,
        'guest_choice': None,
        'status': 'waiting',
        'created_at': time.time(),
        'rounds': []
    }
    return active_games[room_code]


def game_to_dict(room_code):
    """Convert game state to dict for client."""
    game = active_games.get(room_code)
    if not game:
        return None
    return {
        'room_code': room_code,
        'host': {'id': game['host_id'], 'username': game['host_username']},
        'guest': {'id': game['guest_id'], 'username': game['guest_username']} if game['guest_id'] else None,
        'best_of': game['best_of'],
        'host_score': game['host_score'],
        'guest_score': game['guest_score'],
        'current_round': game['current_round'],
        'status': game['status']
    }


@socketio.on('connect')
def handle_connect():
    """Handle new WebSocket connection."""
    user_id = session.get('user_id')
    print(f"[Socket] Connect attempt - user_id: {user_id}, sid: {request.sid}")

    if user_id:
        emit('connected', {'user_id': user_id, 'sid': request.sid})
    else:
        # Still allow connection but notify client
        emit('connected', {'user_id': None, 'sid': request.sid, 'error': 'Not authenticated'})


@socketio.on('ping')
def handle_ping():
    """Heartbeat ping - respond with pong."""
    emit('pong', {'timestamp': time.time()})


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

        # Clean up lobby_users
        if user_id in lobby_users:
            del lobby_users[user_id]
            # Broadcast updated online list to lobby
            broadcast_lobby_users()


def broadcast_lobby_users():
    """Broadcast current online users to all lobby members."""
    # Cleanup old invites periodically
    cleanup_old_invites()

    online_list = [
        {'id': uid, 'username': data['username'], 'avatar_url': data.get('avatar_url')}
        for uid, data in lobby_users.items()
    ]
    socketio.emit('lobby_users', {'users': online_list}, room='game_lobby')


@socketio.on('join_lobby')
def handle_join_lobby():
    """User joins the game lobby to see online players."""
    user_id = session.get('user_id')
    sid = request.sid

    print(f"[Socket] join_lobby - user_id: {user_id}, sid: {sid}")

    if not user_id:
        emit('error', {'message': 'Chưa đăng nhập'})
        return

    user = UserService.get_by_id(user_id)
    if not user:
        emit('error', {'message': 'User not found'})
        return

    # Join lobby room
    join_room('game_lobby')

    # Add to lobby users with sid for tracking
    lobby_users[user_id] = {
        'username': user.username,
        'avatar_url': user.avatar_url,
        'sid': sid
    }

    print(f"[Socket] User {user.username} joined lobby. Total online: {len(lobby_users)}")

    # Send confirmation first
    emit('joined_lobby', {'user_id': user_id, 'username': user.username})

    # Then broadcast updated list to everyone
    broadcast_lobby_users()


@socketio.on('create_room')
def handle_create_room(data):
    """Create a new game room in memory."""
    user_id = session.get('user_id')
    print(f"[Socket] create_room - user_id: {user_id}")

    if not user_id:
        emit('error', {'message': 'Chưa đăng nhập'})
        return

    user = UserService.get_by_id(user_id)
    if not user:
        emit('error', {'message': 'User not found'})
        return

    best_of = data.get('best_of', 3)
    if best_of not in [1, 3, 5]:
        best_of = 3

    # Cleanup old games periodically
    cleanup_old_games()

    # Generate unique room code
    room_code = generate_room_code()
    while room_code in active_games:
        room_code = generate_room_code()

    # Create game in memory
    create_game(room_code, user_id, user.username, best_of)

    # Auto-join host to socket room
    join_room(room_code)
    if room_code not in room_users:
        room_users[room_code] = {}
    room_users[room_code][user_id] = request.sid

    print(f"[Socket] Room created: {room_code} by user {user_id}")

    emit('room_created', {
        'room_code': room_code,
        'room': game_to_dict(room_code)
    })


@socketio.on('join_room_by_code')
def handle_join_room_by_code(data):
    """Join a room using room code."""
    user_id = session.get('user_id')
    room_code = data.get('room_code', '').upper().strip()

    print(f"[Socket] join_room_by_code - user_id: {user_id}, room: {room_code}")

    if not user_id:
        emit('error', {'message': 'Chưa đăng nhập'})
        return

    if not room_code:
        emit('error', {'message': 'Vui lòng nhập mã phòng'})
        return

    game = get_game_state(room_code)
    if not game:
        emit('error', {'message': 'Không tìm thấy phòng'})
        return

    if game['status'] != 'waiting':
        emit('error', {'message': 'Phòng không khả dụng'})
        return

    if game['host_id'] == user_id:
        emit('error', {'message': 'Không thể tham gia phòng của chính mình'})
        return

    if game['guest_id']:
        emit('error', {'message': 'Phòng đã đầy'})
        return

    # Get guest user info
    user = UserService.get_by_id(user_id)
    if not user:
        emit('error', {'message': 'User not found'})
        return

    # Add guest to game
    game['guest_id'] = user_id
    game['guest_username'] = user.username
    game['status'] = 'playing'
    game['current_round'] = 1

    # Auto-join guest to socket room
    join_room(room_code)
    if room_code not in room_users:
        room_users[room_code] = {}
    room_users[room_code][user_id] = request.sid

    # Notify host that guest joined
    socketio.emit('player_joined', {
        'user': {'id': user_id, 'username': user.username},
        'room': game_to_dict(room_code)
    }, room=room_code)

    print(f"[Socket] User {user_id} joined room {room_code}")

    emit('room_joined', {
        'room_code': room_code,
        'room': game_to_dict(room_code)
    })


@socketio.on('leave_lobby')
def handle_leave_lobby():
    """User leaves the game lobby."""
    user_id = session.get('user_id')
    if user_id:
        leave_room('game_lobby')
        if user_id in lobby_users:
            del lobby_users[user_id]
            broadcast_lobby_users()


@socketio.on('invite_player')
def handle_invite_player(data):
    """Send game invite to another player."""
    import uuid
    import time

    from_user_id = session.get('user_id')
    to_user_id = data.get('to_user_id')
    best_of = data.get('best_of', 3)

    if not from_user_id or not to_user_id:
        emit('error', {'message': 'Invalid request'})
        return

    if to_user_id not in lobby_users:
        emit('error', {'message': 'Player is offline'})
        return

    if from_user_id == to_user_id:
        emit('error', {'message': 'Cannot invite yourself'})
        return

    from_user = UserService.get_by_id(from_user_id)
    if not from_user:
        emit('error', {'message': 'User not found'})
        return

    # Create invite
    invite_id = str(uuid.uuid4())[:8]
    pending_invites[invite_id] = {
        'from_user_id': from_user_id,
        'from_username': from_user.username,
        'from_avatar': from_user.avatar_url,
        'to_user_id': to_user_id,
        'best_of': best_of,
        'timestamp': time.time()
    }

    # Send invite to target player (broadcast to lobby, client filters)
    emit('game_invite', {
        'invite_id': invite_id,
        'from_user': {
            'id': from_user_id,
            'username': from_user.username,
            'avatar_url': from_user.avatar_url
        },
        'to_user_id': to_user_id,
        'best_of': best_of
    }, room='game_lobby')

    emit('invite_sent', {'invite_id': invite_id, 'to_user_id': to_user_id})


@socketio.on('accept_invite')
def handle_accept_invite(data):
    """Accept a game invite and create room IN MEMORY."""
    invite_id = data.get('invite_id')
    user_id = session.get('user_id')

    if not invite_id or invite_id not in pending_invites:
        emit('error', {'message': 'Invalid invite'})
        return

    invite = pending_invites[invite_id]

    if invite['to_user_id'] != user_id:
        emit('error', {'message': 'This invite is not for you'})
        return

    # Get guest user info
    guest_user = UserService.get_by_id(user_id)
    if not guest_user:
        emit('error', {'message': 'User not found'})
        return

    # Create game room IN MEMORY (no database!)
    room_code = generate_room_code()
    from_user_id = invite['from_user_id']
    best_of = invite['best_of']

    create_game(room_code, from_user_id, invite['from_username'], best_of)

    # Add guest to game
    game = active_games[room_code]
    game['guest_id'] = user_id
    game['guest_username'] = guest_user.username
    game['status'] = 'playing'
    game['current_round'] = 1

    # Clean up invite
    del pending_invites[invite_id]

    # Notify both players
    emit('game_started', {
        'room_code': room_code,
        'invite_id': invite_id
    }, room='game_lobby')


@socketio.on('decline_invite')
def handle_decline_invite(data):
    """Decline a game invite."""
    invite_id = data.get('invite_id')
    user_id = session.get('user_id')

    if not invite_id or invite_id not in pending_invites:
        return

    invite = pending_invites[invite_id]

    if invite['to_user_id'] != user_id:
        return

    # Get decliner info
    user = UserService.get_by_id(user_id)

    # Clean up invite
    del pending_invites[invite_id]

    # Notify inviter
    emit('invite_declined', {
        'invite_id': invite_id,
        'declined_by': {
            'id': user_id,
            'username': user.username if user else 'Unknown'
        }
    }, room='game_lobby')


@socketio.on('join_game_room')
def handle_join_room(data):
    """Join a game room WebSocket channel - ALL IN MEMORY."""
    room_code = data.get('room_code', '').upper()
    user_id = session.get('user_id')

    if not user_id or not room_code:
        emit('error', {'message': 'Invalid request'})
        return

    game = get_game_state(room_code)
    if not game:
        emit('error', {'message': 'Room not found'})
        return

    # Check if user is part of this room
    if user_id not in [game['host_id'], game['guest_id']]:
        emit('error', {'message': 'Not in this room'})
        return

    # Join the socket room
    join_room(room_code)

    # Track user
    if room_code not in room_users:
        room_users[room_code] = {}
    room_users[room_code][user_id] = request.sid

    # Get username
    username = game['host_username'] if user_id == game['host_id'] else game['guest_username']

    # Notify room
    emit('player_joined', {
        'user': {'id': user_id, 'username': username},
        'room': game_to_dict(room_code)
    }, room=room_code)


@socketio.on('leave_game_room')
def handle_leave_room(data):
    """Leave a game room - forfeit if playing."""
    room_code = data.get('room_code', '').upper()
    user_id = session.get('user_id')

    if not room_code or not user_id:
        return

    leave_room(room_code)

    if room_code in room_users and user_id in room_users[room_code]:
        del room_users[room_code][user_id]

    game = get_game_state(room_code)
    if game and game['status'] == 'playing':
        # Forfeit - other player wins
        winner_id = game['guest_id'] if user_id == game['host_id'] else game['host_id']
        if winner_id:
            end_match_in_memory(room_code, winner_id)

    emit('player_left', {'user_id': user_id}, room=room_code)


@socketio.on('make_choice')
def handle_make_choice(data):
    """Handle player choice - ALL IN MEMORY, NO DATABASE!"""
    room_code = data.get('room_code', '').upper()
    choice = data.get('choice', '').lower()
    user_id = session.get('user_id')

    if not all([room_code, choice, user_id]):
        emit('error', {'message': 'Invalid request'})
        return

    if choice not in VALID_CHOICES:
        emit('error', {'message': 'Invalid choice'})
        return

    game = get_game_state(room_code)
    if not game:
        emit('error', {'message': 'Room not found'})
        return

    if game['status'] != 'playing':
        emit('error', {'message': 'Game not in progress'})
        return

    # Set choice in memory
    is_host = user_id == game['host_id']
    if is_host:
        if game['host_choice']:
            emit('error', {'message': 'Already chosen'})
            return
        game['host_choice'] = choice
    else:
        if game['guest_choice']:
            emit('error', {'message': 'Already chosen'})
            return
        game['guest_choice'] = choice

    # Emit choice made (without revealing)
    emit('choice_made', {'user_id': user_id, 'ready': True}, room=room_code)

    # Check if round complete
    if game['host_choice'] and game['guest_choice']:
        resolve_round_in_memory(room_code)


def resolve_round_in_memory(room_code):
    """Resolve round - all in memory."""
    game = active_games[room_code]
    host_choice = game['host_choice']
    guest_choice = game['guest_choice']

    # Determine winner
    if host_choice == guest_choice:
        result = 'draw'
    elif CHOICE_BEATS[host_choice] == guest_choice:
        result = 'host'
        game['host_score'] += 1
    else:
        result = 'guest'
        game['guest_score'] += 1

    # Save round result
    game['rounds'].append({
        'round': game['current_round'],
        'host_choice': host_choice,
        'guest_choice': guest_choice,
        'result': result
    })

    round_data = {
        'round_number': game['current_round'],
        'host_choice': host_choice,
        'guest_choice': guest_choice,
        'result': result
    }

    # Check if match over
    wins_needed = (game['best_of'] // 2) + 1
    if game['host_score'] >= wins_needed:
        end_match_in_memory(room_code, game['host_id'])
        socketio.emit('match_result', {
            'status': 'match_complete',
            'winner_id': game['host_id'],
            'room': game_to_dict(room_code),
            'round': round_data
        }, room=room_code)
    elif game['guest_score'] >= wins_needed:
        end_match_in_memory(room_code, game['guest_id'])
        socketio.emit('match_result', {
            'status': 'match_complete',
            'winner_id': game['guest_id'],
            'room': game_to_dict(room_code),
            'round': round_data
        }, room=room_code)
    else:
        # Next round
        game['current_round'] += 1
        game['host_choice'] = None
        game['guest_choice'] = None

        socketio.emit('round_result', {
            'status': 'round_complete',
            'round': round_data,
            'room': game_to_dict(room_code)
        }, room=room_code)


def end_match_in_memory(room_code, winner_id):
    """End match and save to database (only time we hit DB)."""
    game = active_games.get(room_code)
    if not game:
        return

    game['status'] = 'finished'

    # Save to database asynchronously (only at match end!)
    try:
        import json
        from app.extensions import db
        from app.models import GameMatch

        match = GameMatch(
            player1_id=game['host_id'],
            player2_id=game['guest_id'],
            winner_id=winner_id,
            player1_score=game['host_score'],
            player2_score=game['guest_score'],
            rounds_data=json.dumps(game['rounds'])
        )
        db.session.add(match)

        # Update user stats
        if winner_id == game['host_id']:
            UserService.update_stats(game['host_id'], 'win')
            UserService.update_stats(game['guest_id'], 'loss')
        else:
            UserService.update_stats(game['guest_id'], 'win')
            UserService.update_stats(game['host_id'], 'loss')

        db.session.commit()
    except Exception as e:
        print(f"Error saving match to DB: {e}")
        db.session.rollback()


@socketio.on('request_rematch')
def handle_rematch(data):
    """Handle rematch request - create new game in memory."""
    room_code = data.get('room_code', '').upper()
    user_id = session.get('user_id')

    old_game = get_game_state(room_code)
    if not old_game or old_game['status'] != 'finished':
        emit('error', {'message': 'Cannot rematch'})
        return

    # Create new game in memory
    new_room_code = generate_room_code()
    username = old_game['host_username'] if user_id == old_game['host_id'] else old_game['guest_username']

    create_game(new_room_code, user_id, username, old_game['best_of'])

    emit('rematch_requested', {
        'new_room_code': new_room_code,
        'requested_by': user_id
    }, room=room_code)


@socketio.on('get_room_state')
def handle_get_room_state(data):
    """Get current room state from memory."""
    room_code = data.get('room_code', '').upper()
    user_id = session.get('user_id')

    if not room_code or not user_id:
        emit('error', {'message': 'Invalid request'})
        return

    game = get_game_state(room_code)
    if not game:
        emit('error', {'message': 'Room not found'})
        return

    # Don't reveal current choices
    emit('room_state', {
        'room': game_to_dict(room_code),
        'current_round': game['current_round'],
        'host_ready': game['host_choice'] is not None,
        'guest_ready': game['guest_choice'] is not None,
        'online_players': list(room_users.get(room_code, {}).keys())
    })
