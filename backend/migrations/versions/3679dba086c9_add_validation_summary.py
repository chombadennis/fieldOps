"""add_validation_summary

Revision ID: 3679dba086c9
Revises: a1b2c3d4e5f6
Create Date: 2026-07-18 11:02:55.891044

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3679dba086c9'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('boq_documents', sa.Column('validation_summary', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('boq_documents', 'validation_summary')
