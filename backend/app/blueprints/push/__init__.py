from flask import Blueprint

push_bp = Blueprint("push", __name__)

from app.blueprints.push import routes  # noqa: F401, E402
