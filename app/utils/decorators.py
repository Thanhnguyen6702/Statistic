"""
Custom decorators for route protection.
"""

from functools import wraps
from flask import session, request, current_app
from app.utils.responses import error_response


def login_required(f):
    """Decorator to require login for a route."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('logged_in'):
            return error_response('Chưa đăng nhập', 401)
        return f(*args, **kwargs)
    return decorated_function


def password_required(f):
    """Decorator to require password verification for sensitive operations."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        data = request.get_json(silent=True) or {}
        password = data.get('password')

        if password != current_app.config['ADMIN_PASSWORD']:
            return error_response('Mật khẩu không đúng', 401)

        return f(*args, **kwargs)
    return decorated_function
