from datetime import datetime, timezone

from flask import request
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from sqlalchemy.orm import joinedload

from app.blueprints.tables import tables_bp
from app.extensions import db, socketio
from app.models.table import Table
from app.models.bill import Bill
from app.models.table_event import TableEvent
from app.utils.response import success_response, error_response
from app.utils.auth_helpers import roles_required


# ---------------------------------------------------------------------------
# List & get
# ---------------------------------------------------------------------------

@tables_bp.get("")
@jwt_required()
def list_tables():
    tables = (
        Table.query
        .options(joinedload(Table.waiter))
        .filter_by(is_active=True)
        .order_by(Table.number)
        .all()
    )
    return success_response([_table_dict(t) for t in tables])


@tables_bp.get("/<int:table_id>")
@jwt_required()
def get_table(table_id: int):
    table = db.session.get(Table, table_id)
    if not table or not table.is_active:
        return error_response("Table not found.", "TABLE_NOT_FOUND", 404)
    return success_response(_table_dict(table))


# ---------------------------------------------------------------------------
# Create & edit (manager only, only when available)
# ---------------------------------------------------------------------------

@tables_bp.post("")
@roles_required("manager")
def create_table():
    body = request.get_json(silent=True) or {}
    number = body.get("number")
    seats = body.get("seats")

    if number is None or seats is None:
        return error_response("number and seats are required.", "VALIDATION_ERROR", 400)
    if int(seats) < 1:
        return error_response("seats must be at least 1.", "VALIDATION_ERROR", 400)
    if Table.query.filter_by(number=int(number), is_active=True).first():
        return error_response("A table with this number already exists.", "TABLE_DUPLICATE", 409)

    table = Table(number=int(number), seats=int(seats))
    db.session.add(table)
    db.session.commit()
    return success_response(_table_dict(table), "Table created.", 201)


@tables_bp.patch("/<int:table_id>")
@roles_required("manager")
def update_table(table_id: int):
    table = db.session.get(Table, table_id)
    if not table or not table.is_active:
        return error_response("Table not found.", "TABLE_NOT_FOUND", 404)
    if table.status != "available":
        return error_response("Table can only be edited when available.", "TABLE_NOT_EDITABLE", 409)

    body = request.get_json(silent=True) or {}

    if "number" in body:
        existing = Table.query.filter(Table.number == int(body["number"]), Table.id != table_id).first()
        if existing:
            return error_response("A table with this number already exists.", "TABLE_DUPLICATE", 409)
        table.number = int(body["number"])

    if "seats" in body:
        if int(body["seats"]) < 1:
            return error_response("seats must be at least 1.", "VALIDATION_ERROR", 400)
        table.seats = int(body["seats"])

    if "is_active" in body:
        if not body["is_active"] and table.status != "available":
            return error_response("Table can only be deactivated when available.", "TABLE_NOT_EDITABLE", 409)
        table.is_active = bool(body["is_active"])

    db.session.commit()
    _emit_table_changed()
    return success_response(_table_dict(table), "Table updated.")


# ---------------------------------------------------------------------------
# State machine actions
# ---------------------------------------------------------------------------

@tables_bp.post("/<int:table_id>/start-service")
@roles_required("waiter", "manager")
def start_service(table_id: int):
    table = db.session.get(Table, table_id)
    if not table or not table.is_active:
        return error_response("Table not found.", "TABLE_NOT_FOUND", 404)
    if table.status not in ("available", "reserved"):
        return error_response("Table is already occupied.", "TABLE_NOT_AVAILABLE", 409)

    user_id = int(get_jwt_identity())
    now = datetime.now(timezone.utc)

    table.status = "occupied"
    table.waiter_id = user_id
    table.service_started_at = now

    bill = Bill(table_id=table_id, waiter_id=user_id)
    db.session.add(bill)
    db.session.flush()  # get bill.id before commit

    _log_event(table_id, bill.id, None, "service_started", f"Service started at table {table.number}", user_id)
    db.session.commit()

    _emit_table_changed()
    return success_response({"table": _table_dict(table), "bill_id": bill.id}, "Service started.")


