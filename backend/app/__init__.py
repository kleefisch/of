from flask import Flask
from dotenv import load_dotenv

from app.config import config_by_name
from app.extensions import db, migrate, jwt, socketio, bcrypt, cors, ma

load_dotenv()


def create_app(env: str = "development") -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_by_name[env])

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    bcrypt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    ma.init_app(app)
    socketio.init_app(
        app,
        cors_allowed_origins=app.config["CORS_ORIGINS"],
        async_mode="eventlet",
    )

    # Import models so Flask-Migrate can detect them
    from app.models import user, table, menu_category, menu_item, bill, order, order_item, payment, table_event  # noqa: F401

    # Register blueprints
    from app.blueprints.auth import auth_bp
    from app.blueprints.menu import menu_bp
    from app.blueprints.tables import tables_bp
    from app.blueprints.orders import orders_bp
    from app.blueprints.payments import payments_bp
    from app.blueprints.admin import admin_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(menu_bp, url_prefix="/api/menu")
    app.register_blueprint(tables_bp, url_prefix="/api/tables")
    app.register_blueprint(orders_bp, url_prefix="/api/orders")
    app.register_blueprint(payments_bp, url_prefix="/api/payments")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")

    # Register WebSocket event handlers
    from app.sockets import events  # noqa: F401

    return app
