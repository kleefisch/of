from functools import wraps
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from app.utils.response import error_response


def roles_required(*roles: str):
    """Decorator that requires the JWT to carry one of the specified roles."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            if claims.get("role") not in roles:
                return error_response("You do not have permission to perform this action.", "FORBIDDEN", 403)
            return fn(*args, **kwargs)
        return wrapper
    return decorator
