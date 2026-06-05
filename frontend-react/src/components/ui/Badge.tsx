import React from 'react';
import { WorkflowState, WORKFLOW_STATES } from '../../services/workflow';

interface BadgeProps {
  state: WorkflowState | string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ state, className = '' }) => {
  const transition = WORKFLOW_STATES[state as WorkflowState];
  const colorClasses = transition 
    ? transition.color 
    : 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClasses} ${className}`}>
      {transition ? transition.label : state}
    </span>
  );
};
