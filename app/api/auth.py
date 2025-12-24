"""
Authentication API routes.
"""

from flask import Blueprint, session, request, current_app
from app.utils import success_response, error_response, data_response

bp = Blueprint('auth', __name__)


@bp.route('/login', methods=['POST'])
def login():
    """Login with password."""
    data = request.get_json() or {}
    password = data.get('password')

    if password == current_app.config['ADMIN_PASSWORD']:
        session['logged_in'] = True
        return success_response(message='Đăng nhập thành công')

    return error_response('Mật khẩu không đúng', 401)


@bp.route('/logout', methods=['POST'])
def logout():
    """Logout current session."""
    session.pop('logged_in', None)
    return success_response(message='Đăng xuất thành công')


@bp.route('/check-auth', methods=['GET'])
def check_auth():
    """Check if user is authenticated."""
    return data_response({'logged_in': session.get('logged_in', False)})
