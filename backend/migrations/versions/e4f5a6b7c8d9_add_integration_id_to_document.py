"""add_integration_id_to_document

Revision ID: e4f5a6b7c8d9
Revises: 12af688cbc64
Create Date: 2026-07-20 12:13:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, Sequence[str], None] = '12af688cbc64'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Check if column already exists before attempting op.add_column
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('documents')]
    if 'integration_id' not in columns:
        op.add_column('documents', sa.Column('integration_id', sa.Integer(), sa.ForeignKey('project_integrations.id', ondelete='SET NULL'), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('documents', 'integration_id')
