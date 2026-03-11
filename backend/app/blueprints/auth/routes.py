from flask import request
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt

from app.blueprints.auth import auth_bp
from app.extensions import db, bcrypt
from app.models.user import User
from app.utils.response import success_response, error_response


@auth_bp.post("/login")
def login():
    body = request.get_json(silent=True) or {}
    username = body.get("username", "").strip()
    password = body.get("password", "")

    if not username or not password:
        return error_response("Username and password are required.", "VALIDATION_ERROR", 400)

    user = User.query.filter_by(username=username, is_active=True).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return error_response("Invalid credentials.", "INVALID_CREDENTIALS", 401)

    additional_claims = {"display_name": user.display_name, "role": user.role}
    token = create_access_token(identity=str(user.id), additional_claims=additional_claims)

    return success_response(
        {"access_token": token, "user": {"id": user.id, "display_name": user.display_name, "role": user.role}},
        "Login successful",
    )


@auth_bp.get("/me")
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    user = db.session.get(User, user_id)
    if not user or not user.is_active:
        return error_response("User not found.", "USER_NOT_FOUND", 404)
    return success_response(
        {"id": user.id, "display_name": claims.get("display_name"), "role": claims.get("role")}
    )
