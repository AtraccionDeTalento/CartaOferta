"""
Modelos SQLAlchemy — Esquema completo basado en los Excel operativos reales.
Replica fielmente las columnas de:
  - SOLICITUD DE CARTAS OFERTA (hoja 'Mar-A la fecha')
  - Estatus Cambios Organizacionales (hoja 'CONSOLIDADO TOTAL')
"""
from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime, Text, Boolean, ForeignKey,
)
from sqlalchemy.orm import relationship
from backend.database import Base


# ─────────────────────────────────────────────
# CATÁLOGOS (Tablas maestras)
# ─────────────────────────────────────────────

class UnidadNegocio(Base):
    __tablename__ = "unidades_negocio"
    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(50), unique=True, nullable=False)  # USIL, CSIR, IE, EPG


class Categoria(Base):
    """ACADEMICOS, ADMINISTRATIVOS, OTROS ACADEMICOS"""
    __tablename__ = "categorias"
    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), unique=True, nullable=False)


class CategoriaTrabajador(Base):
    """DIRECCION, CONFIANZA - NO SUJETO A FISCALIZACION, etc."""
    __tablename__ = "categorias_trabajador"
    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(200), unique=True, nullable=False)


class TipoDocumento(Base):
    """Catálogo de tipos de documento de movimiento."""
    __tablename__ = "tipos_documento"
    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(200), nullable=False)
    subtipo = Column(String(200), nullable=True)  # e.g. "Cambio de area" para "Carta de Movimiento"


class Puesto(Base):
    """Catálogo de puestos (según ADRYAN)."""
    __tablename__ = "puestos"
    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(300), nullable=False)
    codigo_ceco = Column(String(50), nullable=True)
    activo = Column(Boolean, default=True)


class Sede(Base):
    __tablename__ = "sedes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(200), unique=True, nullable=False)


# ─────────────────────────────────────────────
# OPERACIONALES — Solicitudes de Ingreso
# ─────────────────────────────────────────────

class SolicitudIngreso(Base):
    """
    Tabla principal operativa — replica las columnas del Excel
    'SOLICITUD DE CARTAS OFERTA_PROYECTO.xlsx' → hoja 'Mar-A la fecha'.
    """
    __tablename__ = "solicitudes_ingreso"

    id = Column(Integer, primary_key=True, autoincrement=True)
    correlativo = Column(Integer, nullable=True)

    # Identificación
    unidad = Column(String(50), nullable=False)  # USIL, CSIR, IE, EPG
    fecha_solicitud = Column(Date, nullable=True)
    fecha_tentativa_ingreso = Column(Date, nullable=True)
    modalidad = Column(String(50), nullable=True)  # PRESENCIAL, FULL TIME, PART TIME
    genero = Column(String(20), nullable=True)  # MASCULINO, FEMENINO
    dni = Column(String(20), nullable=True)
    nombres_apellidos = Column(String(300), nullable=False)

    # Puesto
    puesto_nuevo = Column(String(10), nullable=True)  # SI/NO
    puesto = Column(String(300), nullable=True)  # Nombre del puesto según ADRYAN
    codigo_cr = Column(String(50), nullable=True)  # Código CECO/CR
    puesto_jefe_directo = Column(String(300), nullable=True)
    nombre_jefe_directo = Column(String(300), nullable=True)

    # Compensación
    salario = Column(Float, nullable=True)
    salario_letras = Column(String(500), nullable=True)
    categoria = Column(String(100), nullable=True)  # ADMINISTRATIVOS, ACADEMICOS
    motivo_contrato = Column(String(100), nullable=True)

    # Contrato
    tiempo_contrato = Column(String(50), nullable=True)  # "6 meses", etc.
    fecha_termino_contrato = Column(Date, nullable=True)
    modalidad_trabajo = Column(String(50), nullable=True)  # Presencial, Híbrido
    categoria_trabajador = Column(String(200), nullable=True)  # Sujeto a Fiscalización
    condicion_categoria = Column(String(200), nullable=True)  # FISCALIZABLE / NO FISCALIZABLE

    # Tipo de ingreso
    tipo_ingreso = Column(String(100), nullable=True)
    # Reemplazo / Ingreso sin Reemplazo / Ingreso Temporal / Ingreso Puesto Nuevo / Ingreso por Reemplazo Licencia

    # Datos del reemplazo (si aplica)
    codigo_reemplazo = Column(String(50), nullable=True)
    nombre_reemplazo = Column(String(300), nullable=True)
    cargo_reemplazo = Column(String(300), nullable=True)
    fecha_cese_reemplazo = Column(Date, nullable=True)

    # Estado del workflow
    estado = Column(String(50), default="BORRADOR")
    # BORRADOR, PENDIENTE_BP, PENDIENTE_COMPENSACIONES, APROBADO, CARTA_EMITIDA, FIRMADO, ANULADO

    # Organización
    unidad_funcional = Column(String(200), nullable=True)
    area = Column(String(200), nullable=True)
    business_partner = Column(String(200), nullable=True)

    # Carta oferta — configuración
    plantilla_carta = Column(String(100), nullable=True)
    incluye_eps = Column(Boolean, default=True)
    incluye_movilidad = Column(Boolean, default=False)
    monto_movilidad = Column(Float, nullable=True)
    incluye_tarjeta_alimentos = Column(Boolean, default=False)
    monto_tarjeta_alimentos = Column(Float, nullable=True)
    incluye_bono_transporte = Column(Boolean, default=False)
    monto_bono_transporte = Column(Float, nullable=True)
    periodo_prueba = Column(String(50), default="03 meses")
    tipo_personal = Column(String(100), nullable=True)  # "Personal Sujeto a Fiscalización"
    jornada = Column(String(20), default="48")  # "48" o "30" horas

    # Auditoría
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(200), nullable=True)

    # Relación
    cartas = relationship("CartaOferta", back_populates="solicitud")


