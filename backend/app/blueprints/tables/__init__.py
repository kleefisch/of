from flask import Blueprint

tables_bp = Blueprint("tables", __name__)

from app.blueprints.tables import routes  # noqa: F401, E402
