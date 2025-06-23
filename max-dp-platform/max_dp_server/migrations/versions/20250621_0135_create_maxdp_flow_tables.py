"""Create MAXDP flow tables

Revision ID: 20250621_0135
Revises: 20250621_0130
Create Date: 2025-06-21 01:35:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20250621_0135'
down_revision = '20250621_0130'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum types for flow management
    op.execute("CREATE TYPE flowstatus AS ENUM ('draft', 'active', 'inactive', 'archived')")
    op.execute("CREATE TYPE executionstatus AS ENUM ('pending', 'running', 'success', 'failed', 'cancelled')")
    
    # Create maxdp_flows table
    op.create_table('maxdp_flows',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False, comment='Flow 이름'),
        sa.Column('description', sa.Text(), nullable=True, comment='Flow 설명'),
        sa.Column('workspace_id', sa.Integer(), nullable=False, comment='소속 워크스페이스 ID'),
        sa.Column('owner_type', sa.Enum('user', 'group', name='ownertype'), nullable=False, comment='소유자 타입: user 또는 group'),
        sa.Column('owner_user_id', postgresql.UUID(as_uuid=True), nullable=True, comment='사용자 소유자 ID'),
        sa.Column('owner_group_id', sa.Integer(), nullable=True, comment='그룹 소유자 ID'),
        sa.Column('status', sa.Enum('draft', 'active', 'inactive', 'archived', name='flowstatus'), nullable=True, comment='Flow 상태'),
        sa.Column('is_public', sa.Boolean(), nullable=True, comment='공개 Flow 여부'),
        sa.Column('tags', sa.JSON(), nullable=True, comment='Flow 태그 (JSON 배열)'),
        sa.Column('current_version', sa.Integer(), nullable=True, comment='현재 활성 버전'),
        sa.Column('latest_version', sa.Integer(), nullable=True, comment='최신 버전 번호'),
        sa.Column('is_scheduled', sa.Boolean(), nullable=True, comment='스케줄 실행 여부'),
        sa.Column('schedule_config', sa.JSON(), nullable=True, comment='스케줄 설정 (JSON)'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False, comment='생성자 ID'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['owner_group_id'], ['groups.id'], ),
        sa.ForeignKeyConstraint(['owner_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['workspace_id'], ['maxdp_workspaces.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_maxdp_flows_id'), 'maxdp_flows', ['id'], unique=False)

    # Create maxdp_flow_versions table
    op.create_table('maxdp_flow_versions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('flow_id', sa.Integer(), nullable=False, comment='Flow ID'),
        sa.Column('version_number', sa.Integer(), nullable=False, comment='버전 번호'),
        sa.Column('version_name', sa.String(length=100), nullable=True, comment='버전 이름'),
        sa.Column('description', sa.Text(), nullable=True, comment='버전 설명'),
        sa.Column('changelog', sa.Text(), nullable=True, comment='변경사항'),
        sa.Column('flow_definition', sa.JSON(), nullable=False, comment='Flow 정의 (JSON)'),
        sa.Column('components', sa.JSON(), nullable=True, comment='사용된 컴포넌트 목록 (JSON)'),
        sa.Column('is_active', sa.Boolean(), nullable=True, comment='활성 버전 여부'),
        sa.Column('is_published', sa.Boolean(), nullable=True, comment='발행된 버전 여부'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False, comment='생성자 ID'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['flow_id'], ['maxdp_flows.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_maxdp_flow_versions_id'), 'maxdp_flow_versions', ['id'], unique=False)

    # Create maxdp_flow_executions table
    op.create_table('maxdp_flow_executions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('flow_id', sa.Integer(), nullable=False, comment='Flow ID'),
        sa.Column('version_id', sa.Integer(), nullable=True, comment='버전 ID'),
        sa.Column('status', sa.Enum('pending', 'running', 'success', 'failed', 'cancelled', name='executionstatus'), nullable=True, comment='실행 상태'),
        sa.Column('execution_id', sa.String(length=100), nullable=False, comment='실행 고유 ID'),
        sa.Column('trigger_type', sa.String(length=50), nullable=False, comment='실행 트리거 타입 (manual, schedule, api)'),
        sa.Column('trigger_user_id', postgresql.UUID(as_uuid=True), nullable=True, comment='실행 트리거 사용자 ID'),
        sa.Column('start_time', sa.DateTime(), nullable=True, comment='실행 시작 시간'),
        sa.Column('end_time', sa.DateTime(), nullable=True, comment='실행 종료 시간'),
        sa.Column('duration_seconds', sa.Integer(), nullable=True, comment='실행 시간 (초)'),
        sa.Column('logs', sa.Text(), nullable=True, comment='실행 로그'),
        sa.Column('error_message', sa.Text(), nullable=True, comment='에러 메시지'),
        sa.Column('result_data', sa.JSON(), nullable=True, comment='실행 결과 데이터 (JSON)'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['flow_id'], ['maxdp_flows.id'], ),
        sa.ForeignKeyConstraint(['trigger_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['version_id'], ['maxdp_flow_versions.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('execution_id')
    )
    op.create_index(op.f('ix_maxdp_flow_executions_id'), 'maxdp_flow_executions', ['id'], unique=False)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index(op.f('ix_maxdp_flow_executions_id'), table_name='maxdp_flow_executions')
    op.drop_table('maxdp_flow_executions')
    
    op.drop_index(op.f('ix_maxdp_flow_versions_id'), table_name='maxdp_flow_versions')
    op.drop_table('maxdp_flow_versions')
    
    op.drop_index(op.f('ix_maxdp_flows_id'), table_name='maxdp_flows')
    op.drop_table('maxdp_flows')
    
    # Drop enum types
    op.execute("DROP TYPE IF EXISTS executionstatus")
    op.execute("DROP TYPE IF EXISTS flowstatus")