# ─────────────────────────────────────────────
# CARTAS OFERTA GENERADAS
# ─────────────────────────────────────────────

class CartaOferta(Base):
    __tablename__ = "cartas_oferta"

    id = Column(Integer, primary_key=True, autoincrement=True)
    solicitud_id = Column(Integer, ForeignKey("solicitudes_ingreso.id"), nullable=False)
    correlativo = Column(Integer, nullable=True)
    plantilla_usada = Column(String(100), nullable=True)
    pdf_filename = Column(String(500), nullable=True)
    estado = Column(String(50), default="GENERADA")  # GENERADA, ENVIADA, FIRMADA
    created_at = Column(DateTime, default=datetime.utcnow)

    solicitud = relationship("SolicitudIngreso", back_populates="cartas")


# ─────────────────────────────────────────────
# OPERACIONALES — Movimientos Organizacionales
# ─────────────────────────────────────────────

class Movimiento(Base):
    """
    Replica las columnas del Excel
    'Estatus Cambios Organizacionales 2026-PROYECTO.xlsm' → hoja 'CONSOLIDADO TOTAL'.
    """
    __tablename__ = "movimientos"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Período
    periodo_pago = Column(Date, nullable=True)
    tipo = Column(String(50), nullable=True)  # PAGO, CAMBIO DE DATOS, DATOS
    fecha_cambio = Column(Date, nullable=True)
    sucursal = Column(String(100), nullable=True)  # UNIVERSIDAD, CSIR, EPG, IE

    # Colaborador
    codigo_colaborador = Column(String(20), nullable=True)
    nombre = Column(String(300), nullable=False)
    cargo_actual = Column(String(300), nullable=True)
    fecha_ingreso = Column(String(50), nullable=True)
    ceco_actual = Column(String(100), nullable=True)
    jefe_directo_actual = Column(String(300), nullable=True)
    categoria = Column(String(100), nullable=True)
    sede_trabajo = Column(String(200), nullable=True)
    departamento_actual = Column(String(300), nullable=True)
    area_actual = Column(String(300), nullable=True)
    seccion_actual = Column(String(300), nullable=True)
    sueldo_actual = Column(Float, nullable=True)

    # Documento / Tipo de cambio
    tipo_documento = Column(String(200), nullable=True)
    # Incremento, Promoción, Ajuste salarial, Cambio de jefe, Cambio de puesto,
    # Bono por funciones adicionales, Convenio de Transporte, Carta de Nombramiento, etc.

    cambio_cargo = Column(String(10), nullable=True)  # SI/NO (columna "CARGO?")
    remuneracion = Column(Float, nullable=True)
    bono = Column(Float, nullable=True)
    movilidad = Column(Float, nullable=True)
    fecha_inicio = Column(Date, nullable=True)
    fecha_fin = Column(Date, nullable=True)
    adryan = Column(String(20), nullable=True)  # SI / NO APLICA

    # Datos nuevos (post-movimiento)
    cargo_nuevo = Column(String(300), nullable=True)
    ceco_nuevo = Column(String(100), nullable=True)
    sede_trabajo_nuevo = Column(String(200), nullable=True)
    sucursal_nueva = Column(String(100), nullable=True)
    categoria_nueva = Column(String(100), nullable=True)
    jefe_directo_nuevo = Column(String(300), nullable=True)

    # Estado
    estado = Column(String(50), default="PENDIENTE")
    # PENDIENTE, EN_PROCESO, COMPLETADO, ANULADO

    # Auditoría
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ─────────────────────────────────────────────
# CORRELATIVO GLOBAL
# ─────────────────────────────────────────────

class Correlativo(Base):
    """Tabla para manejar el correlativo auto-incremental de cartas."""
    __tablename__ = "correlativos"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tipo = Column(String(50), unique=True, nullable=False)  # "carta_oferta", "movimiento"
    ultimo_valor = Column(Integer, default=0)
