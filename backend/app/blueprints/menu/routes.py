from flask import request
from flask_jwt_extended import jwt_required

from app.blueprints.menu import menu_bp
from app.extensions import db
from app.models.menu_category import MenuCategory
from app.models.menu_item import MenuItem
from app.utils.response import success_response, error_response
from app.utils.auth_helpers import roles_required


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

@menu_bp.get("/categories")
@jwt_required()
def list_categories():
    categories = MenuCategory.query.filter_by(is_active=True).order_by(MenuCategory.name).all()
    return success_response([
        {"id": c.id, "name": c.name, "is_active": c.is_active}
        for c in categories
    ])


@menu_bp.post("/categories")
@roles_required("manager")
def create_category():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return error_response("Name is required.", "VALIDATION_ERROR", 400)

    if MenuCategory.query.filter_by(name=name).first():
        return error_response("A category with this name already exists.", "CATEGORY_DUPLICATE", 409)

    category = MenuCategory(name=name)
    db.session.add(category)
    db.session.commit()
    return success_response({"id": category.id, "name": category.name, "is_active": category.is_active}, "Category created.", 201)


@menu_bp.patch("/categories/<int:category_id>")
@roles_required("manager")
def update_category(category_id: int):
    category = db.session.get(MenuCategory, category_id)
    if not category:
        return error_response("Category not found.", "CATEGORY_NOT_FOUND", 404)

    body = request.get_json(silent=True) or {}

    if "name" in body:
        name = (body["name"] or "").strip()
        if not name:
            return error_response("Name cannot be empty.", "VALIDATION_ERROR", 400)
        duplicate = MenuCategory.query.filter(MenuCategory.name == name, MenuCategory.id != category_id).first()
        if duplicate:
            return error_response("A category with this name already exists.", "CATEGORY_DUPLICATE", 409)
        category.name = name

    if "is_active" in body:
        category.is_active = bool(body["is_active"])

    db.session.commit()
    return success_response({"id": category.id, "name": category.name, "is_active": category.is_active}, "Category updated.")


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------

@menu_bp.get("/items")
@jwt_required()
def list_items():
    query = MenuItem.query.filter_by(is_active=True)

    category_id = request.args.get("category_id", type=int)
    if category_id:
        query = query.filter_by(category_id=category_id)

    search = (request.args.get("search") or "").strip()
    if search:
        like = f"%{search}%"
        query = query.filter(
            db.or_(MenuItem.name.ilike(like), MenuItem.description.ilike(like))
        )

    available_only = request.args.get("available") == "true"
    if available_only:
        query = query.filter_by(is_available=True)

    items = query.order_by(MenuItem.name).all()
    return success_response([_item_dict(i) for i in items])


@menu_bp.get("/items/<int:item_id>")
@jwt_required()
def get_item(item_id: int):
    item = db.session.get(MenuItem, item_id)
    if not item or not item.is_active:
        return error_response("Item not found.", "ITEM_NOT_FOUND", 404)
    return success_response(_item_dict(item))


@menu_bp.post("/items")
@roles_required("manager")
def create_item():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    price = body.get("price")
    category_id = body.get("category_id")

    if not name:
        return error_response("Name is required.", "VALIDATION_ERROR", 400)
    if price is None or float(price) < 0:
        return error_response("A valid price is required.", "VALIDATION_ERROR", 400)
    if not category_id:
        return error_response("category_id is required.", "VALIDATION_ERROR", 400)

    category = db.session.get(MenuCategory, category_id)
    if not category or not category.is_active:
        return error_response("Category not found.", "CATEGORY_NOT_FOUND", 404)

    item = MenuItem(
        name=name,
        description=(body.get("description") or "").strip() or None,
        price=float(price),
        image_url=(body.get("image_url") or "").strip() or None,
        category_id=category_id,
        is_available=bool(body.get("is_available", True)),
    )
    db.session.add(item)
    db.session.commit()
    return success_response(_item_dict(item), "Item created.", 201)


@menu_bp.patch("/items/<int:item_id>")
@roles_required("manager")
def update_item(item_id: int):
    item = db.session.get(MenuItem, item_id)
    if not item or not item.is_active:
        return error_response("Item not found.", "ITEM_NOT_FOUND", 404)

    body = request.get_json(silent=True) or {}

    if "name" in body:
        name = (body["name"] or "").strip()
        if not name:
            return error_response("Name cannot be empty.", "VALIDATION_ERROR", 400)
        item.name = name

    if "description" in body:
        item.description = (body["description"] or "").strip() or None

    if "price" in body:
        price = body["price"]
        if price is None or float(price) < 0:
            return error_response("A valid price is required.", "VALIDATION_ERROR", 400)
        item.price = float(price)

    if "image_url" in body:
        item.image_url = (body["image_url"] or "").strip() or None

    if "category_id" in body:
        category = db.session.get(MenuCategory, body["category_id"])
        if not category or not category.is_active:
            return error_response("Category not found.", "CATEGORY_NOT_FOUND", 404)
        item.category_id = body["category_id"]

    if "is_available" in body:
        item.is_available = bool(body["is_available"])

    if "is_active" in body:
        item.is_active = bool(body["is_active"])

    db.session.commit()
    return success_response(_item_dict(item), "Item updated.")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _item_dict(item: MenuItem) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "description": item.description,
        "price": float(item.price),
        "image_url": item.image_url,
        "category_id": item.category_id,
        "is_available": item.is_available,
        "is_active": item.is_active,
    }
