"""
API package - All API blueprints.
"""

from app.api import auth, expenses, history, archive, stats, admin


def register_blueprints(app):
    """Register all API blueprints with the app."""

    # Auth routes: /api/login, /api/logout, /api/check-auth
    app.register_blueprint(auth.bp, url_prefix='/api')

    # Expense routes: /api/expenses/*
    app.register_blueprint(expenses.bp, url_prefix='/api/expenses')

    # History routes: /api/history/*
    app.register_blueprint(history.bp, url_prefix='/api/history')

    # Archive routes: /api/archive/*
    app.register_blueprint(archive.bp, url_prefix='/api/archive')

    # Stats routes: /api/stats/*
    app.register_blueprint(stats.bp, url_prefix='/api/stats')

    # Admin routes: /api/lock
    app.register_blueprint(admin.bp, url_prefix='/api')
