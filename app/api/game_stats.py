"""
Game statistics API routes.
"""

from flask import Blueprint, session
from app.services import UserService, GameRoomService
from app.utils import data_response, error_response

bp = Blueprint('game_stats', __name__)


@bp.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    """Get the game leaderboard."""
    users = UserService.get_leaderboard(20)
    return data_response([u.to_public_dict() for u in users])


@bp.route('/history', methods=['GET'])
def get_match_history():
    """Get match history for current user."""
    user_id = session.get('user_id')
    if not user_id:
        return error_response('Chưa đăng nhập', 401)

    matches = GameRoomService.get_user_match_history(user_id, 20)
    return data_response([m.to_dict() for m in matches])


@bp.route('/user/<int:user_id>', methods=['GET'])
def get_user_stats(user_id):
    """Get stats for a specific user."""
    user = UserService.get_by_id(user_id)
    if not user:
        return error_response('Không tìm thấy người dùng', 404)

    return data_response(user.to_public_dict())
