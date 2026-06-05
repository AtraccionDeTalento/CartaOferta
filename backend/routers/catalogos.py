"""API endpoints para catálogos (tablas maestras)."""
import os
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import get_db
from backend.models import (
    UnidadNegocio, Categoria, CategoriaTrabajador, TipoDocumento, Puesto, Sede,
)
from backend.config import BASE_DIR

router = APIRouter(prefix="/api/catalogos", tags=["catalogos"])

# Ruta al catálogo de puestos extraído de Libro2.xlsx
_CATALOGO_PATH = os.path.join(BASE_DIR, "data", "catalogo_puestos.json")
_catalogo_cache = None


def _get_catalogo():
    global _catalogo_cache
    if _catalogo_cache is None and os.path.exists(_CATALOGO_PATH):
        with open(_CATALOGO_PATH, "r", encoding="utf-8") as f:
            _catalogo_cache = json.load(f)
    return _catalogo_cache or []


# ── Unidades de Negocio ──
@router.get("/unidades")
def listar_unidades(db: Session = Depends(get_db)):
    return [{"id": u.id, "nombre": u.nombre} for u in db.query(UnidadNegocio).all()]


@router.post("/unidades")
def crear_unidad(data: dict, db: Session = Depends(get_db)):
    obj = UnidadNegocio(nombre=data["nombre"])
    db.add(obj)
    db.commit()
    return {"id": obj.id, "nombre": obj.nombre}


# ── Categorías ──
@router.get("/categorias")
def listar_categorias(db: Session = Depends(get_db)):
    return [{"id": c.id, "nombre": c.nombre} for c in db.query(Categoria).all()]


@router.get("/categorias-trabajador")
def listar_categorias_trabajador(db: Session = Depends(get_db)):
    return [{"id": c.id, "nombre": c.nombre} for c in db.query(CategoriaTrabajador).all()]


# ── Tipos de Documento ──
@router.get("/tipos-documento")
def listar_tipos_documento(db: Session = Depends(get_db)):
    return [
        {"id": t.id, "nombre": t.nombre, "subtipo": t.subtipo}
        for t in db.query(TipoDocumento).all()
    ]


# ── Puestos ──
@router.get("/puestos")
def listar_puestos(q: str = "", db: Session = Depends(get_db)):
    query = db.query(Puesto).filter(Puesto.activo == True)
    if q:
        query = query.filter(Puesto.nombre.ilike(f"%{q}%"))
    return [
        {"id": p.id, "nombre": p.nombre, "codigo_ceco": p.codigo_ceco}
        for p in query.limit(50).all()
    ]


@router.post("/puestos")
def crear_puesto(data: dict, db: Session = Depends(get_db)):
    obj = Puesto(nombre=data["nombre"], codigo_ceco=data.get("codigo_ceco"), activo=True)
    db.add(obj)
    db.commit()
    return {"id": obj.id, "nombre": obj.nombre, "codigo_ceco": obj.codigo_ceco}


# ── Puestos desde Libro2.xlsx (Catálogo Oficial) ──
@router.get("/puestos-libro2")
def buscar_puestos_libro2(q: str = "", unidad: str = ""):
    """Búsqueda de puestos del catálogo oficial (Libro2.xlsx) con autocompletado.
    Filtra por nombre de puesto (búsqueda parcial) y/o unidad de negocio.
    Retorna puesto + codigo_cc + area + departamento para autorellenar el formulario.
    """
    catalogo = _get_catalogo()
    resultados = catalogo

    if unidad:
        resultados = [r for r in resultados if r.get("unidad", "").upper() == unidad.upper()]

    if q and len(q) >= 2:
        q_up = q.upper()
        resultados = [
            r for r in resultados
            if q_up in r.get("puesto", "").upper()
        ]

    # Deduplicate by puesto + codigo_cc
    seen = set()
    unique = []
    for r in resultados:
        key = (r["puesto"], r["codigo_cc"])
        if key not in seen:
            seen.add(key)
            unique.append(r)

    return unique[:60]


# ── Sedes ──
@router.get("/sedes")
def listar_sedes(db: Session = Depends(get_db)):
    return [{"id": s.id, "nombre": s.nombre} for s in db.query(Sede).all()]


# ── Dashboard Stats ──
@router.get("/stats")
def obtener_stats(db: Session = Depends(get_db)):
    from backend.models import SolicitudIngreso, Movimiento, CartaOferta

    total_ingresos = db.query(func.count(SolicitudIngreso.id)).scalar()
    pendientes = db.query(func.count(SolicitudIngreso.id)).filter(
        SolicitudIngreso.estado.in_(["BORRADOR", "PENDIENTE_BP", "PENDIENTE_COMPENSACIONES"])
    ).scalar()
    aprobados = db.query(func.count(SolicitudIngreso.id)).filter(
        SolicitudIngreso.estado == "APROBADO"
    ).scalar()
    cartas_emitidas = db.query(func.count(CartaOferta.id)).scalar()
    total_movimientos = db.query(func.count(Movimiento.id)).scalar()
    mov_pendientes = db.query(func.count(Movimiento.id)).filter(
        Movimiento.estado == "PENDIENTE"
    ).scalar()
    total_puestos = db.query(func.count(Puesto.id)).filter(Puesto.activo == True).scalar()

    return {
        "total_ingresos": total_ingresos,
        "ingresos_pendientes": pendientes,
        "ingresos_aprobados": aprobados,
        "cartas_emitidas": cartas_emitidas,
        "total_movimientos": total_movimientos,
        "movimientos_pendientes": mov_pendientes,
        "total_puestos": total_puestos,
    }
