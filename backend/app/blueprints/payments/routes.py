import os
from datetime import datetime, timezone

import stripe
from flask import request
from flask_jwt_extended import get_jwt_identity

from app.blueprints.payments import payments_bp
from app.extensions import db
from app.models.bill import Bill
from app.models.order import Order
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

    orders = Order.query.filter_by(bill_id=bill_id).all()
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
    orders = Order.query.filter_by(bill_id=bill_id).all()
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

        if method not in ("credit", "debit", "cash"):
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