@tables_bp.post("/<int:table_id>/reserve")
@roles_required("waiter", "manager")
def reserve_table(table_id: int):
    table = db.session.get(Table, table_id)
    if not table or not table.is_active:
        return error_response("Table not found.", "TABLE_NOT_FOUND", 404)
    if table.status != "available":
        return error_response("Table is not available.", "TABLE_NOT_AVAILABLE", 409)

    user_id = int(get_jwt_identity())
    table.status = "reserved"
    table.waiter_id = user_id

    _log_event(table_id, None, None, "reservation_made", f"Table {table.number} reserved", user_id)
    db.session.commit()

    _emit_table_changed()
    return success_response(_table_dict(table), "Table reserved.")


@tables_bp.post("/<int:table_id>/release-reservation")
@roles_required("waiter", "manager")
def release_reservation(table_id: int):
    table = db.session.get(Table, table_id)
    if not table or not table.is_active:
        return error_response("Table not found.", "TABLE_NOT_FOUND", 404)
    if table.status != "reserved":
        return error_response("Table is not reserved.", "TABLE_INVALID_TRANSITION", 409)

    user_id = int(get_jwt_identity())
    table.status = "available"
    table.waiter_id = None

    _log_event(table_id, None, None, "reservation_released", f"Reservation released for table {table.number}", user_id)
    db.session.commit()

    _emit_table_changed()
    return success_response(_table_dict(table), "Reservation released.")


@tables_bp.post("/<int:table_id>/release")
@roles_required("waiter", "manager")
def release_table(table_id: int):
    """Release an occupied table without payment (cancels the bill)."""
    table = db.session.get(Table, table_id)
    if not table or not table.is_active:
        return error_response("Table not found.", "TABLE_NOT_FOUND", 404)
    if table.status != "occupied":
        return error_response("Table is not occupied.", "TABLE_INVALID_TRANSITION", 409)

    user_id = int(get_jwt_identity())
    bill = _get_open_bill(table_id)

    if bill:
        bill.status = "cancelled"
        bill.closed_at = datetime.now(timezone.utc)
        _log_event(table_id, bill.id, None, "table_released", f"Table {table.number} released without payment", user_id)

    table.status = "available"
    table.waiter_id = None
    table.service_started_at = None
    db.session.commit()

    _emit_table_changed()
    return success_response(_table_dict(table), "Table released.")


@tables_bp.get("/<int:table_id>/current-bill")
@jwt_required()
def get_current_bill(table_id: int):
    """Return the open bill for an occupied table (used by Continue Service)."""
    table = db.session.get(Table, table_id)
    if not table or not table.is_active:
        return error_response("Table not found.", "TABLE_NOT_FOUND", 404)

    bill = _get_open_bill(table_id)
    if not bill:
        return error_response("No open bill for this table.", "BILL_NOT_FOUND", 404)

    return success_response({"bill_id": bill.id, "table": _table_dict(table)})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_open_bill(table_id: int) -> Bill | None:
    return Bill.query.filter_by(table_id=table_id, status="open").first()


def _log_event(table_id: int, bill_id: int | None, order_id: int | None, event_type: str, description: str, actor_id: int) -> None:
    event = TableEvent(
        table_id=table_id,
        bill_id=bill_id,
        order_id=order_id,
        event_type=event_type,
        description=description,
        actor_id=actor_id,
    )
    db.session.add(event)


def _emit_table_changed() -> None:
    socketio.emit("table:status_changed", {}, to="admin")


def _table_dict(table: Table) -> dict:
    return {
        "id": table.id,
        "number": table.number,
        "seats": table.seats,
        "status": table.status,
        "is_active": table.is_active,
        "waiter_id": table.waiter_id,
        "waiter_display_name": table.waiter.display_name if table.waiter else None,
        "service_started_at": table.service_started_at.isoformat() if table.service_started_at else None,
    }
