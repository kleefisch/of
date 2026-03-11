from flask import Blueprint

menu_bp = Blueprint("menu", __name__)

from app.blueprints.menu import routes  # noqa: F401, E402
