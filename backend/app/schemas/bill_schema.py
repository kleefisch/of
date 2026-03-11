from app.extensions import ma
from app.models.bill import Bill


class BillSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Bill
        load_instance = True
        include_fk = True
