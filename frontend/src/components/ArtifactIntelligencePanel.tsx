import React from 'react';
import { BrainCircuit, CheckCircle2, AlertTriangle, Clock, Users, FileQuestion, HelpCircle } from 'lucide-react';

interface ArtifactIntelligencePanelProps {
  document: any;
}

export default function ArtifactIntelligencePanel({ document }: ArtifactIntelligencePanelProps) {
  const insights = document.ai_insights;

  if (!insights) {
    return (
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/5 p-6 flex flex-col items-center justify-center text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center">
          <BrainCircuit className="w-6 h-6 text-indigo-400 opacity-50" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">No Context Insights Available</p>
          <p className="text-xs text-gray-500 mt-1">This document has not been analyzed by the intelligence engine yet.</p>
        </div>
      </div>
    );
  }

  // Pre-defined mapping for the 9 questions to give them specific icons and styles
  const questionConfig: Record<string, { icon: any, color: string }> = {
    "What is the main topic?": { icon: FileQuestion, color: "text-blue-400" },
    "Who is responsible?": { icon: Users, color: "text-emerald-400" },
    "What are the blockers?": { icon: AlertTriangle, color: "text-red-400" },
    "Is there a cost impact?": { icon: AlertTriangle, color: "text-amber-400" },
    "What is the deadline?": { icon: Clock, color: "text-orange-400" },
    "What are the next steps?": { icon: CheckCircle2, color: "text-indigo-400" },
    "Are there any compliance issues?": { icon: ShieldAlert, color: "text-rose-400" },
    "What departments are involved?": { icon: Users, color: "text-teal-400" },
    "Overall Summary": { icon: BrainCircuit, color: "text-neon-cyan" }
  };

  // Fallback icon for unexpected questions
  const getIcon = (q: string) => questionConfig[q]?.icon || HelpCircle;
  const getColor = (q: string) => questionConfig[q]?.color || "text-gray-400";

  return (
    <div className="bg-black/20 backdrop-blur-xl rounded-3xl border border-indigo-500/20 p-6 space-y-6">
      <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-4">
        <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
          <BrainCircuit className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white tracking-wider font-lexend">Artifact Context</h3>
          <p className="text-[10px] text-gray-400 uppercase font-semibold">Automated Insights extracted from document</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(insights).map(([question, answer]: [string, any]) => {
          const Icon = getIcon(question);
          const colorClass = getColor(question);
          
          return (
            <div key={question} className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex items-start gap-3">
                <Icon className={`w-4 h-4 mt-0.5 ${colorClass}`} />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{question}</p>
                  <p className="text-xs text-gray-200 leading-relaxed">{answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Dummy component since ShieldAlert isn't imported from lucide-react above
function ShieldAlert(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}
