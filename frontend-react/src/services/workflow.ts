import { updateDoc } from './firestore';
import { getCurrentUser } from './auth';

export type WorkflowState = 
  | 'BORRADOR' 
  | 'PENDIENTE_BP' 
  | 'PENDIENTE_COMPENSACIONES' 
  | 'APROBADO' 
  | 'CARTA_EMITIDA' 
  | 'FIRMADO' 
  | 'NOMINA_COMPLETADO' 
  | 'OBSERVADO'
  | 'ANULADO';

export interface WorkflowTransition {
  state: WorkflowState;
  label: string;
  color: string;
  allowedRoles: string[];
}

export interface HistorialEntry {
  fecha: string;
  usuario: string;
  rol: string;
  estado_anterior: WorkflowState;
  estado_nuevo: WorkflowState;
  comentario?: string;
}

export const WORKFLOW_STATES: Record<WorkflowState, WorkflowTransition> = {
  BORRADOR: {
    state: 'BORRADOR',
    label: 'Borrador',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    allowedRoles: ['Business Partner', 'Admin']
  },
  PENDIENTE_BP: {
    state: 'PENDIENTE_BP',
    label: 'Pendiente Validación BP',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    allowedRoles: ['Business Partner', 'Admin']
  },
  PENDIENTE_COMPENSACIONES: {
    state: 'PENDIENTE_COMPENSACIONES',
    label: 'En Revisión (Compensaciones)',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    allowedRoles: ['Compensaciones', 'Admin']
  },
  APROBADO: {
    state: 'APROBADO',
    label: 'Aprobado',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    allowedRoles: ['Compensaciones', 'Admin']
  },
  CARTA_EMITIDA: {
    state: 'CARTA_EMITIDA',
    label: 'Carta Emitida',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    allowedRoles: ['Compensaciones', 'Admin']
  },
  FIRMADO: {
    state: 'FIRMADO',
    label: 'Firmado por Colaborador',
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    allowedRoles: ['Compensaciones', 'Admin']
  },
  NOMINA_COMPLETADO: {
    state: 'NOMINA_COMPLETADO',
    label: 'Registrado en Nómina',
    color: 'bg-sky-50 text-sky-700 border-sky-200',
    allowedRoles: ['Nómina', 'Admin']
  },
  OBSERVADO: {
    state: 'OBSERVADO',
    label: 'Observado / Corregir',
    color: 'bg-red-50 text-red-700 border-red-200',
    allowedRoles: ['Compensaciones', 'Admin']
  },
  ANULADO: {
    state: 'ANULADO',
    label: 'Anulado',
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    allowedRoles: ['Business Partner', 'Compensaciones', 'Admin']
  }
};

// Visual timeline helper
export const WORKFLOW_TIMELINE_STEPS = [
  { key: 'SOLICITUD', label: 'Solicitud', states: ['BORRADOR'] },
  { key: 'VALIDACION', label: 'Validación', states: ['PENDIENTE_BP'] },
  { key: 'REVISION', label: 'Revisión', states: ['PENDIENTE_COMPENSACIONES', 'OBSERVADO'] },
  { key: 'APROBACION', label: 'Aprobación', states: ['APROBADO'] },
  { key: 'CARTA', label: 'Carta Oferta', states: ['CARTA_EMITIDA'] },
  { key: 'FIRMA', label: 'Firma', states: ['FIRMADO'] },
  { key: 'NOMINA', label: 'Nómina', states: ['NOMINA_COMPLETADO'] }
];

export const getTimelineStepIndex = (currentState: WorkflowState): number => {
  return WORKFLOW_TIMELINE_STEPS.findIndex(step => step.states.includes(currentState));
};

export const transitionState = async (
  solicitud: any,
  newState: WorkflowState,
  comentario?: string
): Promise<void> => {
  const user = getCurrentUser();
  if (!user) throw new Error("No active user session.");

  const transition = WORKFLOW_STATES[newState];
  if (!transition) throw new Error(`Invalid target state: ${newState}`);

  // Check role permission
  if (!transition.allowedRoles.includes(user.role)) {
    throw new Error(`Your role (${user.role}) is not allowed to transition to ${transition.label}`);
  }

  // Create audit entry
  const entry: HistorialEntry = {
    fecha: new Date().toISOString(),
    usuario: user.displayName,
    rol: user.role,
    estado_anterior: solicitud.estado,
    estado_nuevo: newState,
    comentario: comentario || ""
  };

  const currentHistorial = Array.isArray(solicitud.historial) ? solicitud.historial : [];
  const updatedHistorial = [...currentHistorial, entry];

  // Update Firestore / LocalStorage
  await updateDoc('solicitudes_ingreso', solicitud.id, {
    estado: newState,
    historial: updatedHistorial
  });
};
