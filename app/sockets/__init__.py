"""
WebSocket handlers package.
"""


def init_sockets():
    """Initialize all socket event handlers."""
    import importlib
    from app.sockets import game_events
    # Reload to re-run decorators after socketio.init_app()
    importlib.reload(game_events)
