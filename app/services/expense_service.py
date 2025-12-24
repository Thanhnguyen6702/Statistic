"""
Expense service - Business logic for expense operations.
"""

from datetime import datetime
from app.extensions import db
from app.models import Expense
from app.services.history_service import HistoryService


class ExpenseService:
    """Service class for expense operations."""

    @staticmethod
    def get_all():
        """Get all expenses."""
        return Expense.query.all()

    @staticmethod
    def get_by_id(expense_id):
        """Get expense by ID."""
        return Expense.query.get_or_404(expense_id)

    @staticmethod
    def get_by_name(name):
        """Get all expenses by person name."""
        return Expense.query.filter_by(name=name).all()

    @staticmethod
    def create(data):
        """
        Create a new expense.
        Args:
            data: dict with name, amount, purpose, participants (optional)
        Returns:
            Created expense
        """
        expense = Expense(
            name=data['name'],
            amount=float(data['amount']),
            purpose=data['purpose']
        )

        # Handle participants
        participants = data.get('participants')
        expense.set_participants(participants)

        db.session.add(expense)
        db.session.commit()

        # Log to history
        HistoryService.add('ADD', expense.to_dict())

        return expense

    @staticmethod
    def update(expense_id, data):
        """
        Update an existing expense.
        Args:
            expense_id: ID of expense to update
            data: dict with name, amount, purpose, participants (optional)
        Returns:
            Updated expense
        """
        expense = Expense.query.get_or_404(expense_id)
        old_data = expense.to_dict()

        expense.name = data['name']
        expense.amount = float(data['amount'])
        expense.purpose = data['purpose']
        expense.last_updated = datetime.utcnow()

        # Handle participants
        participants = data.get('participants')
        expense.set_participants(participants)

        db.session.commit()

        # Log to history
        HistoryService.add('UPDATE', {'old': old_data, 'new': expense.to_dict()})

        return expense

    @staticmethod
    def delete(expense_id):
        """
        Delete an expense.
        Args:
            expense_id: ID of expense to delete
        Returns:
            True if successful
        """
        expense = Expense.query.get_or_404(expense_id)
        deleted_data = expense.to_dict()

        db.session.delete(expense)
        db.session.commit()

        # Log to history
        HistoryService.add('DELETE', deleted_data)

        return True
