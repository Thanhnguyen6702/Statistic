"""
History model - audit trail for all changes.
"""

from datetime import datetime
from app.extensions import db


class History(db.Model):
    """Model for tracking changes/audit trail."""

    __tablename__ = 'history'

    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    action = db.Column(db.String(50), nullable=False)  # ADD, UPDATE, DELETE, ARCHIVE
    data = db.Column(db.Text, nullable=False)  # JSON data

    def __repr__(self):
        return f'<History {self.id}: {self.action} at {self.timestamp}>'

    def to_dict(self):
        """Convert model to dictionary."""
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat(),
            'action': self.action,
            'data': self.data
        }
