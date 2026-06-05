import { addDoc, getCollection, updateDoc } from './firestore';
import { determinarPlantillaCliente } from './reglasNegocio';
import type { UserProfile } from './auth';
import type { WorkflowState } from './workflow';

export interface CartaTemplateOption {
  id: string;
  label: string;
  emoji: string;
  desc: string;
}

export const TIPOS_CARTA: CartaTemplateOption[] = [
  { id: 'CO BASE', label: 'CO BASE', emoji: '📄', desc: 'Contrato estandar para personal administrativo con flujo regular y cobertura EPS.' },
  { id: 'CO BASE (2)', label: 'CO BASE (2)', emoji: '🧩', desc: 'Variante para personal de confianza no fiscalizable.' },
  { id: 'CO BASE (3)', label: 'CO BASE (3)', emoji: '🧾', desc: 'Formato extendido para personal sujeto a fiscalizacion con firmas adicionales.' },
  { id: 'CO (3)', label: 'CO (3)', emoji: '🏢', desc: 'Formato de direccion para cargos institucionales de alto nivel.' },
  { id: 'CO X', label: 'CO X', emoji: '⭐', desc: 'Plazo indeterminado o gerencia ejecutiva con condiciones especiales.' },
  { id: 'CO+mov+teb', label: 'CO+Movilidad+TEB', emoji: '🚘', desc: 'Incluye movilidad y tarjeta de alimentos en la oferta.' },
  { id: 'CO TP', label: 'CO TP', emoji: '🎓', desc: 'Docentes a tiempo parcial con remuneracion por hora lectiva.' },
  { id: 'CO GEF', label: 'CO GEF', emoji: '🏗️', desc: 'Formato para GEF e IE.' },
  { id: 'CO sin eps', label: 'CO sin EPS', emoji: '🚫', desc: 'Oferta sin cobertura EPS.' },
  { id: 'CO Chofer', label: 'CO Chofer', emoji: '🚌', desc: 'Formato para choferes con beneficios complementarios.' },
  { id: 'CO maternidad', label: 'CO Maternidad', emoji: '🤱', desc: 'Suplencia por licencia de maternidad.' },
  { id: 'PRACTICANTE PRE', label: 'Practicante PRE', emoji: '📚', desc: 'Convenio preprofesional de 30 horas semanales.' },
  { id: 'PRACTICANTE PRO', label: 'Practicante PRO', emoji: '🎓', desc: 'Convenio profesional para egresados.' },
  { id: 'CSIR', label: 'CSIR', emoji: '🏫', desc: 'Plantilla para Colegio San Ignacio de Recalde.' },
  { id: 'PART TIME', label: 'PART TIME', emoji: '⏰', desc: 'Jornada parcial con EPS.' },
  { id: 'PART TIME (2)', label: 'PART TIME sin EPS', emoji: '⏱️', desc: 'Jornada parcial sin EPS.' },
  { id: 'operador', label: 'Operador/Promotor', emoji: '🎪', desc: 'Formato de promotores y operadores de eventos.' },
  { id: 'PREPARADOR FISICO', label: 'Preparador Fisico', emoji: '🏃', desc: 'Formato para preparadores fisicos e instructores.' },
];

export const getCartaTemplateMeta = (templateId?: string | null): CartaTemplateOption | null => {
  if (!templateId) return null;
  return TIPOS_CARTA.find((item) => item.id === templateId) || null;
};

const buildHistorialEntry = (
  solicitud: any,
  targetState: WorkflowState,
  actor: UserProfile,
  comentario?: string,
) => ({
  fecha: new Date().toISOString(),
  usuario: actor.displayName,
  rol: actor.role,
  estado_anterior: solicitud.estado,
  estado_nuevo: targetState,
  comentario: comentario || 'Carta oferta generada desde el flujo colaborativo.',
});

export const resolveCartaTemplate = async (solicitud: any): Promise<string> => {
  return solicitud.plantilla_carta || await determinarPlantillaCliente(solicitud);
};

export const generarCartaOferta = async (
  solicitud: any,
  actor: UserProfile,
  comentario?: string,
): Promise<{ cartaId: string; correlativo: number; plantilla: string }> => {
  const plantilla = await resolveCartaTemplate(solicitud);
  const cartas = await getCollection('cartas_oferta');
  const correlativoBase = Math.max(
    2409,
    ...cartas.map((c) => Number(c.correlativo || 0)).filter((value) => Number.isFinite(value)),
  );
  const correlativo = solicitud.correlativo || correlativoBase + 1;

  if (solicitud.carta_id) {
    const currentHistorial = Array.isArray(solicitud.historial) ? solicitud.historial : [];
    await updateDoc('solicitudes_ingreso', solicitud.id, {
      estado: 'CARTA_EMITIDA',
      plantilla_carta: plantilla,
      historial: [
        ...currentHistorial,
        buildHistorialEntry(solicitud, 'CARTA_EMITIDA', actor, comentario),
      ],
    });
    return { cartaId: solicitud.carta_id, correlativo, plantilla };
  }

  const cartaId = await addDoc('cartas_oferta', {
    solicitud_id: solicitud.id,
    correlativo,
    nombre_colaborador: solicitud.nombres_apellidos,
    puesto: solicitud.puesto,
    plantilla_usada: plantilla,
    estado: 'GENERADA',
    created_at: new Date().toISOString(),
  });

  const currentHistorial = Array.isArray(solicitud.historial) ? solicitud.historial : [];
  await updateDoc('solicitudes_ingreso', solicitud.id, {
    estado: 'CARTA_EMITIDA',
    carta_id: cartaId,
    plantilla_carta: plantilla,
    historial: [
      ...currentHistorial,
      buildHistorialEntry(solicitud, 'CARTA_EMITIDA', actor, comentario),
    ],
  });

  return { cartaId, correlativo, plantilla };
};
