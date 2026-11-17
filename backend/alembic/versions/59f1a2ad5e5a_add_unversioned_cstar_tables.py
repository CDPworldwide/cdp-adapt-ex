"""add unversioned cstar tables

Blue/green step 1: create year-less copies of the seven CSTAR_2025_* tables
(e.g. CSTAR_Dim_Central) alongside the originals, with the same columns,
defaults, primary keys and indexes, and copy the 2025 rows across.

The CSTAR_2025_* tables are left untouched, so the app keeps working on them
until CSTAR_TABLE_PREFIX is switched to "CSTAR_". Switching back is just
resetting that setting. The old tables get dropped in a later migration
once the new ones are trusted.

Revision ID: 59f1a2ad5e5a
Revises: 7e96002e433d
Create Date: 2026-11-17 11:21:13.437487

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "59f1a2ad5e5a"
down_revision: Union[str, Sequence[str], None] = "7e96002e433d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = [
    "Dim_Central",
    "Fact_Hazard",
    "Fact_Goal",
    "Fact_Action",
    "Fact_Funding_Gap",
    "Peer_Solutions",
    "Solution_Examples",
]
OLD_PREFIX = "CSTAR_2025_"

def upgrade() -> None:
    """Create the year-less tables and copy the 2025 data into them."""
    for table in TABLES:
        old, new = f"{OLD_PREFIX}{table}", f"{table}"
        # INCLUDING ALL copies column types, defaults, NOT NULLs, the primary
        # key and the indexes (incl. the PostGIS geometry indexes on Dim).
        op.execute(f'CREATE TABLE "{new}" (LIKE "{old}" INCLUDING ALL)')
        op.execute(f'INSERT INTO "{new}" SELECT * FROM "{old}"')
        op.execute(f'ANALYZE "{new}"')


def downgrade() -> None:
    """Drop the year-less tables. The CSTAR_2025_* tables are unaffected."""
    for table in reversed(TABLES):
        op.execute(f'DROP TABLE IF EXISTS "{table}"')
