"""Configuración central del sistema HR Operations."""
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "hr_ops.db")
UPLOADS_DIR = os.path.join(BASE_DIR, "data", "cartas")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

# Asegurar que existan los directorios de datos
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH}"
