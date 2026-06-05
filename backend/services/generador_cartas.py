"""
Generador de Cartas Oferta en PDF y HTML.

Produce documentos PDF y vistas HTML con el mismo formato que las plantillas Excel,
respetando estrictamente las variaciones de redacción cargadas de manera declarativa.
"""
import os
from datetime import date, datetime
from fpdf import FPDF
from backend.services.numero_a_letras import numero_a_letras
from backend.services.reglas_negocio import obtener_config_plantilla, cargar_plantillas
from backend.config import UPLOADS_DIR


def clean_text_latin1(text):
    if not isinstance(text, str):
        return text
    # Map common non-latin-1 characters
    replacements = {
        "\u2014": "-",   # em-dash
        "\u2013": "-",   # en-dash
        "\u2022": "-",   # bullet point (•)
        "\u201c": '"',   # left double quote
        "\u201d": '"',   # right double quote
        "\u2018": "'",   # left single quote
        "\u2019": "'",   # right single quote
        "\xa0": " ",     # non-breaking space
    }
    for orig, rep in replacements.items():
        text = text.replace(orig, rep)
    # Encode and decode using latin-1 with replacement to avoid FPDFUnicodeEncodingException
    return text.encode("latin-1", errors="replace").decode("latin-1")


class CartaOfertaPDF(FPDF):
    """PDF personalizado para cartas oferta USIL."""

    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_auto_page_break(auto=True, margin=25)

    def cell(self, *args, **kwargs):
        args = list(args)
        if len(args) > 2:
            args[2] = clean_text_latin1(args[2])
        elif "text" in kwargs:
            kwargs["text"] = clean_text_latin1(kwargs["text"])
        elif "txt" in kwargs:
            kwargs["txt"] = clean_text_latin1(kwargs["txt"])
        return super().cell(*args, **kwargs)

    def multi_cell(self, *args, **kwargs):
        args = list(args)
        if len(args) > 2:
            args[2] = clean_text_latin1(args[2])
        elif "text" in kwargs:
            kwargs["text"] = clean_text_latin1(kwargs["text"])
        elif "txt" in kwargs:
            kwargs["txt"] = clean_text_latin1(kwargs["txt"])
        return super().multi_cell(*args, **kwargs)

    def header(self):
        # Encabezado institucional
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(0, 51, 102)
        self.cell(0, 8, "USIL - Universidad San Ignacio de Loyola", ln=True, align="L")
        self.set_draw_color(0, 51, 102)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)

    def footer(self):
        self.set_y(-20)
        self.set_font("Helvetica", "I", 7)
        self.set_text_color(128, 128, 128)
        self.cell(0, 5, "Documento generado por HR Operations Management System", align="C", ln=True)
        self.cell(0, 5, f"Página {self.page_no()}/{{nb}}", align="C")


