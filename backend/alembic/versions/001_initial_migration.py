"""Initial migration: create all tables

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create all tables."""
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Create sessions table
    op.create_table(
        'sessions',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('token_id', sa.String(255), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token_id'),
    )
    op.create_index(op.f('ix_sessions_token_id'), 'sessions', ['token_id'], unique=True)
    op.create_index(op.f('ix_sessions_user_id'), 'sessions', ['user_id'])

    # Create devices table
    op.create_table(
        'devices',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('device_id', sa.String(255), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('device_type', sa.String(50), nullable=False),
        sa.Column('connection_type', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='offline'),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('mac_address', sa.String(17), nullable=True),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('device_id'),
    )
    op.create_index(op.f('ix_devices_device_id'), 'devices', ['device_id'], unique=True)
    op.create_index(op.f('ix_devices_user_id'), 'devices', ['user_id'])

    # Create camera_sources table
    op.create_table(
        'camera_sources',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('device_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('source_type', sa.String(50), nullable=False),
        sa.Column('resolution', sa.String(20), nullable=True),
        sa.Column('fps', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('status', sa.String(50), nullable=False, server_default='disconnected'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_camera_sources_device_id'), 'camera_sources', ['device_id'])

    # Create models table
    op.create_table(
        'models',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('version', sa.String(50), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('framework', sa.String(50), nullable=False),
        sa.Column('task', sa.String(50), nullable=False),
        sa.Column('class_count', sa.Integer(), nullable=False, server_default='80'),
        sa.Column('status', sa.String(50), nullable=False, server_default='available'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('file_name'),
    )

    # Create model_configs table
    op.create_table(
        'model_configs',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('model_id', sa.String(36), nullable=False),
        sa.Column('confidence_threshold', sa.Float(), nullable=False, server_default='0.5'),
        sa.Column('iou_threshold', sa.Float(), nullable=False, server_default='0.45'),
        sa.Column('image_size', sa.Integer(), nullable=False, server_default='640'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['model_id'], ['models.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_model_configs_model_id'), 'model_configs', ['model_id'])

    # Create inference_sessions table
    op.create_table(
        'inference_sessions',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('device_id', sa.String(36), nullable=True),
        sa.Column('camera_source_id', sa.String(36), nullable=True),
        sa.Column('model_id', sa.String(36), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('average_fps', sa.Float(), nullable=True),
        sa.Column('average_latency_ms', sa.Float(), nullable=True),
        sa.Column('frames_processed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('frames_dropped', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['camera_source_id'], ['camera_sources.id'], ),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ),
        sa.ForeignKeyConstraint(['model_id'], ['models.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_inference_sessions_model_id'), 'inference_sessions', ['model_id'])
    op.create_index(op.f('ix_inference_sessions_user_id'), 'inference_sessions', ['user_id'])

    # Create detection_events table
    op.create_table(
        'detection_events',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('inference_session_id', sa.String(36), nullable=False),
        sa.Column('class_id', sa.Integer(), nullable=False),
        sa.Column('class_name', sa.String(255), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('x1', sa.Float(), nullable=False),
        sa.Column('y1', sa.Float(), nullable=False),
        sa.Column('x2', sa.Float(), nullable=False),
        sa.Column('y2', sa.Float(), nullable=False),
        sa.Column('tracking_id', sa.Integer(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['inference_session_id'], ['inference_sessions.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_detection_events_inference_session_id'), 'detection_events', ['inference_session_id'])

    # Create device_events table
    op.create_table(
        'device_events',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('device_id', sa.String(36), nullable=False),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_device_events_device_id'), 'device_events', ['device_id'])

    # Create bluetooth_devices table
    op.create_table(
        'bluetooth_devices',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('device_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('address', sa.String(17), nullable=False),
        sa.Column('device_type', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='disconnected'),
        sa.Column('signal_strength', sa.Integer(), nullable=True),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('address'),
    )
    op.create_index(op.f('ix_bluetooth_devices_address'), 'bluetooth_devices', ['address'], unique=True)
    op.create_index(op.f('ix_bluetooth_devices_device_id'), 'bluetooth_devices', ['device_id'])

    # Create wifi_devices table
    op.create_table(
        'wifi_devices',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('device_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=False),
        sa.Column('port', sa.Integer(), nullable=False, server_default='8000'),
        sa.Column('device_type', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='offline'),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ip_address'),
    )
    op.create_index(op.f('ix_wifi_devices_ip_address'), 'wifi_devices', ['ip_address'], unique=True)
    op.create_index(op.f('ix_wifi_devices_device_id'), 'wifi_devices', ['device_id'])


def downgrade() -> None:
    """Drop all tables."""
    op.drop_table('wifi_devices')
    op.drop_table('bluetooth_devices')
    op.drop_table('device_events')
    op.drop_table('detection_events')
    op.drop_table('inference_sessions')
    op.drop_table('model_configs')
    op.drop_table('models')
    op.drop_table('camera_sources')
    op.drop_table('devices')
    op.drop_table('sessions')
    op.drop_table('users')
