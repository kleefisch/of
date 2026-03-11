from datetime import datetime, timezone
from app.extensions import db


class TableEvent(db.Model):
    __tablename__ = "table_events"

    id: int = db.Column(db.Integer, primary_key=True)
    table_id: int = db.Column(db.Integer, db.ForeignKey("tables.id"), nullable=False, index=True)
    bill_id: int = db.Column(db.Integer, db.ForeignKey("bills.id"), nullable=True, index=True)
    order_id: int = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=True, index=True)
    event_type: str = db.Column(db.String(50), nullable=False)
    description: str = db.Column(db.Text, nullable=True)
    actor_id: int = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    created_at: datetime = db.Column(
        db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    table = db.relationship("Table", back_populates="table_events")
    bill = db.relationship("Bill", back_populates="table_events")
    order = db.relationship("Order", back_populates="table_events")
    actor = db.relationship("User", back_populates="table_events", foreign_keys=[actor_id])
