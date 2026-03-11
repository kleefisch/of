from datetime import datetime, timezone
from app.extensions import db


class Table(db.Model):
    __tablename__ = "tables"

    id: int = db.Column(db.Integer, primary_key=True)
    number: int = db.Column(db.Integer, nullable=False, unique=True)
    seats: int = db.Column(db.Integer, nullable=False)
    status: str = db.Column(db.String(20), nullable=False, default="available")  # available | reserved | occupied
    is_active: bool = db.Column(db.Boolean, nullable=False, default=True)
    waiter_id: int = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    service_started_at: datetime = db.Column(db.DateTime(timezone=True), nullable=True)
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
    waiter = db.relationship("User", back_populates="tables", foreign_keys=[waiter_id])
    bills = db.relationship("Bill", back_populates="table")
    table_events = db.relationship("TableEvent", back_populates="table")
