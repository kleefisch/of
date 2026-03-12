from datetime import datetime, timezone
from app.extensions import db


class Bill(db.Model):
    __tablename__ = "bills"

    id: int = db.Column(db.Integer, primary_key=True)
    table_id: int = db.Column(db.Integer, db.ForeignKey("tables.id"), nullable=False, index=True)
    waiter_id: int = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    status: str = db.Column(db.String(20), nullable=False, default="open")  # open | closed | cancelled
    split_method: str = db.Column(db.String(20), nullable=True)  # full | custom_amount | split_equally | by_items
    payment_method: str = db.Column(db.String(20), nullable=True)  # credit | debit | cash
    tip_percent: float = db.Column(db.Numeric(5, 2), nullable=True)
    tip_amount: float = db.Column(db.Numeric(10, 2), nullable=True)
    subtotal: float = db.Column(db.Numeric(10, 2), nullable=True)
    total: float = db.Column(db.Numeric(10, 2), nullable=True)
    split_plan = db.Column(db.JSON, nullable=True)  # persists per-person split state
    opened_at: datetime = db.Column(
        db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    closed_at: datetime = db.Column(db.DateTime(timezone=True), nullable=True)

    # Relationships
    table = db.relationship("Table", back_populates="bills")
    waiter = db.relationship("User", back_populates="bills", foreign_keys=[waiter_id])
    orders = db.relationship("Order", back_populates="bill")
    payments = db.relationship("Payment", back_populates="bill")
    table_events = db.relationship("TableEvent", back_populates="bill")
