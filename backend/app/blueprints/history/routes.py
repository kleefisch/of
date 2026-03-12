from datetime import datetime, timezone, timedelta

from flask import request
from flask_jwt_extended import get_jwt, get_jwt_identity
from sqlalchemy.orm import joinedload

from app.blueprints.history import history_bp
from app.extensions import db
from app.models.bill import Bill
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.payment import Payment
from app.models.table import Table
from app.models.user import User
from app.utils.auth_helpers import roles_required
from app.utils.response import success_response, error_response


def _period_bounds(period: str, date_from: str | None, date_to: str | None):
    """Return (start, end) as UTC-aware datetimes for the requested period."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    if period == "today":
        return today_start, now
    if period == "last7days":
        return today_start - timedelta(days=6), now
    if period == "last30days":
        return today_start - timedelta(days=29), now
    if period == "current_month":
        return today_start.replace(day=1), now
    if period == "custom":
        try:
            start = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            end = datetime.fromisoformat(date_to).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            return start, end
        except Exception:
            return None, None
    # fallback: today
    return today_start, now


@history_bp.get("/bills")
@roles_required("waiter", "manager")
def list_bills():
    claims = get_jwt()
    role = claims.get("role")
    current_user_id = int(get_jwt_identity())

    # ── Query params ──────────────────────────────────────────────────────────
    period = request.args.get("period", "today")
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    status_filter = request.args.get("status", "all")  # all | open | closed | cancelled
    waiter_id_param = request.args.get("waiter_id", type=int)

    # ── Date bounds ───────────────────────────────────────────────────────────
    start, end = _period_bounds(period, date_from, date_to)
    if start is None:
        return error_response("Invalid date_from or date_to.", "VALIDATION_ERROR", 400)

    # ── Base query ────────────────────────────────────────────────────────────
    query = (
        Bill.query
        .options(
            joinedload(Bill.table),
            joinedload(Bill.waiter),
            joinedload(Bill.orders).joinedload(Order.items).joinedload(OrderItem.menu_item),
            joinedload(Bill.payments),
        )
        .filter(Bill.opened_at >= start, Bill.opened_at <= end)
    )

    # Waiters only see their own bills
    if role == "waiter":
        query = query.filter(Bill.waiter_id == current_user_id)
    elif waiter_id_param:
        query = query.filter(Bill.waiter_id == waiter_id_param)

    if status_filter != "all":
        query = query.filter(Bill.status == status_filter)

    bills = query.order_by(Bill.opened_at.desc()).all()

    # ── Serialize bills ───────────────────────────────────────────────────────
    bills_out = []
    for bill in bills:
        # Duration in minutes (closed bills only)
        duration_minutes = None
        if bill.closed_at and bill.opened_at:
            delta = bill.closed_at - bill.opened_at
            duration_minutes = int(delta.total_seconds() / 60)

        orders_out = []
        for order in sorted(bill.orders, key=lambda o: o.sequence_number):
            items_out = [
                {
                    "name": oi.menu_item.name if oi.menu_item else f"Item #{oi.menu_item_id}",
                    "quantity": oi.quantity,
                    "unit_price": float(oi.unit_price),
                    "line_total": round(float(oi.unit_price) * oi.quantity, 2),
                }
                for oi in order.items
            ]
            orders_out.append({
                "id": order.id,
                "sequence_number": order.sequence_number,
                "status": order.status,
                "sent_to_kitchen_at": order.sent_to_kitchen_at.isoformat() if order.sent_to_kitchen_at else None,
                "delivered_at": order.delivered_at.isoformat() if order.delivered_at else None,
                "items": items_out,
            })

        payments_out = [
            {
                "method": p.method,
                "amount": float(p.amount),
                "tip_amount": float(p.tip_amount),
            }
            for p in bill.payments
        ]

        bills_out.append({
            "id": bill.id,
            "table_number": bill.table.number if bill.table else None,
            "waiter_id": bill.waiter_id,
            "waiter_name": bill.waiter.display_name if bill.waiter else None,
            "status": bill.status,
            "split_method": bill.split_method,
            "tip_percent": float(bill.tip_percent) if bill.tip_percent is not None else None,
            "tip_amount": float(bill.tip_amount) if bill.tip_amount is not None else None,
            "subtotal": float(bill.subtotal) if bill.subtotal is not None else None,
            "total": float(bill.total) if bill.total is not None else None,
            "opened_at": bill.opened_at.isoformat() if bill.opened_at else None,
            "closed_at": bill.closed_at.isoformat() if bill.closed_at else None,
            "duration_minutes": duration_minutes,
            "orders": orders_out,
            "payments": payments_out,
        })

    # ── Summary KPIs (closed bills only) ─────────────────────────────────────
    closed = [b for b in bills_out if b["status"] == "closed"]
    total_sales = round(sum(b["total"] or 0 for b in closed), 2)
    tables_served = len(closed)
    total_tips = round(sum(b["tip_amount"] or 0 for b in closed), 2)
    avg_ticket = round(total_sales / tables_served, 2) if tables_served else 0.0
    durations = [b["duration_minutes"] for b in closed if b["duration_minutes"] is not None]
    avg_service_minutes = round(sum(durations) / len(durations)) if durations else 0

    # ── Waiters list (managers only, for the filter dropdown) ─────────────────
    waiters_out = []
    if role == "manager":
        waiters = (
            User.query
            .filter_by(role="waiter", is_active=True)
            .order_by(User.display_name)
            .all()
        )
        waiters_out = [{"id": w.id, "name": w.display_name} for w in waiters]

    return success_response({
        "summary": {
            "total_sales": total_sales,
            "tables_served": tables_served,
            "total_tips": total_tips,
            "avg_ticket": avg_ticket,
            "avg_service_minutes": avg_service_minutes,
        },
        "bills": bills_out,
        "waiters": waiters_out,
    })
