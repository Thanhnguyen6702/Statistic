"""
Flask extensions initialization.
Extensions are initialized here and imported where needed.
"""

from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO

db = SQLAlchemy()
socketio = SocketIO(
    cors_allowed_origins="*",
    manage_session=False,  # Use Flask session
    async_mode='threading',
    ping_timeout=60,
    ping_interval=25
)
