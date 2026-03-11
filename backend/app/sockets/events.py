from app.extensions import socketio


@socketio.on("connect")
def handle_connect():
    pass


@socketio.on("disconnect")
def handle_disconnect():
    pass


@socketio.on("join")
def handle_join(data: dict):
    """Client sends {"room": "kitchen"} or {"room": "waiter_3"} to subscribe."""
    from flask_socketio import join_room
    room = data.get("room")
    if room:
        join_room(room)
