"""
Run once to create the first manager user.
Usage: python seed.py
"""
from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.extensions import db, bcrypt
from app.models.user import User


def seed() -> None:
    app = create_app("development")
    with app.app_context():
        if User.query.filter_by(username="admin").first():
            print("Manager user already exists — skipping.")
            return

        manager = User(
            full_name="Manager",
            display_name="Manager",
            username="admin",
            password_hash=bcrypt.generate_password_hash("admin123").decode("utf-8"),
            role="manager",
            is_active=True,
        )
        db.session.add(manager)
        db.session.commit()
        print(f"Manager user created — username: admin / password: admin123")
        print("Change the password after first login!")


if __name__ == "__main__":
    seed()
