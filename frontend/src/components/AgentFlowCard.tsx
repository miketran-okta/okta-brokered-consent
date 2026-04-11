'use client';

import { AgentFlowStep } from '@/types';

interface Props {
  steps: AgentFlowStep[];
  isLoading?: boolean;
}

export default function AgentFlowCard({ steps, isLoading }: Props) {
  // Detect if this is Jira or GitHub based on steps
  const isJira = steps.some(s => s.step === 'execute_jira');
  const executeStep = isJira ? 'execute_jira' : 'execute_github';

  // Define workflow stages with progressive colors (using inline styles for reliability)
  const workflowStages = [
    {
      id: 'router',
      label: 'Router',
      icon: 'RT',
      bgColor: '#60a5fa',           // Light Blue
      inactiveBg: 'rgba(96, 165, 250, 0.2)',
      textColor: '#2563eb'
    },
    {
      id: 'sts_exchange',
      label: 'OAuth-STS',
      icon: 'STS',
      bgColor: '#fbbf24',           // Yellow
      inactiveBg: 'rgba(251, 191, 36, 0.2)',
      textColor: '#d97706'
    },
    {
      id: executeStep,
      label: isJira ? 'Jira' : 'GitHub',
      icon: isJira ? 'JR' : 'GH',
      bgColor: isJira ? '#2196f3' : '#4ade80',
      inactiveBg: isJira ? 'rgba(33, 150, 243, 0.2)' : 'rgba(74, 222, 128, 0.2)',
      textColor: isJira ? '#1565c0' : '#16a34a'
    },
    {
      id: 'generate_response',
      label: 'Response',
      icon: '✓',
      bgColor: '#16a34a',           // Dark Green
      inactiveBg: 'rgba(22, 163, 74, 0.2)',
      textColor: '#15803d'
    },
  ];

  const getStepStatus = (stageId: string) => {
    const step = steps.find(s => s.step === stageId);
    return step?.status || 'inactive';
  };

  return (
    <div className="rounded-xl border-2 shadow-sm overflow-hidden" style={{ backgroundColor: '#e0f2f1', borderColor: '#26a69a' }}>
      <div className="bg-gradient-to-r from-primary to-primary-light px-4 py-3 border-b border-neutral-border">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Agent Flow</span>
          <span className="text-white/60 text-sm font-normal">— LangGraph + Claude</span>
        </h3>
      </div>

      <div className="p-4">
        {/* Visual Workflow */}
        <div className="flex items-center justify-center gap-1">
          {workflowStages.map((stage, idx) => {
            const status = getStepStatus(stage.id);
            const isActive = status === 'processing';
            const isCompleted = status === 'completed';
            const isError = status === 'error';

            return (
              <div key={stage.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                      isActive ? 'animate-pulse' : ''
                    }`}
                    style={{
                      backgroundColor: isCompleted || isActive ? stage.bgColor : isError ? '#ef4444' : stage.inactiveBg,
                      color: isCompleted || isActive || isError ? '#ffffff' : stage.textColor,
                      boxShadow: isCompleted ? '0 4px 6px -1px rgba(0,0,0,0.1)' : isActive ? '0 10px 15px -3px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                  >
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : isError ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : isActive ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      stage.icon
                    )}
                  </div>
                  <span
                    className="text-[10px] mt-1 font-medium"
                    style={{ color: isCompleted || isActive ? stage.textColor : '#6b7280' }}
                  >
                    {stage.label}
                  </span>
                </div>

                {/* Arrow between stages */}
                {idx < workflowStages.length - 1 && (
                  <svg className="w-4 h-4 text-gray-300 mx-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>

        {/* Step Details */}
        {steps.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="space-y-1">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between text-xs px-2 py-1 rounded ${
                    step.status === 'completed' ? 'bg-success-green/5' :
                    step.status === 'error' ? 'bg-error-red/5' :
                    step.status === 'processing' ? 'bg-accent/5' :
                    'bg-gray-50'
                  }`}
                >
                  <span className="text-gray-600 font-mono">{step.step}</span>
                  <span className={`${
                    step.status === 'completed' ? 'text-success-green' :
                    step.status === 'error' ? 'text-error-red' :
                    step.status === 'processing' ? 'text-accent' :
                    'text-gray-400'
                  }`}>
                    {step.action}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <svg className="w-4 h-4 text-accent animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-sm text-gray-600">Processing request...</span>
          </div>
        )}

        {/* Empty state */}
        {steps.length === 0 && !isLoading && (
          <div className="text-center py-4 text-gray-400">
            <p className="text-sm">Send a message to see the agent workflow</p>
          </div>
        )}
      </div>
    </div>
  );
}
