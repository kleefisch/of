import os
import socket
from datetime import datetime, timezone

import stripe
from flask import request
from flask_jwt_extended import get_jwt_identity
from sqlalchemy.orm import joinedload

from app.blueprints.payments import payments_bp
from app.extensions import db
from app.models.bill import Bill
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.payment import Payment
from app.models.table import Table
from app.models.table_event import TableEvent
from app.utils.response import success_response, error_response
from app.utils.auth_helpers import roles_required

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")


# ---------------------------------------------------------------------------
# Bill summary (for Close Table screen)
# ---------------------------------------------------------------------------

@payments_bp.get("/bill/<int:bill_id>")
@roles_required("waiter", "manager")
def get_bill_summary(bill_id: int):
    bill = Bill.query.get(bill_id)
    if not bill or bill.status != "open":
        return error_response("Bill not found or not open.", "BILL_NOT_FOUND", 404)

    # Block if any active orders exist
    blocking = Order.query.filter(
        Order.bill_id == bill_id,
        Order.status.in_(["pending", "preparing", "done"]),
    ).count()
    if blocking:
        return error_response(
            "Cannot close bill while orders are pending, preparing, or done.",
            "BILL_HAS_ACTIVE_ORDERS",
            409,
        )

    orders = Order.query.options(
        joinedload(Order.items).joinedload(OrderItem.menu_item)
    ).filter(
        Order.bill_id == bill_id,
        Order.status != "cancelled",
    ).all()
    items_flat = []
    subtotal = 0.0
    for order in orders:
        for item in order.items:
            line_total = float(item.unit_price) * item.quantity
            subtotal += line_total
            items_flat.append({
                "order_sequence": order.sequence_number,
                "order_item_id": item.id,
                "menu_item_id": item.menu_item_id,
                "name": item.menu_item.name if item.menu_item else f"Item #{item.menu_item_id}",
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
                "line_total": line_total,
                "special_instructions": item.special_instructions,
            })

    return success_response({
        "bill_id": bill.id,
        "table_id": bill.table_id,
        "waiter_id": bill.waiter_id,
        "subtotal": round(subtotal, 2),
        "items": items_flat,
        "split_method": bill.split_method,
        "tip_percent": float(bill.tip_percent) if bill.tip_percent is not None else None,
        "split_plan": bill.split_plan,
    })


# ---------------------------------------------------------------------------
# Init split plan (stores config without closing the bill)
# ---------------------------------------------------------------------------

@payments_bp.post("/bill/<int:bill_id>/init-split")
@roles_required("waiter", "manager")
def init_split(bill_id: int):
    bill = Bill.query.get(bill_id)
    if not bill or bill.status != "open":
        return error_response("Bill not found or not open.", "BILL_NOT_FOUND", 404)

    blocking = Order.query.filter(
        Order.bill_id == bill_id,
        Order.status.in_(["pending", "preparing", "done"]),
    ).count()
    if blocking:
        return error_response(
            "Cannot start split while orders are pending, preparing, or done.",
            "BILL_HAS_ACTIVE_ORDERS",
            409,
        )

    body = request.get_json(silent=True) or {}
    split_method = body.get("split_method")
    tip_percent = body.get("tip_percent", 0)
    persons = body.get("persons", [])

    if split_method not in ("split_equally", "custom_amount"):
        return error_response("split_method must be split_equally or custom_amount.", "VALIDATION_ERROR", 400)
    if not persons or not isinstance(persons, list):
        return error_response("persons list is required.", "VALIDATION_ERROR", 400)

    # Preserve paid entries from any previous init-split call
    existing_plan = bill.split_plan or []
    existing_paid = {p["index"]: p for p in existing_plan if p.get("status") == "paid"}

    plan = []
    for i, person in enumerate(persons):
        if i in existing_paid:
            plan.append(existing_paid[i])
        else:
            plan.append({
                "index": i,
                "label": person.get("label", f"Person {i + 1}"),
                "amount": round(float(person.get("amount", 0)), 2),
                "tip_amount": round(float(person.get("tip_amount", 0)), 2),
                "status": "pending",
                "payment_id": None,
            })

    bill.split_method = split_method
    bill.tip_percent = float(tip_percent)
    bill.split_plan = plan
    db.session.commit()

    return success_response({"split_plan": plan})


