"""
Motor de Reglas de Negocio — Selección automática de plantilla y validaciones.

Carga reglas de manera declarativa desde data/rules_config.json y data/templates_config.json.
"""
import os
import json
from typing import List, Dict, Optional
from backend.config import BASE_DIR

RULES_PATH = os.path.join(BASE_DIR, "data", "rules_config.json")
TEMPLATES_PATH = os.path.join(BASE_DIR, "data", "templates_config.json")

PLANTILLAS = [
    "CO BASE", "CO BASE (2)", "CO BASE (3)", "CO (3)", "CO X",
    "CO+mov+teb", "CO TP", "CO GEF", "CO sin eps", "CO Chofer",
    "CO maternidad", "PRACTICANTE PRE", "PRACTICANTE PRO",
    "CSIR", "PART TIME", "PART TIME (2)", "operador", "PREPARADOR FISICO",
]


def cargar_reglas() -> list:
    if os.path.exists(RULES_PATH):
        try:
            with open(RULES_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []


def cargar_plantillas() -> dict:
    if os.path.exists(TEMPLATES_PATH):
        try:
            with open(TEMPLATES_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _evaluar_condicion(cond: dict, solicitud: dict) -> bool:
    if "any" in cond:
        return any(_evaluar_condicion(c, solicitud) for c in cond["any"])
    if "all" in cond:
        return all(_evaluar_condicion(c, solicitud) for c in cond["all"])
    
    field = cond.get("field")
    operator = cond.get("operator", "equal")
    target_val = cond.get("value")
    
    raw_val = solicitud.get(field)
    
    # Normalización para comparaciones de texto
    val_str = str(raw_val or "").upper().strip()
    target_str = str(target_val or "").upper().strip()
    
    if operator == "contains":
        return target_str in val_str
    elif operator == "equal":
        return val_str == target_str
    elif operator == "not_equal":
        return val_str != target_str
    elif operator == "true":
        return bool(raw_val) is True
    elif operator == "false":
        return bool(raw_val) is False
    
    return False


def determinar_plantilla(solicitud: dict) -> str:
    """
    Determina automáticamente la plantilla de carta oferta evaluando las reglas
    cargadas desde rules_config.json.
    """
    rules = cargar_reglas()
    if not rules:
        return determinar_plantilla_fallback(solicitud)
        
    for rule in rules:
        plantilla = rule.get("plantilla")
        condiciones = rule.get("condiciones", [])
        
        if not condiciones or all(_evaluar_condicion(c, solicitud) for c in condiciones):
            return plantilla
            
    return "CO BASE"


def determinar_plantilla_fallback(solicitud: dict) -> str:
    """Fallback por código si no existe el archivo JSON."""
    modalidad = (solicitud.get("modalidad") or "").upper().strip()
    tipo_ingreso = (solicitud.get("tipo_ingreso") or "").upper().strip()
    unidad = (solicitud.get("unidad") or "").upper().strip()
    incluye_eps = solicitud.get("incluye_eps", True)
    incluye_movilidad = solicitud.get("incluye_movilidad", False)
    incluye_tarjeta = solicitud.get("incluye_tarjeta_alimentos", False)
    incluye_transporte = solicitud.get("incluye_bono_transporte", False)
    tipo_personal = (solicitud.get("tipo_personal") or "").upper().strip()
    jornada = solicitud.get("jornada", "48")
    puesto = (solicitud.get("puesto") or "").upper().strip()
    categoria_trab = (solicitud.get("categoria_trabajador") or "").upper().strip()

    if "PRACTICANTE" in modalidad or "PRACTICANTE" in puesto or "PRACTICANTE" in tipo_ingreso:
        if "PRE" in modalidad or "PRE" in puesto:
            return "PRACTICANTE PRE"
        return "PRACTICANTE PRO"

    if "MATERNIDAD" in tipo_ingreso or "LICENCIA" in tipo_ingreso:
        return "CO maternidad"

    if "PREPARADOR" in puesto or "INSTRUCTOR" in puesto:
        return "PREPARADOR FISICO"

    if "OPERADOR" in puesto and "PROMOTOR" in puesto:
        return "operador"

    if unidad == "GEF" or unidad == "IE":
        return "CO GEF"

    if unidad == "CSIR":
        return "CSIR"

    if "PART" in modalidad or jornada != "48":
        if incluye_eps:
            return "PART TIME"
        return "PART TIME (2)"

    if "CHOFER" in puesto:
        return "CO Chofer"

    if incluye_movilidad and incluye_tarjeta:
        return "CO+mov+teb"
    if incluye_transporte and incluye_tarjeta:
        return "CO+mov+teb"

    if not incluye_eps:
        return "CO sin eps"

    if "DOCENTE" in puesto and "TIEMPO PARCIAL" in modalidad:
        return "CO TP"

    if "GERENTE" in puesto or "INDETERMINADO" in tipo_personal:
        return "CO X"

    if "DIRECCION" in tipo_personal and "NO FISCALIZABLE" in categoria_trab:
        return "CO (3)"

    if "CONFIANZA" in tipo_personal and "NO FISCALIZABLE" in categoria_trab:
        return "CO BASE (2)"

    if "SUJETO" in categoria_trab:
        return "CO BASE (3)"

    return "CO BASE"


def validar_solicitud(solicitud: dict) -> List[str]:
    """
    Validaciones que previenen errores ANTES de generar la carta.
    Devuelve lista de errores (vacía si todo está OK).
    """
    errores = []

    # Campos obligatorios
    if not solicitud.get("nombres_apellidos"):
        errores.append("El nombre del colaborador es obligatorio")
    if not solicitud.get("puesto"):
        errores.append("Debe especificar el puesto")
    if not solicitud.get("unidad"):
        errores.append("Debe seleccionar la unidad de negocio")

    # Salario
    salario = solicitud.get("salario")
    if salario is not None and salario <= 0:
        errores.append("El salario debe ser mayor a 0")

    # DNI
    dni = solicitud.get("dni", "")
    if dni and len(str(dni).strip()) not in (8, 9, 12):
        errores.append("El DNI debe tener 8 dígitos o CEX 9-12 caracteres")

    # Reemplazo requiere datos del saliente
    tipo_ingreso = (solicitud.get("tipo_ingreso") or "").upper()
    if "REEMPLAZO" in tipo_ingreso:
        if not solicitud.get("codigo_reemplazo"):
            errores.append("Para reemplazos, debe indicar el código del saliente")
        if not solicitud.get("nombre_reemplazo"):
            errores.append("Para reemplazos, debe indicar el nombre del saliente")

    # CECO
    if not solicitud.get("codigo_cr"):
        errores.append("El código CR (CECO) es obligatorio")

    # Fechas
    if not solicitud.get("fecha_tentativa_ingreso"):
        errores.append("La fecha tentativa de ingreso es obligatoria")

    return errores


def obtener_config_plantilla(nombre: str) -> dict:
    """Devuelve la configuración automática de una plantilla."""
    templates = cargar_plantillas()
    if nombre in templates:
        config = templates[nombre].get("config_defecto", {})
        jornada = config.get("jornada", "48")
        incluye_eps = config.get("incluye_eps", True)
        periodo_prueba = config.get("periodo_prueba", "03 meses")
        texto_jornada = (
            "tiempo parcial" if jornada == "parcial"
            else "treinta (30) horas semanales" if jornada == "30"
            else "cuarenta y ocho (48) horas semanales"
        )
        return {
            "jornada": jornada,
            "incluye_eps": incluye_eps,
            "periodo_prueba": periodo_prueba,
            "texto_jornada": texto_jornada,
            "incluye_tarjeta_alimentos": config.get("incluye_tarjeta_alimentos", False),
            "monto_tarjeta_alimentos": config.get("monto_tarjeta_alimentos"),
            "incluye_bono_transporte": config.get("incluye_bono_transporte", False),
            "monto_bono_transporte": config.get("monto_bono_transporte"),
        }

    # Fallback clásico
    return {
        "jornada": "48", "incluye_eps": True, "periodo_prueba": "03 meses",
        "texto_jornada": "cuarenta y ocho (48) horas semanales",
    }
