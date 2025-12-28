"""
GameUser model - Game player accounts (separate from admin).
"""

from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db


class GameUser(db.Model):
    """Model for game user accounts."""

    __tablename__ = 'game_user'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    avatar_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_active = db.Column(db.DateTime, default=datetime.utcnow)

    # Statistics
    total_wins = db.Column(db.Integer, default=0)
    total_losses = db.Column(db.Integer, default=0)
    total_draws = db.Column(db.Integer, default=0)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def total_matches(self):
        return self.total_wins + self.total_losses + self.total_draws

    @property
    def win_rate(self):
        if self.total_matches == 0:
            return 0.0
        return (self.total_wins / self.total_matches) * 100

    def to_dict(self, include_stats=True):
        data = {
            'id': self.id,
            'username': self.username,
            'avatar_url': self.avatar_url,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_stats:
            data.update({
                'total_wins': self.total_wins,
                'total_losses': self.total_losses,
                'total_draws': self.total_draws,
                'total_matches': self.total_matches,
                'win_rate': round(self.win_rate, 1)
            })
        return data

    def to_public_dict(self):
        """Public profile (for leaderboard)."""
        return {
            'id': self.id,
            'username': self.username,
            'avatar_url': self.avatar_url,
            'total_wins': self.total_wins,
            'total_losses': self.total_losses,
            'total_draws': self.total_draws,
            'win_rate': round(self.win_rate, 1)
        }
