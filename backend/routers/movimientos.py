"""API endpoints para movimientos organizacionales."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from backend.database import get_db
from backend.models import Movimiento

router = APIRouter(prefix="/api/movimientos", tags=["movimientos"])


def _to_date(val):
    if val is None or val == "":
        return None
    try:
        return datetime.strptime(str(val)[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def _mov_to_dict(m: Movimiento) -> dict:
    return {
        "id": m.id, "periodo_pago": str(m.periodo_pago) if m.periodo_pago else None,
        "tipo": m.tipo, "fecha_cambio": str(m.fecha_cambio) if m.fecha_cambio else None,
        "sucursal": m.sucursal, "codigo_colaborador": m.codigo_colaborador,
        "nombre": m.nombre, "cargo_actual": m.cargo_actual,
        "fecha_ingreso": m.fecha_ingreso, "ceco_actual": m.ceco_actual,
        "jefe_directo_actual": m.jefe_directo_actual, "categoria": m.categoria,
        "sede_trabajo": m.sede_trabajo, "departamento_actual": m.departamento_actual,
        "area_actual": m.area_actual, "seccion_actual": m.seccion_actual,
        "sueldo_actual": m.sueldo_actual, "tipo_documento": m.tipo_documento,
        "cambio_cargo": m.cambio_cargo, "remuneracion": m.remuneracion,
        "bono": m.bono, "movilidad": m.movilidad,
        "fecha_inicio": str(m.fecha_inicio) if m.fecha_inicio else None,
        "fecha_fin": str(m.fecha_fin) if m.fecha_fin else None,
        "adryan": m.adryan, "cargo_nuevo": m.cargo_nuevo,
        "ceco_nuevo": m.ceco_nuevo, "sede_trabajo_nuevo": m.sede_trabajo_nuevo,
        "sucursal_nueva": m.sucursal_nueva, "categoria_nueva": m.categoria_nueva,
        "jefe_directo_nuevo": m.jefe_directo_nuevo, "estado": m.estado,
        "created_at": str(m.created_at) if m.created_at else None,
    }


@router.get("")
def listar_movimientos(
    tipo_documento: str = None, sucursal: str = None,
    q: str = None, skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(Movimiento).order_by(desc(Movimiento.id))
    if tipo_documento:
        query = query.filter(Movimiento.tipo_documento == tipo_documento)
    if sucursal:
        query = query.filter(Movimiento.sucursal == sucursal)
    if q:
        query = query.filter(Movimiento.nombre.ilike(f"%{q}%"))

    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return {"total": total, "items": [_mov_to_dict(m) for m in items]}


@router.get("/{mov_id}")
def obtener_movimiento(mov_id: int, db: Session = Depends(get_db)):
    m = db.query(Movimiento).filter(Movimiento.id == mov_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    return _mov_to_dict(m)


@router.post("")
def crear_movimiento(data: dict, db: Session = Depends(get_db)):
    m = Movimiento(
        periodo_pago=_to_date(data.get("periodo_pago")),
        tipo=data.get("tipo"), fecha_cambio=_to_date(data.get("fecha_cambio")),
        sucursal=data.get("sucursal"), codigo_colaborador=data.get("codigo_colaborador"),
        nombre=data.get("nombre", ""), cargo_actual=data.get("cargo_actual"),
        fecha_ingreso=data.get("fecha_ingreso"), ceco_actual=data.get("ceco_actual"),
        jefe_directo_actual=data.get("jefe_directo_actual"),
        categoria=data.get("categoria"), sede_trabajo=data.get("sede_trabajo"),
        departamento_actual=data.get("departamento_actual"),
        area_actual=data.get("area_actual"), seccion_actual=data.get("seccion_actual"),
        sueldo_actual=data.get("sueldo_actual"), tipo_documento=data.get("tipo_documento"),
        cambio_cargo=data.get("cambio_cargo"), remuneracion=data.get("remuneracion"),
        bono=data.get("bono"), movilidad=data.get("movilidad"),
        fecha_inicio=_to_date(data.get("fecha_inicio")),
        fecha_fin=_to_date(data.get("fecha_fin")), adryan=data.get("adryan"),
        cargo_nuevo=data.get("cargo_nuevo"), ceco_nuevo=data.get("ceco_nuevo"),
        sede_trabajo_nuevo=data.get("sede_trabajo_nuevo"),
        sucursal_nueva=data.get("sucursal_nueva"),
        categoria_nueva=data.get("categoria_nueva"),
        jefe_directo_nuevo=data.get("jefe_directo_nuevo"),
        estado=data.get("estado", "PENDIENTE"),
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return _mov_to_dict(m)


@router.delete("/{mov_id}")
def eliminar_movimiento(mov_id: int, db: Session = Depends(get_db)):
    m = db.query(Movimiento).filter(Movimiento.id == mov_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    db.delete(m)
    db.commit()
    return {"ok": True}
