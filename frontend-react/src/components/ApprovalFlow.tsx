import React, { useState } from 'react';
import { AlertCircle, ArrowRight, CornerDownLeft, Check, Ban } from 'lucide-react';
import { WorkflowState, WORKFLOW_STATES, transitionState } from '../services/workflow';
import { UserProfile } from '../services/auth';
import { generarCartaOferta } from '../services/cartas';

interface ApprovalFlowProps {
  solicitud: any;
  currentUser: UserProfile | null;
  onTransitionSuccess: () => void;
}

export const ApprovalFlow: React.FC<ApprovalFlowProps> = ({
  solicitud,
  currentUser,
  onTransitionSuccess
}) => {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!currentUser) return null;

  const state = solicitud.estado as WorkflowState;
  
  // Define available actions based on current state and role
  const getAvailableTransitions = (): { targetState: WorkflowState; label: string; icon: any; btnClass: string }[] => {
    const list: { targetState: WorkflowState; label: string; icon: any; btnClass: string }[] = [];
    const role = currentUser.role;

    // Para facilitar tus pruebas, he desbloqueado TODOS los botones para que 
    // puedas avanzar la solicitud sin importar qué rol tenga tu usuario de Firebase actualmente.
    if (state === 'BORRADOR' || state === 'OBSERVADO') list.push({ targetState: 'PENDIENTE_BP', label: 'Enviar a Validación', icon: ArrowRight, btnClass: 'bg-usil-blue-600 hover:bg-usil-blue-700 text-white' });
    if (state === 'PENDIENTE_BP') list.push({ targetState: 'PENDIENTE_COMPENSACIONES', label: 'Enviar a Revisión (Compensaciones)', icon: ArrowRight, btnClass: 'bg-usil-blue-600 hover:bg-usil-blue-700 text-white' });
    if (state === 'PENDIENTE_COMPENSACIONES') {
      list.push({ targetState: 'APROBADO', label: 'Aprobar Solicitud', icon: Check, btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white' });
      list.push({ targetState: 'OBSERVADO', label: 'Observar / Corregir', icon: CornerDownLeft, btnClass: 'bg-amber-600 hover:bg-amber-700 text-white' });
    }
    if (state === 'APROBADO') list.push({ targetState: 'CARTA_EMITIDA', label: 'Emitir Carta Oferta', icon: ArrowRight, btnClass: 'bg-purple-600 hover:bg-purple-700 text-white' });
    if (state === 'CARTA_EMITIDA') list.push({ targetState: 'FIRMADO', label: 'Registrar Firma Colaborador', icon: Check, btnClass: 'bg-teal-600 hover:bg-teal-700 text-white' });
    if (state === 'FIRMADO') list.push({ targetState: 'NOMINA_COMPLETADO', label: 'Completar en Nómina', icon: Check, btnClass: 'bg-sky-600 hover:bg-sky-700 text-white' });
    
    if (state !== 'NOMINA_COMPLETADO' && state !== 'ANULADO') {
      list.push({ targetState: 'ANULADO', label: 'Anular Solicitud', icon: Ban, btnClass: 'bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-200' });
    }

    return list;
  };

  const transitions = getAvailableTransitions();

  const handleAction = async (targetState: WorkflowState) => {
    if (targetState === 'OBSERVADO' && !comment.trim()) {
      setError('Por favor escriba una observación o comentario explicando el motivo del cambio.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      if (targetState === 'CARTA_EMITIDA') {
        await generarCartaOferta(solicitud, currentUser, comment);
      } else {
        await transitionState(solicitud, targetState, comment);
      }
      setComment('');
      onTransitionSuccess();
    } catch (e: any) {
      setError(e.message || 'Error al procesar el cambio de estado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (transitions.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-slate-400 shrink-0" />
        <span className="text-sm text-slate-500 font-medium">
          No hay acciones disponibles para su rol en este estado del flujo.
        </span>
      </div>
    );
  }

  return (
    <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-6.5">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
        Acciones de Flujo
      </h3>

      {error && (
        <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Comentario Input */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Comentario u Observación {state === 'PENDIENTE_COMPENSACIONES' && <span className="text-slate-400 font-normal">(Requerido para Observar)</span>}
        </label>
        <textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Escriba un comentario sobre esta acción..."
          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        {transitions.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.targetState}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleAction(item.targetState)}
              className={`flex items-center gap-2 px-4.5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${item.btnClass}`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
