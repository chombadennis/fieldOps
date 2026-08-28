'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProject,
  deleteBoqDocument,
  getProjectNotes,
  createProjectNote,
  getProjectDocuments,
  createProjectDocument,
  getProjectBudgets,
  createProjectBudget,
  getProjectIPCs,
  createProjectIPC,
  deleteDecoupledDocument,
} from '@/services/api';
import ProjectDetails from '@/components/ProjectDetails';
import UploadBOQ from '@/app/components/UploadBOQ';
import Report from '@/app/components/Report';
import DashboardSkeleton from '@/components/DashboardSkeleton';
import ErrorMessage from '@/components/ErrorMessage';
import BoqIntegrations from '@/components/BoqIntegrations';
import BoqDocumentList from '@/components/BoqDocumentList';
import BoqItemsModal from '@/components/BoqItemsModal';
import RoleSwitcher, { UserRole, ROLES_CONFIG } from '@/components/RoleSwitcher';
import BudgetsTab from '@/components/BudgetsTab';
import CustomAlert, { AlertType } from '@/components/ui/CustomAlert';
import IpcsTab from '@/components/IpcsTab';
import FieldOpsTab from '@/components/FieldOpsTab';
import HrTab from '@/components/HrTab';
import LegalTab from '@/components/LegalTab';
import TechTab from '@/components/TechTab';
import RateScheduleTab from '@/components/RateScheduleTab';
import ReimbursableCostsTab from '@/components/ReimbursableCostsTab';
import ProgramOfWorksTab from '@/components/ProgramOfWorksTab';
import ActivityScheduleTab from '@/components/ActivityScheduleTab';
import MilestonesTab from '@/components/MilestonesTab';
import DiscussionBoard from '@/components/DiscussionBoard';
import Link from 'next/link';
import { ArrowLeft, Home, AlertTriangle, X, FileSpreadsheet, DollarSign, FileCheck, HardHat, Wrench, Users, Scale, Building2, Calendar, ClipboardList, Ruler, Truck, Clock, Plus, Settings, Trash2 } from 'lucide-react';

const EMPTY_ARRAY: any[] = [];

