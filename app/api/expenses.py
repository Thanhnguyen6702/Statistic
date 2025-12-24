"""
Expenses API routes.
"""

from flask import Blueprint, request
from app.services import ExpenseService
from app.utils import success_response, error_response, data_response, password_required

bp = Blueprint('expenses', __name__)


@bp.route('', methods=['GET'])
def get_expenses():
    """Get all expenses."""
    expenses = ExpenseService.get_all()
    return data_response([exp.to_dict() for exp in expenses])


@bp.route('', methods=['POST'])
def create_expense():
    """Create a new expense."""
    data = request.get_json() or {}

    # Validate required fields
    if not all(key in data for key in ['name', 'amount', 'purpose']):
        return error_response('Thiếu thông tin bắt buộc', 400)

    expense = ExpenseService.create(data)
    return data_response(expense.to_dict())


@bp.route('/<int:expense_id>', methods=['PUT'])
@password_required
def update_expense(expense_id):
    """Update an existing expense."""
    data = request.get_json() or {}

    # Validate required fields
    if not all(key in data for key in ['name', 'amount', 'purpose']):
        return error_response('Thiếu thông tin bắt buộc', 400)

    expense = ExpenseService.update(expense_id, data)
    return data_response(expense.to_dict())


@bp.route('/<int:expense_id>', methods=['DELETE'])
@password_required
def delete_expense(expense_id):
    """Delete an expense."""
    ExpenseService.delete(expense_id)
    return success_response(message='Xóa thành công')
