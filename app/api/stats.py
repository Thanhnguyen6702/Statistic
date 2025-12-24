"""
Statistics API routes.
"""

from flask import Blueprint
from app.services import StatsService
from app.utils import data_response, error_response

bp = Blueprint('stats', __name__)


@bp.route('', methods=['GET'])
def get_stats():
    """Get overall statistics."""
    stats = StatsService.get_overall_stats()
    return data_response(stats)


@bp.route('/people', methods=['GET'])
def get_people_stats():
    """Get statistics per person."""
    stats = StatsService.get_people_stats()
    return data_response(stats)


@bp.route('/people/<name>', methods=['GET'])
def get_person_stats(name):
    """Get statistics for a specific person."""
    stats = StatsService.get_person_stats(name)

    if not stats:
        return error_response('Không tìm thấy người này', 404)

    return data_response(stats)
