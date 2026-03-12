from flask import Blueprint

analytics_bp = Blueprint("analytics", __name__)

from app.blueprints.analytics import routes  # noqa: F401, E402
