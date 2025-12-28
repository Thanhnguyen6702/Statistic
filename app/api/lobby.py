"""
Lobby API - Polling-based multiplayer lobby (no WebSocket needed).
Lightweight solution for low-RAM environments like Koyeb.
"""

import time
import random
import string
from flask import Blueprint, jsonify, request, session
from app.services import UserService

bp = Blueprint('lobby', __name__)

# ============ IN-MEMORY STORAGE ============
# Online users: {user_id: {username, avatar_url, last_seen}}
online_users = {}

# Game rooms: {room_code: {host_id, guest_id, host_username, guest_username,
#              best_of, host_score, guest_score, current_round, status, ...}}
game_rooms = {}

# Pending invites: {invite_id: {from_user_id, to_user_id, best_of, timestamp}}
pending_invites = {}

# Pending redirects for invite senders: {user_id: {room_code, timestamp}}
pending_redirects = {}

# Constants
ONLINE_TIMEOUT = 30  # seconds - user considered offline after this
INVITE_TIMEOUT = 60  # seconds
ROOM_TIMEOUT = 3600  # 1 hour

VALID_CHOICES = {'rock', 'paper', 'scissors'}
CHOICE_BEATS = {'rock': 'scissors', 'paper': 'rock', 'scissors': 'paper'}


def cleanup():
    """Remove stale data."""
    now = time.time()

    # Remove offline users
    offline = [uid for uid, data in online_users.items()
               if now - data.get('last_seen', 0) > ONLINE_TIMEOUT]
    for uid in offline:
        del online_users[uid]

    # Remove expired invites
    expired_invites = [iid for iid, data in pending_invites.items()
                       if now - data.get('timestamp', 0) > INVITE_TIMEOUT]
    for iid in expired_invites:
        del pending_invites[iid]

    # Remove old rooms
    expired_rooms = [code for code, data in game_rooms.items()
                     if now - data.get('created_at', 0) > ROOM_TIMEOUT]
    for code in expired_rooms:
        del game_rooms[code]


def generate_code(length=6):
    """Generate random room/invite code."""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))


# ============ HEARTBEAT & ONLINE STATUS ============

