"""
Application factory pattern for Flask app.
"""

import os
from flask import Flask, render_template, session, redirect, url_for

from config import config
from app.extensions import db
from app.api import register_blueprints


def create_app(config_name=None):
    """
    Create and configure the Flask application.

    Args:
        config_name: Configuration name ('development', 'production', 'testing')

    Returns:
        Configured Flask application
    """
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')

    app = Flask(__name__,
                template_folder='templates',
                static_folder='static')

    # Load configuration
    app.config.from_object(config[config_name])

    # Initialize extensions
    db.init_app(app)

    # Register blueprints
    register_blueprints(app)

    # Register view routes
    register_views(app)

    # Create database tables and run migrations
    with app.app_context():
        db.create_all()
        # Add participants column if missing
        from sqlalchemy import text
        try:
            db.session.execute(text('ALTER TABLE expense ADD COLUMN IF NOT EXISTS participants TEXT'))
            db.session.commit()
        except Exception:
            db.session.rollback()

    return app


def register_views(app):
    """Register view routes (HTML pages)."""

    @app.route('/')
    def index():
        """Main page."""
        if not session.get('logged_in'):
            return redirect(url_for('login_page'))

        from app.models import Expense
        expenses = Expense.query.all()
        return render_template('index.html', expenses=[exp.to_dict() for exp in expenses])

    @app.route('/login')
    def login_page():
        """Login page."""
        if session.get('logged_in'):
            return redirect(url_for('index'))
        return render_template('login.html')


# Create app instance for gunicorn (gunicorn app:app)
app = create_app()
