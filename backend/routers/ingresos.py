"""API endpoints para solicitudes de ingreso."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import date, datetime
from backend.database import get_db
from backend.models import SolicitudIngreso, Correlativo
from backend.services.reglas_negocio import determinar_plantilla, validar_solicitud
from backend.services.numero_a_letras import numero_a_letras

router = APIRouter(prefix="/api/ingresos", tags=["ingresos"])


def _to_date(val):
    """Convierte string a date si es necesario."""
    if val is None or val == "":
        return None
    if isinstance(val, date):
        return val
    try:
        return datetime.strptime(str(val)[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def _solicitud_to_dict(s: SolicitudIngreso) -> dict:
    """Serializa un modelo a dict para JSON."""
    return {
        "id": s.id,
        "correlativo": s.correlativo,
        "unidad": s.unidad,
        "fecha_solicitud": str(s.fecha_solicitud) if s.fecha_solicitud else None,
        "fecha_tentativa_ingreso": str(s.fecha_tentativa_ingreso) if s.fecha_tentativa_ingreso else None,
        "modalidad": s.modalidad,
        "genero": s.genero,
        "dni": s.dni,
        "nombres_apellidos": s.nombres_apellidos,
        "puesto_nuevo": s.puesto_nuevo,
        "puesto": s.puesto,
        "codigo_cr": s.codigo_cr,
        "puesto_jefe_directo": s.puesto_jefe_directo,
        "nombre_jefe_directo": s.nombre_jefe_directo,
        "salario": s.salario,
        "salario_letras": s.salario_letras,
        "categoria": s.categoria,
        "motivo_contrato": s.motivo_contrato,
        "tiempo_contrato": s.tiempo_contrato,
        "fecha_termino_contrato": str(s.fecha_termino_contrato) if s.fecha_termino_contrato else None,
        "modalidad_trabajo": s.modalidad_trabajo,
        "categoria_trabajador": s.categoria_trabajador,
        "condicion_categoria": s.condicion_categoria,
        "tipo_ingreso": s.tipo_ingreso,
        "codigo_reemplazo": s.codigo_reemplazo,
        "nombre_reemplazo": s.nombre_reemplazo,
        "cargo_reemplazo": s.cargo_reemplazo,
        "fecha_cese_reemplazo": str(s.fecha_cese_reemplazo) if s.fecha_cese_reemplazo else None,
        "estado": s.estado,
        "unidad_funcional": s.unidad_funcional,
        "area": s.area,
        "business_partner": s.business_partner,
        "plantilla_carta": s.plantilla_carta,
        "incluye_eps": s.incluye_eps,
        "incluye_movilidad": s.incluye_movilidad,
        "monto_movilidad": s.monto_movilidad,
        "incluye_tarjeta_alimentos": s.incluye_tarjeta_alimentos,
        "monto_tarjeta_alimentos": s.monto_tarjeta_alimentos,
        "incluye_bono_transporte": s.incluye_bono_transporte,
        "monto_bono_transporte": s.monto_bono_transporte,
        "periodo_prueba": s.periodo_prueba,
        "tipo_personal": s.tipo_personal,
        "jornada": s.jornada,
        "created_at": str(s.created_at) if s.created_at else None,
        "cartas_count": len(s.cartas) if s.cartas else 0,
        "carta_id": s.cartas[-1].id if s.cartas else None,
    }


@router.get("")
def listar_ingresos(
    estado: str = None,
    unidad: str = None,
    q: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Listar solicitudes de ingreso con filtros opcionales."""
    query = db.query(SolicitudIngreso).order_by(desc(SolicitudIngreso.id))

    if estado:
        query = query.filter(SolicitudIngreso.estado == estado)
    if unidad:
        query = query.filter(SolicitudIngreso.unidad == unidad)
    if q:
        query = query.filter(SolicitudIngreso.nombres_apellidos.ilike(f"%{q}%"))

    total = query.count()
    items = query.offset(skip).limit(limit).all()

    return {"total": total, "items": [_solicitud_to_dict(s) for s in items]}