@bp.route('/heartbeat', methods=['POST'])
def heartbeat():
    """Update user's online status. Call every 10-15 seconds."""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    user = UserService.get_by_id(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    online_users[user_id] = {
        'username': user.username,
        'avatar_url': user.avatar_url,
        'last_seen': time.time()
    }

    # Check if there's a pending redirect (invite was accepted)
    if user_id in pending_redirects:
        redirect_data = pending_redirects.pop(user_id)
        return jsonify({
            'ok': True,
            'redirect': f"/game/room/{redirect_data['room_code']}",
            'pending_invites': []
        })

    # Check for pending invites for this user
    my_invites = [
        {
            'invite_id': iid,
            'from_user': {
                'id': data['from_user_id'],
                'username': data['from_username'],
                'avatar_url': data.get('from_avatar')
            },
            'best_of': data['best_of']
        }
        for iid, data in pending_invites.items()
        if data['to_user_id'] == user_id
    ]

    return jsonify({
        'ok': True,
        'pending_invites': my_invites
    })


@bp.route('/leave', methods=['POST'])
def leave():
    """User leaves lobby."""
    user_id = session.get('user_id')
    if user_id and user_id in online_users:
        del online_users[user_id]
    return jsonify({'ok': True})


@bp.route('/online', methods=['GET'])
def get_online_users():
    """Get list of online users."""
    cleanup()

    users = [
        {'id': uid, 'username': data['username'], 'avatar_url': data.get('avatar_url')}
        for uid, data in online_users.items()
    ]

    return jsonify({'users': users, 'count': len(users)})


# ============ INVITES ============

@bp.route('/invite', methods=['POST'])
def send_invite():
    """Send game invite to another user."""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.get_json() or {}
    to_user_id = data.get('to_user_id')
    best_of = data.get('best_of', 3)

    if not to_user_id:
        return jsonify({'error': 'Missing to_user_id'}), 400

    if to_user_id == user_id:
        return jsonify({'error': 'Cannot invite yourself'}), 400

    if to_user_id not in online_users:
        return jsonify({'error': 'User is offline'}), 400

    user = UserService.get_by_id(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    invite_id = generate_code(8)
    pending_invites[invite_id] = {
        'from_user_id': user_id,
        'from_username': user.username,
        'from_avatar': user.avatar_url,
        'to_user_id': to_user_id,
        'best_of': best_of,
        'timestamp': time.time()
    }

    return jsonify({'ok': True, 'invite_id': invite_id})


@bp.route('/invite/<invite_id>/accept', methods=['POST'])
def accept_invite(invite_id):
    """Accept an invite and create game room."""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    if invite_id not in pending_invites:
        return jsonify({'error': 'Invite not found or expired'}), 404

    invite = pending_invites[invite_id]

    if invite['to_user_id'] != user_id:
        return jsonify({'error': 'This invite is not for you'}), 403

    # Get both users
    guest = UserService.get_by_id(user_id)
    host_id = invite['from_user_id']

    if not guest:
        return jsonify({'error': 'User not found'}), 404

    # Create game room
    room_code = generate_code()
    while room_code in game_rooms:
        room_code = generate_code()

    game_rooms[room_code] = {
        'host_id': host_id,
        'host_username': invite['from_username'],
        'guest_id': user_id,
        'guest_username': guest.username,
        'best_of': invite['best_of'],
        'host_score': 0,
        'guest_score': 0,
        'current_round': 1,
        'host_choice': None,
        'guest_choice': None,
        'status': 'playing',
        'created_at': time.time(),
        'rounds': [],
        'last_update': time.time()
    }

    # Remove invite
    del pending_invites[invite_id]

    # Save redirect for the invite sender (A) so they get notified
    pending_redirects[host_id] = {
        'room_code': room_code,
        'timestamp': time.time()
    }

    return jsonify({
        'ok': True,
        'room_code': room_code,
        'redirect': f'/game/room/{room_code}'
    })


@bp.route('/invite/<invite_id>/decline', methods=['POST'])
def decline_invite(invite_id):
    """Decline an invite."""
    user_id = session.get('user_id')

    if invite_id in pending_invites:
        invite = pending_invites[invite_id]
        if invite['to_user_id'] == user_id:
            del pending_invites[invite_id]

    return jsonify({'ok': True})


# ============ GAME ROOMS ============

@bp.route('/room/create', methods=['POST'])
def create_room():
    """Create a new game room."""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    user = UserService.get_by_id(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json() or {}
    best_of = data.get('best_of', 3)
    if best_of not in [1, 3, 5]:
        best_of = 3

    cleanup()

    room_code = generate_code()
    while room_code in game_rooms:
        room_code = generate_code()

    game_rooms[room_code] = {
        'host_id': user_id,
        'host_username': user.username,
        'guest_id': None,
        'guest_username': None,
        'best_of': best_of,
        'host_score': 0,
        'guest_score': 0,
        'current_round': 0,
        'host_choice': None,
        'guest_choice': None,
        'status': 'waiting',
        'created_at': time.time(),
        'rounds': [],
        'last_update': time.time()
    }

    return jsonify({
        'ok': True,
        'room_code': room_code,
        'redirect': f'/game/room/{room_code}'
    })


@bp.route('/room/<room_code>/join', methods=['POST'])
def join_room(room_code):
    """Join an existing room."""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    room_code = room_code.upper()

    if room_code not in game_rooms:
        return jsonify({'error': 'Room not found'}), 404

    room = game_rooms[room_code]

    if room['status'] != 'waiting':
        return jsonify({'error': 'Room is not available'}), 400

    if room['host_id'] == user_id:
        return jsonify({'error': 'Cannot join your own room'}), 400

    if room['guest_id']:
        return jsonify({'error': 'Room is full'}), 400

    user = UserService.get_by_id(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    room['guest_id'] = user_id
    room['guest_username'] = user.username
    room['status'] = 'playing'
    room['current_round'] = 1
    room['last_update'] = time.time()

    return jsonify({
        'ok': True,
        'room_code': room_code,
        'redirect': f'/game/room/{room_code}'
    })


@bp.route('/room/<room_code>/state', methods=['GET'])
def get_room_state(room_code):
    """Get current room state (poll this every 1-2 seconds during game)."""
    user_id = session.get('user_id')
    room_code = room_code.upper()

    if room_code not in game_rooms:
        return jsonify({'error': 'Room not found'}), 404

    room = game_rooms[room_code]

    # Check if user is in this room
    is_host = room['host_id'] == user_id
    is_guest = room['guest_id'] == user_id

    if not is_host and not is_guest:
        return jsonify({'error': 'Not in this room'}), 403

    # Don't reveal choices until both have chosen
    host_ready = room['host_choice'] is not None
    guest_ready = room['guest_choice'] is not None

    return jsonify({
        'room_code': room_code,
        'status': room['status'],
        'best_of': room['best_of'],
        'current_round': room['current_round'],
        'host': {
            'id': room['host_id'],
            'username': room['host_username'],
            'score': room['host_score'],
            'ready': host_ready
        },
        'guest': {
            'id': room['guest_id'],
            'username': room['guest_username'],
            'score': room['guest_score'],
            'ready': guest_ready
        } if room['guest_id'] else None,
        'rounds': room['rounds'],
        'last_update': room['last_update']
    })


@bp.route('/room/<room_code>/choice', methods=['POST'])
def make_choice(room_code):
    """Make a choice (rock/paper/scissors)."""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    room_code = room_code.upper()

    if room_code not in game_rooms:
        return jsonify({'error': 'Room not found'}), 404

    room = game_rooms[room_code]

    if room['status'] != 'playing':
        return jsonify({'error': 'Game not in progress'}), 400

    data = request.get_json() or {}
    choice = data.get('choice', '').lower()

    if choice not in VALID_CHOICES:
        return jsonify({'error': 'Invalid choice'}), 400

    is_host = room['host_id'] == user_id
    is_guest = room['guest_id'] == user_id

    if not is_host and not is_guest:
        return jsonify({'error': 'Not in this room'}), 403

    if is_host:
        if room['host_choice']:
            return jsonify({'error': 'Already chosen'}), 400
        room['host_choice'] = choice
    else:
        if room['guest_choice']:
            return jsonify({'error': 'Already chosen'}), 400
        room['guest_choice'] = choice

    room['last_update'] = time.time()

    # Check if round complete
    if room['host_choice'] and room['guest_choice']:
        resolve_round(room_code)

    return jsonify({'ok': True})


def resolve_round(room_code):
    """Resolve the current round."""
    room = game_rooms[room_code]
    host_choice = room['host_choice']
    guest_choice = room['guest_choice']

    if host_choice == guest_choice:
        result = 'draw'
    elif CHOICE_BEATS[host_choice] == guest_choice:
        result = 'host'
        room['host_score'] += 1
    else:
        result = 'guest'
        room['guest_score'] += 1

    room['rounds'].append({
        'round': room['current_round'],
        'host_choice': host_choice,
        'guest_choice': guest_choice,
        'result': result
    })

    # Check if match over
    wins_needed = (room['best_of'] // 2) + 1

    if room['host_score'] >= wins_needed:
        room['status'] = 'finished'
        room['winner_id'] = room['host_id']
        save_match_result(room)
    elif room['guest_score'] >= wins_needed:
        room['status'] = 'finished'
        room['winner_id'] = room['guest_id']
        save_match_result(room)
    else:
        # Next round
        room['current_round'] += 1
        room['host_choice'] = None
        room['guest_choice'] = None

    room['last_update'] = time.time()


def save_match_result(room):
    """Save match result to database."""
    try:
        import json
        from app.extensions import db
        from app.models import GameMatch

        match = GameMatch(
            player1_id=room['host_id'],
            player2_id=room['guest_id'],
            winner_id=room['winner_id'],
            player1_score=room['host_score'],
            player2_score=room['guest_score'],
            rounds_data=json.dumps(room['rounds'])
        )
        db.session.add(match)

        if room['winner_id'] == room['host_id']:
            UserService.update_stats(room['host_id'], 'win')
            UserService.update_stats(room['guest_id'], 'loss')
        else:
            UserService.update_stats(room['guest_id'], 'win')
            UserService.update_stats(room['host_id'], 'loss')

        db.session.commit()
    except Exception as e:
        print(f"Error saving match: {e}")
        from app.extensions import db
        db.session.rollback()


@bp.route('/room/<room_code>/leave', methods=['POST'])
def leave_room(room_code):
    """Leave a room (forfeit if playing)."""
    user_id = session.get('user_id')
    room_code = room_code.upper()

    if room_code not in game_rooms:
        return jsonify({'ok': True})

    room = game_rooms[room_code]

    if room['status'] == 'playing':
        # Forfeit
        if room['host_id'] == user_id:
            room['winner_id'] = room['guest_id']
        elif room['guest_id'] == user_id:
            room['winner_id'] = room['host_id']

        if room.get('winner_id'):
            room['status'] = 'finished'
            save_match_result(room)

    return jsonify({'ok': True})
