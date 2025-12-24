"""
Expense model - represents a spending record.
"""

import json
from datetime import datetime
from app.extensions import db


class Expense(db.Model):
    """Model for expense/spending records."""

    __tablename__ = 'expense'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    purpose = db.Column(db.String(200), nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    participants = db.Column(db.Text, nullable=True)  # JSON list, null = all members

    def __repr__(self):
        return f'<Expense {self.id}: {self.name} - {self.amount}>'

    def get_participants(self):
        """Parse and return participants list."""
        if not self.participants:
            return None
        try:
            return json.loads(self.participants)
        except (json.JSONDecodeError, TypeError):
            return None

    def set_participants(self, participants_list):
        """Set participants from a list."""
        if participants_list and len(participants_list) > 0:
            self.participants = json.dumps(participants_list)
        else:
            self.participants = None

    def to_dict(self):
        """Convert model to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'amount': self.amount,
            'purpose': self.purpose,
            'date': self.date.strftime('%Y-%m-%d %H:%M:%S'),
            'last_updated': self.last_updated.strftime('%Y-%m-%d %H:%M:%S') if self.last_updated else None,
            'participants': self.get_participants()
        }
