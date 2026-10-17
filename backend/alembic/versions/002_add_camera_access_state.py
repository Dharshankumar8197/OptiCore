"""Add access_state column to camera_sources

Revision ID: 002
Revises: 001
Create Date: 2024-01-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add access_state column to camera_sources."""
    op.add_column(
        'camera_sources',
        sa.Column('access_state', sa.String(20), nullable=False, server_default='idle')
    )


def downgrade() -> None:
    """Remove access_state column from camera_sources."""
    op.drop_column('camera_sources', 'access_state')