# ---------------------------------------------------------------------------
# Pay one person's share (persists immediately, auto-closes when done)
# ---------------------------------------------------------------------------

@payments_bp.post("/bill/<int:bill_id>/pay-person")
@roles_required("waiter", "manager")
def pay_person(bill_id: int):
    bill = Bill.query.get(bill_id)
    if not bill or bill.status != "open":
        return error_response("Bill not found or not open.", "BILL_NOT_FOUND", 404)
    if not bill.split_plan:
        return error_response("Split plan not initialised. Call init-split first.", "NO_SPLIT_PLAN", 409)

    body = request.get_json(silent=True) or {}
    person_index = body.get("person_index")
    method = body.get("method")
    stripe_pi_id = body.get("stripe_payment_intent_id")

    if person_index is None or not isinstance(person_index, int):
        return error_response("person_index (int) is required.", "VALIDATION_ERROR", 400)

    valid_methods = ("credit", "debit", "cash", "tap_to_pay", "qr_code", "card_reader")
    if method not in valid_methods:
        return error_response(f"Invalid payment method: {method}", "VALIDATION_ERROR", 400)

    plan = bill.split_plan
    if person_index < 0 or person_index >= len(plan):
        return error_response("person_index out of range.", "VALIDATION_ERROR", 400)

    entry = plan[person_index]
    if entry.get("status") == "paid":
        return error_response("This person has already paid.", "ALREADY_PAID", 409)

    if method in ("credit", "debit"):
        if not stripe_pi_id:
            return error_response("stripe_payment_intent_id is required for card payments.", "VALIDATION_ERROR", 400)
        intent = stripe.PaymentIntent.retrieve(stripe_pi_id)
        if intent.status != "succeeded":
            return error_response("Stripe payment has not succeeded.", "STRIPE_PAYMENT_FAILED", 402)

    payment = Payment(
        bill_id=bill_id,
        method=method,
        amount=entry["amount"],
        tip_amount=entry["tip_amount"],
        stripe_payment_intent_id=stripe_pi_id,
    )
    db.session.add(payment)
    db.session.flush()  # get payment.id before commit

    # Update plan entry (must replace list for SQLAlchemy JSON change detection)
    new_plan = list(plan)
    new_plan[person_index] = {
        **entry,
        "status": "paid",
        "payment_id": payment.id,
    }
    bill.split_plan = new_plan

    # Check if all persons paid
    all_paid = all(p.get("status") == "paid" for p in new_plan)
    total_paid = round(sum(
        float(p["amount"]) + float(p["tip_amount"])
        for p in new_plan if p.get("status") == "paid"
    ), 2)

    auto_closed = False
    if all_paid:
        # Recalculate current subtotal (handles new orders added mid-split)
        orders = Order.query.filter(
            Order.bill_id == bill_id,
            Order.status != "cancelled",
        ).all()
        subtotal = round(sum(
            float(item.unit_price) * item.quantity
            for order in orders
            for item in order.items
        ), 2)
        tip_amount = round(subtotal * float(bill.tip_percent or 0) / 100, 2)
        current_total = round(subtotal + tip_amount, 2)

        if total_paid >= current_total - 0.01:
            user_id = int(get_jwt_identity())
            now = datetime.now(timezone.utc)

            bill.status = "closed"
            bill.tip_amount = tip_amount
            bill.subtotal = subtotal
            bill.total = current_total
            bill.closed_at = now

            table = db.session.get(Table, bill.table_id)
            if table:
                table.status = "available"
                table.waiter_id = None
                table.service_started_at = None

            db.session.add(TableEvent(
                table_id=bill.table_id,
                bill_id=bill_id,
                order_id=None,
                event_type="payment_confirmed",
                description=f"Bill #{bill_id} closed (split) — total €{current_total}",
                actor_id=user_id,
            ))
            db.session.add(TableEvent(
                table_id=bill.table_id,
                bill_id=bill_id,
                order_id=None,
                event_type="table_closed",
                description=f"Table {table.number if table else bill.table_id} returned to available",
                actor_id=user_id,
            ))
            auto_closed = True

    db.session.commit()

    remaining = round(sum(
        float(p["amount"]) + float(p["tip_amount"])
        for p in new_plan if p.get("status") != "paid"
    ), 2)

    return success_response({
        "auto_closed": auto_closed,
        "split_plan": new_plan,
        "total_paid": total_paid,
        "remaining": remaining,
    })


