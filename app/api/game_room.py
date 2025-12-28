"""
Game room API routes.
"""

from functools import wraps
from flask import Blueprint, session, request
from app.services import GameRoomService
from app.utils import success_response, error_response, data_response

bp = Blueprint('game_room', __name__)


def get_current_user_id():
    """Get current user ID from session."""
    return session.get('user_id')


def require_auth(f):
    """Decorator to require user authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = get_current_user_id()
        if not user_id:
            return error_response('Chưa đăng nhập', 401)
        return f(*args, **kwargs)
    return decorated


@bp.route('/create', methods=['POST'])
@require_auth
def create_room():
    """Create a new game room."""
    data = request.get_json() or {}
    best_of = data.get('best_of', 3)

    if best_of not in [1, 3, 5]:
        best_of = 3

    room = GameRoomService.create_room(get_current_user_id(), best_of)
    return success_response(data=room.to_dict(), message='Tạo phòng thành công')


@bp.route('/join/<room_code>', methods=['POST'])
@require_auth
def join_room(room_code):
    """Join an existing room."""
    try:
        room = GameRoomService.join_room(room_code, get_current_user_id())
        return success_response(data=room.to_dict(), message='Tham gia phòng thành công')
    except ValueError as e:
        return error_response(str(e), 400)


@bp.route('/<room_code>', methods=['GET'])
@require_auth
def get_room(room_code):
    """Get room details."""
    room = GameRoomService.get_room_by_code(room_code)
    if not room:
        return error_response('Không tìm thấy phòng', 404)

    return data_response(room.to_dict())


@bp.route('/<room_code>/leave', methods=['POST'])
@require_auth
def leave_room(room_code):
    """Leave a room."""
    room = GameRoomService.get_room_by_code(room_code)
    if not room:
        return error_response('Không tìm thấy phòng', 404)

    GameRoomService.leave_room(room.id, get_current_user_id())
    return success_response(message='Rời phòng thành công')


@bp.route('/<room_code>/round', methods=['GET'])
@require_auth
def get_current_round(room_code):
    """Get current round info."""
    room = GameRoomService.get_room_by_code(room_code)
    if not room:
        return error_response('Không tìm thấy phòng', 404)

    current_round = GameRoomService.get_current_round(room.id)
    if not current_round:
        return error_response('Không có lượt đang hoạt động', 404)

    return data_response(current_round.to_dict())
