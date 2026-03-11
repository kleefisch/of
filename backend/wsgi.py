import eventlet
eventlet.monkey_patch()  # MUST be the very first import before anything else

from app import create_app
from app.extensions import socketio

app = create_app("production")

if __name__ == "__main__":
    socketio.run(app)
