"""add_boq_document_validation_fields

Revision ID: a1b2c3d4e5f6
Revises: d0601b1af8a4
Create Date: 2026-07-17 21:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'd0601b1af8a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add validation and preview_only fields to boq_documents."""
    op.add_column('boq_documents', sa.Column('preview_only', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('boq_documents', sa.Column('validation_status', sa.String(), nullable=True))
    op.add_column('boq_documents', sa.Column('validation_score', sa.Float(), nullable=True))
    op.add_column('boq_documents', sa.Column('validation_issues', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Remove validation and preview_only fields from boq_documents."""
    op.drop_column('boq_documents', 'validation_issues')
    op.drop_column('boq_documents', 'validation_score')
    op.drop_column('boq_documents', 'validation_status')
    op.drop_column('boq_documents', 'preview_only')
