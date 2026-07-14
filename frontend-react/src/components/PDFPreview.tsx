import React, { useState, useEffect } from 'react';
import { Download, FileText, Loader, Sparkles } from 'lucide-react';
import { getTemplateDetails, determinarPlantillaCliente } from '../services/reglasNegocio';
import { jsPDF } from 'jspdf';
import { getCartaTemplateMeta } from '../services/cartas';
import { buildAssetUrl } from '../services/paths';

interface PDFPreviewProps {
  solicitud: any;
  onLetterGenerated?: () => void;
  downloadButtonId?: string;
}

export const PDFPreview: React.FC<PDFPreviewProps> = ({ solicitud, onLetterGenerated, downloadButtonId }) => {
  const [templateName, setTemplateName] = useState('CO BASE');
  const [templateConfig, setTemplateConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const headerLogoUrl = buildAssetUrl('assets/SOLICITUD DE CARTAS OFERTA_PROYECTO_image1.png');
  const footerImageUrl = buildAssetUrl('assets/SOLICITUD DE CARTAS OFERTA_PROYECTO_image3.png');
  // const signatureImageUrl = buildAssetUrl('assets/SOLICITUD DE CARTAS OFERTA_PROYECTO_image5.png');

  useEffect(() => {
    const resolveTemplate = async () => {
      setLoading(true);
      try {
        const name = solicitud.plantilla_carta || await determinarPlantillaCliente(solicitud);
        setTemplateName(name);
        
        const details = await getTemplateDetails(name);
        setTemplateConfig(details);
      } catch (error) {
        console.error("Error resolving preview template:", error);
      } finally {
        setLoading(false);
      }
    };
    resolveTemplate();
  }, [solicitud]);

  // Helper function to convert number to words client-side
  const getSalarioLetras = (num: number): string => {
    if (solicitud.salario_letras) return solicitud.salario_letras;

    if (num === 1000) return "MIL Y 00/100 SOLES";
    if (num === 1500) return "MIL QUINIENTOS Y 00/100 SOLES";
    if (num === 2000) return "DOS MIL Y 00/100 SOLES";
    if (num === 2500) return "DOS MIL QUINIENTOS Y 00/100 SOLES";
    if (num === 3000) return "TRES MIL Y 00/100 SOLES";
    if (num === 3500) return "TRES MIL QUINIENTOS Y 00/100 SOLES";
    if (num === 4000) return "CUATRO MIL Y 00/100 SOLES";
    if (num === 5000) return "CINCO MIL Y 00/100 SOLES";
    if (num === 6000) return "SEIS MIL Y 00/100 SOLES";
    if (num === 8000) return "OCHO MIL Y 00/100 SOLES";
    if (num === 10000) return "DIEZ MIL Y 00/100 SOLES";
    
    return `${num} Y 00/100 SOLES`;
  };

  const getVariablesContext = () => {
    const hoy = new Date();
    const meses = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];
    const fechaHoyStr = `${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;

    const salario = Number(solicitud.salario || 0);

    return {
      nombre: String(solicitud.nombres_apellidos || '').toUpperCase().trim(),
      puesto: String(solicitud.puesto || '').toUpperCase().trim(),
      codigo_cr: String(solicitud.codigo_cr || '').toUpperCase().trim(),
      jefe: String(solicitud.nombre_jefe_directo || '—').toUpperCase().trim(),
      salario: salario.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      salario_letras: getSalarioLetras(salario),
      fecha_termino_contrato: solicitud.fecha_termino_contrato || '_______',
      modalidad_trabajo: solicitud.modalidad_trabajo || 'Presencial',
      tipo_personal: solicitud.tipo_personal || '',
      categoria_trabajador: solicitud.categoria_trabajador || '',
      periodo_prueba: templateConfig?.config_defecto?.periodo_prueba || solicitud.periodo_prueba || '03 meses',
      tiempo_contrato: solicitud.tiempo_contrato || '6 meses',
      fecha_hoy: fechaHoyStr,
    };
  };

  const renderTemplateStr = (tmplStr: string, context: Record<string, string>) => {
    if (!tmplStr) return '';
    let res = tmplStr;
    Object.entries(context).forEach(([k, v]) => {
      res = res.split(`{{${k}}}`).join(v || '');
    });
    return res;
  };

  const fetchImageDataUrl = async (assetUrl: string): Promise<string | null> => {
    try {
      const response = await fetch(assetUrl);
      if (!response.ok) {
        return null;
      }

      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn('Error loading carta asset:', assetUrl, error);
      return null;
    }
  };

  const getLetterTexts = () => {
    const context = getVariablesContext();
    if (!templateConfig) {
      // Basic default texts
      return {
        fecha: context.fecha_hoy,
        intro: `Nos complace presentarle esta oferta de empleo para formar parte de la Universidad San Ignacio de Loyola.`,
        cargoLabel: "Cargo:",
        cargoVal: context.puesto,
        jefeLabel: "Dependencia:",
        jefeVal: `Bajo la dirección del puesto ${context.jefe}`,
        compLabel: "Compensación:",
        compVal: `S/ ${context.salario} (${context.salario_letras}) mensuales.`,
        contratoLabel: "Contrato:",
        contratoVal: `Contrato a plazo determinado por ${context.tiempo_contrato}.`,
        horarioLabel: "Horario:",
        horarioVal: `Jornada semanal de 48 horas.`,
        cierre: `Agradecemos su interés en incorporarse a nuestra institución y le solicitamos firmar la copia de la presente en señal de aceptación.`,
        nombre: context.nombre
      };
    }

    const labels = templateConfig.labels || {};
    const templates = templateConfig.templates || {};

    let compVal = renderTemplateStr(templates.compensacion, context);
    if (solicitud.incluye_tarjeta_alimentos) {
      compVal += `\n• Tarjeta de alimentos por un importe de S/ ${Number(solicitud.monto_tarjeta_alimentos || 0).toFixed(2)}`;
    }
    if (solicitud.incluye_bono_transporte) {
      compVal += `\n• Bono de transporte por un importe diario de S/ ${Number(solicitud.monto_bono_transporte || 0).toFixed(2)}`;
    }
    if (solicitud.incluye_movilidad) {
      compVal += `\n• Bono de movilidad por un importe de S/ ${Number(solicitud.monto_movilidad || 0).toFixed(2)} diarios`;
    }

    return {
      fecha: context.fecha_hoy,
      intro: renderTemplateStr(templateConfig.intro, context),
      cargoLabel: labels.cargo || "Cargo:",
      cargoVal: renderTemplateStr(templates.cargo, context),
      jefeLabel: labels.dependencia || "Dependencia:",
      jefeVal: renderTemplateStr(templates.dependencia, context),
      compLabel: labels.compensacion || "Compensación:",
      compVal: compVal,
      contratoLabel: labels.contrato || "Contrato:",
      contratoVal: renderTemplateStr(templates.contrato, context),
      horarioLabel: labels.horario || "Horario de Trabajo:",
      horarioVal: renderTemplateStr(templates.horario, context),
      cierre: renderTemplateStr(templateConfig.cierre, context),
      nombre: context.nombre
    };
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Free/static deployment path: generate PDFs entirely in the browser.
      const texts = getLetterTexts();
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const [headerLogo, footerImage] = await Promise.all([
        fetchImageDataUrl(headerLogoUrl),
        fetchImageDataUrl(footerImageUrl),
      ]);

      if (headerLogo) {
        doc.addImage(headerLogo, 'PNG', 0, 0, pageWidth, 28);
      }
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(128, 128, 128);
      doc.text(`Correlativo: ${solicitud.correlativo || '2410'} | Plantilla: ${templateName}`, 15, 34);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`La Molina, ${texts.fecha}`, 195, 44, { align: "right" });

      doc.text("Estimado (a):", 15, 54);
      doc.setFont("helvetica", "bold");
      doc.text(texts.nombre, 15, 60);

      doc.setFont("helvetica", "normal");
      const introLines = doc.splitTextToSize(texts.intro, 180);
      doc.text(introLines, 15, 70);

      let yPos = 70 + (introLines.length * 6) + 5;

      const drawRow = (label: string, value: string) => {
        doc.setFont("helvetica", "bold");
        doc.text(label, 15, yPos);
        doc.setFont("helvetica", "normal");
        
        const valLines = doc.splitTextToSize(value, 135);
        doc.text(valLines, 55, yPos);
        yPos += (valLines.length * 6) + 4;
      };

      drawRow(texts.cargoLabel, texts.cargoVal);
      drawRow(texts.jefeLabel, texts.jefeVal);
      drawRow(texts.compLabel, texts.compVal);
      drawRow(texts.contratoLabel, texts.contratoVal);
      drawRow(texts.horarioLabel, texts.horarioVal);

      yPos += 2;
      const cierreLines = doc.splitTextToSize(texts.cierre, 180);
      doc.text(cierreLines, 15, yPos);

      yPos += (cierreLines.length * 6) + 20;
      doc.line(15, yPos, 80, yPos);
      doc.setFont("helvetica", "bold");
      doc.text(texts.nombre, 15, yPos + 5);
      doc.setFont("helvetica", "normal");
      doc.text("Candidato / Aceptante", 15, yPos + 10);

      doc.line(130, yPos, 195, yPos);
      // if (signatureImage) {
      //   doc.addImage(signatureImage, 'PNG', 138, yPos - 16, 48, 14);
      // }
      doc.setFont("helvetica", "bold");
      doc.text("Vicepresidencia de Talento", 130, yPos + 5);
      doc.setFont("helvetica", "normal");
      doc.text("Universidad San Ignacio de Loyola", 130, yPos + 10);

      // if (footerImage) {
      //   doc.addImage(footerImage, 'PNG', 0, pageHeight - 18, pageWidth, 18);
      // }

      doc.save(`Carta_Oferta_${texts.nombre.split(' ').join('_')}.pdf`);
      
      if (onLetterGenerated) onLetterGenerated();
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setDownloading(false);
    }
  };

  const templateMeta = getCartaTemplateMeta(templateName);

  const texts = getLetterTexts();

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Document Header Toolbar */}
      <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-usil-blue-700" />
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Vista Previa de la Carta</h2>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
              Plantilla: {templateName} {loading && '(cargando...)'}
            </p>
          </div>
        </div>

        <button
          id={downloadButtonId}
          type="button"
          disabled={downloading || loading}
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-usil-blue-600 hover:bg-usil-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all duration-200 disabled:opacity-50"
        >
          {downloading ? (
            <Loader className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span>Descargar PDF</span>
        </button>
      </div>

      {/* Sheet of Paper Preview */}
      <div className="flex-1 p-8 bg-slate-100/50 overflow-y-auto flex justify-center">
        <div className="w-full max-w-[760px] min-h-[900px] bg-white border border-slate-200/60 shadow-lg px-12 pt-12 pb-24 font-sans text-[13px] leading-relaxed text-slate-800 flex flex-col relative justify-between overflow-hidden">
          
          <div>
            <div className="absolute right-8 top-4 rounded-md bg-usil-blue-700 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
              Modo carta oferta
            </div>

            {templateMeta && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-usil-blue-100 bg-usil-blue-50/70 px-4 py-3">
                <span className="text-xl">{templateMeta.emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-usil-blue-700">{templateMeta.label}</span>
                    <Sparkles className="h-3.5 w-3.5 text-usil-blue-500" />
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{templateMeta.desc}</p>
                </div>
              </div>
            )}

            <div className="mb-8 border-b border-slate-200 pb-4">
              <img
                src={headerLogoUrl}
                alt="USIL"
                className="w-full h-auto object-contain"
              />
              <div className="text-right text-[10px] text-slate-400 font-mono mt-2">
                Correlativo: {solicitud.correlativo || '2410'}
              </div>
            </div>

            {/* Date */}
            <div className="text-right text-slate-700 mb-8 text-[15px]">
              La Molina, {texts.fecha}
            </div>

            {/* Candidate Header */}
            <div className="mb-8">
              <span className="text-slate-700">Estimado (a):</span>
              <h4 className="text-base font-bold text-slate-900 mt-1 uppercase">{texts.nombre || 'CANDIDATO'}</h4>
            </div>

            {/* Intro */}
            <p className="text-slate-700 text-justify mb-8 whitespace-pre-line text-[15px] leading-7">
              {texts.intro}
            </p>

            {/* Table Details */}
            <table className="w-full border-collapse mb-8 text-justify text-[14px]">
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-2.5 font-bold text-slate-600 w-40 valign-top">{texts.cargoLabel}</td>
                  <td className="py-2.5 font-semibold text-slate-800">{texts.cargoVal || '—'}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2.5 font-bold text-slate-600 valign-top">{texts.jefeLabel}</td>
                  <td className="py-2.5 text-slate-700">{texts.jefeVal || '—'}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2.5 font-bold text-slate-600 valign-top">{texts.compLabel}</td>
                  <td className="py-2.5 text-slate-700 whitespace-pre-line">{texts.compVal || '—'}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2.5 font-bold text-slate-600 valign-top">{texts.contratoLabel}</td>
                  <td className="py-2.5 text-slate-700 whitespace-pre-line">{texts.contratoVal || '—'}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2.5 font-bold text-slate-600 valign-top">{texts.horarioLabel}</td>
                  <td className="py-2.5 text-slate-700 whitespace-pre-line">{texts.horarioVal || '—'}</td>
                </tr>
              </tbody>
            </table>

            {/* Cierre */}
            <p className="text-slate-700 text-justify mb-8 whitespace-pre-line text-[14px] leading-7">
              {texts.cierre}
            </p>
          </div>

          {/* Signatures */}
          <div className="flex justify-between items-end mt-12">
            <div>
              <div className="border-t border-slate-300 w-44 pt-1 text-[10px] font-bold text-slate-700">
                {texts.nombre || 'CANDIDATO'}
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">Candidato / Aceptante</div>
            </div>

            <div className="text-right">
              <div className="mt-12 border-t border-slate-300 w-44 pt-1 text-[10px] font-bold text-slate-700 ml-auto">
                Vicepresidencia de Talento
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">Universidad San Ignacio de Loyola</div>
            </div>
          </div>

          {/* 
          <img
            src={footerImageUrl}
            alt="Footer carta"
            className="pointer-events-none absolute bottom-0 left-0 w-full object-cover"
          /> 
          */}

        </div>
      </div>
    </div>
  );
};
