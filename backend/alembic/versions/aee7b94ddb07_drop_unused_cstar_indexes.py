"""drop unused cstar indexes

cdp-test's CSTAR_2025_* tables had 9 indexes added by hand (never in prod or
this repo), and the previous migration's LIKE ... INCLUDING ALL copied them
onto the year-less tables there. No query needs them: the tables are a few
thousand rows and every lookup is by org number (covered by the primary key).
Dropping them makes cdp-test match prod and freshly created databases.

IF EXISTS makes this a no-op everywhere except cdp-test.

Revision ID: aee7b94ddb07
Revises: 59f1a2ad5e5a
Create Date: 2026-11-20 13:35:11.242054

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "aee7b94ddb07"
down_revision: Union[str, Sequence[str], None] = "59f1a2ad5e5a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UNUSED_INDEXES = [
    "Dim_Central_has_geometry_idx",
    "Dim_Central_lower_idx",
    "Dim_Central_lower_idx1",  # trigram, organisation name
    "Dim_Central_lower_idx2",  # trigram, country
    "Dim_Central_public_status_idx",
    "Fact_Action_public_status_idx",
    "Fact_Funding_Gap_public_status_idx",
    "Fact_Goal_public_status_idx",
    "Fact_Hazard_public_status_idx",
]


def upgrade() -> None:
    """Drop the hand-added indexes from the year-less tables, if present."""
    for index in UNUSED_INDEXES:
        op.execute(f'DROP INDEX IF EXISTS "{index}"')


def downgrade() -> None:
    """Nothing to do: these indexes were never part of the intended schema."""
