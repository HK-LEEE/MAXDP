"""Create MAXDP workspace tables

Revision ID: 20250621_0130
Revises: 
Create Date: 2025-06-21 01:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20250621_0130'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum type for owner_type
    op.execute("CREATE TYPE ownertype AS ENUM ('user', 'group')")
    
    # Create maxdp_workspaces table
    op.create_table('maxdp_workspaces',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False, comment='워크스페이스 이름'),
        sa.Column('description', sa.Text(), nullable=True, comment='워크스페이스 설명'),
        sa.Column('owner_type', sa.Enum('user', 'group', name='ownertype'), nullable=False, comment='소유자 타입: user 또는 group'),
        sa.Column('owner_user_id', postgresql.UUID(as_uuid=True), nullable=True, comment='사용자 소유자 ID'),
        sa.Column('owner_group_id', sa.Integer(), nullable=True, comment='그룹 소유자 ID'),
        sa.Column('is_active', sa.Boolean(), nullable=True, comment='워크스페이스 활성화 상태'),
        sa.Column('is_public', sa.Boolean(), nullable=True, comment='공개 워크스페이스 여부'),
        sa.Column('settings', sa.Text(), nullable=True, comment='워크스페이스 설정 (JSON)'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False, comment='생성자 ID'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['owner_group_id'], ['groups.id'], ),
        sa.ForeignKeyConstraint(['owner_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_maxdp_workspaces_id'), 'maxdp_workspaces', ['id'], unique=False)

    # Create maxdp_workspace_permissions table
    op.create_table('maxdp_workspace_permissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workspace_id', sa.Integer(), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('can_read', sa.Boolean(), nullable=True, comment='읽기 권한'),
        sa.Column('can_write', sa.Boolean(), nullable=True, comment='쓰기 권한'),
        sa.Column('can_execute', sa.Boolean(), nullable=True, comment='실행 권한'),
        sa.Column('can_admin', sa.Boolean(), nullable=True, comment='관리 권한'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['workspace_id'], ['maxdp_workspaces.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_maxdp_workspace_permissions_id'), 'maxdp_workspace_permissions', ['id'], unique=False)

    # Create maxdp_workspace_activities table
    op.create_table('maxdp_workspace_activities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workspace_id', sa.Integer(), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('action', sa.String(length=100), nullable=False, comment='수행된 작업'),
        sa.Column('description', sa.Text(), nullable=True, comment='작업 설명'),
        sa.Column('activity_metadata', sa.Text(), nullable=True, comment='추가 메타데이터 (JSON)'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['workspace_id'], ['maxdp_workspaces.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_maxdp_workspace_activities_id'), 'maxdp_workspace_activities', ['id'], unique=False)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index(op.f('ix_maxdp_workspace_activities_id'), table_name='maxdp_workspace_activities')
    op.drop_table('maxdp_workspace_activities')
    
    op.drop_index(op.f('ix_maxdp_workspace_permissions_id'), table_name='maxdp_workspace_permissions')
    op.drop_table('maxdp_workspace_permissions')
    
    op.drop_index(op.f('ix_maxdp_workspaces_id'), table_name='maxdp_workspaces')
    op.drop_table('maxdp_workspaces')
    
    # Drop enum type
    op.execute("DROP TYPE IF EXISTS ownertype")