@router.get("/{ingreso_id}")
def obtener_ingreso(ingreso_id: int, db: Session = Depends(get_db)):
    s = db.query(SolicitudIngreso).filter(SolicitudIngreso.id == ingreso_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    return _solicitud_to_dict(s)


@router.get("/{ingreso_id}/preview")
def obtener_preview_carta(ingreso_id: int, db: Session = Depends(get_db)):
    s = db.query(SolicitudIngreso).filter(SolicitudIngreso.id == ingreso_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    from backend.services.generador_cartas import generar_html_preview
    sol_dict = _solicitud_to_dict(s)
    html_content = generar_html_preview(sol_dict, s.correlativo or s.id)
    return {"html": html_content}


@router.post("")
def crear_ingreso(data: dict, db: Session = Depends(get_db)):
    """Crear nueva solicitud de ingreso."""
    # Validar
    errores = validar_solicitud(data)
    if errores:
        raise HTTPException(status_code=422, detail={"errores": errores})

    # Calcular salario en letras
    salario = data.get("salario")
    salario_letras = numero_a_letras(float(salario)) if salario else None

    # Determinar plantilla automáticamente
    plantilla = determinar_plantilla(data)

    # Generar correlativo
    corr = db.query(Correlativo).filter(Correlativo.tipo == "solicitud_ingreso").first()
    if not corr:
        corr = Correlativo(tipo="solicitud_ingreso", ultimo_valor=2409)  # Continuar desde el Excel
        db.add(corr)
    corr.ultimo_valor += 1
    nuevo_correlativo = corr.ultimo_valor

    solicitud = SolicitudIngreso(
        correlativo=nuevo_correlativo,
        unidad=data.get("unidad"),
        fecha_solicitud=_to_date(data.get("fecha_solicitud")) or date.today(),
        fecha_tentativa_ingreso=_to_date(data.get("fecha_tentativa_ingreso")),
        modalidad=data.get("modalidad"),
        genero=data.get("genero"),
        dni=data.get("dni"),
        nombres_apellidos=data.get("nombres_apellidos"),
        puesto_nuevo=data.get("puesto_nuevo"),
        puesto=data.get("puesto"),
        codigo_cr=data.get("codigo_cr"),
        puesto_jefe_directo=data.get("puesto_jefe_directo"),
        nombre_jefe_directo=data.get("nombre_jefe_directo"),
        salario=float(salario) if salario else None,
        salario_letras=salario_letras,
        categoria=data.get("categoria"),
        motivo_contrato=data.get("motivo_contrato"),
        tiempo_contrato=data.get("tiempo_contrato"),
        fecha_termino_contrato=_to_date(data.get("fecha_termino_contrato")),
        modalidad_trabajo=data.get("modalidad_trabajo"),
        categoria_trabajador=data.get("categoria_trabajador"),
        condicion_categoria=data.get("condicion_categoria"),
        tipo_ingreso=data.get("tipo_ingreso"),
        codigo_reemplazo=data.get("codigo_reemplazo"),
        nombre_reemplazo=data.get("nombre_reemplazo"),
        cargo_reemplazo=data.get("cargo_reemplazo"),
        fecha_cese_reemplazo=_to_date(data.get("fecha_cese_reemplazo")),
        estado="BORRADOR",
        unidad_funcional=data.get("unidad_funcional"),
        area=data.get("area"),
        business_partner=data.get("business_partner"),
        plantilla_carta=plantilla,
        incluye_eps=data.get("incluye_eps", True),
        incluye_movilidad=data.get("incluye_movilidad", False),
        monto_movilidad=data.get("monto_movilidad"),
        incluye_tarjeta_alimentos=data.get("incluye_tarjeta_alimentos", False),
        monto_tarjeta_alimentos=data.get("monto_tarjeta_alimentos"),
        incluye_bono_transporte=data.get("incluye_bono_transporte", False),
        monto_bono_transporte=data.get("monto_bono_transporte"),
        periodo_prueba=data.get("periodo_prueba", "03 meses"),
        tipo_personal=data.get("tipo_personal"),
        jornada=data.get("jornada", "48"),
    )

    db.add(solicitud)
    db.commit()
    db.refresh(solicitud)

    return _solicitud_to_dict(solicitud)


@router.put("/{ingreso_id}")
def actualizar_ingreso(ingreso_id: int, data: dict, db: Session = Depends(get_db)):
    """Actualizar solicitud existente."""
    s = db.query(SolicitudIngreso).filter(SolicitudIngreso.id == ingreso_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    # Actualizar campos
    for field in [
        "unidad", "modalidad", "genero", "dni", "nombres_apellidos",
        "puesto_nuevo", "puesto", "codigo_cr", "puesto_jefe_directo",
        "nombre_jefe_directo", "categoria", "motivo_contrato",
        "tiempo_contrato", "modalidad_trabajo", "categoria_trabajador",
        "condicion_categoria", "tipo_ingreso", "codigo_reemplazo",
        "nombre_reemplazo", "cargo_reemplazo", "unidad_funcional", "area",
        "business_partner", "periodo_prueba", "tipo_personal", "jornada",
    ]:
        if field in data:
            setattr(s, field, data[field])

    # Campos numéricos
    if "salario" in data:
        s.salario = float(data["salario"]) if data["salario"] else None
        s.salario_letras = numero_a_letras(s.salario) if s.salario else None

    # Campos booleanos
    for field in ["incluye_eps", "incluye_movilidad", "incluye_tarjeta_alimentos", "incluye_bono_transporte"]:
        if field in data:
            setattr(s, field, bool(data[field]))

    # Montos
    for field in ["monto_movilidad", "monto_tarjeta_alimentos", "monto_bono_transporte"]:
        if field in data:
            setattr(s, field, float(data[field]) if data[field] else None)

    # Fechas
    for field in ["fecha_solicitud", "fecha_tentativa_ingreso", "fecha_termino_contrato", "fecha_cese_reemplazo"]:
        if field in data:
            setattr(s, field, _to_date(data[field]))

    # Recalcular plantilla
    s.plantilla_carta = determinar_plantilla(_solicitud_to_dict(s))

    db.commit()
    db.refresh(s)
    return _solicitud_to_dict(s)


@router.patch("/{ingreso_id}/estado")
def cambiar_estado(ingreso_id: int, data: dict, db: Session = Depends(get_db)):
    """Cambiar estado de la solicitud (workflow)."""
    s = db.query(SolicitudIngreso).filter(SolicitudIngreso.id == ingreso_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    nuevo_estado = data.get("estado")
    estados_validos = [
        "BORRADOR", "PENDIENTE_BP", "PENDIENTE_COMPENSACIONES",
        "APROBADO", "CARTA_EMITIDA", "FIRMADO", "ANULADO",
    ]
    if nuevo_estado not in estados_validos:
        raise HTTPException(status_code=400, detail=f"Estado inválido. Válidos: {estados_validos}")

    s.estado = nuevo_estado
    db.commit()
    return {"id": s.id, "estado": s.estado}


@router.delete("/{ingreso_id}")
def eliminar_ingreso(ingreso_id: int, db: Session = Depends(get_db)):
    s = db.query(SolicitudIngreso).filter(SolicitudIngreso.id == ingreso_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    db.delete(s)
    db.commit()
    return {"ok": True}


# --- EXTRACTOR DE CANDIDATOS (PRO) ---
from fastapi import File, UploadFile, Form
import io
import pypdf
import urllib.request
import urllib.error
import json
import re
import os

def get_gemini_keys():
    try:
        # Read from frontend-react/.env.local
        env_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend-react", ".env.local")
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("VITE_GEMINI_API_KEYS="):
                        keys = line.split("=")[1].strip()
                        return [k.strip() for k in keys.split(",") if k.strip()]
    except Exception as e:
        print("Error reading .env.local in backend:", str(e))
    
    # Fallbacks
    keys = os.environ.get("VITE_GEMINI_API_KEYS", "")
    if keys:
        return [k.strip() for k in keys.split(",") if k.strip()]
    single_key = os.environ.get("VITE_GEMINI_API_KEY", "")
    return [single_key] if single_key else []

def call_gemini_api(text_content: str) -> dict:
    keys = get_gemini_keys()
    if not keys:
        raise Exception("No se configuraron llaves de API de Gemini en .env.local.")

    prompt = (
        "Analiza el texto de un candidato de atracción de talento (resumen de entrevista, briefing o CV) "
        "y extrae los siguientes datos en formato JSON estructurado.\n\n"
        "Campos requeridos:\n"
        "- nombres_apellidos: Nombre completo del candidato (en mayúsculas).\n"
        "- dni: DNI del candidato (8 dígitos consecutivos) o Carnet de Extranjería (CEX, de 9 a 12 dígitos).\n"
        "- salario: Salario bruto mensual ofrecido (número entero).\n"
        "- modalidad: 'FULL TIME' o 'PART TIME' o 'PRACTICANTE'.\n"
        "- tiempo_contrato: Tiempo del contrato en meses (ej: '03 meses', '06 meses') si se menciona, o null.\n"
        "- nombre_jefe_directo: Nombre completo del jefe directo o reportante (en mayúsculas), o null.\n"
        "- fecha_tentativa_ingreso: Fecha aproximada de ingreso en formato YYYY-MM-DD, o null.\n"
        "- puesto_sugerido: Puesto al que postula o se sugiere, o null.\n"
        "- observaciones: Breve nota aclaratoria si hay condiciones especiales.\n\n"
        "Importante: Devuelve SOLAMENTE el objeto JSON sin markdown ni bloques de código."
    )

    body_data = {
        "contents": [{
            "parts": [
                {"text": prompt + "\n\nTexto a analizar:\n" + text_content}
            ]
        }],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }

    last_err = None
    # Crop content to avoid exceeding token limit (max 8000 characters)
    cropped_text = text_content[:8000]
    
    for key in keys:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={key}"
        req = urllib.request.Request(
            url,
            data=json.dumps(body_data).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                resp_data = json.loads(response.read().decode("utf-8"))
                text = resp_data["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(text)
        except urllib.error.HTTPError as e:
            err_content = e.read().decode("utf-8")
            print(f"Error calling Gemini in backend (Key {key[:10]}...): {e.code} - {err_content}")
            last_err = Exception(f"Gemini API returned error status {e.code}")
            if e.code in [429, 403, 500, 503]:
                continue
            raise last_err
        except Exception as e:
            print(f"Error calling Gemini in backend: {str(e)}")
            last_err = e
            continue
            
    raise last_err or Exception("Todas las llaves de API de Gemini fallaron.")

def parse_locally(text: str) -> dict:
    result = {}
    clean_text = text.replace('\r', '')

    # DNI (8 digits)
    dni_match = re.search(r'\b\d{8}\b', clean_text)
    if dni_match:
        result["dni"] = dni_match.group(0)

    # Names (All caps lines)
    lines = [line.strip() for line in clean_text.split('\n') if len(line.strip()) > 5]
    for line in lines:
        if re.match(r'^[A-ZÁÉÍÓÚÑ\s,]+$', line) and 2 <= len(line.split()) <= 4:
            if not any(word in line for word in ["CURRICULUM", "HOJA", "RESUMEN", "PERFIL"]):
                result["nombres_apellidos"] = line.replace(',', '').strip()
                break

    # Salary
    sal_match = re.search(r'(?:S/\.?\s*|Soles\s*|S/\s*|sueldo\s*[:=]?\s*|salario\s*[:=]?\s*)(\d{3,5}(?:[.,]\d{2})?)', clean_text, re.IGNORECASE)
    if sal_match:
        try:
            val = float(sal_match.group(1).replace(',', ''))
            if val > 500:
                result["salario"] = int(val)
        except ValueError:
            pass

    # Jefe Directo
    jefe_match = re.search(r'(?:jefe|supervisor|reporta a|jefe directo)\s*[:=]?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)', clean_text, re.IGNORECASE)
    if jefe_match:
        raw_jefe = jefe_match.group(1).strip()
        first_line = raw_jefe.split('\n')[0].split(',')[0].strip()
        if 5 < len(first_line) and 2 <= len(first_line.split()) <= 4:
            result["nombre_jefe_directo"] = first_line.upper()

    # Date
    date_match = re.search(r'(\d{2})[-/](\d{2})[-/](\d{4})', clean_text) or re.search(r'(\d{4})[-/](\d{2})[-/](\d{2})', clean_text)
    if date_match:
        raw_date = date_match.group(0)
        if '/' in raw_date:
            parts = raw_date.split('/')
            if len(parts[0]) == 2:
                result["fecha_tentativa_ingreso"] = f"{parts[2]}-{parts[1]}-{parts[0]}"
            else:
                result["fecha_tentativa_ingreso"] = raw_date.replace('/', '-')
        else:
            result["fecha_tentativa_ingreso"] = raw_date

    # Modalidad
    if "part time" in clean_text.lower() or "medio tiempo" in clean_text.lower():
        result["modalidad"] = "PART TIME"
    else:
        result["modalidad"] = "FULL TIME"

    return result

@router.post("/extract")
async def extract_candidate_info(
    resumen: str = Form(None),
    file: UploadFile = File(None)
):
    combined_text = resumen.strip() if resumen else ""
    
    if file:
        if not file.filename.endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF.")
        try:
            contents = await file.read()
            pdf_reader = pypdf.PdfReader(io.BytesIO(contents))
            pdf_text = ""
            # Extract up to 5 pages
            for i in range(min(5, len(pdf_reader.pages))):
                pdf_text += pdf_reader.pages[i].extract_text() or ""
            
            if pdf_text.strip():
                combined_text += f"\n\n{pdf_text}"
        except Exception as e:
            print(f"Error parsing PDF: {str(e)}")

    if not combined_text.strip():
        raise HTTPException(status_code=400, detail="No se proporcionó texto ni se pudo extraer texto legible del PDF.")

    try:
        result = call_gemini_api(combined_text)
        result["local_fallback"] = False
        return result
    except Exception as e:
        print(f"Gemini API error in backend: {str(e)}. Running local parser.")
        fallback_result = parse_locally(combined_text)
        fallback_result["local_fallback"] = True
        return fallback_result
