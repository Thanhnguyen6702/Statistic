"""
History API routes.
"""

from flask import Blueprint, request
from app.services import HistoryService
from app.utils import success_response, data_response, password_required

bp = Blueprint('history', __name__)


@bp.route('', methods=['GET'])
def get_history():
    """Get all history entries."""
    history = HistoryService.get_all()
    return data_response([h.to_dict() for h in history])


@bp.route('/clear', methods=['POST'])
@password_required
def clear_history():
    """Clear history by month or all."""
    data = request.get_json() or {}
    month = data.get('month', 'all')

    count = HistoryService.clear_by_month(month)
    return success_response({'deleted_count': count})
