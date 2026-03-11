from app.extensions import ma
from app.models.menu_category import MenuCategory
from app.models.menu_item import MenuItem


class MenuCategorySchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = MenuCategory
        load_instance = True


class MenuItemSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = MenuItem
        load_instance = True
        include_fk = True
