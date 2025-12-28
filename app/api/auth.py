"""
Authentication API routes - Unified login/register for entire app.
"""

from flask import Blueprint, session, request
from app.services import UserService
from app.utils import success_response, error_response, data_response

bp = Blueprint('auth', __name__)


@bp.route('/register', methods=['POST'])
def register():
    """Register a new user account."""
    data = request.get_json() or {}

    username = data.get('username', '').strip()
    password = data.get('password', '')
    avatar_url = data.get('avatar_url')

    if not username or len(username) < 3:
        return error_response('Tên đăng nhập phải có ít nhất 3 ký tự', 400)
    if len(username) > 20:
        return error_response('Tên đăng nhập tối đa 20 ký tự', 400)
    if not password or len(password) < 4:
        return error_response('Mật khẩu phải có ít nhất 4 ký tự', 400)

    try:
        user = UserService.create(username, password, avatar_url)
        session['user_id'] = user.id
        session['username'] = user.username
        return success_response(data=user.to_dict(), message='Đăng ký thành công')
    except ValueError as e:
        return error_response(str(e), 400)


@bp.route('/login', methods=['POST'])
def login():
    """Login with username and password."""
    data = request.get_json() or {}

    username = data.get('username', '').strip()
    password = data.get('password', '')

    user = UserService.authenticate(username, password)
    if user:
        session['user_id'] = user.id
        session['username'] = user.username
        return success_response(data=user.to_dict(), message='Đăng nhập thành công')

    return error_response('Tên đăng nhập hoặc mật khẩu không đúng', 401)


@bp.route('/logout', methods=['POST'])
def logout():
    """Logout current session."""
    session.clear()
    return success_response(message='Đăng xuất thành công')


@bp.route('/me', methods=['GET'])
def get_current_user():
    """Get current logged in user info."""
    user_id = session.get('user_id')
    if not user_id:
        return error_response('Chưa đăng nhập', 401)

    user = UserService.get_by_id(user_id)
    if not user:
        session.clear()
        return error_response('Không tìm thấy người dùng', 401)

    return data_response(user.to_dict())


@bp.route('/check-auth', methods=['GET'])
def check_auth():
    """Check if user is authenticated."""
    user_id = session.get('user_id')
    if user_id:
        user = UserService.get_by_id(user_id)
        if user:
            return data_response({
                'logged_in': True,
                'user': user.to_dict()
            })
    return data_response({'logged_in': False})


@bp.route('/profile', methods=['PUT'])
def update_profile():
    """Update user profile."""
    user_id = session.get('user_id')
    if not user_id:
        return error_response('Chưa đăng nhập', 401)

    data = request.get_json() or {}
    avatar_url = data.get('avatar_url')

    user = UserService.update_profile(user_id, avatar_url=avatar_url)
    if user:
        return success_response(data=user.to_dict(), message='Cập nhật thành công')

    return error_response('Cập nhật thất bại', 400)
