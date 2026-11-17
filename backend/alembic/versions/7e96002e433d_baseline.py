"""baseline

Revision ID: 7e96002e433d
Revises: 
Create Date: 2026-11-17 11:13:34.869908

"""
from typing import Sequence, Union
import geoalchemy2
import sqlmodel
import app.models.location_details

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7e96002e433d'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
