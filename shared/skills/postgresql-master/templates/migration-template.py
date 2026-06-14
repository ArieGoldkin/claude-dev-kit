"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


def upgrade() -> None:
    """
    Upgrade schema changes.

    Examples:
        # Add column
        op.add_column('members', sa.Column('phone', sa.String(20), nullable=True))

        # Add index
        op.create_index('idx_members_email', 'members', ['email'], unique=True, schema='acme_operational')

        # Add foreign key
        op.create_foreign_key('fk_notes_member_id', 'notes', 'members', ['member_id'], ['id'], source_schema='acme_operational', referent_schema='acme_operational')

        # Execute raw SQL
        op.execute("UPDATE members SET status = 'active' WHERE status IS NULL")
    """
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    """
    Downgrade schema changes (reverse of upgrade).

    Examples:
        # Remove column
        op.drop_column('members', 'phone')

        # Remove index
        op.drop_index('idx_members_email', table_name='members', schema='acme_operational')

        # Remove foreign key
        op.drop_constraint('fk_notes_member_id', 'notes', schema='acme_operational', type_='foreignkey')
    """
    ${downgrades if downgrades else "pass"}