export default function ProjectDashboardPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
      
  const queryClient = useQueryClient();
  const { data: project, isLoading: loading } = useQuery({ queryKey: ['project', projectId], queryFn: () => getProject(projectId) });
  const { data: budgets = EMPTY_ARRAY } = useQuery({ queryKey: ['budgets', projectId], queryFn: () => getProjectBudgets(projectId).catch(() => []) });
  const { data: ipcs = EMPTY_ARRAY } = useQuery({ queryKey: ['ipcs', projectId], queryFn: () => getProjectIPCs(projectId).catch(() => []) });
  const { data: notes = EMPTY_ARRAY } = useQuery({ queryKey: ['notes', projectId], queryFn: () => getProjectNotes(projectId).catch(() => []) });
  
  // Parallel query for documents
  const { data: documents = EMPTY_ARRAY } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: async () => {
      const api = await import('@/services/api');
      const [dData, techData, fieldOpsData, activityData, milestoneData, rateData, reimbursableData, programData, ipcDocsData] = await Promise.all([
        getProjectDocuments(projectId).catch(() => []),
        api.getDecoupledDocuments(projectId, 'tech').catch(() => []),
        api.getDecoupledDocuments(projectId, 'field_ops').catch(() => []),
        api.getDecoupledDocuments(projectId, 'activity_schedule').catch(() => []),
        api.getDecoupledDocuments(projectId, 'milestone_claims').catch(() => []),
        api.getDecoupledDocuments(projectId, 'rate_schedule').catch(() => []),
        api.getDecoupledDocuments(projectId, 'reimbursable_claims').catch(() => []),
        api.getDecoupledDocuments(projectId, 'program_of_works').catch(() => []),
        api.getDecoupledDocuments(projectId, 'ipc').catch(() => []),
      ]);
      return [...dData, ...techData, ...fieldOpsData, ...activityData, ...milestoneData, ...rateData, ...reimbursableData, ...programData, ...ipcDocsData];
    }
  });

  const fetchProjectData = async () => {
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    queryClient.invalidateQueries({ queryKey: ['budgets', projectId] });
    queryClient.invalidateQueries({ queryKey: ['ipcs', projectId] });
    queryClient.invalidateQueries({ queryKey: ['notes', projectId] });
    queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
  };

  // Role & Tab Navigation state
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('active_tab') || 'pmo';
    }
    return 'pmo';
  });
  const [pmoSubTab, setPmoSubTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('pmo_sub_tab') || 'boq';
    }
    return 'boq';
  });
  const [fieldOpsSubTab, setFieldOpsSubTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('field_ops_sub_tab') || 'dpr';
    }
    return 'dpr';
  });

  // Platform Data states
        
  // BOQ Modal states
  const [selectedBoqId, setSelectedBoqId] = useState<number | null>(null);
  const [selectedBoqName, setSelectedBoqName] = useState<string>('');
  const [isBoqModalOpen, setIsBoqModalOpen] = useState(false);
  const [globalProcessing, setGlobalProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [customFieldOpsTabs, setCustomFieldOpsTabs] = useState<any[]>([]);
  const [showAddModulePrompt, setShowAddModulePrompt] = useState(false);
  const [newModuleName, setNewModuleName] = useState('');
  const [hiddenModules, setHiddenModules] = useState<string[]>([]);
  const [isManageModulesOpen, setIsManageModulesOpen] = useState(false);
  const [moduleToDelete, setModuleToDelete] = useState<{key: string, name: string} | null>(null);
  const [isDeletingModule, setIsDeletingModule] = useState(false);
  const [globalAlert, setGlobalAlert] = useState<{type: AlertType, message: string} | null>(null);

  const contractType = project?.contracts?.[0]?.contract_type || 'GENERAL';
  const contractName = project?.contracts?.[0]?.name || 'General Contract';
  const contractContext = `(Active Contract: ${contractName} - ${contractType.replace('_', ' ')})`;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('fieldops_custom_templates');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const customs = parsed
            .filter((t: any) => t.name && t.name.startsWith('field_ops_custom_'))
            .map((t: any) => {
              const label = t.name.replace('field_ops_custom_', '').replace(/_/g, ' ');
              return {
                key: t.name,
                label: label,
                description: `Custom Module. ${contractContext}`,
                icon: ClipboardList,
                badgeCount: documents.filter((d: any) => d.department?.toLowerCase() === t.name.toLowerCase()).length,
                departmentKey: t.name
              };
            });
          setCustomFieldOpsTabs(prev => {
            // prevent infinite loops if array looks the same (excluding icon which is a function)
            const prevCompare = prev.map(p => ({...p, icon: null}));
            const nextCompare = customs.map((c: any) => ({...c, icon: null}));
            return JSON.stringify(prevCompare) === JSON.stringify(nextCompare) ? prev : customs;
          });
        } catch (e) {}
      }
      
      const storedHidden = localStorage.getItem('fieldops_hidden_modules');
      if (storedHidden) {
        try {
          const parsed = JSON.parse(storedHidden);
          setHiddenModules(prev => JSON.stringify(prev) === storedHidden ? prev : parsed);
        } catch (e) {}
      }
    }
  }, [documents, contractContext]);

  const handleAddCustomModule = () => {
    if (!newModuleName.trim()) return;
    const cleanName = newModuleName.trim().replace(/\s+/g, '_');
    const keyName = `field_ops_custom_${cleanName}`;
    const storedTpls = localStorage.getItem('fieldops_custom_templates');
    let tpls: any[] = [];
    if (storedTpls) {
      try { tpls = JSON.parse(storedTpls); } catch (e) {}
    }
    if (!tpls.find((t: any) => t.name === keyName)) {
      tpls.push({
        name: keyName,
        sections: [{ title: 'Section 1', columns: ['Item', 'Quantity', 'Unit'] }]
      });
      localStorage.setItem('fieldops_custom_templates', JSON.stringify(tpls));
      
      setCustomFieldOpsTabs([...customFieldOpsTabs, {
        key: keyName,
        label: newModuleName.trim(),
        description: `Custom Module. ${contractContext}`,
        icon: ClipboardList,
        badgeCount: 0,
        departmentKey: keyName
      }]);
      setFieldOpsSubTab(keyName);
    }
    setShowAddModulePrompt(false);
    setNewModuleName('');
  };

  const confirmDeleteModule = async () => {
    if (!moduleToDelete) return;
    const moduleKey = moduleToDelete.key;
    
    setIsDeletingModule(true);
    try {
      // 1. Delete from localStorage
      const storedTpls = localStorage.getItem('fieldops_custom_templates');
      if (storedTpls) {
        let tpls: any[] = JSON.parse(storedTpls);
        tpls = tpls.filter(t => t.name !== moduleKey);
        localStorage.setItem('fieldops_custom_templates', JSON.stringify(tpls));
      }

      // 2. Remove from state
      setCustomFieldOpsTabs(prev => prev.filter(t => t.key !== moduleKey));
      
      // 3. Fallback active tab if needed
      if (fieldOpsSubTab === moduleKey) {
        setFieldOpsSubTab('dpr'); // Safe fallback
      }

      // 4. Delete all associated documents from the DB
      const docsToDelete = documents.filter(d => d.department?.toLowerCase() === moduleKey.toLowerCase());
      for (const doc of docsToDelete) {
        await deleteDecoupledDocument(projectId, 'field_ops', doc.id).catch(console.error);
      }
      
      // 5. Refresh project data to sync state
      await fetchProjectData();
      setModuleToDelete(null);
      setGlobalAlert({ type: 'success', message: 'Module deleted successfully.' });
    } catch (err: any) {
      console.error("Failed to delete custom module", err);
      setGlobalAlert({ type: 'error', message: 'Failed to delete module. Please check your connection.' });
    } finally {
      setIsDeletingModule(false);
    }
  };

  const visibleTabs = ROLES_CONFIG[currentRole]?.visibleTabs || ['pmo'];

  // Switch tab automatically if current activeTab is hidden for newly selected role
  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] || 'pmo');
    }
  }, [currentRole]);

  // Sync active tabs to URL so they persist on refresh
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('active_tab', activeTab);
      url.searchParams.set('pmo_sub_tab', pmoSubTab);
      url.searchParams.set('field_ops_sub_tab', fieldOpsSubTab);
      window.history.replaceState({}, '', url.toString());
    }
  }, [activeTab, pmoSubTab, fieldOpsSubTab]);

  useEffect(() => {
    if (hiddenModules.includes(fieldOpsSubTab)) {
      // Find the first visible tab that is NOT hidden
      // The tabs are predefined in FIELD_OPS_SUBTABS, but since it's defined lower down,
      // we can just check against customFieldOpsTabs and the base list.
      // We will handle the fallback right here safely.
      if (!hiddenModules.includes('dpr')) setFieldOpsSubTab('dpr');
      else if (!hiddenModules.includes('jms')) setFieldOpsSubTab('jms');
      else if (!hiddenModules.includes('grn')) setFieldOpsSubTab('grn');
      else if (!hiddenModules.includes('timesheets')) setFieldOpsSubTab('timesheets');
      else if (!hiddenModules.includes('general')) setFieldOpsSubTab('general');
      else if (customFieldOpsTabs.length > 0) setFieldOpsSubTab(customFieldOpsTabs[0].key);
    }
  }, [hiddenModules, fieldOpsSubTab, customFieldOpsTabs]);



  const handleAddBudget = async (b: { category: string; amount: number; description: string }) => {
    await createProjectBudget(projectId, b);
    queryClient.invalidateQueries({ queryKey: ['budgets', projectId] });
  };

  const handleAddIPC = async (i: { certificate_number: string; amount_claimed: number; status: string }) => {
    await createProjectIPC(projectId, i);
    queryClient.invalidateQueries({ queryKey: ['ipcs', projectId] });
  };

  const handleAddNote = async (n: { content: string; department: string; is_issue: boolean; priority: string }) => {
    await createProjectNote(projectId, n);
    queryClient.invalidateQueries({ queryKey: ['notes', projectId] });
  };

  const handleAddDocument = async (d: { title: string; file_url: string; department: string }) => {
    await createProjectDocument(projectId, d);
    queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
  };

  const handleViewBoqItems = (boqId: number, docName: string) => {
    setSelectedBoqId(boqId);
    setSelectedBoqName(docName);
    setIsBoqModalOpen(true);
  };

  const handleDeleteBoqDocument = async (boqId: number) => {
    setGlobalProcessing(true);
    try {
      await deleteBoqDocument(boqId);
      await fetchProjectData();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || 'Failed to delete BOQ document.');
    } finally {
      setGlobalProcessing(false);
    }
  };



  if (loading) {
    return (
      <main className="container mx-auto p-4">
        <DashboardSkeleton />
      </main>
    );
  }

  if (!project) {
    return (
      <main className="container mx-auto p-4">
        <ErrorMessage message={'Project not found.'} />
      </main>
    );
  }

  const TABS = [
    { key: 'pmo', label: 'PMO - Project Management Office', icon: Building2 },
    { key: 'tech', label: 'Engineering / Tech', icon: HardHat },
    { key: 'field_ops', label: 'Field Operations', icon: Wrench },
    { key: 'hr', label: 'HR', icon: Users },
    { key: 'legal', label: 'Legal', icon: Scale },
  ].filter((t) => visibleTabs.includes(t.key));

  let PMO_SUBTABS = [];
  if (contractType === 'LUMP_SUM') {
    PMO_SUBTABS = [
      { key: 'activity_schedule', label: 'Activity Schedule', description: `Upload Activity Schedule files (Expected: Excel). ${contractContext}`, icon: FileSpreadsheet, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'activity_schedule').length },
      { key: 'milestone_payments', label: 'Milestone Payments', description: `Upload milestone claims (Expected: PDF/Word). ${contractContext}`, icon: FileCheck, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'milestone_claims').length },
      { key: 'budgets', label: 'Budget & EVM', description: `Project budget, cost tracking, and Work Progress Calculations. ${contractContext}`, icon: DollarSign, badgeCount: ((project.integrations || []).filter((i: any) => i.module === 'budget' || i.module === 'budgets' || i.module === 'progress' || i.module === 'cost')).length },
      { key: 'scheduling', label: 'Scheduling & Timeline', description: `Upload Program of Works (Expected: MPP/Excel). ${contractContext}`, icon: Calendar, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'program_of_works').length },
    ];
  } else if (contractType === 'COST_PLUS') {
    PMO_SUBTABS = [
      { key: 'rate_schedule', label: 'Schedule of Rates', description: `Upload Rate Schedule files (Expected: Excel). ${contractContext}`, icon: FileSpreadsheet, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'rate_schedule').length },
      { key: 'reimbursable_costs', label: 'Reimbursable Costs', description: `Upload Invoices and Receipts (Expected: PDF/Images). ${contractContext}`, icon: FileCheck, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'reimbursable_claims').length },
      { key: 'budgets', label: 'Budget & EVM', description: `Project budget, cost tracking, and Work Progress Calculations. ${contractContext}`, icon: DollarSign, badgeCount: ((project.integrations || []).filter((i: any) => i.module === 'budget' || i.module === 'budgets' || i.module === 'progress' || i.module === 'cost')).length },
      { key: 'scheduling', label: 'Scheduling & Timeline', description: `Upload Program of Works (Expected: MPP/Excel). ${contractContext}`, icon: Calendar, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'program_of_works').length },
    ];
  } else {
    // GENERAL - ALL TABS ACTIVE
    PMO_SUBTABS = [
      { key: 'boq', label: 'BoQ & Files', description: `Bills of Quantities (Expected: Excel Workbooks). ${contractContext}`, icon: FileSpreadsheet, badgeCount: project.boq_documents?.length || 0 },
      { key: 'ipcs', label: 'IPC & Claims', description: `Interim Payment Certificates (Expected: PDF/Excel). ${contractContext}`, icon: FileCheck, badgeCount: documents.filter((d) => d.department?.toUpperCase() === 'IPC' || d.department?.toLowerCase() === 'ipc').length },
      { key: 'budgets', label: 'Budget & EVM', description: `Project budget, cost tracking, and Work Progress Calculations. ${contractContext}`, icon: DollarSign, badgeCount: ((project.integrations || []).filter((i: any) => i.module === 'budget' || i.module === 'budgets' || i.module === 'progress' || i.module === 'cost')).length },
      { key: 'scheduling', label: 'Scheduling & Timeline', description: `Upload Program of Works (Expected: MPP/Excel). ${contractContext}`, icon: Calendar, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'program_of_works').length },
      { key: 'activity_schedule', label: 'Activity Schedule', description: `Upload Activity Schedule files (Expected: Excel). ${contractContext}`, icon: FileSpreadsheet, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'activity_schedule').length },
      { key: 'milestone_payments', label: 'Milestone Payments', description: `Upload milestone claims (Expected: PDF/Word). ${contractContext}`, icon: FileCheck, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'milestone_claims').length },
      { key: 'rate_schedule', label: 'Schedule of Rates', description: `Upload Rate Schedule files (Expected: Excel). ${contractContext}`, icon: FileSpreadsheet, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'rate_schedule').length },
      { key: 'reimbursable_costs', label: 'Reimbursable Costs', description: `Upload Invoices and Receipts (Expected: PDF/Images). ${contractContext}`, icon: FileCheck, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'reimbursable_claims').length },
    ];
  }

  const FIELD_OPS_SUBTABS = [
    { key: 'dpr', label: 'Daily Progress Reports', description: `DPRs & Weekly Logs. ${contractContext}`, icon: ClipboardList, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'field_ops_dpr').length, departmentKey: 'field_ops_dpr' },
    { key: 'jms', label: 'Joint Measurement Sheets', description: `Agreed Quantities. ${contractContext}`, icon: Ruler, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'field_ops_jms').length, departmentKey: 'field_ops_jms' },
    { key: 'grn', label: 'Material Delivery Logs', description: `GRNs & Delivery Tickets. ${contractContext}`, icon: Truck, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'field_ops_grn').length, departmentKey: 'field_ops_grn' },
    { key: 'timesheets', label: 'Timesheets & Equipment', description: `Labor and Machinery Logs. ${contractContext}`, icon: Clock, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'field_ops_timesheets').length, departmentKey: 'field_ops_timesheets' },
    { key: 'general', label: 'General Field Ops', description: `Legacy or uncategorized docs. ${contractContext}`, icon: Wrench, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'field_ops').length, departmentKey: 'field_ops' },
    ...customFieldOpsTabs
  ];

  if (loading) {
    return (
      <main className="container mx-auto p-4">
        <DashboardSkeleton />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#030305] text-white selection:bg-neon-cyan/30 pb-20 relative font-inter overflow-hidden">
      {/* Ambient Mesmerizing Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-neon-purple/20 rounded-full blur-[120px] animate-blob mix-blend-screen pointer-events-none z-0"></div>
      <div className="absolute top-[30%] right-[-10%] w-[600px] h-[600px] bg-neon-cyan/20 rounded-full blur-[150px] animate-blob-slow mix-blend-screen pointer-events-none z-0" style={{ animationDelay: '2s' }}></div>
      {globalAlert && (
        <CustomAlert 
          type={globalAlert.type} 
          message={globalAlert.message} 
          onClose={() => setGlobalAlert(null)} 
        />
      )}
      <main className="container mx-auto p-4 space-y-6 relative z-10">
        {/* Navigation Breadcrumbs */}
        <div className="flex items-center space-x-3 mb-2">
          <Link href="/dashboard" className="inline-flex items-center px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-300 hover:text-white transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Projects Hub
          </Link>
          <Link href="/" className="inline-flex items-center px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-300 hover:text-white transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            <Home className="w-4 h-4 mr-1.5" /> System Home
          </Link>
        </div>

        {/* Role Switcher Banner */}
        <RoleSwitcher currentRole={currentRole} onRoleChange={setCurrentRole} />

        {/* Project Header */}
        <ProjectDetails project={project} />

      {/* Dashboard Top Section Navigation Bar */}
      <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/10 flex items-center gap-2 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${isActive
                  ? 'bg-white/10 text-neon-cyan shadow-[0_0_15px_rgba(0,243,255,0.2)] font-lexend border border-white/10'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Top Level Tab 1: PMO (Project Management Office) */}
      {activeTab === 'pmo' && (
        <div className="space-y-6 animate-fade-in">
          {/* PMO Header Banner */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
            {/* Background Glow Accents */}
            <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-80 h-80 bg-neon-purple/20 rounded-full blur-3xl pointer-events-none mix-blend-screen" />
            <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-neon-cyan/20 rounded-full blur-3xl pointer-events-none mix-blend-screen" />

            <div className="relative z-10">
              <span className="text-xs font-semibold text-neon-cyan uppercase tracking-widest drop-shadow-[0_0_8px_rgba(0,243,255,0.5)]">Office Operations</span>
              <h2 className="text-xl font-bold font-lexend mt-1 text-white drop-shadow-md">Project Management Office (PMO)</h2>
              <p className="text-xs text-gray-400 mt-1 max-w-xl leading-relaxed">
                Consolidated PMO control center for tracking physical Quantities (BoQ), interim payment claims (IPCs), and cost-to-complete budgets.
              </p>
            </div>
            <div className="flex items-center space-x-4 relative z-10 flex-shrink-0">
              <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/5 text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Total Claimed</p>
                <p className="text-sm font-bold font-lexend text-white mt-0.5">${ipcs.reduce((s: any, i: any) => s + (i.amount_claimed || 0), 0).toLocaleString()}</p>
              </div>
              <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/5 text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Total Budget</p>
                <p className="text-sm font-bold font-lexend text-white mt-0.5">${budgets.reduce((s: any, b: any) => s + (b.amount || 0), 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Vertical Navigation Grid on the Left */}
            <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] space-y-3 sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="px-3 py-2 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-neon-cyan font-inter">
                      PMO Modules
                    </span>
                    <h3 className="text-xs font-bold font-lexend text-white">Control Panel</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white border border-white/10">
                    3 Views
                  </span>
                </div>

                <div className="space-y-2">
                  {PMO_SUBTABS.map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive = pmoSubTab === sub.key;
                    return (
                      <button
                        key={sub.key}
                        onClick={() => {
                          setPmoSubTab(sub.key);
                          const el = document.getElementById('pmo-content-area');
                          if (el) {
                            const y = el.getBoundingClientRect().top + window.scrollY - 120;
                            window.scrollTo({ top: y, behavior: 'smooth' });
                          }
                        }}
                        className={`w-full text-left p-3.5 rounded-2xl transition-all duration-200 flex items-center justify-between group ${isSubActive
                            ? 'bg-gradient-to-r from-neon-cyan/20 to-transparent border-l-2 border-neon-cyan text-white shadow-md scale-[1.01]'
                            : 'bg-transparent hover:bg-white/5 text-gray-400 border-l-2 border-transparent'
                          }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`p-2.5 rounded-xl transition ${isSubActive
                                ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 shadow-[0_0_10px_rgba(0,243,255,0.2)]'
                                : 'bg-white/5 text-gray-400 border border-white/10 group-hover:text-white group-hover:scale-110'
                              }`}
                          >
                            <SubIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold font-lexend leading-tight">{sub.label}</p>
                            <p className={`text-[10px] mt-0.5 leading-snug ${isSubActive ? 'text-gray-300' : 'text-gray-500'}`}>
                              {sub.description}
                            </p>
                          </div>
                        </div>
                        {sub.badgeCount !== undefined && (
                          <span
                            className={`ml-2 px-2 py-0.5 text-[10px] font-black rounded-full whitespace-nowrap ${isSubActive
                                ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30'
                                : 'bg-white/10 text-gray-400 border border-white/5'
                              }`}
                          >
                            {sub.badgeCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Quick Summary Pill inside Left PMO Bar */}
                <div className="p-3 bg-black/60 border border-white/10 text-white rounded-2xl text-xs space-y-2 mt-4 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/10 to-transparent opacity-50 z-0"></div>
                  <div className="flex items-center justify-between relative z-10">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">PMO Quick Stats</span>
                    <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_8px_rgba(0,243,255,0.8)]" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 relative z-10">
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase font-semibold">Total Claimed</p>
                      <p className="font-bold text-white">${ipcs.reduce((s: any, i: any) => s + (i.amount_claimed || 0), 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase font-semibold">Total Budget</p>
                      <p className="font-bold text-white">${budgets.reduce((s: any, b: any) => s + (b.amount || 0), 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PMO Main Content Area (Right Side) */}
            <div className="flex-1 min-w-0" id="pmo-content-area">
              <div key={pmoSubTab} className="space-y-8 animate-fade-in-up">
              {/* PMO Subtab 1: BoQ & Cloud Files */}
              {pmoSubTab === 'boq' && (
                <div className="space-y-8 animate-fade-in">
                  {/* BoQ Header Banner */}
                  <div className="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950 text-white rounded-3xl p-8 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                    <div className="relative z-10">
                      <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Base Quantities</span>
                      <h2 className="text-xl font-bold font-lexend mt-1">Bill of Quantities (BoQ) & Files</h2>
                      <p className="text-xs text-indigo-100/80 mt-1 max-w-lg">
                        Manage your foundational BoQ, integrate spreadsheets, and parse structural project data.
                      </p>
                    </div>
                    <div className="flex items-center space-x-4 relative z-10">
                      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-right">
                        <p className="text-xs font-semibold text-indigo-200 uppercase">Total BoQs</p>
                        <p className="text-sm font-bold font-lexend text-white mt-0.5">
                          {(project.boq_documents || []).length}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cloud Integrations Card */}
                  <BoqIntegrations
                    projectId={project.id}
                    integrations={(project.integrations || []).filter((i: any) => i.module === 'boq')}
                    boqDocuments={project.boq_documents || []}
                    documents={documents.filter((d: any) => d.department?.toLowerCase() === 'boq')}
                    onRefresh={fetchProjectData}
                    globalLoading={globalProcessing}
                    setGlobalLoading={setGlobalProcessing}
                  />

                  {/* Upload BOQ */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <UploadBOQ projectId={project.id} onUploadSuccess={fetchProjectData} disabled={globalProcessing} />
                    <Report projectId={project.id} />
                  </div>


                  {/* Attached Bills of Quantities */}
                  <BoqDocumentList
                    documents={project.boq_documents || []}
                    onViewItems={handleViewBoqItems}
                    onDeleteDocument={handleDeleteBoqDocument}
                    integrations={(project.integrations || []).filter((i: any) => i.module === 'boq')}
                  />

                  {/* Discussion Board for BoQ */}
                  <DiscussionBoard
                    notes={notes.filter((n: any) => n.department?.toLowerCase() === 'boq')}
                    onAddNote={handleAddNote}
                    departmentKey="boq"
                    departmentName="Bill of Quantities"
                  />
                </div>
              )}

              {/* PMO Subtab 2: IPC & Claims */}
              {pmoSubTab === 'ipcs' && (
                <IpcsTab
                  projectId={project.id}
                  ipcs={ipcs}
                  notes={notes.filter((n: any) => n.department?.toLowerCase() === 'ipc' || n.department?.toLowerCase() === 'ipcs')}
                  documents={documents.filter((d: any) => d.department?.toLowerCase() === 'ipc' || d.department?.toLowerCase() === 'ipcs')}
                  onAddNote={handleAddNote}
                  integrations={(project.integrations || []).filter((i: any) => i.module === 'ipc' || i.module === 'ipcs')}
                  boqDocuments={project.boq_documents || []}
                  onRefresh={fetchProjectData}
                  globalLoading={globalProcessing}
                  setGlobalLoading={setGlobalProcessing}
                />
              )}

              {/* PMO Subtab 3: Budget */}
              {pmoSubTab === 'budgets' && (
                <BudgetsTab
                  projectId={project.id}
                  notes={notes.filter((n: any) => n.department?.toLowerCase() === 'budget' || n.department?.toLowerCase() === 'budgets')}
                  documents={documents.filter((d: any) => d.department?.toLowerCase() === 'budget' || d.department?.toLowerCase() === 'budgets')}
                  onAddNote={handleAddNote}
                  integrations={(project.integrations || []).filter((i: any) => i.module === 'budget' || i.module === 'budgets' || i.module === 'progress' || i.module === 'cost')}
                  boqDocuments={project.boq_documents || []}
                  onRefresh={fetchProjectData}
                  globalLoading={globalProcessing}
                  setGlobalLoading={setGlobalProcessing}
                />
              )}
              {/* PMO Subtab: Activity Schedule */}
              {pmoSubTab === 'activity_schedule' && (
                <ActivityScheduleTab
                  projectId={project.id}
                  notes={notes}
                  documents={documents}
                  onAddNote={handleAddNote}
                  integrations={(project.integrations || []).filter((i: any) => i.module === 'activity_schedule')}
                  onRefresh={fetchProjectData}
                  globalLoading={globalProcessing}
                  setGlobalLoading={setGlobalProcessing}
                />
              )}

              {/* PMO Subtab: Milestone Payments */}
              {pmoSubTab === 'milestone_payments' && (
                <MilestonesTab
                  projectId={project.id}
                  notes={notes}
                  documents={documents}
                  onAddNote={handleAddNote}
                  integrations={(project.integrations || []).filter((i: any) => i.module === 'milestone_claims')}
                  onRefresh={fetchProjectData}
                  globalLoading={globalProcessing}
                  setGlobalLoading={setGlobalProcessing}
                />
              )}

              {/* PMO Subtab: Schedule of Rates */}
              {pmoSubTab === 'rate_schedule' && (
                <RateScheduleTab
                  projectId={project.id}
                  departmentName="Schedule of Rates"
                  departmentKey="rate_schedule"
                  apiEndpoint="rate_schedule"
                  description="Upload Cost-Plus Schedule of Rates. Expected format: Excel Workbooks."
                  colorTheme="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950"
                  notes={notes.filter((n: any) => n.department?.toLowerCase() === 'rate_schedule')}
                  documents={documents.filter((d: any) => d.department?.toLowerCase() === 'rate_schedule')}
                  onAddNote={handleAddNote}
                  integrations={(project.integrations || []).filter((i: any) => i.module === 'rate_schedule')}
                  onRefresh={fetchProjectData}
                  globalLoading={globalProcessing}
                  setGlobalLoading={setGlobalProcessing}
                  activeTab="pmo"
                />
              )}

              {/* PMO Subtab: Reimbursable Costs */}
              {pmoSubTab === 'reimbursable_costs' && (
                <ReimbursableCostsTab
                  projectId={project.id}
                  departmentName="Reimbursable Costs"
                  departmentKey="reimbursable_claims"
                  apiEndpoint="reimbursable_claims"
                  description="Upload daily invoices, receipts, and reimbursable claims. Expected format: PDF or Images."
                  colorTheme="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950"
                  notes={notes.filter((n: any) => n.department?.toLowerCase() === 'reimbursable_claims')}
                  documents={documents.filter((d: any) => d.department?.toLowerCase() === 'reimbursable_claims')}
                  onAddNote={handleAddNote}
                  integrations={(project.integrations || []).filter((i: any) => i.module === 'reimbursable_claims')}
                  onRefresh={fetchProjectData}
                  globalLoading={globalProcessing}
                  setGlobalLoading={setGlobalProcessing}
                  activeTab="pmo"
                />
              )}

              {/* PMO Subtab: Scheduling & Timeline */}
              {pmoSubTab === 'scheduling' && (
                <ProgramOfWorksTab
                  projectId={project.id}
                  departmentName="Program of Works"
                  departmentKey="program_of_works"
                  apiEndpoint="program_of_works"
                  description="Upload master scheduling files and timelines. Expected format: MPP (MS Project), Excel, or PDF."
                  colorTheme="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950"
                  notes={notes.filter((n: any) => n.department?.toLowerCase() === 'program_of_works')}
                  documents={documents.filter((d: any) => d.department?.toLowerCase() === 'program_of_works')}
                  onAddNote={handleAddNote}
                  integrations={(project.integrations || []).filter((i: any) => i.module === 'program_of_works')}
                  onRefresh={fetchProjectData}
                  globalLoading={globalProcessing}
                  setGlobalLoading={setGlobalProcessing}
                  activeTab="pmo"
                />
              )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Level Tab 2: Tech / Engineering */}
      {activeTab === 'tech' && (
        <TechTab
          projectId={project.id}
          departmentName="Engineering & Tech"
          departmentKey="tech"
          apiEndpoint="tech"
          description={`Technical specs, structural calculations, and engineering issue logs. Expected format: PDF, AutoCAD (DWG), or Images. ${contractContext}`}
          colorTheme="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950"
          notes={notes.filter((n: any) => n.department?.toLowerCase() === 'tech')}
          documents={documents.filter((d: any) => d.department?.toLowerCase() === 'tech')}
          onAddNote={handleAddNote}
          integrations={(project.integrations || []).filter((i: any) => i.module === 'tech')}
          boqDocuments={project.boq_documents || []}
          onRefresh={fetchProjectData}
          globalLoading={globalProcessing}
          setGlobalLoading={setGlobalProcessing}
          activeTab="tech"
        />
      )}

      {/* Top Level Tab 3: Field Operations */}
      {activeTab === 'field_ops' && (
        <div className="space-y-6 animate-fade-in">
          {/* Field Ops Header Banner */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
            {/* Background Glow Accents */}
            <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-80 h-80 bg-neon-pink/20 rounded-full blur-3xl pointer-events-none mix-blend-screen" />
            
            <div className="relative z-10">
              <span className="text-xs font-semibold text-neon-pink uppercase tracking-widest drop-shadow-[0_0_8px_rgba(255,0,127,0.5)]">Site Execution</span>
              <h2 className="text-xl font-bold font-lexend mt-1 text-white drop-shadow-md">Field Operations</h2>
              <p className="text-xs text-gray-400 mt-1 max-w-xl leading-relaxed">
                Log daily progress, material deliveries, measurements, and timesheets to substantiate billing.
              </p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Vertical Navigation Grid on the Left */}
            <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] space-y-3 sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="px-3 py-2 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-neon-pink font-inter">
                      Field Modules
                    </span>
                    <h3 className="text-xs font-bold font-lexend text-white">Operations</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white border border-white/10">
                    {FIELD_OPS_SUBTABS.length} Views
                  </span>
                </div>

                <div className="space-y-2">
                  {FIELD_OPS_SUBTABS.filter(sub => !hiddenModules.includes(sub.key)).map((sub) => {
                    const SubIcon = sub.icon || ClipboardList;
                    const isSubActive = fieldOpsSubTab === sub.key;
                    return (
                      <button
                        key={sub.key}
                        onClick={() => {
                          setFieldOpsSubTab(sub.key);
                          const el = document.getElementById('field-ops-content-area');
                          if (el) {
                            const y = el.getBoundingClientRect().top + window.scrollY - 120;
                            window.scrollTo({ top: y, behavior: 'smooth' });
                          }
                        }}
                        className={`w-full text-left p-3.5 rounded-2xl transition-all duration-200 flex items-center justify-between group ${isSubActive
                            ? 'bg-gradient-to-r from-neon-pink/20 to-transparent border-l-2 border-neon-pink text-white shadow-md scale-[1.01]'
                            : 'bg-transparent hover:bg-white/5 text-gray-400 border-l-2 border-transparent'
                          }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`p-2.5 rounded-xl transition ${isSubActive
                                ? 'bg-neon-pink/20 text-neon-pink border border-neon-pink/30 shadow-[0_0_10px_rgba(255,0,127,0.2)]'
                                : 'bg-white/5 text-gray-400 border border-white/10 group-hover:text-white group-hover:scale-110'
                              }`}
                          >
                            <SubIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold font-lexend leading-tight">{sub.label}</p>
                            <p className={`text-[10px] mt-0.5 leading-snug ${isSubActive ? 'text-gray-300' : 'text-gray-500'}`}>
                              {sub.description.split('.')[0]}
                            </p>
                          </div>
                        </div>
                        {sub.badgeCount !== undefined && sub.badgeCount > 0 && (
                          <span
                            className={`ml-2 px-2 py-0.5 text-[10px] font-black rounded-full whitespace-nowrap ${isSubActive
                                ? 'bg-neon-pink/20 text-neon-pink border border-neon-pink/30'
                                : 'bg-white/10 text-gray-400 border border-white/5'
                              }`}
                          >
                            {sub.badgeCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  
                  {/* Add Module Button */}
                  <button onClick={() => setShowAddModulePrompt(true)} className="w-full text-left p-3.5 rounded-2xl transition-all duration-200 flex items-center justify-center group border border-dashed border-gray-300 hover:border-princeton-orange-300 hover:bg-princeton-orange-50 text-gray-500 hover:text-princeton-orange-700">
                    <Plus className="w-4 h-4 mr-2" />
                    <span className="text-xs font-bold">Add Module</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Field Ops Main Content Area (Right Side) */}
            <div className="flex-1 min-w-0" id="field-ops-content-area">
              <div className="space-y-8 animate-fade-in-up">
                {FIELD_OPS_SUBTABS.filter(sub => sub.key === fieldOpsSubTab).map(sub => (
                  <FieldOpsTab
                    key={sub.key}
                    projectId={project.id}
                    departmentName={sub.label}
                    departmentKey={sub.departmentKey}
                    apiEndpoint="field_ops"
                    description={sub.description}
                    colorTheme="bg-gradient-to-r from-princeton-orange-950 via-princeton-orange-900 to-autumn-leaf-950"
                    notes={notes.filter((n: any) => n.department?.toLowerCase() === sub.departmentKey.toLowerCase())}
                    documents={documents.filter((d: any) => d.department?.toLowerCase() === sub.departmentKey.toLowerCase())}
                    onAddNote={handleAddNote}
                    integrations={(project.integrations || []).filter((i: any) => i.module === 'field_ops')}
                    boqDocuments={project.boq_documents || []}
                    onRefresh={fetchProjectData}
                    globalLoading={globalProcessing}
                    setGlobalLoading={setGlobalProcessing}
                    activeTab="field_ops"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Level Tab 4: HR */}
      {activeTab === 'hr' && (
        <HrTab
          projectId={project.id}
          departmentName="Human Resources"
          departmentKey="HR"
          description="Site staffing rosters, labor compliance, personnel onboarding, and labor issues. Expected format: PDF, Excel, or Word."
          colorTheme="bg-gradient-to-r from-emerald-950 via-teal-900 to-dark-teal-950"
          notes={notes.filter((n: any) => n.department?.toLowerCase() === 'hr')}
          documents={documents.filter((d: any) => d.department?.toLowerCase() === 'hr')}
          onAddNote={handleAddNote}
          integrations={(project.integrations || []).filter((i: any) => i.module?.toLowerCase() === 'hr')}
          boqDocuments={project.boq_documents || []}
          onRefresh={fetchProjectData}
          globalLoading={globalProcessing}
          setGlobalLoading={setGlobalProcessing}
          activeTab="hr"
        />
      )}

      {/* Top Level Tab 5: Legal */}
      {activeTab === 'legal' && (
        <LegalTab
          projectId={project.id}
          departmentName="Legal & Compliance"
          departmentKey="Legal"
          description="Subcontractor contracts, environmental permits, regulatory compliance, and legal notices. Expected format: PDF or Word."
          colorTheme="bg-gradient-to-r from-crimson-violet-950 via-deep-crimson-950 to-dark-teal-950"
          notes={notes.filter((n: any) => n.department?.toLowerCase() === 'legal')}
          documents={documents.filter((d: any) => d.department?.toLowerCase() === 'legal')}
          onAddNote={handleAddNote}
          integrations={(project.integrations || []).filter((i: any) => i.module?.toLowerCase() === 'legal')}
          boqDocuments={project.boq_documents || []}
          onRefresh={fetchProjectData}
          globalLoading={globalProcessing}
          setGlobalLoading={setGlobalProcessing}
          activeTab="legal"
        />
      )}

      {/* Modals */}
      <BoqItemsModal
        isOpen={isBoqModalOpen}
        onClose={() => setIsBoqModalOpen(false)}
        boqId={selectedBoqId}
        docName={selectedBoqName}
        isReadOnly={
          project?.boq_documents?.find((d: any) => d.id === selectedBoqId)?.origin !== 'file_upload' &&
          !project?.integrations?.some(
            (i: any) => i.provider === project?.boq_documents?.find((d: any) => d.id === selectedBoqId)?.origin
          )
        }
      />

      {isManageModulesOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl flex flex-col overflow-hidden animate-scale-up">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="text-xl font-bold font-lexend text-gray-900 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-indigo-600" />
                  Manage Field Modules
                </h3>
                <p className="text-xs text-gray-500 mt-1">Toggle which modules are visible in the sidebar.</p>
              </div>
              <button onClick={() => setIsManageModulesOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {FIELD_OPS_SUBTABS.map((sub) => {
                const isHidden = hiddenModules.includes(sub.key);
                return (
                  <div key={sub.key} className={`flex items-center justify-between p-4 rounded-2xl border transition-colors ${isHidden ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-200 shadow-sm'}`}>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900">{sub.label}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{sub.description}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      {sub.key.startsWith('field_ops_custom_') && (
                        <button
                          onClick={() => setModuleToDelete({ key: sub.key, name: sub.label })}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors focus:outline-none"
                          title="Permanently Delete Module"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          let updated: string[];
                          if (isHidden) updated = hiddenModules.filter(k => k !== sub.key);
                          else updated = [...hiddenModules, sub.key];
                          setHiddenModules(updated);
                          localStorage.setItem('fieldops_hidden_modules', JSON.stringify(updated));
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${!isHidden ? 'bg-indigo-600' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${!isHidden ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button 
                onClick={() => setIsManageModulesOpen(false)}
                className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModulePrompt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-scale-up border border-gray-100">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold font-lexend text-gray-900 flex items-center">
                  <Plus className="w-5 h-5 mr-2 text-princeton-orange-600" />
                  Add New Module
                </h3>
                <p className="text-xs text-gray-500 mt-1">Create a custom tracking module for field operations.</p>
              </div>
              <button onClick={() => setShowAddModulePrompt(false)} className="text-gray-400 hover:text-gray-600 transition p-1 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-xs font-bold text-gray-700 mb-2">Module Name</label>
              <input 
                type="text" 
                autoFocus 
                value={newModuleName} 
                onChange={e => setNewModuleName(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleAddCustomModule()}
                placeholder="e.g. Concrete Pour Log" 
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-princeton-orange-500 text-sm outline-none transition font-medium" 
              />
            </div>
            <div className="p-6 pt-0 flex space-x-3">
              <button 
                onClick={() => setShowAddModulePrompt(false)}
                className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition shadow-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddCustomModule}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-princeton-orange-600 rounded-xl hover:bg-princeton-orange-700 shadow-sm shadow-princeton-orange-200 transition"
              >
                Create Module
              </button>
            </div>
          </div>
        </div>
      )}

      {moduleToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden animate-scale-up border border-red-100 text-center">
            <div className="pt-8 pb-6 px-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold font-lexend text-gray-900 mb-2">Delete Module?</h3>
              <p className="text-sm text-gray-500 mb-2">
                You are about to permanently delete <strong className="text-gray-900">{moduleToDelete.name}</strong>.
              </p>
              <p className="text-xs text-red-600 font-medium bg-red-50 p-3 rounded-lg border border-red-100">
                This action will permanently erase all configuration and <strong>permanently purge all documents and records</strong> associated with this module from the database. This cannot be undone.
              </p>
            </div>
            <div className="p-6 pt-0 flex space-x-3 bg-gray-50/50">
              <button 
                onClick={() => setModuleToDelete(null)}
                className="flex-1 py-2.5 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition shadow-sm"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteModule}
                disabled={isDeletingModule}
                className={`flex-1 py-2.5 text-sm font-bold text-white rounded-xl shadow-sm transition flex items-center justify-center ${isDeletingModule ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}
              >
                {isDeletingModule ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {actionError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 flex flex-col relative animate-scale-up">
            <button
              onClick={() => setActionError(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 active:scale-95 transition-all duration-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-50 rounded-xl text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Action Required</h3>
                <p className="text-xs text-gray-400">Request could not be completed</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed mb-6">{actionError}</p>

            <button
              onClick={() => setActionError(null)}
              className="w-full py-2.5 px-4 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow active:scale-[0.98] transition-all duration-100"
            >
              Close
            </button>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}