import os

from flask import request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.blueprints.push import push_bp
from app.extensions import db
from app.models.push_subscription import PushSubscription
from app.utils.response import success_response, error_response


@push_bp.get("/vapid-public-key")
def get_vapid_public_key():
    key = os.environ.get("VAPID_PUBLIC_KEY", "")
    return success_response({"vapid_public_key": key})


@push_bp.post("/subscribe")
@jwt_required()
def subscribe():
    body = request.get_json(silent=True) or {}
    endpoint = body.get("endpoint", "").strip()
    p256dh = body.get("p256dh", "").strip()
    auth = body.get("auth", "").strip()

    if not endpoint or not p256dh or not auth:
        return error_response("endpoint, p256dh, and auth are required.", "VALIDATION_ERROR", 400)

    user_id = int(get_jwt_identity())

    # Upsert: update if endpoint already exists, else create
    existing = PushSubscription.query.filter_by(endpoint=endpoint).first()
    if existing:
        existing.user_id = user_id
        existing.p256dh = p256dh
        existing.auth = auth
    else:
        db.session.add(PushSubscription(
            user_id=user_id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
        ))

    db.session.commit()
    return success_response({}, "Push subscription saved.", 201)
