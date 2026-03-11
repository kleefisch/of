from datetime import datetime, timezone
from app.extensions import db


class MenuItem(db.Model):
    __tablename__ = "menu_items"

    id: int = db.Column(db.Integer, primary_key=True)
    name: str = db.Column(db.String(120), nullable=False)
    description: str = db.Column(db.Text, nullable=True)
    price: float = db.Column(db.Numeric(10, 2), nullable=False)
    image_url: str = db.Column(db.String(500), nullable=True)
    category_id: int = db.Column(db.Integer, db.ForeignKey("menu_categories.id"), nullable=False, index=True)
    is_available: bool = db.Column(db.Boolean, nullable=False, default=True)
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
    category = db.relationship("MenuCategory", back_populates="items")
    order_items = db.relationship("OrderItem", back_populates="menu_item")
