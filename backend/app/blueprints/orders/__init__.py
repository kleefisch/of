from flask import Blueprint

orders_bp = Blueprint("orders", __name__)

from app.blueprints.orders import routes  # noqa: F401, E402
