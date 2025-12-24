"""
Archive model - stores archived expense periods.
"""

import json
from datetime import datetime
from app.extensions import db


class Archive(db.Model):
    """Model for archived expense periods."""

    __tablename__ = 'archive'

    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    data = db.Column(db.Text, nullable=False)  # JSON array of expenses

    def __repr__(self):
        return f'<Archive {self.id}: {self.timestamp}>'

    def get_expenses(self):
        """Parse and return archived expenses list."""
        try:
            return json.loads(self.data)
        except (json.JSONDecodeError, TypeError):
            return []

    def to_dict(self):
        """Convert model to dictionary."""
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat(),
            'data': self.get_expenses()
        }
