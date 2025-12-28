"""
GameUserService - Business logic for game user operations.
"""

from datetime import datetime
from app.extensions import db
from app.models import GameUser


class GameUserService:
    """Service class for game user operations."""

    @staticmethod
    def create(username, password, avatar_url=None):
        """Create a new game user."""
        if GameUser.query.filter_by(username=username).first():
            raise ValueError('Username already exists')

        user = GameUser(username=username, avatar_url=avatar_url)
        user.set_password(password)

        db.session.add(user)
        db.session.commit()
        return user

    @staticmethod
    def authenticate(username, password):
        """Authenticate user credentials."""
        user = GameUser.query.filter_by(username=username).first()
        if user and user.check_password(password):
            user.last_active = datetime.utcnow()
            db.session.commit()
            return user
        return None

    @staticmethod
    def get_by_id(user_id):
        return GameUser.query.get(user_id)

    @staticmethod
    def get_by_username(username):
        return GameUser.query.filter_by(username=username).first()

    @staticmethod
    def update_stats(user_id, result):
        """Update user stats after a match. Result: 'win', 'loss', 'draw'"""
        user = GameUser.query.get(user_id)
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
        return GameUser.query.order_by(
            GameUser.total_wins.desc(),
            GameUser.total_losses.asc()
        ).limit(limit).all()

    @staticmethod
    def update_profile(user_id, avatar_url=None):
        """Update user profile."""
        user = GameUser.query.get(user_id)
        if not user:
            return None

        if avatar_url is not None:
            user.avatar_url = avatar_url

        db.session.commit()
        return user
