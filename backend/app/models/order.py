from datetime import datetime, timezone
from app.extensions import db


class Order(db.Model):
    __tablename__ = "orders"

    id: int = db.Column(db.Integer, primary_key=True)
    bill_id: int = db.Column(db.Integer, db.ForeignKey("bills.id"), nullable=False, index=True)
    sequence_number: int = db.Column(db.Integer, nullable=False)
    status: str = db.Column(db.String(20), nullable=False, default="pending")  # pending | preparing | done | delivered | cancelled
    sent_to_kitchen_at: datetime = db.Column(
        db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    done_at: datetime = db.Column(db.DateTime(timezone=True), nullable=True)
    delivered_at: datetime = db.Column(db.DateTime(timezone=True), nullable=True)
    cancelled_at: datetime = db.Column(db.DateTime(timezone=True), nullable=True)
    cancelled_by: int = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    # Relationships
    bill = db.relationship("Bill", back_populates="orders")
    items = db.relationship("OrderItem", back_populates="order")
    cancelled_by_user = db.relationship("User", back_populates="cancelled_orders", foreign_keys=[cancelled_by])
    table_events = db.relationship("TableEvent", back_populates="order")
