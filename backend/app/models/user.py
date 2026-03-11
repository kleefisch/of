from datetime import datetime, timezone
from app.extensions import db


class User(db.Model):
    __tablename__ = "users"

    id: int = db.Column(db.Integer, primary_key=True)
    full_name: str = db.Column(db.String(120), nullable=False)
    display_name: str = db.Column(db.String(60), nullable=False)
    username: str = db.Column(db.String(60), nullable=False, unique=True, index=True)
    password_hash: str = db.Column(db.String(255), nullable=False)
    role: str = db.Column(db.String(20), nullable=False)  # waiter | kitchen | manager
    is_active: bool = db.Column(db.Boolean, nullable=False, default=True)
    created_at: datetime = db.Column(
        db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    tables = db.relationship("Table", back_populates="waiter", foreign_keys="Table.waiter_id")
    bills = db.relationship("Bill", back_populates="waiter", foreign_keys="Bill.waiter_id")
    cancelled_orders = db.relationship("Order", back_populates="cancelled_by_user", foreign_keys="Order.cancelled_by")
    table_events = db.relationship("TableEvent", back_populates="actor", foreign_keys="TableEvent.actor_id")
