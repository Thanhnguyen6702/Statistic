"""
Admin API routes.
"""

from flask import Blueprint
from app.utils import success_response, password_required

bp = Blueprint('admin', __name__)


@bp.route('/lock', methods=['POST'])
@password_required
def toggle_lock():
    """Toggle lock state (client-side feature)."""
    return success_response(message='Lock state toggled')
