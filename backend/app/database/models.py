"""SQLAlchemy database models."""

from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import uuid

from app.database.database import Base


class User(Base):
    """User model."""

    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    devices = relationship("Device", back_populates="user", cascade="all, delete-orphan")
    inference_sessions = relationship("InferenceSession", back_populates="user", cascade="all, delete-orphan")


class Session(Base):
    """User session model."""

    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    token_id = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="sessions")


class Device(Base):
    """Connected device model."""

    __tablename__ = "devices"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id = Column(String(255), unique=True, nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    device_type = Column(String(50), nullable=False)  # mobile, camera, pi, sensor, bluetooth
    connection_type = Column(String(50), nullable=False)  # wifi, bluetooth, usb, local
    status = Column(String(50), default="offline")  # online, offline, error
    ip_address = Column(String(45), nullable=True)
    mac_address = Column(String(17), nullable=True)
    last_seen = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="devices")
    camera_sources = relationship("CameraSource", back_populates="device", cascade="all, delete-orphan")
    device_events = relationship("DeviceEvent", back_populates="device", cascade="all, delete-orphan")
    inference_sessions = relationship("InferenceSession", back_populates="device")
    bluetooth_devices = relationship("BluetoothDevice", back_populates="device", cascade="all, delete-orphan")
    wifi_devices = relationship("WiFiDevice", back_populates="device", cascade="all, delete-orphan")


class CameraSource(Base):
    """Camera source model."""

    __tablename__ = "camera_sources"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id = Column(String(36), ForeignKey("devices.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    source_type = Column(String(50), nullable=False)  # local, usb, rtsp, http
    resolution = Column(String(20), nullable=True)  # e.g., 1920x1080
    fps = Column(Integer, default=30)
    status = Column(String(50), default="disconnected")  # connected, disconnected, error
    access_state = Column(String(20), default="idle")    # idle, pending, approved, denied
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    device = relationship("Device", back_populates="camera_sources")
    inference_sessions = relationship("InferenceSession", back_populates="camera_source")


class Model(Base):
    """AI model model."""

    __tablename__ = "models"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    version = Column(String(50), nullable=False)
    file_name = Column(String(255), nullable=False, unique=True)
    framework = Column(String(50), nullable=False)  # Ultralytics, TensorFlow, etc.
    task = Column(String(50), nullable=False)  # object_detection, segmentation, etc.
    class_count = Column(Integer, default=80)
    status = Column(String(50), default="available")  # available, loading, error
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    model_configs = relationship("ModelConfig", back_populates="model", cascade="all, delete-orphan")
    inference_sessions = relationship("InferenceSession", back_populates="model")


class ModelConfig(Base):
    """Model inference configuration."""

    __tablename__ = "model_configs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    model_id = Column(String(36), ForeignKey("models.id"), nullable=False, index=True)
    confidence_threshold = Column(Float, default=0.50)
    iou_threshold = Column(Float, default=0.45)
    image_size = Column(Integer, default=640)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    model = relationship("Model", back_populates="model_configs")


class InferenceSession(Base):
    """Model inference session."""

    __tablename__ = "inference_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    device_id = Column(String(36), ForeignKey("devices.id"), nullable=True, index=True)
    camera_source_id = Column(String(36), ForeignKey("camera_sources.id"), nullable=True)
    model_id = Column(String(36), ForeignKey("models.id"), nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
    average_fps = Column(Float, nullable=True)
    average_latency_ms = Column(Float, nullable=True)
    frames_processed = Column(Integer, default=0)
    frames_dropped = Column(Integer, default=0)

    # Relationships
    user = relationship("User", back_populates="inference_sessions")
    device = relationship("Device", back_populates="inference_sessions")
    camera_source = relationship("CameraSource", back_populates="inference_sessions")
    model = relationship("Model", back_populates="inference_sessions")
    detection_events = relationship("DetectionEvent", back_populates="inference_session", cascade="all, delete-orphan")


class DetectionEvent(Base):
    """Detection event model."""

    __tablename__ = "detection_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    inference_session_id = Column(String(36), ForeignKey("inference_sessions.id"), nullable=False, index=True)
    class_id = Column(Integer, nullable=False)
    class_name = Column(String(255), nullable=False)
    confidence = Column(Float, nullable=False)
    x1 = Column(Float, nullable=False)
    y1 = Column(Float, nullable=False)
    x2 = Column(Float, nullable=False)
    y2 = Column(Float, nullable=False)
    tracking_id = Column(Integer, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    inference_session = relationship("InferenceSession", back_populates="detection_events")


class DeviceEvent(Base):
    """Device event model."""

    __tablename__ = "device_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id = Column(String(36), ForeignKey("devices.id"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)  # CONNECTED, DISCONNECTED, ERROR, etc.
    message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    device = relationship("Device", back_populates="device_events")


class BluetoothDevice(Base):
    """Paired Bluetooth device."""

    __tablename__ = "bluetooth_devices"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id = Column(String(36), ForeignKey("devices.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    address = Column(String(17), unique=True, nullable=False, index=True)
    device_type = Column(String(50), nullable=False)  # sensor, speaker, etc.
    status = Column(String(50), default="disconnected")  # connected, disconnected, error
    signal_strength = Column(Integer, nullable=True)  # RSSI in dBm
    last_seen = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    device = relationship("Device", back_populates="bluetooth_devices")


class WiFiDevice(Base):
    """Wi-Fi connected device."""

    __tablename__ = "wifi_devices"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id = Column(String(36), ForeignKey("devices.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    ip_address = Column(String(45), unique=True, nullable=False, index=True)
    port = Column(Integer, default=8000)
    device_type = Column(String(50), nullable=False)  # pi, camera, etc.
    status = Column(String(50), default="offline")  # online, offline, error
    last_seen = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    device = relationship("Device", back_populates="wifi_devices")
