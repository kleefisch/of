from datetime import datetime, timezone

from flask import request
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from sqlalchemy.orm import joinedload

from app.blueprints.orders import orders_bp
from app.extensions import db, socketio
from app.models.bill import Bill
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.menu_item import MenuItem
from app.models.table_event import TableEvent
from app.utils.response import success_response, error_response
from app.utils.auth_helpers import roles_required


# ---------------------------------------------------------------------------
# Send order to kitchen
# ---------------------------------------------------------------------------

@orders_bp.post("")
@roles_required("waiter", "manager")
def create_order():
    body = request.get_json(silent=True) or {}
    bill_id = body.get("bill_id")
    items_data = body.get("items", [])

    if not bill_id:
        return error_response("bill_id is required.", "VALIDATION_ERROR", 400)
    if not items_data:
        return error_response("At least one item is required.", "VALIDATION_ERROR", 400)

    bill = db.session.get(Bill, bill_id)
    if not bill or bill.status != "open":
        return error_response("Bill not found or not open.", "BILL_NOT_FOUND", 404)

    user_id = int(get_jwt_identity())

    # Calculate next sequence_number within this bill (in the same transaction)
    max_seq = db.session.execute(
        db.select(db.func.coalesce(db.func.max(Order.sequence_number), 0))
        .where(Order.bill_id == bill_id)
    ).scalar()
    sequence_number = max_seq + 1

    order = Order(bill_id=bill_id, sequence_number=sequence_number)
    db.session.add(order)
    db.session.flush()  # get order.id

    for entry in items_data:
        menu_item_id = entry.get("menu_item_id")
        quantity = int(entry.get("quantity", 0))
        if not menu_item_id or quantity < 1:
            db.session.rollback()
            return error_response("Each item must have menu_item_id and quantity >= 1.", "VALIDATION_ERROR", 400)

        menu_item = db.session.get(MenuItem, menu_item_id)
        if not menu_item or not menu_item.is_active or not menu_item.is_available:
            db.session.rollback()
            return error_response(f"Menu item {menu_item_id} is not available.", "ITEM_NOT_AVAILABLE", 400)

        order_item = OrderItem(
            order_id=order.id,
            menu_item_id=menu_item_id,
            quantity=quantity,
            unit_price=float(menu_item.price),  # price snapshot
            special_instructions=(entry.get("special_instructions") or "").strip() or None,
        )
        db.session.add(order_item)

    _log_event(bill.table_id, bill_id, order.id, "order_sent",
               f"Order #{sequence_number} sent to kitchen", user_id)
    db.session.commit()

    # Notify kitchen with sound+vibration
    socketio.emit("order:created", _order_dict(order), to="kitchen")
    # Silent update for admin
    socketio.emit("order:status_changed", {"order_id": order.id, "status": order.status}, to="admin")

    return success_response(_order_dict(order), "Order sent to kitchen.", 201)


# ---------------------------------------------------------------------------
# List orders (kitchen view: all active; bill view: by bill)
# ---------------------------------------------------------------------------

@orders_bp.get("")
@jwt_required()
def list_orders():
    bill_id = request.args.get("bill_id", type=int)
    claims = get_jwt()
    role = claims.get("role")

    _eager = [
        joinedload(Order.items).joinedload(OrderItem.menu_item),
        joinedload(Order.bill).joinedload(Bill.table),
        joinedload(Order.bill).joinedload(Bill.waiter),
    ]
    if bill_id:
        orders = (
            Order.query
            .options(*_eager)
            .filter_by(bill_id=bill_id)
            .order_by(Order.sequence_number)
            .all()
        )
    elif role in ("kitchen", "manager", "waiter"):
        # Active orders only (not delivered/cancelled)
        orders = (
            Order.query
            .options(*_eager)
            .filter(Order.status.in_(["pending", "preparing", "done"]))
            .order_by(Order.sent_to_kitchen_at)
            .all()
        )
    else:
        return error_response("bill_id is required for waiters.", "VALIDATION_ERROR", 400)

    return success_response([_order_dict(o) for o in orders])


# ---------------------------------------------------------------------------
# Status transitions
# ---------------------------------------------------------------------------

