from app.extensions import ma
from app.models.order import Order
from app.models.order_item import OrderItem


class OrderItemSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = OrderItem
        load_instance = True
        include_fk = True


class OrderSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Order
        load_instance = True
        include_fk = True

    items = ma.Nested(OrderItemSchema, many=True)
