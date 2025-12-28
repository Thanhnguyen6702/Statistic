"""
Custom decorators for route protection and database operations.
"""

import time
from functools import wraps
from flask import session
from sqlalchemy.exc import OperationalError, DisconnectionError
from app.utils.responses import error_response


def login_required(f):
    """Decorator to require login for a route."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('user_id'):
            return error_response('Chưa đăng nhập', 401)
        return f(*args, **kwargs)
    return decorated_function


def password_required(f):
    """Decorator for sensitive operations - now just requires login."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('user_id'):
            return error_response('Chưa đăng nhập', 401)
        return f(*args, **kwargs)
    return decorated_function


def db_retry(max_retries=3, delay=0.5):
    """Decorator to retry database operations on connection errors."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            from app.extensions import db

            last_error = None
            for attempt in range(max_retries):
                try:
                    return f(*args, **kwargs)
                except (OperationalError, DisconnectionError) as e:
                    last_error = e
                    if attempt < max_retries - 1:
                        # Rollback and close bad connections
                        try:
                            db.session.rollback()
                            db.session.remove()
                        except Exception:
                            pass
                        time.sleep(delay * (attempt + 1))
                    else:
                        # Log error and re-raise on final attempt
                        print(f"DB Error after {max_retries} retries: {e}")
                        raise
            raise last_error
        return wrapper
    return decorator
