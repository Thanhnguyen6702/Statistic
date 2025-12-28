"""
Application factory pattern for Flask app.
"""

import os
from flask import Flask, render_template, session, redirect, url_for

from config import config
from app.extensions import db, socketio
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
    socketio.init_app(app)

    # Import socket events (registers handlers via decorators)
    from app.sockets import game_events

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
        """Dashboard - main page after login."""
        if not session.get('user_id'):
            return redirect(url_for('login_page'))
        return render_template('dashboard.html')

    @app.route('/login')
    def login_page():
        """Login/Register page."""
        if session.get('user_id'):
            return redirect(url_for('index'))
        return render_template('login.html')

    # Game room page (for playing RPS)
    @app.route('/game/room/<room_code>')
    def game_room_page(room_code):
        """Game room page for playing."""
        if not session.get('user_id'):
            return redirect(url_for('login_page'))
        from app.services import GameRoomService
        room = GameRoomService.get_room_by_code(room_code)
        if not room:
            return redirect(url_for('index'))
        return render_template('game_room.html', room=room.to_dict())


# Create app instance for gunicorn (gunicorn app:app)
app = create_app()