# ---------------------------------------------------------------------------
# Stripe: create payment intent (credit/debit)
# ---------------------------------------------------------------------------

@payments_bp.post("/stripe/create-intent")
@roles_required("waiter", "manager")
def create_stripe_intent():
    body = request.get_json(silent=True) or {}
    amount_cents = body.get("amount_cents")  # integer, e.g. 1550 for €15.50

    if not amount_cents or int(amount_cents) < 50:
        return error_response("amount_cents must be at least 50.", "VALIDATION_ERROR", 400)

    intent = stripe.PaymentIntent.create(
        amount=int(amount_cents),
        currency="eur",
        payment_method_types=["card"],
    )
    return success_response({"client_secret": intent.client_secret, "payment_intent_id": intent.id})


# ---------------------------------------------------------------------------
# Stripe: create Checkout Session (for QR Code flow)
# ---------------------------------------------------------------------------

@payments_bp.post("/bill/<int:bill_id>/create-checkout-session")
@roles_required("waiter", "manager")
def create_checkout_session(bill_id: int):
    bill = Bill.query.get(bill_id)
    if not bill or bill.status != "open":
        return error_response("Bill not found or not open.", "BILL_NOT_FOUND", 404)

    body = request.get_json(silent=True) or {}
    amount_cents = body.get("amount_cents")

    if not amount_cents or int(amount_cents) < 50:
        return error_response("amount_cents must be at least 50.", "VALIDATION_ERROR", 400)

    # Resolve the frontend base URL: use FRONTEND_URL env var if set,
    # otherwise auto-detect the machine's local IP so a phone on the same
    # WiFi can reach the Vite dev server (localhost won't work on the phone).
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as _s:
            _s.connect(("8.8.8.8", 80))
            local_ip = _s.getsockname()[0]
    except Exception:
        local_ip = "localhost"
    frontend_url = os.environ.get("FRONTEND_URL") or f"http://{local_ip}:5173"

    session = stripe.checkout.Session.create(
        line_items=[{
            "price_data": {
                "currency": "eur",
                "product_data": {"name": f"Order Flow — Bill #{bill_id}"},
                "unit_amount": int(amount_cents),
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=f"{frontend_url}/payment-success",
        cancel_url=f"{frontend_url}/payment-cancelled",
        metadata={"bill_id": str(bill_id)},
    )

    return success_response({
        "session_id": session.id,
        "checkout_url": session.url,
    })


# ---------------------------------------------------------------------------
# Stripe: poll Checkout Session status (for QR Code polling)
# ---------------------------------------------------------------------------

@payments_bp.get("/stripe/session-status/<session_id>")
@roles_required("waiter", "manager")
def get_session_status(session_id: str):
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError as e:
        return error_response(str(e.user_message), "STRIPE_ERROR", 400)

    return success_response({
        "status": session.payment_status,  # "paid" | "unpaid" | "no_payment_required"
        "payment_intent_id": session.payment_intent,
    })


# ---------------------------------------------------------------------------
# Confirm payment and close bill
# ---------------------------------------------------------------------------

@payments_bp.post("/bill/<int:bill_id>/confirm")
@roles_required("waiter", "manager")
def confirm_payment(bill_id: int):
    bill = Bill.query.get(bill_id)
    if not bill or bill.status != "open":
        return error_response("Bill not found or not open.", "BILL_NOT_FOUND", 404)

    # Guard: no active orders allowed
    blocking = Order.query.filter(
        Order.bill_id == bill_id,
        Order.status.in_(["pending", "preparing", "done"]),
    ).count()
    if blocking:
        return error_response(
            "Cannot close bill while orders are pending, preparing, or done.",
            "BILL_HAS_ACTIVE_ORDERS",
            409,
        )

    body = request.get_json(silent=True) or {}
    payments_data = body.get("payments", [])
    split_method = body.get("split_method")
    tip_percent = body.get("tip_percent", 0)

    if not payments_data:
        return error_response("At least one payment entry is required.", "VALIDATION_ERROR", 400)
    if split_method not in ("full", "custom_amount", "split_equally", "by_items"):
        return error_response("Invalid split_method.", "VALIDATION_ERROR", 400)

    # Recalculate subtotal
    orders = Order.query.filter(
        Order.bill_id == bill_id,
        Order.status != "cancelled",
    ).all()
    subtotal = sum(
        float(item.unit_price) * item.quantity
        for order in orders
        for item in order.items
    )
    tip_amount = round(subtotal * float(tip_percent) / 100, 2)
    total = round(subtotal + tip_amount, 2)

    user_id = int(get_jwt_identity())
    now = datetime.now(timezone.utc)

    for p in payments_data:
        method = p.get("method")
        amount = float(p.get("amount", 0))
        p_tip = float(p.get("tip_amount", 0))
        stripe_pi_id = p.get("stripe_payment_intent_id")

        valid_methods = ("credit", "debit", "cash", "tap_to_pay", "qr_code", "card_reader")
        if method not in valid_methods:
            return error_response(f"Invalid payment method: {method}", "VALIDATION_ERROR", 400)

        # For card payments, verify Stripe payment intent is confirmed
        if method in ("credit", "debit"):
            if not stripe_pi_id:
                return error_response("stripe_payment_intent_id is required for card payments.", "VALIDATION_ERROR", 400)
            intent = stripe.PaymentIntent.retrieve(stripe_pi_id)
            if intent.status != "succeeded":
                return error_response("Stripe payment has not succeeded.", "STRIPE_PAYMENT_FAILED", 402)

        payment = Payment(
            bill_id=bill_id,
            method=method,
            amount=amount,
            tip_amount=p_tip,
            stripe_payment_intent_id=stripe_pi_id,
        )
        db.session.add(payment)

    bill.status = "closed"
    bill.split_method = split_method
    bill.tip_percent = float(tip_percent)
    bill.tip_amount = tip_amount
    bill.subtotal = subtotal
    bill.total = total
    bill.closed_at = now

    # Release table
    table = db.session.get(Table, bill.table_id)
    if table:
        table.status = "available"
        table.waiter_id = None
        table.service_started_at = None

    db.session.add(TableEvent(
        table_id=bill.table_id,
        bill_id=bill_id,
        order_id=None,
        event_type="payment_confirmed",
        description=f"Bill #{bill_id} closed — total €{total}",
        actor_id=user_id,
    ))
    db.session.add(TableEvent(
        table_id=bill.table_id,
        bill_id=bill_id,
        order_id=None,
        event_type="table_closed",
        description=f"Table {table.number if table else bill.table_id} returned to available",
        actor_id=user_id,
    ))
    db.session.commit()

    return success_response({
        "bill_id": bill_id,
        "status": "closed",
        "subtotal": subtotal,
        "tip_amount": tip_amount,
        "total": total,
    }, "Payment confirmed. Table is now available.")
