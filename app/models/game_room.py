"""
GameRoom and GameRound models - Game room/lobby for matchmaking.
"""

import secrets
from datetime import datetime
from app.extensions import db


class GameRoom(db.Model):
    """Model for game rooms/lobbies."""

    __tablename__ = 'game_room'

    id = db.Column(db.Integer, primary_key=True)
    room_code = db.Column(db.String(6), unique=True, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Room state: 'waiting', 'playing', 'finished'
    status = db.Column(db.String(20), default='waiting')

    # Players
    host_id = db.Column(db.Integer, db.ForeignKey('game_user.id'), nullable=False)
    guest_id = db.Column(db.Integer, db.ForeignKey('game_user.id'), nullable=True)

    # Best of N rounds (e.g., best of 1, 3, 5)
    best_of = db.Column(db.Integer, default=3)
    current_round = db.Column(db.Integer, default=0)

    # Score tracking
    host_score = db.Column(db.Integer, default=0)
    guest_score = db.Column(db.Integer, default=0)

    # Relationships
    host = db.relationship('User', foreign_keys=[host_id])
    guest = db.relationship('User', foreign_keys=[guest_id])
    rounds = db.relationship('GameRound', backref='room', lazy='dynamic',
                             cascade='all, delete-orphan')

    @staticmethod
    def generate_room_code():
        """Generate a unique 6-character room code."""
        while True:
            code = secrets.token_hex(3).upper()
            if not GameRoom.query.filter_by(room_code=code).first():
                return code

    @property
    def is_full(self):
        return self.guest_id is not None

    @property
    def winner_id(self):
        """Determine winner based on best_of."""
        wins_needed = (self.best_of // 2) + 1
        if self.host_score >= wins_needed:
            return self.host_id
        elif self.guest_score >= wins_needed:
            return self.guest_id
        return None

    def to_dict(self):
        return {
            'id': self.id,
            'room_code': self.room_code,
            'status': self.status,
            'best_of': self.best_of,
            'current_round': self.current_round,
            'host': self.host.to_dict(include_stats=False) if self.host else None,
            'guest': self.guest.to_dict(include_stats=False) if self.guest else None,
            'host_score': self.host_score,
            'guest_score': self.guest_score,
            'is_full': self.is_full,
            'winner_id': self.winner_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class GameRound(db.Model):
    """Model for individual game rounds within a room."""

    __tablename__ = 'game_round'

    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('game_room.id'), nullable=False)
    round_number = db.Column(db.Integer, nullable=False)

    # Choices: 'rock', 'paper', 'scissors' or None
    host_choice = db.Column(db.String(10), nullable=True)
    guest_choice = db.Column(db.String(10), nullable=True)

    # Result: 'host', 'guest', 'draw' or None (pending)
    result = db.Column(db.String(10), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self, reveal=False):
        """Convert to dict. Only reveal choices if round is complete."""
        data = {
            'id': self.id,
            'round_number': self.round_number,
            'result': self.result,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if reveal or self.result:
            data['host_choice'] = self.host_choice
            data['guest_choice'] = self.guest_choice
        else:
            data['host_ready'] = self.host_choice is not None
            data['guest_ready'] = self.guest_choice is not None
        return data
