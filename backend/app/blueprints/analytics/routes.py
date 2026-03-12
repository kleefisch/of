from datetime import datetime, timezone, date, timedelta
from typing import Optional

from flask import request
from sqlalchemy import func, extract, cast, Float

from app.blueprints.analytics import analytics_bp
from app.extensions import db
from app.models.bill import Bill
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.menu_item import MenuItem
from app.models.table import Table
from app.models.user import User
from app.utils.response import success_response, error_response
from app.utils.auth_helpers import roles_required


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_filters() -> tuple[datetime, datetime, Optional[int], Optional[str]]:
    """Parse and validate query params; return (start_dt, end_dt, waiter_id, err)."""
    period = request.args.get("period", "7d")
    waiter_id_raw = request.args.get("waiter_id")
    waiter_id = int(waiter_id_raw) if waiter_id_raw and waiter_id_raw.isdigit() else None

    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)

    if period == "today":
        start_dt = today_start
        end_dt = now
    elif period == "7d":
        start_dt = today_start - timedelta(days=6)
        end_dt = now
    elif period == "30d":
        start_dt = today_start - timedelta(days=29)
        end_dt = now
    elif period == "month":
        start_dt = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        end_dt = now
    elif period == "custom":
        try:
            start_dt = datetime.fromisoformat(request.args["start_date"]).replace(tzinfo=timezone.utc)
            end_dt = datetime.fromisoformat(request.args["end_date"]).replace(tzinfo=timezone.utc)
        except (KeyError, ValueError):
            return None, None, None, "start_date and end_date are required for custom period (ISO format)."
    else:
        start_dt = today_start - timedelta(days=6)
        end_dt = now

    return start_dt, end_dt, waiter_id, None


def _closed_bills_query(start_dt: datetime, end_dt: datetime, waiter_id: Optional[int]):
    """Base query: closed bills within date range, optionally filtered by waiter."""
    q = Bill.query.filter(
        Bill.status == "closed",
        Bill.closed_at >= start_dt,
        Bill.closed_at <= end_dt,
    )
    if waiter_id:
        q = q.filter(Bill.waiter_id == waiter_id)
    return q


