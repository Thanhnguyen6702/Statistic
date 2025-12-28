"""
WebSocket handlers package.
"""

from app.sockets import game_events


def init_sockets(socketio):
    """Initialize all socket event handlers."""
    # Events are registered via decorators in game_events
    pass
