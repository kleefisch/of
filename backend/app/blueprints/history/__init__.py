from flask import Blueprint

history_bp = Blueprint("history", __name__)

from app.blueprints.history import routes  # noqa: F401, E402
