import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, AlertTriangle, TrendingUp, Tag, FileSpreadsheet, Layers, Info } from 'lucide-react';
import BudgetIntegrations from '@/components/BudgetIntegrations';
import LinkedDocumentsPanel from '@/components/LinkedDocumentsPanel';
import { unlinkProjectDocument, deleteProjectDocument, unlinkDecoupledDocument, deleteDecoupledDocument, getProjectBudgets } from '@/services/api';

interface Note {
  id: number;
  content: string;
  department: string;
  is_issue?: boolean;
  priority?: string;
  author_name?: string;
  created_at?: string;
  documents?: any[];
}

interface Document {
  id: number;
  title: string;
  file_url: string;
  file_type?: string;
  department?: string;
  created_at?: string;
  integration_id?: number;
}

interface BudgetsTabProps {
  projectId: number;
  notes: Note[];
  documents: Document[];
  onAddNote: (note: { content: string; department: string; is_issue: boolean; priority: string }) => Promise<void>;
  integrations?: any[];
  boqDocuments?: any[];
  onRefresh?: () => void;
  globalLoading?: boolean;
  setGlobalLoading?: (loading: boolean) => void;
}

export default function BudgetsTab({
  projectId,
  notes = [],
  documents = [],
  onAddNote,
  integrations,
  boqDocuments,
  onRefresh,
  globalLoading,
  setGlobalLoading,
}: BudgetsTabProps) {
  const [internalTab, setInternalTab] = useState<'budget' | 'progress' | 'cost'>('budget');
  const [content, setContent] = useState('');
  const [isIssue, setIsIssue] = useState(false);
  const [priority, setPriority] = useState('Normal');
  const [posting, setPosting] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [budgetRecord, setBudgetRecord] = useState<any>(null);

  const fetchBudgetRecord = async () => {
    try {
      const bList = await getProjectBudgets(projectId);
      if (bList && Array.isArray(bList) && bList.length > 0) {
        setBudgetRecord(bList[0]);
      } else {
        setBudgetRecord(null);
      }
    } catch (err) {
      console.error('Error fetching budget record:', err);
      setBudgetRecord(null);
    }
  };

  useEffect(() => {
    fetchBudgetRecord();
  }, [projectId]);

  const handleUnlinkDocument = async (documentId: number) => {
    if (!onRefresh) return;
    setUnlinkingId(documentId);
    if (setGlobalLoading) setGlobalLoading(true);
    try {
      await unlinkDecoupledDocument(projectId, 'budget', documentId).catch(() => unlinkProjectDocument(projectId, documentId));
      onRefresh();
      fetchBudgetRecord();
    } catch (err) {
      console.error(err);
      alert('Failed to unlink document.');
    } finally {
      setUnlinkingId(null);
      if (setGlobalLoading) setGlobalLoading(false);
    }
  };

  const handleDeleteDocument = async (documentId: number) => {
    if (!onRefresh) return;
    setDeletingId(documentId);
    if (setGlobalLoading) setGlobalLoading(true);
    try {
      await deleteDecoupledDocument(projectId, 'budget', documentId).catch(() => deleteProjectDocument(projectId, documentId));
      onRefresh();
      fetchBudgetRecord();
    } catch (err) {
      console.error(err);
      alert('Failed to delete document data.');
    } finally {
      setDeletingId(null);
      if (setGlobalLoading) setGlobalLoading(false);
    }
  };

  // Filter notes globally for Budgets tab
  const filteredNotes = notes.filter((n) => n.department?.toUpperCase() === 'BUDGET');
  
  // Base docs for budget
  const baseBudgetDocs = documents.filter((d) => d.department?.toUpperCase() === 'BUDGET');
  
  // Filter docs based on internal tab using title prefix
  const filteredDocs = baseBudgetDocs.filter((d) => {
    if (internalTab === 'progress') return d.title.startsWith('[Progress]');
    if (internalTab === 'cost') return d.title.startsWith('[Cost]');
    return d.title.startsWith('[Budget]') || (!d.title.startsWith('[Progress]') && !d.title.startsWith('[Cost]'));
  });

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    try {
      await onAddNote({
        content,
        department: 'BUDGET',
        is_issue: isIssue,
        priority: isIssue ? priority : 'Normal',
      });
      setContent('');
      setIsIssue(false);
      setPriority('Normal');
    } catch (err) {
      console.error(err);
    } finally {
      setPosting(false);
    }
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val);
  };

  const valuesMap = budgetRecord?.values_map || {};
  const masterCleaned = valuesMap.master_cleaned_table || {};
  const masterMatrix: any[] = valuesMap.master_bundle_matrix || [];
  const bundleConfig = valuesMap.bundle_config || { expected_count: 1, linked_count: 1 };

  const originalSum = masterCleaned.original_contract_sum || valuesMap.original_contract_sum || budgetRecord?.amount || 0;
  const appraisedBudget = masterCleaned.appraised_budget ?? valuesMap.appraised_budget ?? budgetRecord?.revised_amount;
  const isAppraised = valuesMap.is_appraised || (appraisedBudget !== null && appraisedBudget !== undefined && appraisedBudget !== originalSum);
  const effectiveBudget = (appraisedBudget !== null && appraisedBudget !== undefined && Number(appraisedBudget) > 0)
    ? Number(appraisedBudget)
    : originalSum;
  const earnedValue = masterCleaned.earned_value ?? valuesMap.earned_value ?? budgetRecord?.earned_value ?? 0;
  const remainingBalance = masterCleaned.remaining_balance ?? valuesMap.remaining_balance ?? Math.max(0, effectiveBudget - earnedValue);
  const percentUsed = masterCleaned.percent_used ?? valuesMap.percent_used ?? (effectiveBudget > 0 ? Math.min(100, (earnedValue / effectiveBudget) * 100) : 0);
  const categories: any[] = masterCleaned.reconciled_categories || valuesMap.summary_breakdown || [];
  const detectedOverlaps: string[] = masterCleaned.detected_overlaps || [];

  return (
    <div className="space-y-6">
      {/* Top Header Summary Card */}
      <div className="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950 text-white rounded-3xl p-8 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Baseline & EVM Module</span>
          <h2 className="text-xl font-bold font-lexend mt-1">Project Budgets & EVM</h2>
          <p className="text-xs text-emerald-100/80 mt-1 max-w-lg">System-reconciled master budget overview, category appraisals, and earned value tracking.</p>
        </div>

        <div className="flex items-center space-x-4 relative z-10 flex-shrink-0">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-right">
            <p className="text-[10px] font-bold text-emerald-200 uppercase">Master Effective Budget</p>
            <p className="text-sm font-bold font-lexend text-white mt-0.5">{formatCurrency(effectiveBudget)}</p>
          </div>
          <div className="bg-white/15 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-right">
            <p className="text-[10px] font-bold text-emerald-200 uppercase">Master EV / % Used</p>
            <p className="text-sm font-bold font-lexend text-white mt-0.5">{formatCurrency(earnedValue)} ({percentUsed.toFixed(1)}%)</p>
          </div>
        </div>
      </div>

      {/* Master Cleaned-Up Executive Budget Table & Cards */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-dark-teal-700 font-inter">
                Master Cleaned-Up Table
              </span>
              {bundleConfig.expected_count > 1 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                  <Layers className="w-3 h-3 mr-1" /> Bundle Rollup ({bundleConfig.linked_count} of {bundleConfig.expected_count} Workbooks)
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold font-lexend text-gray-900 mt-0.5">System-Reconciled Master Project Budget</h3>
          </div>
          {isAppraised && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold">
              <Tag className="w-3.5 h-3.5 mr-1" /> Master Budget Appraised
            </span>
          )}
        </div>

        {/* Cross-Workbook Overlap Detection Explanation Bar */}
        {detectedOverlaps.length > 0 && (
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 space-y-1 text-xs text-indigo-950 font-medium">
            <div className="flex items-center space-x-2 font-bold text-indigo-900">
              <Info className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span>Cross-Workbook Reconciliation Notices:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-indigo-900/90 pl-1">
              {detectedOverlaps.map((notice, idx) => (
                <li key={idx}>{notice}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-150 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Original Master Contract Sum</span>
            <p className="text-sm font-bold font-lexend text-gray-900">{formatCurrency(originalSum)}</p>
          </div>

          <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-150 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Appraised Master Budget</span>
              {isAppraised && <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />}
            </div>
            <p className="text-sm font-bold font-lexend text-indigo-950">
              {isAppraised ? formatCurrency(appraisedBudget) : 'No Revisions'}
            </p>
          </div>

          <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-150 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Earned Value to Date</span>
            <p className="text-sm font-bold font-lexend text-emerald-950">{formatCurrency(earnedValue)}</p>
          </div>

          <div className="bg-dark-teal-50/40 p-4 rounded-2xl border border-dark-teal-150 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-dark-teal-700">Remaining Master Balance</span>
            <p className="text-sm font-bold font-lexend text-dark-teal-950">{formatCurrency(remainingBalance)}</p>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between items-center text-xs font-bold font-lexend">
            <span className="text-gray-600 flex items-center">
              <TrendingUp className="w-3.5 h-3.5 mr-1 text-dark-teal-600" /> Total Project Budget Consumption
            </span>
            <span className="text-dark-teal-900 font-extrabold">{percentUsed.toFixed(1)}% Consumed</span>
          </div>
          <div className="w-full bg-gray-150 h-3 rounded-full overflow-hidden p-0.5 border border-gray-200">
            <div
              className="bg-gradient-to-r from-dark-teal-700 via-dark-teal-600 to-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${percentUsed}%` }}
            />
          </div>
        </div>

        {/* Master Reconciled Category Table */}
        {categories.length > 0 && (
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold font-lexend text-gray-900">Reconciled Master Category Breakdowns</h4>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{categories.length} Categories</span>
            </div>

            <div className="overflow-x-auto border border-gray-150 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[10px] border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3">Category Name</th>
                    <th className="px-4 py-3 text-right">Original ($)</th>
                    <th className="px-4 py-3 text-right">Appraised ($)</th>
                    <th className="px-4 py-3 text-right">Earned Value ($)</th>
                    <th className="px-4 py-3 text-right">Variance (Delta)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {categories.map((cat, idx) => {
                    const orig = cat.original_amount || 0;
                    const appr = cat.appraised_amount !== undefined && cat.appraised_amount !== null ? cat.appraised_amount : orig;
                    const delta = cat.appraisal_delta ?? (appr - orig);
                    const isCatAppraised = cat.is_appraised || appr !== orig;

                    return (
                      <tr key={idx} className="hover:bg-gray-50/80 transition">
                        <td className="px-4 py-3 font-bold text-gray-900">{cat.category_name}</td>
                        <td className="px-4 py-3 text-right text-gray-700 font-semibold">{formatCurrency(orig)}</td>
                        <td className="px-4 py-3 text-right font-bold text-indigo-950">
                          {isCatAppraised ? formatCurrency(appr) : <span className="text-gray-400 font-normal">-</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-950">{formatCurrency(cat.earned_value_to_date || 0)}</td>
                        <td className="px-4 py-3 text-right font-bold">
                          {isCatAppraised ? (
                            <span className={delta >= 0 ? 'text-indigo-600' : 'text-red-600'}>
                              {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
                            </span>
                          ) : (
                            <span className="text-gray-400 font-normal">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Internal Navigation Ribbon */}
      <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
        {[
          { key: 'budget', label: 'Project Budget' },
          { key: 'progress', label: 'Work Progress Calculations' },
          { key: 'cost', label: 'Cost Tracking' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setInternalTab(tab.key as any)}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
              internalTab === tab.key 
                ? 'bg-dark-teal-50 text-dark-teal-900 border border-dark-teal-100 shadow-sm' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cloud Integration Manager Component with Inline Preview Drawers */}
      {integrations && onRefresh && setGlobalLoading && (
        <BudgetIntegrations
          projectId={projectId}
          integrations={integrations.filter(i => i.module === 'budgets' || i.module === 'budget')}
          documents={documents}
          masterMatrix={masterMatrix}
          onRefresh={() => {
            onRefresh();
            fetchBudgetRecord();
          }}
          globalLoading={globalLoading}
          setGlobalLoading={setGlobalLoading}
        />
      )}

      {/* Linked Documents Panel */}
      <LinkedDocumentsPanel
        title={`Linked ${internalTab === 'budget' ? 'Project Budget' : internalTab === 'progress' ? 'Work Progress' : 'Cost Tracking'} Files`}
        documents={filteredDocs}
        onUnlink={handleUnlinkDocument}
        onDelete={handleDeleteDocument}
        unlinkingId={unlinkingId}
        deletingId={deletingId}
        emptyMessage="No files linked yet."
      />

      {/* Discussion & Note Form */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
        <h3 className="text-sm font-bold font-lexend text-gray-800">Add Discussion Note / Log Issue</h3>
        <form onSubmit={handlePostNote} className="space-y-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share a budget update or log an allocation issue..."
            rows={3}
            className="w-full p-4 bg-gray-50 border border-gray-150 rounded-2xl text-xs focus:ring-2 focus:ring-dark-teal-500/20 focus:border-dark-teal-500 focus:outline-none transition font-medium"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="flex items-center space-x-6">
              <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isIssue}
                  onChange={(e) => setIsIssue(e.target.checked)}
                  className="w-4 h-4 rounded text-dark-teal-900 border-gray-300 focus:ring-dark-teal-500"
                />
                <span className="text-xs font-bold text-gray-700">Flag as Site Issue</span>
              </label>

              {isIssue && (
                <div className="flex items-center space-x-2 animate-fade-in">
                  <span className="text-xs text-gray-400 font-semibold">Priority:</span>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="p-1.5 bg-gray-50 border border-gray-150 rounded-xl text-xs font-bold text-gray-700 focus:outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={posting || !content.trim()}
              className="px-5 py-3 bg-dark-teal-800 hover:bg-dark-teal-900 text-white font-bold rounded-xl text-xs shadow-md disabled:opacity-50 transition active:scale-95 flex items-center space-x-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{posting ? 'Posting...' : 'Post Entry'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Discussion Feed */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-inter">Discussion Feed</h4>
        {filteredNotes.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-gray-200">
            <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400 font-medium">No notes recorded for budgets yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className={`bg-white rounded-3xl p-6 border shadow-sm transition ${
                  note.is_issue ? 'border-deep-crimson-200 bg-deep-crimson-50/20' : 'border-gray-100'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold font-lexend text-gray-900">{note.author_name || 'Team Member'}</span>
                    <span className="text-xs text-gray-400">• {note.created_at ? new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}</span>
                  </div>

                  {note.is_issue && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-deep-crimson-50 text-deep-crimson-700 border border-deep-crimson-200">
                      <AlertTriangle className="w-3 h-3 mr-1" /> {note.priority || 'High'} Issue
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line font-medium">{note.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
