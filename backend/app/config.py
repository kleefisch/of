import os
from datetime import timedelta


class Config:
    SECRET_KEY: str = os.environ["SECRET_KEY"]
    JWT_SECRET_KEY: str = os.environ["JWT_SECRET_KEY"]
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)

    SQLALCHEMY_DATABASE_URI: str = os.environ["DATABASE_URL"]
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

    STRIPE_SECRET_KEY: str = os.environ.get("STRIPE_SECRET_KEY", "")

    VAPID_PUBLIC_KEY: str = os.environ.get("VAPID_PUBLIC_KEY", "")
    VAPID_PRIVATE_KEY: str = os.environ.get("VAPID_PRIVATE_KEY", "")
    VAPID_MAILTO: str = os.environ.get("VAPID_MAILTO", "mailto:admin@orderflow.app")

    CORS_ORIGINS: list[str] = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


config_by_name: dict[str, type[Config]] = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
}
