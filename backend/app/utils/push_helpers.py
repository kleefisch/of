import json
import logging
import os

from pywebpush import webpush, WebPushException

from app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)

_VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
_VAPID_CLAIMS = {"sub": os.environ.get("VAPID_MAILTO", "mailto:admin@orderflow.app")}


def send_push_to_user(user_id: int, title: str, body: str) -> None:
    """Send a Web Push notification to all registered devices for a user."""
    if not _VAPID_PRIVATE_KEY:
        return

    subscriptions = PushSubscription.query.filter_by(user_id=user_id).all()
    stale: list[int] = []

    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=json.dumps({"title": title, "body": body}),
                vapid_private_key=_VAPID_PRIVATE_KEY,
                vapid_claims=_VAPID_CLAIMS,
            )
        except WebPushException as exc:
            if exc.response is not None and exc.response.status_code in (404, 410):
                # Subscription has expired or been removed on the browser side
                stale.append(sub.id)
            else:
                logger.warning("Web push failed for subscription %s: %s", sub.id, exc)
        except Exception as exc:
            logger.warning("Web push error for subscription %s: %s", sub.id, exc)

    if stale:
        from app.extensions import db  # avoid circular at module level
        PushSubscription.query.filter(PushSubscription.id.in_(stale)).delete(synchronize_session=False)
        db.session.commit()


def send_push_to_role(role: str, title: str, body: str) -> None:
    """Send a Web Push notification to all users with a given role."""
    from app.models.user import User  # avoid circular at module level
    users = User.query.filter_by(role=role, is_active=True).all()
    for user in users:
        send_push_to_user(user.id, title, body)