def _formato_fecha(d) -> str:
    """Convierte una fecha a formato '18 de mayo de 2026'."""
    if d is None:
        return "_______________"
    if isinstance(d, str):
        try:
            d = datetime.strptime(d[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return str(d)

    meses = [
        "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ]
    return f"{d.day} de {meses[d.month]} de {d.year}"


def render_template_str(tmpl_str: str, context: dict) -> str:
    if not tmpl_str:
        return ""
    res = tmpl_str
    for k, v in context.items():
        res = res.replace(f"{{{{{k}}}}}", str(v if v is not None else ""))
    return res


def obtener_textos_carta(solicitud: dict, correlativo: int) -> dict:
    """
    Devuelve los textos exactos y formateados para cada sección de la carta oferta,
    cargados dinámicamente desde templates_config.json.
    """
    plantilla = solicitud.get("plantilla_carta", "CO BASE")
    config = obtener_config_plantilla(plantilla)
    templates_all = cargar_plantillas()
    
    # Obtener configuración declarativa de la plantilla
    tmpl_config = templates_all.get(plantilla, templates_all.get("CO BASE"))
    labels = tmpl_config.get("labels", {})
    templates = tmpl_config.get("templates", {})

    nombre = str(solicitud.get("nombres_apellidos") or "").strip()
    cargo = str(solicitud.get("puesto") or "").strip()
    ceco = str(solicitud.get("codigo_cr") or "").strip()
    jefe = str(solicitud.get("nombre_jefe_directo") or "").strip()
    if jefe.lower() in ("none", ""):
        jefe = "—"
    if cargo.lower() in ("none", ""):
        cargo = "—"
    if ceco.lower() in ("none", ""):
        ceco = "—"

    salario = solicitud.get("salario", 0) or 0
    salario_texto = numero_a_letras(salario) if salario else "cero"

    fecha_termino = solicitud.get("fecha_termino_contrato")
    modalidad_trabajo = solicitud.get("modalidad_trabajo") or "Presencial"
    tipo_personal = solicitud.get("tipo_personal") or ""
    categoria_trab = solicitud.get("categoria_trabajador") or ""
    tiempo_contrato = solicitud.get("tiempo_contrato") or "6 meses"

    # 1. Fecha actual
    hoy = date.today()
    meses_nombres = [
        "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ]
    fecha_hoy_str = f"{hoy.day} de {meses_nombres[hoy.month]} de {hoy.year}"

    # Formatear fecha de término
    fecha_termino_str = _formato_fecha(fecha_termino)

    # Preparar el contexto para el render de los strings
    context = {
        "nombre": nombre,
        "puesto": cargo,
        "codigo_cr": ceco,
        "jefe": jefe,
        "salario": f"{salario:,.2f}" if salario else "0.00",
        "salario_letras": salario_texto,
        "fecha_termino_contrato": fecha_termino_str,
        "modalidad_trabajo": modalidad_trabajo,
        "tipo_personal": tipo_personal,
        "categoria_trabajador": categoria_trab,
        "periodo_prueba": config.get("periodo_prueba", "03 meses"),
        "tiempo_contrato": tiempo_contrato,
        "fecha_hoy": fecha_hoy_str,
    }

    # 2. Introducción
    intro = render_template_str(tmpl_config.get("intro"), context)

    # 3. Cargo
    cargo_label = labels.get("cargo", "Cargo:")
    cargo_val = render_template_str(templates.get("cargo"), context)

    # 4. Dependencia
    jefe_label = labels.get("dependencia", "Dependencia:")
    jefe_val = render_template_str(templates.get("dependencia"), context)

    # 5. Compensación / Subvención
    comp_label = labels.get("compensacion", "Compensación:")
    comp_val = render_template_str(templates.get("compensacion"), context)

    # Adicionales de compensación (tarjetas y bonos)
    # Tarjeta de alimentos
    incluye_ta = solicitud.get("incluye_tarjeta_alimentos")
    if incluye_ta is None:
        incluye_ta = config.get("incluye_tarjeta_alimentos", False)
    if incluye_ta:
        monto_ta = solicitud.get("monto_tarjeta_alimentos") or config.get("monto_tarjeta_alimentos") or 0
        monto_ta = float(monto_ta)
        comp_val += f"\n• Tarjeta de alimentos por un importe de S/ {monto_ta:,.2f} ({numero_a_letras(monto_ta)})"

    # Bono de transporte
    incluye_bt = solicitud.get("incluye_bono_transporte")
    if incluye_bt is None:
        incluye_bt = config.get("incluye_bono_transporte", False)
    if incluye_bt:
        monto_bt = solicitud.get("monto_bono_transporte") or config.get("monto_bono_transporte") or 0
        monto_bt = float(monto_bt)
        comp_val += f"\n• Bono de transporte por un importe diario de S/ {monto_bt:,.2f} ({numero_a_letras(monto_bt)})"

    # Bono de movilidad
    incluye_mv = solicitud.get("incluye_movilidad")
    if incluye_mv is None:
        incluye_mv = config.get("incluye_movilidad", False)
    if incluye_mv or plantilla == "CO+mov+teb":
        monto_mv = solicitud.get("monto_movilidad")
        if monto_mv:
            monto_mv = float(monto_mv)
            comp_val += f"\n• Bono de movilidad por un importe de S/ {monto_mv:,.2f} diarios sujetos a la asistencia al centro de labores"
        else:
            comp_val += "\n• Bono de movilidad sujetos a la asistencia al centro de labores"

    # 6. Contrato / Convenio
    contrato_label = labels.get("contrato", "Contrato:")
    contrato_val = render_template_str(templates.get("contrato"), context)
    
    # Limpieza dinámica de líneas de personal si están vacías
    if not tipo_personal and not categoria_trab:
        lines = contrato_val.split('\n')
        lines = [l for l in lines if not l.strip().startswith("Personal")]
        contrato_val = '\n'.join(lines)
    else:
        contrato_val = contrato_val.replace("Personal  ", "Personal ")
    contrato_val = contrato_val.strip()

    # 7. Horario
    horario_label = labels.get("horario", "Horario de Trabajo:")
    horario_val = render_template_str(templates.get("horario"), context)

    # 8. Beneficios (EPS)
    beneficios_label = labels.get("beneficios", "Otros Beneficios:")
    if beneficios_label and config.get("incluye_eps", True):
        beneficios_val = render_template_str(templates.get("beneficios"), context)
    else:
        beneficios_val = None

    # 9. Cierre
    cierre = render_template_str(tmpl_config.get("cierre"), context)

    return {
        "plantilla": plantilla,
        "fecha": fecha_hoy_str,
        "intro": intro,
        "cargo_label": cargo_label,
        "cargo_val": cargo_val,
        "jefe_label": jefe_label,
        "jefe_val": jefe_val,
        "comp_label": comp_label,
        "comp_val": comp_val,
        "contrato_label": contrato_label,
        "contrato_val": contrato_val,
        "horario_label": horario_label,
        "horario_val": horario_val,
        "beneficios_label": beneficios_label,
        "beneficios_val": beneficios_val,
        "cierre": cierre,
        "nombre": nombre,
    }


def generar_carta_oferta(solicitud: dict, correlativo: int) -> str:
    """
    Genera el PDF de carta oferta y devuelve el nombre del archivo.
    """
    textos = obtener_textos_carta(solicitud, correlativo)

    pdf = CartaOfertaPDF()
    pdf.alias_nb_pages()
    pdf.add_page()

    # ── Correlativo ──
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 6, f"Correlativo: {correlativo}", ln=True, align="L")
    pdf.ln(8)

    # ── Fecha y lugar ──
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 7, f"La Molina, {textos['fecha']}", ln=True, align="R")
    pdf.ln(8)

    # ── Saludo ──
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 7, "Estimado (a):", ln=True)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, textos["nombre"], ln=True)
    pdf.ln(5)

    # ── Introducción ──
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 6, textos["intro"])
    pdf.ln(8)

    # Helper para filas de tabla
    def agregar_fila_tabla(label, value):
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(35, 7, label, ln=False)
        pdf.set_font("Helvetica", "", 10)
        
        # Manejar múltiples líneas en el valor
        lines = value.split('\n')
        for i, line in enumerate(lines):
            if i > 0:
                pdf.set_x(45)
            pdf.multi_cell(0, 6, line)
        pdf.ln(3)

    # ── Cargo ──
    agregar_fila_tabla(textos["cargo_label"], textos["cargo_val"])

    # ── Dependencia ──
    agregar_fila_tabla(textos["jefe_label"], textos["jefe_val"])

    # ── Compensación ──
    agregar_fila_tabla(textos["comp_label"], textos["comp_val"])

    # ── Contrato ──
    agregar_fila_tabla(textos["contrato_label"], textos["contrato_val"])

    # ── Horario ──
    agregar_fila_tabla(textos["horario_label"], textos["horario_val"])

    # ── Beneficios (si aplica) ──
    if textos["beneficios_val"]:
        agregar_fila_tabla(textos["beneficios_label"], textos["beneficios_val"])

    # ── Cierre ──
    pdf.ln(5)
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 6, textos["cierre"])

    # ── Firma ──
    pdf.ln(20)
    pdf.line(20, pdf.get_y(), 90, pdf.get_y())
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(70, 6, textos["nombre"], ln=True, align="L")

    # ── Guardar ──
    safe_name = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in textos["nombre"])
    filename = f"CO_{correlativo}_{safe_name[:40]}.pdf"
    filepath = os.path.join(UPLOADS_DIR, filename)
    pdf.output(filepath)

    return filename


