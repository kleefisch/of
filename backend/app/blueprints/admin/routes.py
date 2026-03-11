from datetime import datetime, timezone

from flask import request
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from app.blueprints.admin import admin_bp
from app.extensions import db, bcrypt
from app.models.user import User
from app.models.table import Table
from app.models.bill import Bill
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.table_event import TableEvent
from app.utils.response import success_response, error_response
from app.utils.auth_helpers import roles_required


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------

@admin_bp.get("/users")
@roles_required("manager")
def list_users():
    users = User.query.order_by(User.full_name).all()
    return success_response([_user_dict(u) for u in users])


@admin_bp.post("/users")
@roles_required("manager")
def create_user():
    body = request.get_json(silent=True) or {}
    full_name = (body.get("full_name") or "").strip()
    display_name = (body.get("display_name") or "").strip()
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""
    role = body.get("role") or ""

    if not all([full_name, display_name, username, password, role]):
        return error_response("All fields are required.", "VALIDATION_ERROR", 400)
    if role not in ("waiter", "kitchen", "manager"):
        return error_response("role must be waiter, kitchen, or manager.", "VALIDATION_ERROR", 400)
    if len(password) < 6:
        return error_response("Password must be at least 6 characters.", "VALIDATION_ERROR", 400)
    if User.query.filter_by(username=username).first():
        return error_response("Username already taken.", "USER_DUPLICATE", 409)

    user = User(
        full_name=full_name,
        display_name=display_name,
        username=username,
        password_hash=bcrypt.generate_password_hash(password).decode("utf-8"),
        role=role,
    )
    db.session.add(user)
    db.session.commit()
    return success_response(_user_dict(user), "User created.", 201)


@admin_bp.patch("/users/<int:user_id>")
@roles_required("manager")
def update_user(user_id: int):
    user = db.session.get(User, user_id)
    if not user:
        return error_response("User not found.", "USER_NOT_FOUND", 404)

    body = request.get_json(silent=True) or {}

    if "full_name" in body:
        user.full_name = (body["full_name"] or "").strip()
    if "display_name" in body:
        user.display_name = (body["display_name"] or "").strip()
    if "role" in body:
        if body["role"] not in ("waiter", "kitchen", "manager"):
            return error_response("Invalid role.", "VALIDATION_ERROR", 400)
        user.role = body["role"]
    if "is_active" in body:
        user.is_active = bool(body["is_active"])
    if "password" in body:
        password = body["password"] or ""
        if len(password) < 6:
            return error_response("Password must be at least 6 characters.", "VALIDATION_ERROR", 400)
        user.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    db.session.commit()
    return success_response(_user_dict(user), "User updated.")


# ---------------------------------------------------------------------------
# History (bills with full detail)
# ---------------------------------------------------------------------------

@admin_bp.get("/history")
@roles_required("waiter", "manager")
def get_history():
    from flask_jwt_extended import get_jwt, get_jwt_identity
    claims = get_jwt()
    role = claims.get("role")
    current_user_id = int(get_jwt_identity())

    query = Bill.query.options(
        joinedload(Bill.orders).joinedload(Order.items),
        joinedload(Bill.table),
        joinedload(Bill.waiter),
    )

    # Waiters see only their own bills
    if role == "waiter":
        query = query.filter_by(waiter_id=current_user_id)

    # Optional filters
    waiter_id = request.args.get("waiter_id", type=int)
    if waiter_id and role == "manager":
        query = query.filter_by(waiter_id=waiter_id)

    status = request.args.get("status")
    if status in ("open", "closed", "cancelled"):
        query = query.filter_by(status=status)

    date_from = request.args.get("from")
    date_to = request.args.get("to")
    if date_from:
        query = query.filter(Bill.opened_at >= date_from)
    if date_to:
        query = query.filter(Bill.opened_at <= date_to)

    bills = query.order_by(Bill.opened_at.desc()).all()
    return success_response([_bill_detail_dict(b) for b in bills])