def _date_label(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")


def _build_daily_trend(rows: list, start_dt: datetime, end_dt: datetime) -> list[dict]:
    """Fill a date-indexed dict with query rows (date_str -> value) and return sorted list."""
    by_date: dict[str, float] = {}
    cursor = start_dt.date()
    end_date = end_dt.date()
    while cursor <= end_date:
        by_date[cursor.isoformat()] = 0.0
        cursor += timedelta(days=1)
    for row in rows:
        key = row[0].isoformat() if isinstance(row[0], date) else str(row[0])
        by_date[key] = float(row[1] or 0)
    return [{"date": k, "value": v} for k, v in sorted(by_date.items())]


# ---------------------------------------------------------------------------
# Single aggregated endpoint
# ---------------------------------------------------------------------------

@analytics_bp.get("/dashboard")
@roles_required("manager")
def get_dashboard():
    start_dt, end_dt, waiter_id, err = _parse_filters()
    if err:
        return error_response(err, "VALIDATION_ERROR", 400)

    period_seconds = max((end_dt - start_dt).total_seconds(), 1)

    # ── 1 & 2: Revenue, avg ticket, bills closed, tips ─────────────────────
    revenue_trend_rows = (
        db.session.query(
            func.date(Bill.closed_at).label("day"),
            func.sum(Bill.total).label("revenue"),
            func.avg(Bill.total).label("avg_ticket"),
            func.count(Bill.id).label("count"),
            func.sum(Bill.tip_amount).label("tips"),
        )
        .filter(
            Bill.status == "closed",
            Bill.closed_at >= start_dt,
            Bill.closed_at <= end_dt,
            *([Bill.waiter_id == waiter_id] if waiter_id else []),
        )
        .group_by(func.date(Bill.closed_at))
        .order_by(func.date(Bill.closed_at))
        .all()
    )

    total_revenue = sum(float(r.revenue or 0) for r in revenue_trend_rows)
    total_bills = sum(int(r.count or 0) for r in revenue_trend_rows)
    total_tips = sum(float(r.tips or 0) for r in revenue_trend_rows)
    avg_ticket = (total_revenue / total_bills) if total_bills else 0.0

    revenue_trend = _build_daily_trend(
        [(r.day, r.revenue) for r in revenue_trend_rows], start_dt, end_dt
    )
    avg_ticket_trend = _build_daily_trend(
        [(r.day, r.avg_ticket) for r in revenue_trend_rows], start_dt, end_dt
    )
    bills_trend = _build_daily_trend(
        [(r.day, r.count) for r in revenue_trend_rows], start_dt, end_dt
    )
    tips_trend = _build_daily_trend(
        [(r.day, r.tips) for r in revenue_trend_rows], start_dt, end_dt
    )

    # ── 5: Avg table turn time ─────────────────────────────────────────────
    turn_rows = (
        db.session.query(
            func.date(Bill.closed_at).label("day"),
            func.avg(
                func.extract("epoch", Bill.closed_at) - func.extract("epoch", Bill.opened_at)
            ).label("avg_seconds"),
        )
        .filter(
            Bill.status == "closed",
            Bill.closed_at >= start_dt,
            Bill.closed_at <= end_dt,
            Bill.opened_at.isnot(None),
            *([Bill.waiter_id == waiter_id] if waiter_id else []),
        )
        .group_by(func.date(Bill.closed_at))
        .all()
    )

    total_turn_seconds = sum(float(r.avg_seconds or 0) for r in turn_rows)
    avg_turn_minutes = round((total_turn_seconds / len(turn_rows)) / 60, 1) if turn_rows else 0.0

    turn_trend = _build_daily_trend(
        [(r.day, round(float(r.avg_seconds or 0) / 60, 1)) for r in turn_rows],
        start_dt,
        end_dt,
    )

    # ── 4: Table utilization ───────────────────────────────────────────────
    occupied_seconds_row = (
        db.session.query(
            func.sum(
                func.extract("epoch", Bill.closed_at) - func.extract("epoch", Bill.opened_at)
            )
        )
        .filter(
            Bill.status == "closed",
            Bill.closed_at >= start_dt,
            Bill.closed_at <= end_dt,
            Bill.opened_at.isnot(None),
            *([Bill.waiter_id == waiter_id] if waiter_id else []),
        )
        .scalar()
    )
    occupied_seconds = float(occupied_seconds_row or 0)
    active_tables_count = Table.query.filter_by(is_active=True).count()
    total_available_seconds = active_tables_count * period_seconds
    utilization_pct = round(
        (occupied_seconds / total_available_seconds * 100) if total_available_seconds else 0.0, 1
    )

    # ── 6: Top selling items ───────────────────────────────────────────────
    top_items_query = (
        db.session.query(
            MenuItem.name,
            func.sum(OrderItem.quantity).label("quantity"),
            func.sum(OrderItem.quantity * cast(OrderItem.unit_price, Float)).label("revenue"),
        )
        .join(OrderItem, OrderItem.menu_item_id == MenuItem.id)
        .join(Order, Order.id == OrderItem.order_id)
        .join(Bill, Bill.id == Order.bill_id)
        .filter(
            Bill.status == "closed",
            Bill.closed_at >= start_dt,
            Bill.closed_at <= end_dt,
            Order.status != "cancelled",
            *([Bill.waiter_id == waiter_id] if waiter_id else []),
        )
        .group_by(MenuItem.id, MenuItem.name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(10)
        .all()
    )
    top_items = [
        {"name": r.name, "quantity": int(r.quantity or 0), "revenue": round(float(r.revenue or 0), 2)}
        for r in top_items_query
    ]

    # ── 7: Orders per hour ─────────────────────────────────────────────────
    orders_by_hour_query = (
        db.session.query(
            extract("hour", Order.sent_to_kitchen_at).label("hour"),
            func.count(Order.id).label("count"),
        )
        .join(Bill, Bill.id == Order.bill_id)
        .filter(
            Order.status != "cancelled",
            Order.sent_to_kitchen_at >= start_dt,
            Order.sent_to_kitchen_at <= end_dt,
            *([Bill.waiter_id == waiter_id] if waiter_id else []),
        )
        .group_by(extract("hour", Order.sent_to_kitchen_at))
        .order_by(extract("hour", Order.sent_to_kitchen_at))
        .all()
    )
    by_hour: dict[int, int] = {h: 0 for h in range(24)}
    for r in orders_by_hour_query:
        by_hour[int(r.hour)] = int(r.count)
    orders_by_hour = [{"hour": h, "count": by_hour[h]} for h in range(24)]

    # ── 8: Kitchen preparation time ────────────────────────────────────────
    prep_trend_rows = (
        db.session.query(
            func.date(Order.sent_to_kitchen_at).label("day"),
            func.avg(
                func.extract("epoch", Order.done_at) - func.extract("epoch", Order.sent_to_kitchen_at)
            ).label("avg_seconds"),
        )
        .join(Bill, Bill.id == Order.bill_id)
        .filter(
            Order.done_at.isnot(None),
            Order.status != "cancelled",
            Order.sent_to_kitchen_at >= start_dt,
            Order.sent_to_kitchen_at <= end_dt,
            *([Bill.waiter_id == waiter_id] if waiter_id else []),
        )
        .group_by(func.date(Order.sent_to_kitchen_at))
        .all()
    )

    avg_prep_seconds = (
        sum(float(r.avg_seconds or 0) for r in prep_trend_rows) / len(prep_trend_rows)
        if prep_trend_rows else 0.0
    )
    avg_prep_minutes = round(avg_prep_seconds / 60, 1)

    prep_trend = _build_daily_trend(
        [(r.day, round(float(r.avg_seconds or 0) / 60, 1)) for r in prep_trend_rows],
        start_dt,
        end_dt,
    )

    # ── Tables live overview ───────────────────────────────────────────────
    active_tables = (
        Table.query.filter_by(is_active=True).order_by(Table.number).all()
    )
    tables_overview = [
        {"id": t.id, "number": t.number, "seats": t.seats, "status": t.status}
        for t in active_tables
    ]

    # ── Waiters (for filter dropdown) ──────────────────────────────────────
    waiters = (
        User.query.filter_by(role="waiter", is_active=True)
        .order_by(User.display_name)
        .all()
    )
    waiters_out = [{"id": w.id, "name": w.display_name} for w in waiters]

    return success_response(
        {
            "filters": {
                "period": request.args.get("period", "7d"),
                "waiter_id": waiter_id,
                "start_date": start_dt.date().isoformat(),
                "end_date": end_dt.date().isoformat(),
            },
            "revenue": {"total": round(total_revenue, 2), "trend": revenue_trend},
            "avg_ticket": {"value": round(avg_ticket, 2), "trend": avg_ticket_trend},
            "bills_closed": {"total": total_bills, "trend": bills_trend},
            "total_tips": {"total": round(total_tips, 2), "trend": tips_trend},
            "avg_turn_time_minutes": avg_turn_minutes,
            "turn_time_trend": turn_trend,
            "table_utilization_pct": utilization_pct,
            "top_items": top_items,
            "orders_by_hour": orders_by_hour,
            "avg_prep_time_minutes": avg_prep_minutes,
            "prep_time_trend": prep_trend,
            "tables_overview": tables_overview,
            "waiters": waiters_out,
        }
    )
