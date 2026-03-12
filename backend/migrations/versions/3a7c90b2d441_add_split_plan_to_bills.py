"""add split_plan to bills

Revision ID: 3a7c90b2d441
Revises: f5b81a1588da
Create Date: 2026-03-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '3a7c90b2d441'
down_revision = 'f5b81a1588da'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('bills', sa.Column('split_plan', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('bills', 'split_plan')