@orders_bp.patch("/<int:order_id>/status")
@jwt_required()
def update_order_status(order_id: int):
    order = Order.query.options(
        joinedload(Order.bill).joinedload(Bill.table),
        joinedload(Order.bill).joinedload(Bill.waiter),
        joinedload(Order.items).joinedload(OrderItem.menu_item),
    ).get(order_id)
    if not order:
        return error_response("Order not found.", "ORDER_NOT_FOUND", 404)

    body = request.get_json(silent=True) or {}
    new_status = body.get("status", "").strip()
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    role = claims.get("role")

    error = _validate_transition(order.status, new_status, role)
    if error:
        return error_response(error, "ORDER_CANNOT_TRANSITION", 409)

    now = datetime.now(timezone.utc)
    order.status = new_status

    if new_status == "preparing":
        event_type = "order_preparing"
    elif new_status == "done":
        order.done_at = now
        event_type = "order_done"
    elif new_status == "delivered":
        order.delivered_at = now
        event_type = "order_delivered"
    elif new_status == "cancelled":
        order.cancelled_at = now
        order.cancelled_by = user_id
        event_type = "order_cancelled"
    else:
        event_type = "order_status_changed"

    _log_event(order.bill.table_id, order.bill_id, order.id, event_type,
               f"Order #{order.sequence_number} → {new_status}", user_id)
    db.session.commit()

    # Notify waiter when order is done (sound+vibration)
    if new_status == "done":
        socketio.emit("order:done", _order_dict(order), to=f"waiter_{order.bill.waiter_id}")

    # Silent update for kitchen and admin
    socketio.emit("order:status_changed",
                  {"order_id": order.id, "status": order.status},
                  to="kitchen")
    socketio.emit("order:status_changed",
                  {"order_id": order.id, "status": order.status},
                  to="admin")

    return success_response(_order_dict(order), f"Order marked as {new_status}.")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TRANSITIONS: dict[str, dict[str, list[str]]] = {
    # current_status → new_status → allowed_roles
    "pending": {
        "preparing": ["kitchen", "manager"],
        "cancelled": ["waiter", "kitchen", "manager"],
    },
    "preparing": {
        "done": ["kitchen", "manager"],
        "cancelled": ["kitchen", "manager"],
    },
    "done": {
        "delivered": ["waiter", "manager"],
        "cancelled": ["manager"],
    },
    "delivered": {
        "cancelled": ["manager"],
    },
}


def _validate_transition(current: str, new: str, role: str) -> str | None:
    allowed = _TRANSITIONS.get(current, {}).get(new)
    if allowed is None:
        return f"Cannot transition from '{current}' to '{new}'."
    if role not in allowed:
        return f"Role '{role}' cannot perform this transition."
    return None


def _log_event(table_id: int, bill_id: int | None, order_id: int | None,
               event_type: str, description: str, actor_id: int) -> None:
    db.session.add(TableEvent(
        table_id=table_id,
        bill_id=bill_id,
        order_id=order_id,
        event_type=event_type,
        description=description,
        actor_id=actor_id,
    ))


def _order_dict(order: Order) -> dict:
    bill = order.bill
    return {
        "id": order.id,
        "bill_id": order.bill_id,
        "table_number": bill.table.number if bill and bill.table else None,
        "waiter_name": bill.waiter.display_name if bill and bill.waiter else None,
        "sequence_number": order.sequence_number,
        "status": order.status,
        "sent_to_kitchen_at": order.sent_to_kitchen_at.isoformat(),
        "done_at": order.done_at.isoformat() if order.done_at else None,
        "delivered_at": order.delivered_at.isoformat() if order.delivered_at else None,
        "cancelled_at": order.cancelled_at.isoformat() if order.cancelled_at else None,
        "cancelled_by": order.cancelled_by,
        "items": [
            {
                "id": i.id,
                "menu_item_id": i.menu_item_id,
                "name": i.menu_item.name if i.menu_item else None,
                "quantity": i.quantity,
                "unit_price": float(i.unit_price),
                "special_instructions": i.special_instructions,
            }
            for i in order.items
        ],
    }
