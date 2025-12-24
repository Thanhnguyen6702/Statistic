"""
Archive service - Business logic for archiving data.
"""

import json
from app.extensions import db
from app.models import Expense, Archive
from app.services.history_service import HistoryService


class ArchiveService:
    """Service class for archive operations."""

    @staticmethod
    def get_all():
        """Get all archives ordered by timestamp descending."""
        return Archive.query.order_by(Archive.timestamp.desc()).all()

    @staticmethod
    def create_archive():
        """
        Archive all current expenses and clear them.
        Returns:
            Number of archived items
        """
        expenses = Expense.query.all()

        if not expenses:
            return 0

        # Create archive entry
        archive_data = [exp.to_dict() for exp in expenses]
        archive = Archive(data=json.dumps(archive_data))
        db.session.add(archive)

        # Clear current expenses
        count = len(expenses)
        Expense.query.delete()

        db.session.commit()

        # Log to history
        HistoryService.add('ARCHIVE', {'count': count})

        return count
