from app.extensions import db


class OrderItem(db.Model):
    __tablename__ = "order_items"

    id: int = db.Column(db.Integer, primary_key=True)
    order_id: int = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False, index=True)
    menu_item_id: int = db.Column(db.Integer, db.ForeignKey("menu_items.id"), nullable=False, index=True)
    quantity: int = db.Column(db.Integer, nullable=False)
    unit_price: float = db.Column(db.Numeric(10, 2), nullable=False)  # Price snapshot — never recalculate
    special_instructions: str = db.Column(db.Text, nullable=True)

    # Relationships
    order = db.relationship("Order", back_populates="items")
    menu_item = db.relationship("MenuItem", back_populates="order_items")
