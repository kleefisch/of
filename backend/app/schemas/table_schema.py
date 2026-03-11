from app.extensions import ma
from app.models.table import Table


class TableSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Table
        load_instance = True
        include_fk = True
