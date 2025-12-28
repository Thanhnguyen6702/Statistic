"""
UserService - Business logic for user operations.
"""

from datetime import datetime
from app.extensions import db
from app.models.user import User


class UserService:
    """Service class for user operations."""

    @staticmethod
    def create(username, password, avatar_url=None):
        """Create a new user."""
        if User.query.filter_by(username=username).first():
            raise ValueError('Tên đăng nhập đã tồn tại')

        user = User(username=username, avatar_url=avatar_url)
        user.set_password(password)

        db.session.add(user)
        db.session.commit()
        return user

    @staticmethod
    def authenticate(username, password):
        """Authenticate user credentials."""
        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            user.last_active = datetime.utcnow()
            db.session.commit()
            return user
        return None

    @staticmethod
    def get_by_id(user_id):
        return User.query.get(user_id)

    @staticmethod
    def get_by_username(username):
        return User.query.filter_by(username=username).first()

    @staticmethod
    def update_stats(user_id, result):
        """Update user stats after a match. Result: 'win', 'loss', 'draw'"""
        user = User.query.get(user_id)
        if not user:
            return

        if result == 'win':
            user.total_wins += 1
        elif result == 'loss':
            user.total_losses += 1
        elif result == 'draw':
            user.total_draws += 1

        user.last_active = datetime.utcnow()
        db.session.commit()

    @staticmethod
    def get_leaderboard(limit=20):
        """Get top players by win count."""
        return User.query.order_by(
            User.total_wins.desc(),
            User.total_losses.asc()
        ).limit(limit).all()

    @staticmethod
    def update_profile(user_id, avatar_url=None):
        """Update user profile."""
        user = User.query.get(user_id)
        if not user:
            return None

        if avatar_url is not None:
            user.avatar_url = avatar_url

        db.session.commit()
        return user


# Alias for backward compatibility
GameUserService = UserService
