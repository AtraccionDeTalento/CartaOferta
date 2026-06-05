import React from 'react';
import { FileText, CheckSquare, Eye, FileSignature, Landmark, ThumbsUp, Send } from 'lucide-react';
import { WorkflowState, WORKFLOW_TIMELINE_STEPS, getTimelineStepIndex } from '../services/workflow';

interface WorkflowTimelineProps {
  currentState: WorkflowState;
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({ currentState }) => {
  const currentStepIndex = getTimelineStepIndex(currentState);

  const getStepIcon = (key: string, index: number) => {
    const isCompleted = index < currentStepIndex;
    const isActive = index === currentStepIndex;
    const color = isCompleted 
      ? 'text-white' 
      : isActive 
        ? 'text-usil-blue-600' 
        : 'text-slate-400';

    const size = "w-5 h-5";

    switch(key) {
      case 'SOLICITUD': return <FileText className={`${size} ${color}`} />;
      case 'VALIDACION': return <CheckSquare className={`${size} ${color}`} />;
      case 'REVISION': return <Eye className={`${size} ${color}`} />;
      case 'APROBACION': return <ThumbsUp className={`${size} ${color}`} />;
      case 'CARTA': return <Send className={`${size} ${color}`} />;
      case 'FIRMA': return <FileSignature className={`${size} ${color}`} />;
      case 'NOMINA': return <Landmark className={`${size} ${color}`} />;
      default: return <FileText className={`${size} ${color}`} />;
    }
  };

  return (
    <div className="w-full py-6 px-4 bg-slate-50 border border-slate-100 rounded-xl">
      <div className="flex items-center justify-between w-full max-w-4xl mx-auto">
        {WORKFLOW_TIMELINE_STEPS.map((step, idx) => {
          const isCompleted = idx < currentStepIndex;
          const isActive = idx === currentStepIndex;
          const isLast = idx === WORKFLOW_TIMELINE_STEPS.length - 1;

          return (
            <React.Fragment key={step.key}>
              {/* Step Circle */}
              <div className="flex flex-col items-center relative z-10">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                    ${isCompleted 
                      ? 'bg-usil-blue-600 border-usil-blue-600 shadow-md ring-4 ring-usil-blue-100' 
                      : isActive 
                        ? 'bg-white border-usil-blue-600 shadow-md ring-4 ring-usil-blue-100' 
                        : 'bg-white border-slate-200'
                    }`}
                >
                  {getStepIcon(step.key, idx)}
                </div>
                <span 
                  className={`mt-2 text-xs font-semibold whitespace-nowrap transition-colors duration-200
                    ${isActive 
                      ? 'text-usil-blue-600 font-bold' 
                      : isCompleted 
                        ? 'text-slate-700' 
                        : 'text-slate-400'
                    }`}
                >
                  {step.label}
                </span>
                
                {/* Minor label for special states */}
                {isActive && currentState === 'OBSERVADO' && (
                  <span className="absolute -bottom-4 text-[10px] text-red-500 font-medium bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">
                    Observado
                  </span>
                )}
              </div>

              {/* Connecting Line */}
              {!isLast && (
                <div className="flex-1 h-0.5 mx-2 bg-slate-200 relative overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-usil-blue-600 transition-all duration-500 ease-in-out"
                    style={{ width: isCompleted ? '100%' : '0%' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