def generar_html_preview(solicitud: dict, correlativo: int) -> str:
    """
    Genera una representación HTML de la carta oferta basada en su plantilla correspondiente.
    """
    textos = obtener_textos_carta(solicitud, correlativo)

    # Formatear saltos de línea para el valor de compensación
    comp_html = textos["comp_val"].replace("\n", "<br>")
    contrato_html = textos["contrato_val"].replace("\n", "<br>")
    horario_html = textos["horario_val"].replace("\n", "<br>")

    html = f'''<div class="carta-oferta-preview-container" style="background-color: var(--bg-surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 2.5rem; font-family: 'Inter', sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.2); color: var(--text-primary);">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 2rem;">
            <div style="font-weight: 700; color: var(--accent);">USIL - Gestión de Talento</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">Correlativo: <strong>{correlativo}</strong> | Plantilla: <strong>{textos["plantilla"]}</strong></div>
        </div>
        
        <div style="text-align: right; margin-bottom: 1.5rem; color: var(--text-secondary); font-size: 0.95rem;">La Molina, {textos["fecha"]}</div>
        
        <p style="margin-bottom: 0.5rem; color: var(--text-secondary);">Estimado (a):</p>
        <h3 style="margin: 0 0 1.5rem 0; font-size: 1.25rem; font-weight: 600; color: var(--text-primary);">{textos["nombre"]}</h3>
        
        <p style="margin-bottom: 2rem; color: var(--text-secondary);">{textos["intro"]}</p>
        
        <table style="width: 100%; margin-bottom: 2rem; border-collapse: collapse;">
            <tbody>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 0.85rem 0; font-weight: 600; color: var(--text-secondary); width: 140px; vertical-align: top;">{textos["cargo_label"]}</td>
                    <td style="padding: 0.85rem 0; color: var(--text-primary); font-weight: 500;">{textos["cargo_val"]}</td>
                </tr>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 0.85rem 0; font-weight: 600; color: var(--text-secondary); vertical-align: top;">{textos["jefe_label"]}</td>
                    <td style="padding: 0.85rem 0; color: var(--text-primary);">{textos["jefe_val"]}</td>
                </tr>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 0.85rem 0; font-weight: 600; color: var(--text-secondary); vertical-align: top;">{textos["comp_label"]}</td>
                    <td style="padding: 0.85rem 0; color: var(--text-primary);">{comp_html}</td>
                </tr>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 0.85rem 0; font-weight: 600; color: var(--text-secondary); vertical-align: top;">{textos["contrato_label"]}</td>
                    <td style="padding: 0.85rem 0; color: var(--text-primary);">{contrato_html}</td>
                </tr>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 0.85rem 0; font-weight: 600; color: var(--text-secondary); vertical-align: top;">{textos["horario_label"]}</td>
                    <td style="padding: 0.85rem 0; color: var(--text-primary);">{horario_html}</td>
                </tr>'''

    if textos["beneficios_val"]:
        html += f'''
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 0.85rem 0; font-weight: 600; color: var(--text-secondary); vertical-align: top;">{textos["beneficios_label"]}</td>
                    <td style="padding: 0.85rem 0; color: var(--text-primary); font-size: 0.95rem;">{textos["beneficios_val"]}</td>
                </tr>'''

    html += f'''
            </tbody>
        </table>
        
        <p style="margin-top: 2rem; margin-bottom: 3rem; font-size: 0.95rem; color: var(--text-secondary);">{textos["cierre"]}</p>
        
        <div style="margin-top: 3rem; display: flex; justify-content: space-between;">
            <div>
                <div style="border-top: 1px solid var(--border); width: 220px; margin-bottom: 8px; padding-top: 8px; font-weight: 600; color: var(--text-primary);">{textos["nombre"]}</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">Candidato / Aceptante</div>
            </div>
            <div style="text-align: right;">
                <div style="border-top: 1px solid var(--border); width: 220px; margin-bottom: 8px; padding-top: 8px; font-weight: 600; color: var(--text-primary);">Vicepresidencia de Talento</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">Universidad San Ignacio de Loyola</div>
            </div>
        </div>
    </div>'''
    return html
