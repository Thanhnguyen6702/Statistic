"""
GameMatch model - Historical match records for statistics.
"""

import json
from datetime import datetime
from app.extensions import db


class GameMatch(db.Model):
    """Model for completed match history."""

    __tablename__ = 'game_match'

    id = db.Column(db.Integer, primary_key=True)

    # Players
    player1_id = db.Column(db.Integer, db.ForeignKey('game_user.id'), nullable=False)
    player2_id = db.Column(db.Integer, db.ForeignKey('game_user.id'), nullable=False)

    # Winner (null for draw, which shouldn't happen in best-of format)
    winner_id = db.Column(db.Integer, db.ForeignKey('game_user.id'), nullable=True)

    # Scores
    player1_score = db.Column(db.Integer, nullable=False)
    player2_score = db.Column(db.Integer, nullable=False)

    # Match details (JSON: array of round results)
    rounds_data = db.Column(db.Text, nullable=True)

    # Timestamps
    started_at = db.Column(db.DateTime, nullable=False)
    ended_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    player1 = db.relationship('User', foreign_keys=[player1_id])
    player2 = db.relationship('User', foreign_keys=[player2_id])
    winner = db.relationship('User', foreign_keys=[winner_id])

    def to_dict(self):
        return {
            'id': self.id,
            'player1': self.player1.to_dict(include_stats=False) if self.player1 else None,
            'player2': self.player2.to_dict(include_stats=False) if self.player2 else None,
            'winner_id': self.winner_id,
            'player1_score': self.player1_score,
            'player2_score': self.player2_score,
            'rounds': json.loads(self.rounds_data) if self.rounds_data else [],
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None
        }