@admin_bp.get("/history/<int:bill_id>/events")
@roles_required("waiter", "manager")
def get_bill_events(bill_id: int):
    from flask_jwt_extended import get_jwt, get_jwt_identity
    claims = get_jwt()
    role = claims.get("role")
    current_user_id = int(get_jwt_identity())

    bill = db.session.get(Bill, bill_id)
    if not bill:
        return error_response("Bill not found.", "BILL_NOT_FOUND", 404)
    if role == "waiter" and bill.waiter_id != current_user_id:
        return error_response("Access denied.", "FORBIDDEN", 403)

    events = (
        TableEvent.query
        .options(joinedload(TableEvent.actor))
        .filter_by(bill_id=bill_id)
        .order_by(TableEvent.created_at)
        .all()
    )
    return success_response([
        {
            "id": e.id,
            "event_type": e.event_type,
            "description": e.description,
            "actor": e.actor.display_name if e.actor else None,
            "created_at": e.created_at.isoformat(),
        }
        for e in events
    ])


# ---------------------------------------------------------------------------
# Analytics (manager dashboard)
# ---------------------------------------------------------------------------

@admin_bp.get("/analytics")
@roles_required("manager")
def get_analytics():
    date_from = request.args.get("from")
    date_to = request.args.get("to")
    waiter_id = request.args.get("waiter_id", type=int)

    query = Bill.query.filter_by(status="closed")
    if date_from:
        query = query.filter(Bill.opened_at >= date_from)
    if date_to:
        query = query.filter(Bill.opened_at <= date_to)
    if waiter_id:
        query = query.filter_by(waiter_id=waiter_id)

    bills = query.all()

    total_sales = sum(float(b.total or 0) for b in bills)
    total_tips = sum(float(b.tip_amount or 0) for b in bills)
    bills_closed = len(bills)
    avg_ticket = round(total_sales / bills_closed, 2) if bills_closed else 0.0

    # Average service time in minutes
    times = [
        (b.closed_at - b.opened_at).total_seconds() / 60
        for b in bills
        if b.closed_at and b.opened_at
    ]
    avg_service_time = round(sum(times) / len(times), 1) if times else 0.0

    # Live table overview
    tables = Table.query.filter_by(is_active=True).order_by(Table.number).all()

    return success_response({
        "total_sales": round(total_sales, 2),
        "total_tips": round(total_tips, 2),
        "bills_closed": bills_closed,
        "avg_ticket": avg_ticket,
        "avg_service_time_minutes": avg_service_time,
        "tables_overview": [
            {
                "id": t.id,
                "number": t.number,
                "status": t.status,
                "waiter_id": t.waiter_id,
            }
            for t in tables
        ],
    })


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "display_name": user.display_name,
        "username": user.username,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat(),
    }


def _bill_detail_dict(bill: Bill) -> dict:
    return {
        "id": bill.id,
        "table_number": bill.table.number if bill.table else None,
        "waiter": bill.waiter.display_name if bill.waiter else None,
        "status": bill.status,
        "split_method": bill.split_method,
        "payment_method": bill.payment_method,
        "subtotal": float(bill.subtotal) if bill.subtotal is not None else None,
        "tip_percent": float(bill.tip_percent) if bill.tip_percent is not None else None,
        "tip_amount": float(bill.tip_amount) if bill.tip_amount is not None else None,
        "total": float(bill.total) if bill.total is not None else None,
        "opened_at": bill.opened_at.isoformat(),
        "closed_at": bill.closed_at.isoformat() if bill.closed_at else None,
        "orders": [
            {
                "id": o.id,
                "sequence_number": o.sequence_number,
                "status": o.status,
                "sent_to_kitchen_at": o.sent_to_kitchen_at.isoformat(),
                "done_at": o.done_at.isoformat() if o.done_at else None,
                "delivered_at": o.delivered_at.isoformat() if o.delivered_at else None,
                "items": [
                    {
                        "id": i.id,
                        "menu_item_id": i.menu_item_id,
                        "quantity": i.quantity,
                        "unit_price": float(i.unit_price),
                        "line_total": round(float(i.unit_price) * i.quantity, 2),
                        "special_instructions": i.special_instructions,
                    }
                    for i in o.items
                ],
            }
            for o in bill.orders
        ],
    }
