"""
History service - Business logic for audit trail.
"""

import json
from sqlalchemy import extract
from app.extensions import db
from app.models import History


class HistoryService:
    """Service class for history operations."""

    @staticmethod
    def add(action, data):
        """Add a new history entry."""
        history = History(
            action=action,
            data=json.dumps(data) if not isinstance(data, str) else data
        )
        db.session.add(history)
        db.session.commit()
        return history

    @staticmethod
    def get_all():
        """Get all history entries ordered by timestamp descending."""
        return History.query.order_by(History.timestamp.desc()).all()

    @staticmethod
    def clear_by_month(month):
        """
        Clear history by month.
        Args:
            month: 'all' or 'YYYY-MM' format
        Returns:
            Number of deleted records
        """
        if month == 'all':
            count = History.query.delete()
        else:
            year, mon = map(int, month.split('-'))
            count = History.query.filter(
                extract('year', History.timestamp) == year,
                extract('month', History.timestamp) == mon
            ).delete(synchronize_session='fetch')

        db.session.commit()
        return count
