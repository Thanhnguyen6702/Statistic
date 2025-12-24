"""
Archive API routes.
"""

from flask import Blueprint
from app.services import ArchiveService
from app.utils import success_response, data_response, password_required

bp = Blueprint('archive', __name__)


@bp.route('', methods=['POST'])
@password_required
def archive_data():
    """Archive all current expenses."""
    count = ArchiveService.create_archive()
    return success_response({'archived_items': count})


@bp.route('/stats', methods=['GET'])
def get_archive_stats():
    """Get all archived periods."""
    archives = ArchiveService.get_all()
    return data_response([arch.to_dict() for arch in archives])
