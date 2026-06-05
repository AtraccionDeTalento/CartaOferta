"""API endpoints para generación y gestión de cartas oferta."""
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import SolicitudIngreso, CartaOferta, Correlativo
from backend.services.generador_cartas import generar_carta_oferta
from backend.config import UPLOADS_DIR

router = APIRouter(prefix="/api/cartas", tags=["cartas"])


@router.post("/generar/{solicitud_id}")
def generar_carta(solicitud_id: int, db: Session = Depends(get_db)):
    solicitud = db.query(SolicitudIngreso).filter(SolicitudIngreso.id == solicitud_id).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    corr = db.query(Correlativo).filter(Correlativo.tipo == "carta_oferta").first()
    if not corr:
        corr = Correlativo(tipo="carta_oferta", ultimo_valor=2409)
        db.add(corr)
    corr.ultimo_valor += 1

    sol_dict = {
        "nombres_apellidos": solicitud.nombres_apellidos,
        "puesto": solicitud.puesto, "codigo_cr": solicitud.codigo_cr,
        "nombre_jefe_directo": solicitud.nombre_jefe_directo,
        "salario": solicitud.salario,
        "fecha_termino_contrato": solicitud.fecha_termino_contrato,
        "modalidad_trabajo": solicitud.modalidad_trabajo,
        "tipo_personal": solicitud.tipo_personal,
        "categoria_trabajador": solicitud.categoria_trabajador,
        "plantilla_carta": solicitud.plantilla_carta,
        "incluye_eps": solicitud.incluye_eps,
        "incluye_movilidad": solicitud.incluye_movilidad,
        "monto_movilidad": solicitud.monto_movilidad,
        "incluye_tarjeta_alimentos": solicitud.incluye_tarjeta_alimentos,
        "monto_tarjeta_alimentos": solicitud.monto_tarjeta_alimentos,
        "incluye_bono_transporte": solicitud.incluye_bono_transporte,
        "monto_bono_transporte": solicitud.monto_bono_transporte,
        "periodo_prueba": solicitud.periodo_prueba,
        "jornada": solicitud.jornada, "tiempo_contrato": solicitud.tiempo_contrato,
        "modalidad": solicitud.modalidad, "tipo_ingreso": solicitud.tipo_ingreso,
    }

    filename = generar_carta_oferta(sol_dict, corr.ultimo_valor)

    carta = CartaOferta(
        solicitud_id=solicitud.id, correlativo=corr.ultimo_valor,
        plantilla_usada=solicitud.plantilla_carta,
        pdf_filename=filename, estado="GENERADA",
    )
    db.add(carta)
    solicitud.estado = "CARTA_EMITIDA"
    db.commit()
    db.refresh(carta)

    return {"id": carta.id, "correlativo": carta.correlativo,
            "plantilla_usada": carta.plantilla_usada,
            "pdf_filename": carta.pdf_filename, "estado": carta.estado}


@router.get("")
def listar_cartas(db: Session = Depends(get_db)):
    cartas = db.query(CartaOferta).order_by(CartaOferta.id.desc()).all()
    resultado = []
    for c in cartas:
        sol = db.query(SolicitudIngreso).filter(SolicitudIngreso.id == c.solicitud_id).first()
        resultado.append({
            "id": c.id, "correlativo": c.correlativo,
            "plantilla_usada": c.plantilla_usada, "pdf_filename": c.pdf_filename,
            "estado": c.estado,
            "created_at": str(c.created_at) if c.created_at else None,
            "nombre_colaborador": sol.nombres_apellidos if sol else "",
            "puesto": sol.puesto if sol else "",
        })
    return resultado


@router.get("/descargar/{carta_id}")
def descargar_carta(carta_id: int, db: Session = Depends(get_db)):
    carta = db.query(CartaOferta).filter(CartaOferta.id == carta_id).first()
    if not carta:
        raise HTTPException(status_code=404, detail="Carta no encontrada")
    filepath = os.path.join(UPLOADS_DIR, carta.pdf_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Archivo PDF no encontrado")
    return FileResponse(filepath, media_type="application/pdf", filename=carta.pdf_filename)


@router.get("/config/reglas")
def api_obtener_reglas():
    from backend.services.reglas_negocio import cargar_reglas
    return cargar_reglas()


@router.get("/config/plantillas")
def api_obtener_plantillas():
    from backend.services.reglas_negocio import cargar_plantillas
    return cargar_plantillas()

