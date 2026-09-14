import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, AlertTriangle, TrendingUp, Tag, FileSpreadsheet, Layers, Info, Edit3, Check, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import BudgetIntegrations from '@/components/BudgetIntegrations';
import CollaborationPanel from '@/components/CollaborationPanel';
import { getProjectBudgets, updateBudgetWorkbookMatrix, updateProjectBudget, unlinkDecoupledDocument, unlinkProjectDocument, deleteDecoupledDocument, deleteProjectDocument } from '@/services/api';
import LinkedDocumentsPanel from '@/components/LinkedDocumentsPanel';

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
  uploaded_by?: number;
  cloud_email?: string;
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
  const [editingHeaderKey, setEditingHeaderKey] = useState<string | null>(null);
  const [headerInput, setHeaderInput] = useState('');
  const [savingHeader, setSavingHeader] = useState(false);
  const [isMasterCategoriesOpen, setIsMasterCategoriesOpen] = useState(false);
  const [isEditingMasterMetrics, setIsEditingMasterMetrics] = useState(false);
  const [savingMasterMetrics, setSavingMasterMetrics] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [masterMetricsInput, setMasterMetricsInput] = useState({
    original: 0,
    appraised: 0,
    ev: 0,
    remaining: 0
  });

  const queryClient = useQueryClient();
  const { data: budgetRecordArray } = useQuery({ queryKey: ['budgets', projectId], queryFn: () => getProjectBudgets(projectId) });
  const budgetRecord = budgetRecordArray && budgetRecordArray.length > 0 ? budgetRecordArray[0] : null;

  // Filter notes globally for Budgets tab
  const filteredNotes = notes.filter((n) => n.department?.toUpperCase() === 'BUDGET');

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

  const handleSaveHeader = async (oldLabel: string) => {
    if (!headerInput.trim() || headerInput === oldLabel) {
      setEditingHeaderKey(null);
      return;
    }
    setSavingHeader(true);
    try {
      const valuesMap = budgetRecord?.values_map || {};
      const masterMatrix: any[] = valuesMap.master_bundle_matrix || [];
      const matchedWb = masterMatrix.find((wb) => wb.trade_label === oldLabel || wb.title === oldLabel);
      await updateBudgetWorkbookMatrix({
        project_id: projectId,
        integration_id: matchedWb?.integration_id,
        old_trade_label: oldLabel,
        trade_label: headerInput.trim(),
      });
      setEditingHeaderKey(null);
      await queryClient.invalidateQueries({ queryKey: ['budgets', projectId] });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error updating trade header:', err);
    } finally {
      setSavingHeader(false);
    }
  };

  const valuesMap = budgetRecord?.values_map || {};
  const masterCleaned = valuesMap.master_cleaned_table || {};
  const masterMatrix: any[] = valuesMap.master_bundle_matrix || [];
  const bundleConfig = valuesMap.bundle_config || { expected_count: 1, linked_count: 1 };

  const originalSum = masterCleaned.original_contract_sum || valuesMap.original_contract_sum || budgetRecord?.amount || 0;
  const appraisedBudget = masterCleaned.appraised_budget || valuesMap.appraised_budget || budgetRecord?.revised_amount || null;
  const earnedValue = masterCleaned.earned_value || valuesMap.earned_value || budgetRecord?.earned_value || 0;
  const remainingBalance = masterCleaned.remaining_balance ?? Math.max(0, (appraisedBudget ?? originalSum) - earnedValue);

  const handleEditMasterMetrics = () => {
    setMasterMetricsInput({
      original: originalSum,
      appraised: appraisedBudget ?? originalSum,
      ev: earnedValue,
      remaining: remainingBalance
    });
    setIsEditingMasterMetrics(true);
  };

  const handleSaveMasterMetrics = async () => {
    if (!budgetRecord?.id) return;
    setSavingMasterMetrics(true);
    const calculatedRemaining = Math.max(0, masterMetricsInput.appraised - masterMetricsInput.ev);
    const effInputBudget = masterMetricsInput.appraised > 0 ? masterMetricsInput.appraised : masterMetricsInput.original;
    const calculatedPercent = effInputBudget > 0 ? Math.min(100, (masterMetricsInput.ev / effInputBudget) * 100) : 0;

    try {
      await updateProjectBudget(projectId, budgetRecord.id, {
        amount: masterMetricsInput.original,
        revised_amount: masterMetricsInput.appraised,
        values_map: {
          master_cleaned_table: {
            original_contract_sum: masterMetricsInput.original,
            appraised_budget: masterMetricsInput.appraised,
            earned_value: masterMetricsInput.ev,
            remaining_balance: calculatedRemaining,
            percent_used: calculatedPercent
          }
        }
      });
      await queryClient.invalidateQueries({ queryKey: ['budgets', projectId] });
      setIsEditingMasterMetrics(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to save master metrics:', err);
    } finally {
      setSavingMasterMetrics(false);
    }
  };

  const handleUnlinkDocument = async (documentId: number) => {
    if (!onRefresh) return;
    setUnlinkingId(documentId);
    if (setGlobalLoading) setGlobalLoading(true);
    try {
      await unlinkDecoupledDocument(projectId, 'budget', documentId).catch(() => unlinkProjectDocument(projectId, documentId));
      await onRefresh();
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
      await onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed to delete document data.');
    } finally {
      setDeletingId(null);
      if (setGlobalLoading) setGlobalLoading(false);
    }
  };

  const isAppraised = !!valuesMap.is_appraised || (appraisedBudget !== null && appraisedBudget !== undefined && appraisedBudget !== originalSum);
  const effectiveBudget = (appraisedBudget !== null && appraisedBudget !== undefined && Number(appraisedBudget) > 0)
    ? Number(appraisedBudget)
    : originalSum;

  const displayPercentUsed = isEditingMasterMetrics
    ? ((masterMetricsInput.appraised > 0 ? masterMetricsInput.appraised : masterMetricsInput.original) > 0
      ? Math.min(100, (masterMetricsInput.ev / (masterMetricsInput.appraised > 0 ? masterMetricsInput.appraised : masterMetricsInput.original)) * 100)
      : 0)
    : (effectiveBudget > 0 ? Math.min(100, (earnedValue / effectiveBudget) * 100) : 0);

  const categories: any[] = (masterCleaned.categories && masterCleaned.categories.length > 0) ? masterCleaned.categories : (masterCleaned.reconciled_categories || valuesMap.summary_breakdown || []);
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
            <p className="text-sm font-bold font-lexend text-white mt-0.5">{formatCurrency(earnedValue)} ({displayPercentUsed.toFixed(1)}%)</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 space-y-6 min-w-0">
          {/* Cloud Integration Manager Component with Inline Preview Drawers */}
      {integrations && onRefresh && setGlobalLoading && (
        <BudgetIntegrations
          projectId={projectId}
          moduleContext={internalTab === 'progress' ? 'progress' : internalTab === 'cost' ? 'cost' : 'budget'}
          integrations={integrations.filter(i => {
            if (internalTab === 'progress') return i.module === 'progress';
            if (internalTab === 'cost') return i.module === 'cost';
            return i.module === 'budgets' || i.module === 'budget';
          })}
          documents={documents}
          masterMatrix={masterMatrix}
          persistedBundleConfig={bundleConfig}
          onRefresh={() => {
            onRefresh();
            queryClient.invalidateQueries({ queryKey: ['budgets', projectId] });
          }}
          globalLoading={globalLoading}
          setGlobalLoading={setGlobalLoading}
          tabsRibbon={
            <div className="flex items-center justify-start mb-2">
              <div className="flex items-center space-x-1.5 bg-white/5 p-1.5 rounded-2xl w-fit shadow-inner border border-white/10 backdrop-blur-md">
                {[
                  { key: 'budget', label: 'Project Budget' },
                  { key: 'progress', label: 'Work Progress Calculations' },
                  { key: 'cost', label: 'Cost Tracking' }
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setInternalTab(tab.key as any)}
                    className={`px-5 py-2.5 text-xs font-extrabold rounded-xl transition-all duration-300 flex-1 min-w-[140px] text-center ${internalTab === tab.key
                        ? 'bg-white/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)] transform scale-[1.02] border border-emerald-500/30 font-lexend'
                        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          }
        />
      )}



      {/* Master Cleaned-Up Executive Budget Table & Cards */}
      <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] space-y-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 font-inter drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">
                Master Cleaned-Up Table
              </span>
              {bundleConfig.expected_count > 1 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                  <Layers className="w-3 h-3 mr-1" /> Bundle Rollup ({bundleConfig.linked_count} of {bundleConfig.expected_count} Workbooks)
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold font-lexend text-white mt-0.5">System-Reconciled Master Project Budget</h3>
          </div>
          <div className="flex items-center space-x-3">
            {isAppraised && (
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                <Tag className="w-3.5 h-3.5 mr-1" /> Master Budget Appraised
              </span>
            )}
            {!isEditingMasterMetrics ? (
              <button
                onClick={handleEditMasterMetrics}
                className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors border border-white/10"
                title="Edit Master Totals"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsEditingMasterMetrics(false)}
                  className="px-3 py-1 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold rounded-lg transition-colors border border-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMasterMetrics}
                  disabled={savingMasterMetrics}
                  className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shadow-[0_0_15px_rgba(16,185,129,0.4)] disabled:opacity-50 flex items-center space-x-1"
                >
                  {savingMasterMetrics ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Cross-Workbook Overlap Detection Explanation Bar */}
        {detectedOverlaps.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-1 text-xs text-amber-200 font-medium">
            <div className="flex items-center space-x-2 font-bold text-amber-400">
              <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span>Cross-Workbook Reconciliation Notices:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-200/90 pl-1">
              {detectedOverlaps.map((notice, idx) => (
                <li key={idx}>{notice}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/5 space-y-1 hover:border-white/10 transition-colors">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Original Master Contract Sum</span>
            {isEditingMasterMetrics ? (
              <input
                type="number"
                step="any"
                value={masterMetricsInput.original}
                onChange={(e) => setMasterMetricsInput({ ...masterMetricsInput, original: parseFloat(e.target.value) || 0 })}
                className="w-full p-1.5 bg-white/5 border border-white/10 rounded font-bold text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            ) : (
              <p className="text-sm font-bold font-lexend text-white">{formatCurrency(originalSum)}</p>
            )}
          </div>

          <div className="bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/5 space-y-1 hover:border-white/10 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Appraised Master Budget</span>
              {isAppraised && !isEditingMasterMetrics && <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]" />}
            </div>
            {isEditingMasterMetrics ? (
              <input
                type="number"
                step="any"
                value={masterMetricsInput.appraised}
                onChange={(e) => setMasterMetricsInput({ ...masterMetricsInput, appraised: parseFloat(e.target.value) || 0 })}
                className="w-full p-1.5 bg-white/5 border border-indigo-500/30 rounded font-bold text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            ) : (
              <p className="text-sm font-bold font-lexend text-indigo-100">
                {isAppraised ? formatCurrency(appraisedBudget) : 'No Revisions'}
              </p>
            )}
          </div>

          <div className="bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/5 space-y-1 hover:border-white/10 transition-colors">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Earned Value to Date</span>
            {isEditingMasterMetrics ? (
              <input
                type="number"
                step="any"
                value={masterMetricsInput.ev}
                onChange={(e) => setMasterMetricsInput({ ...masterMetricsInput, ev: parseFloat(e.target.value) || 0 })}
                className="w-full p-1.5 bg-white/5 border border-emerald-500/30 rounded font-bold text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            ) : (
              <p className="text-sm font-bold font-lexend text-emerald-100">{formatCurrency(earnedValue)}</p>
            )}
          </div>

          <div className="bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/5 space-y-1 hover:border-white/10 transition-colors">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">Remaining Master Balance</span>
            <p className="text-sm font-bold font-lexend text-teal-100">
              {isEditingMasterMetrics
                ? formatCurrency(Math.max(0, masterMetricsInput.appraised - masterMetricsInput.ev))
                : formatCurrency(remainingBalance)}
            </p>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between items-center text-xs font-bold font-lexend">
            <span className="text-gray-300 flex items-center">
              <TrendingUp className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Total Project Budget Consumption
            </span>
            <span className="text-emerald-400 font-extrabold">{displayPercentUsed.toFixed(1)}% Consumed</span>
          </div>
          <div className="w-full bg-black/60 h-3 rounded-full overflow-hidden p-0.5 border border-white/10">
            <div
              className="bg-gradient-to-r from-teal-500 via-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
              style={{ width: `${displayPercentUsed}%` }}
            />
          </div>
        </div>

        {/* Master Reconciled Category Table */}
        {categories.length > 0 && (() => {
          // Group categories by source trade / workbook
          const groupedData: { [key: string]: { label: string; integrationId?: number; items: any[] } } = {};

          if (masterMatrix && masterMatrix.length > 0) {
            masterMatrix.forEach((wb) => {
              const label = wb.trade_label || wb.title || 'General Trade';
              groupedData[label] = { label, integrationId: wb.integration_id, items: [] };
            });
          }

          categories.forEach((cat) => {
            let key = cat.source_trade || cat.trade_label;
            if (!key) {
              if (masterMatrix.length === 1) {
                key = masterMatrix[0].trade_label || 'General Master Budget';
              } else {
                key = 'General Master Budget';
              }
            }
            if (!groupedData[key]) {
              groupedData[key] = { label: key, items: [] };
            }
            groupedData[key].items.push(cat);
          });

          const groupEntries = Object.entries(groupedData).filter(([_, g]) => g.items.length > 0);

          return (
            <div className="pt-4 border-t border-white/10 space-y-3">
              <div
                className="flex items-center justify-between cursor-pointer bg-black/40 hover:bg-black/60 p-3 rounded-xl border border-white/10 transition-colors backdrop-blur-md"
                onClick={() => setIsMasterCategoriesOpen(!isMasterCategoriesOpen)}
              >
                <div className="flex items-center space-x-3">
                  <button className="flex items-center justify-center p-1.5 bg-white/5 border border-white/10 rounded-lg shadow-sm text-gray-300 hover:text-emerald-400 transition-colors">
                    {isMasterCategoriesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <div>
                    <h4 className="text-xs font-bold font-lexend text-white">Reconciled Master Category Breakdowns</h4>
                    <span className="text-[10px] text-gray-400 font-semibold">Grouped by Source Workbook / Trade</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-gray-300 bg-white/5 px-3 py-1 rounded-full border border-white/10 shadow-sm uppercase tracking-wider">
                  {categories.length} Categories ({groupEntries.length} Trades)
                </span>
              </div>

              {isMasterCategoriesOpen && (
                <div className="overflow-x-auto border border-white/10 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] animate-fade-in bg-black/40 backdrop-blur-md">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 text-gray-400 font-bold uppercase tracking-wider text-[10px] border-b border-white/10">
                      <tr>
                        <th className="px-4 py-3">Category Component / Trade Header</th>
                        <th className="px-4 py-3 text-right">Original ($)</th>
                        <th className="px-4 py-3 text-right">Appraised ($)</th>
                        <th className="px-4 py-3 text-right">Earned Value ($)</th>
                        <th className="px-4 py-3 text-right">Variance (Delta)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-medium text-gray-200">
                      {groupEntries.map(([groupKey, group]) => {
                        const groupItems = group.items;
                        const isEditingThis = editingHeaderKey === groupKey;

                        const sumOrig = groupItems.reduce((acc, c) => acc + (Number(c.original_amount) || 0), 0);
                        const sumAppr = groupItems.reduce((acc, c) => {
                          const a = c.appraised_amount !== undefined && c.appraised_amount !== null ? Number(c.appraised_amount) : Number(c.original_amount);
                          return acc + (a || 0);
                        }, 0);
                        const sumEv = groupItems.reduce((acc, c) => acc + (Number(c.earned_value_to_date) || 0), 0);
                        const sumDelta = sumAppr - sumOrig;
                        const isGroupAppraised = groupItems.some((c) => (c.appraised_amount !== undefined && c.appraised_amount !== null && Number(c.appraised_amount) !== Number(c.original_amount)) || c.is_appraised);

                        return (
                          <React.Fragment key={groupKey}>
                            {/* Group Section Header Row */}
                            <tr className="bg-white/5 border-t border-b border-white/10">
                              <td colSpan={5} className="px-4 py-2.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2.5">
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-900/50 text-emerald-300 border border-emerald-500/30 font-extrabold text-[10px] uppercase tracking-wider">
                                      Source Table / Trade
                                    </span>

                                    {isEditingThis ? (
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="text"
                                          value={headerInput}
                                          onChange={(e) => setHeaderInput(e.target.value)}
                                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveHeader(groupKey); }}
                                          className="p-2 px-3 bg-black/50 border border-emerald-500/50 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[260px] shadow-inner"
                                          autoFocus
                                        />
                                        <button
                                          onClick={() => handleSaveHeader(groupKey)}
                                          disabled={savingHeader}
                                          className="p-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition"
                                          title="Save Header Title"
                                        >
                                          {savingHeader ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                        </button>
                                        <button
                                          onClick={() => setEditingHeaderKey(null)}
                                          className="p-1 bg-white/10 text-gray-300 rounded-lg hover:bg-white/20 transition"
                                          title="Cancel"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div
                                        onClick={() => {
                                          setEditingHeaderKey(groupKey);
                                          setHeaderInput(group.label);
                                        }}
                                        className="flex items-center space-x-2 group cursor-pointer"
                                        title="Click to edit group header title"
                                      >
                                        <h5 className="text-xs font-extrabold font-lexend text-white group-hover:text-emerald-400 transition">
                                          {group.label}
                                        </h5>
                                        <Edit3 className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-400 transition opacity-70 group-hover:opacity-100" />
                                      </div>
                                    )}
                                  </div>

                                  <span className="text-[10px] font-bold text-gray-400 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
                                    {groupItems.length} {groupItems.length === 1 ? 'component' : 'components'}
                                  </span>
                                </div>
                              </td>
                            </tr>

                            {/* Component Rows */}
                            {groupItems.map((cat, idx) => {
                              const orig = Number(cat.original_amount) || 0;
                              const appr = cat.appraised_amount !== undefined && cat.appraised_amount !== null ? Number(cat.appraised_amount) : orig;
                              const delta = cat.appraisal_delta ?? (appr - orig);
                              const isCatAppraised = cat.is_appraised || appr !== orig;

                              return (
                                <tr key={idx} className="hover:bg-white/5 transition">
                                  <td className="px-4 py-3 font-bold text-gray-200 pl-8 flex items-center space-x-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                                    <span>{cat.category_name}</span>
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-400 font-semibold">{formatCurrency(orig)}</td>
                                  <td className="px-4 py-3 text-right font-bold text-indigo-300">
                                    {formatCurrency(appr)}
                                  </td>
                                  <td className="px-4 py-3 text-right font-bold text-emerald-300">{formatCurrency(cat.earned_value_to_date || 0)}</td>
                                  <td className="px-4 py-3 text-right font-bold">
                                    <span className={delta > 0 ? 'text-indigo-400' : delta < 0 ? 'text-red-400' : 'text-gray-500'}>
                                      {delta > 0 ? '+' : ''}{formatCurrency(delta)}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}

                            {/* Group Subtotal Autosum Row */}
                            <tr className="bg-emerald-900/20 font-bold border-t border-b border-emerald-500/20 text-emerald-100">
                              <td className="px-4 py-2.5 pl-8 font-lexend text-xs flex items-center space-x-2">
                                <span className="px-1.5 py-0.5 rounded bg-emerald-700/50 text-white font-mono text-[10px] border border-emerald-500/30">∑ Subtotal</span>
                                <span className="font-extrabold text-white">{group.label}</span>
                              </td>
                              <td className="px-4 py-2.5 text-right text-gray-300 font-extrabold">{formatCurrency(sumOrig)}</td>
                              <td className="px-4 py-2.5 text-right text-indigo-300 font-extrabold">
                                {formatCurrency(sumAppr)}
                              </td>
                              <td className="px-4 py-2.5 text-right text-emerald-300 font-extrabold">{formatCurrency(sumEv)}</td>
                              <td className="px-4 py-2.5 text-right font-extrabold">
                                <span className={sumDelta > 0 ? 'text-indigo-400' : sumDelta < 0 ? 'text-red-400' : 'text-gray-500'}>
                                  {sumDelta > 0 ? '+' : ''}{formatCurrency(sumDelta)}
                                </span>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}
      </div>

        </div>
        <div className="shrink-0">
          {/* Collaboration Panel — Threads / Tasks / Log */}
          <CollaborationPanel
            projectId={projectId}
            module="Budget"
            moduleName="Budgets"
          />
        </div>
      </div>
    </div>
  );
}
