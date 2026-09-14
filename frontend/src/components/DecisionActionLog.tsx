import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProjectDecisions, getProjectActions, createProjectDecision, createProjectAction, updateProjectDecision, updateProjectAction, suggestAssignee } from '@/services/api';
import { Shield, Target, Plus, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronRight, User, BrainCircuit, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface DecisionActionLogProps {
  projectId: number;
  documentId: number;
}

export default function DecisionActionLog({ projectId, documentId }: DecisionActionLogProps) {
  const queryClient = useQueryClient();
  const [isAddingDecision, setIsAddingDecision] = useState(false);
  const [newDecision, setNewDecision] = useState({ title: '', description: '', status: 'Proposed', made_on: format(new Date(), 'yyyy-MM-dd') });
  
  const [addingActionToDecision, setAddingActionToDecision] = useState<number | null>(null);
  const [newAction, setNewAction] = useState({ description: '', due_date: '', status: 'Pending', assigned_to: 1 });
  const [suggestingAssigneeForDecision, setSuggestingAssigneeForDecision] = useState<number | null>(null);
  const [assigneeReasoning, setAssigneeReasoning] = useState<string>('');

  const { data: decisions = [], isLoading: loadingDecisions } = useQuery({
    queryKey: ['decisions', projectId, documentId],
    queryFn: () => getProjectDecisions(projectId, documentId),
    enabled: !!projectId && !!documentId,
  });

  const { data: actions = [], isLoading: loadingActions } = useQuery({
    queryKey: ['actions', projectId, documentId],
    queryFn: () => getProjectActions(projectId, documentId),
    enabled: !!projectId && !!documentId,
  });

  const handleCreateDecision = async () => {
    if (!newDecision.title) return;
    await createProjectDecision(projectId, { ...newDecision, document_id: documentId });
    queryClient.invalidateQueries({ queryKey: ['decisions', projectId, documentId] });
    setIsAddingDecision(false);
    setNewDecision({ title: '', description: '', status: 'Proposed', made_on: format(new Date(), 'yyyy-MM-dd') });
  };

  const handleCreateAction = async (decisionId: number) => {
    if (!newAction.description) return;
    await createProjectAction(projectId, { ...newAction, decision_id: decisionId, document_id: documentId });
    queryClient.invalidateQueries({ queryKey: ['actions', projectId, documentId] });
    setAddingActionToDecision(null);
    setNewAction({ description: '', due_date: '', status: 'Pending', assigned_to: 1 });
    setAssigneeReasoning('');
  };

  const handleUpdateDecisionStatus = async (id: number, status: string) => {
    await updateProjectDecision(projectId, id, { status });
    queryClient.invalidateQueries({ queryKey: ['decisions', projectId, documentId] });
  };

  const handleUpdateActionStatus = async (id: number, status: string) => {
    await updateProjectAction(projectId, id, { status });
    queryClient.invalidateQueries({ queryKey: ['actions', projectId, documentId] });
  };

  const statusColors: any = {
    'Proposed': 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    'Approved': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    'Reversed': 'text-rose-400 bg-rose-400/10 border-rose-400/20',
    'Pending': 'text-gray-400 bg-gray-400/10 border-gray-400/20',
    'In Progress': 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    'Completed': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 font-inter flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-500" />
          Decisions & Actions Log
        </h4>
        <button
          onClick={() => setIsAddingDecision(!isAddingDecision)}
          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Log Decision
        </button>
      </div>

      {isAddingDecision && (
        <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-5 space-y-4 animate-fade-in">
          <input
            type="text"
            placeholder="Decision Title (e.g. Approved structural revision V2)"
            value={newDecision.title}
            onChange={e => setNewDecision({ ...newDecision, title: e.target.value })}
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
          />
          <textarea
            placeholder="Context or reasoning..."
            value={newDecision.description}
            onChange={e => setNewDecision({ ...newDecision, description: e.target.value })}
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 min-h-[80px]"
          />
          <div className="flex items-center justify-between pt-2">
            <select
              value={newDecision.status}
              onChange={e => setNewDecision({ ...newDecision, status: e.target.value })}
              className="bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 appearance-none cursor-pointer"
            >
              <option value="Proposed">Proposed</option>
              <option value="Approved">Approved</option>
            </select>
            <div className="flex items-center gap-3">
              <button onClick={() => setIsAddingDecision(false)} className="text-xs font-semibold text-gray-400 hover:text-white">Cancel</button>
              <button
                onClick={handleCreateDecision}
                disabled={!newDecision.title}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50 transition-colors"
              >
                Save Decision
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {decisions.length === 0 && !isAddingDecision ? (
          <div className="text-center py-8">
            <p className="text-xs text-gray-500 font-medium">No formal decisions logged for this artifact.</p>
          </div>
        ) : (
          decisions.map((decision: any) => {
            const decisionActions = actions.filter((a: any) => a.decision_id === decision.id);
            return (
              <div key={decision.id} className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-sm hover:border-white/20 transition-colors">
                <div className="p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white/[0.02]">
                  <div>
                    <h5 className="text-sm font-bold text-white font-lexend">{decision.title}</h5>
                    {decision.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{decision.description}</p>}
                    <div className="flex items-center gap-3 mt-3 text-[10px] font-semibold text-gray-500 uppercase">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {decision.made_on || format(new Date(decision.created_at), 'MMM dd, yyyy')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={decision.status}
                      onChange={(e) => handleUpdateDecisionStatus(decision.id, e.target.value)}
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border appearance-none cursor-pointer outline-none ${statusColors[decision.status] || statusColors['Approved']}`}
                    >
                      <option value="Proposed">Proposed</option>
                      <option value="Approved">Approved</option>
                      <option value="Reversed">Reversed</option>
                    </select>
                  </div>
                </div>

                <div className="bg-black/20 p-4 border-t border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                      <Target className="w-3 h-3" /> Follow-up Actions
                    </span>
                    <button
                      onClick={() => setAddingActionToDecision(decision.id)}
                      className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Action
                    </button>
                  </div>

                  {addingActionToDecision === decision.id && (
                    <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-3 mb-3 animate-fade-in">
                      <div className="flex items-start gap-3 mb-2">
                        <input
                          type="text"
                          placeholder="Action description..."
                          value={newAction.description}
                          onChange={e => setNewAction({ ...newAction, description: e.target.value })}
                          className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                        />
                        <input
                          type="date"
                          value={newAction.due_date}
                          onChange={e => setNewAction({ ...newAction, due_date: e.target.value })}
                          className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                        />
                        <button
                          onClick={() => handleCreateAction(decision.id)}
                          disabled={!newAction.description}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!newAction.description) {
                              alert("Please enter a description first.");
                              return;
                            }
                            setSuggestingAssigneeForDecision(decision.id);
                            try {
                              const suggestion = await suggestAssignee(projectId, newAction.description, documentId);
                              setNewAction({ ...newAction, assigned_to: suggestion.user_id });
                              setAssigneeReasoning(suggestion.reasoning);
                            } catch (e) {
                              console.error("Failed to suggest assignee", e);
                            } finally {
                              setSuggestingAssigneeForDecision(null);
                            }
                          }}
                          disabled={suggestingAssigneeForDecision === decision.id || !newAction.description}
                          className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-fuchsia-400 hover:text-white bg-fuchsia-500/10 hover:bg-fuchsia-500/30 border border-fuchsia-500/30 px-2 py-1 rounded transition-colors disabled:opacity-50"
                        >
                          {suggestingAssigneeForDecision === decision.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
                          {suggestingAssigneeForDecision === decision.id ? 'Analyzing...' : 'Auto-Assign'}
                        </button>
                        {assigneeReasoning && (
                          <span className="text-[10px] text-gray-400 italic">
                            Assigned to User #{newAction.assigned_to}: {assigneeReasoning}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {decisionActions.length === 0 && addingActionToDecision !== decision.id ? (
                    <p className="text-[10px] text-gray-600 font-medium">No actions assigned.</p>
                  ) : (
                    <div className="space-y-2">
                      {decisionActions.map((action: any) => (
                        <div key={action.id} className="flex items-center justify-between bg-white/5 rounded-lg p-2.5 border border-white/5">
                          <div className="flex items-center gap-3">
                            <CheckCircle className={`w-4 h-4 ${action.status === 'Completed' ? 'text-emerald-500' : 'text-gray-600'}`} />
                            <span className={`text-xs ${action.status === 'Completed' ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                              {action.description}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {action.due_date && <span className="text-[10px] font-bold text-gray-500 uppercase">{format(new Date(action.due_date), 'MMM dd')}</span>}
                            <select
                              value={action.status}
                              onChange={(e) => handleUpdateActionStatus(action.id, e.target.value)}
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border appearance-none cursor-pointer outline-none ${statusColors[action.status] || statusColors['Pending']}`}
                            >
                              <option value="Pending">Pending</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Completed">Completed</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
