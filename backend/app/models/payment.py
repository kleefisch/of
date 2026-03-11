from datetime import datetime, timezone
from app.extensions import db


class Payment(db.Model):
    __tablename__ = "payments"

    id: int = db.Column(db.Integer, primary_key=True)
    bill_id: int = db.Column(db.Integer, db.ForeignKey("bills.id"), nullable=False, index=True)
    method: str = db.Column(db.String(20), nullable=False)  # credit | debit | cash
    amount: float = db.Column(db.Numeric(10, 2), nullable=False)
    tip_amount: float = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    stripe_payment_intent_id: str = db.Column(db.String(255), nullable=True)
    created_at: datetime = db.Column(
        db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    bill = db.relationship("Bill", back_populates="payments")
