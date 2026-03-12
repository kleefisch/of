from datetime import datetime, timezone
from app.extensions import db


class PushSubscription(db.Model):
    __tablename__ = "push_subscriptions"

    id: int = db.Column(db.Integer, primary_key=True)
    user_id: int = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    endpoint: str = db.Column(db.Text, nullable=False, unique=True)
    p256dh: str = db.Column(db.Text, nullable=False)
    auth: str = db.Column(db.Text, nullable=False)
    created_at: datetime = db.Column(
        db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    user = db.relationship("User", backref=db.backref("push_subscriptions", lazy="dynamic"))
