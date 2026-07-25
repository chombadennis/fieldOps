'use client';

import { useEffect, useState } from 'react';
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
import IpcsTab from '@/components/IpcsTab';
import DepartmentTab from '@/components/DepartmentTab';
import { AlertTriangle, X, FileSpreadsheet, DollarSign, FileCheck, HardHat, Wrench, Users, Scale, Building2, Calendar } from 'lucide-react';

export default function ProjectDashboardPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Platform Data states
  const [budgets, setBudgets] = useState<any[]>([]);
  const [ipcs, setIpcs] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);

  // BOQ Modal states
  const [selectedBoqId, setSelectedBoqId] = useState<number | null>(null);
  const [selectedBoqName, setSelectedBoqName] = useState<string>('');
  const [isBoqModalOpen, setIsBoqModalOpen] = useState(false);
  const [globalProcessing, setGlobalProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const visibleTabs = ROLES_CONFIG[currentRole]?.visibleTabs || ['pmo'];

  // Switch tab automatically if current activeTab is hidden for newly selected role
  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] || 'pmo');
    }
  }, [currentRole]);

  const fetchProjectData = async () => {
    try {
      const [
        projData, bData, iData, nData, 
        dData, techData, fieldOpsData, activityData, milestoneData, rateData, reimbursableData, programData, ipcDocsData
      ] = await Promise.all([
        getProject(projectId),
        getProjectBudgets(projectId).catch(() => []),
        getProjectIPCs(projectId).catch(() => []),
        getProjectNotes(projectId).catch(() => []),
        getProjectDocuments(projectId).catch(() => []), // standard documents
        
        // Decoupled Documents
        import('@/services/api').then(m => m.getDecoupledDocuments(projectId, 'tech')).catch(() => []),
        import('@/services/api').then(m => m.getDecoupledDocuments(projectId, 'field_ops')).catch(() => []),
        import('@/services/api').then(m => m.getDecoupledDocuments(projectId, 'activity_schedule')).catch(() => []),
        import('@/services/api').then(m => m.getDecoupledDocuments(projectId, 'milestone_claims')).catch(() => []),
        import('@/services/api').then(m => m.getDecoupledDocuments(projectId, 'rate_schedule')).catch(() => []),
        import('@/services/api').then(m => m.getDecoupledDocuments(projectId, 'reimbursable_claims')).catch(() => []),
        import('@/services/api').then(m => m.getDecoupledDocuments(projectId, 'program_of_works')).catch(() => []),
        import('@/services/api').then(m => m.getDecoupledDocuments(projectId, 'ipc')).catch(() => []),
      ]);
      
      const allDocs = [
        ...dData, ...techData, ...fieldOpsData, ...activityData, 
        ...milestoneData, ...rateData, ...reimbursableData, ...programData, ...ipcDocsData
      ];
      
      setProject(projData);
      setBudgets(bData);
      setIpcs(iData);
      setNotes(nData);
      setDocuments(allDocs);
      setError(null);
    } catch (err) {
      setError('Failed to fetch project details.');
      console.error(err);
    }
  };

  const handleAddBudget = async (b: { category: string; amount: number; description: string }) => {
    await createProjectBudget(projectId, b);
    const updated = await getProjectBudgets(projectId);
    setBudgets(updated);
  };

  const handleAddIPC = async (i: { certificate_number: string; amount_claimed: number; status: string }) => {
    await createProjectIPC(projectId, i);
    const updated = await getProjectIPCs(projectId);
    setIpcs(updated);
  };

  const handleAddNote = async (n: { content: string; department: string; is_issue: boolean; priority: string }) => {
    await createProjectNote(projectId, n);
    const updated = await getProjectNotes(projectId);
    setNotes(updated);
  };

  const handleAddDocument = async (d: { title: string; file_url: string; department: string }) => {
    await createProjectDocument(projectId, d);
    const updated = await getProjectDocuments(projectId);
    setDocuments(updated);
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

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchProjectData();
      setLoading(false);
    };
    init();
  }, [projectId]);

  if (loading) {
    return (
      <main className="container mx-auto p-4">
        <DashboardSkeleton />
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="container mx-auto p-4">
        <ErrorMessage message={error || 'Project not found.'} />
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

  const contractType = project?.contracts?.[0]?.contract_type || 'GENERAL';
  const contractName = project?.contracts?.[0]?.name || 'General Contract';
  const contractContext = `(Active Contract: ${contractName} - ${contractType.replace('_', ' ')})`;

  let PMO_SUBTABS = [];
  if (contractType === 'LUMP_SUM') {
    PMO_SUBTABS = [
      { key: 'activity_schedule', label: 'Activity Schedule', description: `Upload Activity Schedule files (Expected: Excel). ${contractContext}`, icon: FileSpreadsheet, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'activity_schedule').length },
      { key: 'milestone_payments', label: 'Milestone Payments', description: `Upload milestone claims (Expected: PDF/Word). ${contractContext}`, icon: FileCheck, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'milestone_claims').length },
      { key: 'budgets', label: 'Budget & EVM', description: `Project budget, cost tracking, and Work Progress Calculations. ${contractContext}`, icon: DollarSign, badgeCount: budgets.length + documents.filter((d) => d.department?.toUpperCase() === 'BUDGET').length },
      { key: 'scheduling', label: 'Scheduling & Timeline', description: `Upload Program of Works (Expected: MPP/Excel). ${contractContext}`, icon: Calendar, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'program_of_works').length },
    ];
  } else if (contractType === 'COST_PLUS') {
    PMO_SUBTABS = [
      { key: 'rate_schedule', label: 'Schedule of Rates', description: `Upload Rate Schedule files (Expected: Excel). ${contractContext}`, icon: FileSpreadsheet, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'rate_schedule').length },
      { key: 'reimbursable_costs', label: 'Reimbursable Costs', description: `Upload Invoices and Receipts (Expected: PDF/Images). ${contractContext}`, icon: FileCheck, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'reimbursable_claims').length },
      { key: 'budgets', label: 'Budget & EVM', description: `Project budget, cost tracking, and Work Progress Calculations. ${contractContext}`, icon: DollarSign, badgeCount: budgets.length + documents.filter((d) => d.department?.toUpperCase() === 'BUDGET').length },
      { key: 'scheduling', label: 'Scheduling & Timeline', description: `Upload Program of Works (Expected: MPP/Excel). ${contractContext}`, icon: Calendar, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'program_of_works').length },
    ];
  } else {
    // GENERAL - ALL TABS ACTIVE
    PMO_SUBTABS = [
      { key: 'boq', label: 'BoQ & Files', description: `Bills of Quantities (Expected: Excel Workbooks). ${contractContext}`, icon: FileSpreadsheet, badgeCount: project.boq_documents?.length || 0 },
      { key: 'ipcs', label: 'IPC & Claims', description: `Interim Payment Certificates (Expected: PDF/Excel). ${contractContext}`, icon: FileCheck, badgeCount: documents.filter((d) => d.department?.toUpperCase() === 'IPC' || d.department?.toLowerCase() === 'ipc').length },
      { key: 'budgets', label: 'Budget & EVM', description: `Project budget, cost tracking, and Work Progress Calculations. ${contractContext}`, icon: DollarSign, badgeCount: budgets.length + documents.filter((d) => d.department?.toUpperCase() === 'BUDGET').length },
      { key: 'scheduling', label: 'Scheduling & Timeline', description: `Upload Program of Works (Expected: MPP/Excel). ${contractContext}`, icon: Calendar, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'program_of_works').length },
      { key: 'activity_schedule', label: 'Activity Schedule', description: `Upload Activity Schedule files (Expected: Excel). ${contractContext}`, icon: FileSpreadsheet, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'activity_schedule').length },
      { key: 'milestone_payments', label: 'Milestone Payments', description: `Upload milestone claims (Expected: PDF/Word). ${contractContext}`, icon: FileCheck, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'milestone_claims').length },
      { key: 'rate_schedule', label: 'Schedule of Rates', description: `Upload Rate Schedule files (Expected: Excel). ${contractContext}`, icon: FileSpreadsheet, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'rate_schedule').length },
      { key: 'reimbursable_costs', label: 'Reimbursable Costs', description: `Upload Invoices and Receipts (Expected: PDF/Images). ${contractContext}`, icon: FileCheck, badgeCount: documents.filter((d) => d.department?.toLowerCase() === 'reimbursable_claims').length },
    ];
  }

  return (
    <main className="container mx-auto p-4 space-y-6">
      {/* Role Switcher Banner */}
      <RoleSwitcher currentRole={currentRole} onRoleChange={setCurrentRole} />

      {/* Project Header */}
      <ProjectDetails project={project} />

      {/* Dashboard Top Section Navigation Bar */}
      <div className="bg-white rounded-3xl p-2.5 shadow-sm border border-gray-100 flex items-center gap-2 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-dark-teal-900 text-white shadow-md font-lexend'
                  : 'text-gray-600 hover:bg-dark-teal-50 hover:text-dark-teal-900'
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
          <div className="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950 text-white rounded-3xl p-8 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
            <div className="relative z-10">
              <span className="text-xs font-semibold text-dark-teal-300 uppercase tracking-widest">Office Operations</span>
              <h2 className="text-xl font-bold font-lexend mt-1">Project Management Office (PMO)</h2>
              <p className="text-xs text-dark-teal-100/80 mt-1 max-w-xl leading-relaxed">
                Consolidated PMO control center for tracking physical Quantities (BoQ), interim payment claims (IPCs), and cost-to-complete budgets.
              </p>
            </div>
            <div className="flex items-center space-x-4 relative z-10 flex-shrink-0">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-right">
                <p className="text-[10px] font-bold text-dark-teal-200 uppercase">Total Claimed</p>
                <p className="text-sm font-bold font-lexend text-white mt-0.5">${ipcs.reduce((s, i) => s + (i.amount_claimed || 0), 0).toLocaleString()}</p>
              </div>
              <div className="bg-white/15 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-right">
                <p className="text-[10px] font-bold text-dark-teal-200 uppercase">Total Budget</p>
                <p className="text-sm font-bold font-lexend text-white mt-0.5">${budgets.reduce((s, b) => s + (b.amount || 0), 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Vertical Navigation Grid on the Left */}
            <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
              <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 space-y-3 sticky top-6">
                <div className="px-3 py-2 bg-dark-teal-50/70 rounded-2xl border border-dark-teal-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-dark-teal-800 font-inter">
                      PMO Modules
                    </span>
                    <h3 className="text-xs font-bold font-lexend text-gray-900">Control Panel</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-dark-teal-900 text-white">
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
                        onClick={() => setPmoSubTab(sub.key)}
                        className={`w-full text-left p-3.5 rounded-2xl transition-all duration-200 flex items-center justify-between group ${
                          isSubActive
                            ? 'bg-gradient-to-r from-dark-teal-900 to-dark-teal-950 text-white shadow-md scale-[1.01]'
                            : 'bg-gray-50/80 hover:bg-dark-teal-50/50 text-gray-700 hover:text-dark-teal-900 border border-gray-100 hover:border-dark-teal-100'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`p-2.5 rounded-xl transition ${
                              isSubActive
                                ? 'bg-white/10 text-white'
                                : 'bg-white text-dark-teal-700 shadow-sm border border-gray-100 group-hover:scale-110'
                            }`}
                          >
                            <SubIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold font-lexend leading-tight">{sub.label}</p>
                            <p className={`text-[10px] mt-0.5 leading-snug ${isSubActive ? 'text-dark-teal-200' : 'text-gray-400'}`}>
                              {sub.description}
                            </p>
                          </div>
                        </div>
                        {sub.badgeCount !== undefined && (
                          <span
                            className={`ml-2 px-2 py-0.5 text-[10px] font-black rounded-full whitespace-nowrap ${
                              isSubActive
                                ? 'bg-white/20 text-white'
                                : 'bg-gray-200/80 text-gray-600'
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
                <div className="p-3 bg-gradient-to-br from-gray-900 to-dark-teal-950 text-white rounded-2xl text-xs space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-dark-teal-200 uppercase">PMO Quick Stats</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase font-semibold">Total Claimed</p>
                      <p className="font-bold text-white">${ipcs.reduce((s, i) => s + (i.amount_claimed || 0), 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase font-semibold">Total Budget</p>
                      <p className="font-bold text-white">${budgets.reduce((s, b) => s + (b.amount || 0), 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PMO Main Content Area (Right Side) */}
            <div className="flex-1 space-y-8 min-w-0">
              {/* PMO Subtab 1: BoQ & Cloud Files */}
              {pmoSubTab === 'boq' && (
                <div className="space-y-8 animate-fade-in">
                  {/* Cloud Integrations Card */}
                  <BoqIntegrations
                    projectId={project.id}
                    integrations={project.integrations || []}
                    boqDocuments={project.boq_documents || []}
                    documents={documents}
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
                    integrations={project.integrations || []}
                  />
                </div>
              )}

              {/* PMO Subtab 2: IPC & Claims */}
              {pmoSubTab === 'ipcs' && (
                <IpcsTab
                  projectId={project.id}
                  ipcs={ipcs}
                  notes={notes}
                  documents={documents}
                  onAddNote={handleAddNote}
                  integrations={project.integrations || []}
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
                  notes={notes}
                  documents={documents}
                  onAddNote={handleAddNote}
                  integrations={project.integrations || []}
                  boqDocuments={project.boq_documents || []}
                  onRefresh={fetchProjectData}
                  globalLoading={globalProcessing}
                  setGlobalLoading={setGlobalProcessing}
                />
              )}
              {/* PMO Subtab: Activity Schedule */}
              {pmoSubTab === 'activity_schedule' && (
                <DepartmentTab
                  projectId={project.id}
                  departmentName="Activity Schedule"
                  departmentKey="activity_schedule"
                  apiEndpoint="activity_schedule"
                  description="Upload and link Lump Sum Activity Schedule files. Expected format: Excel Workbooks."
                  colorTheme="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950"
                  notes={notes}
                  documents={documents}
                  onAddNote={handleAddNote}
                  integrations={project.integrations || []}
                  onRefresh={fetchProjectData}
                  globalLoading={globalProcessing}
                  setGlobalLoading={setGlobalProcessing}
                  activeTab="pmo"
                />
              )}

              {/* PMO Subtab: Milestone Payments */}
              {pmoSubTab === 'milestone_payments' && (
                <DepartmentTab
                  projectId={project.id}
                  departmentName="Milestone Payments"
                  departmentKey="milestone_claims"
                  apiEndpoint="milestone_claims"
                  description="Upload milestone payment claims and certificates. Expected format: PDF or Word."
                  colorTheme="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950"
                  notes={notes}
                  documents={documents}
                  onAddNote={handleAddNote}
                  integrations={project.integrations || []}
                  onRefresh={fetchProjectData}
                  globalLoading={globalProcessing}
                  setGlobalLoading={setGlobalProcessing}
                  activeTab="pmo"
                />
              )}

              {/* PMO Subtab: Schedule of Rates */}
              {pmoSubTab === 'rate_schedule' && (
                <DepartmentTab
                  projectId={project.id}
                  departmentName="Schedule of Rates"
                  departmentKey="rate_schedule"
                  apiEndpoint="rate_schedule"
                  description="Upload Cost-Plus Schedule of Rates. Expected format: Excel Workbooks."
                  colorTheme="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950"
                  notes={notes}
                  documents={documents}
                  onAddNote={handleAddNote}
                  integrations={project.integrations || []}
                  onRefresh={fetchProjectData}
                  globalLoading={globalProcessing}
                  setGlobalLoading={setGlobalProcessing}
                  activeTab="pmo"
                />
              )}

              {/* PMO Subtab: Reimbursable Costs */}
              {pmoSubTab === 'reimbursable_costs' && (
                <DepartmentTab
                  projectId={project.id}
                  departmentName="Reimbursable Costs"
                  departmentKey="reimbursable_claims"
                  apiEndpoint="reimbursable_claims"
                  description="Upload daily invoices, receipts, and reimbursable claims. Expected format: PDF or Images."
                  colorTheme="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950"
                  notes={notes}
                  documents={documents}
                  onAddNote={handleAddNote}
                  integrations={project.integrations || []}
                  onRefresh={fetchProjectData}
                  globalLoading={globalProcessing}
                  setGlobalLoading={setGlobalProcessing}
                  activeTab="pmo"
                />
              )}

              {/* PMO Subtab: Scheduling & Timeline */}
              {pmoSubTab === 'scheduling' && (
                <DepartmentTab
                  projectId={project.id}
                  departmentName="Program of Works"
                  departmentKey="program_of_works"
                  apiEndpoint="program_of_works"
                  description="Upload master scheduling files and timelines. Expected format: MPP (MS Project), Excel, or PDF."
                  colorTheme="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950"
                  notes={notes}
                  documents={documents}
                  onAddNote={handleAddNote}
                  integrations={project.integrations || []}
                  onRefresh={fetchProjectData}
                  globalLoading={globalProcessing}
                  setGlobalLoading={setGlobalProcessing}
                  activeTab="pmo"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Level Tab 2: Tech / Engineering */}
      {activeTab === 'tech' && (
        <DepartmentTab
          projectId={project.id}
          departmentName="Engineering & Tech"
          departmentKey="tech"
          apiEndpoint="tech"
          description={`Technical specs, structural calculations, and engineering issue logs. Expected format: PDF, AutoCAD (DWG), or Images. ${contractContext}`}
          colorTheme="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950"
          notes={notes}
          documents={documents}
          onAddNote={handleAddNote}
          integrations={project.integrations || []}
          boqDocuments={project.boq_documents || []}
          onRefresh={fetchProjectData}
          globalLoading={globalProcessing}
          setGlobalLoading={setGlobalProcessing}
          activeTab="tech"
        />
      )}

      {/* Top Level Tab 3: Field Operations */}
      {activeTab === 'field_ops' && (
        <DepartmentTab
          projectId={project.id}
          departmentName="Field Operations"
          departmentKey="field_ops"
          apiEndpoint="field_ops"
          description={`Site equipment status, weather delays, safety updates, and contractor coordination. Expected format: PDF, Word, or Images. ${contractContext}`}
          colorTheme="bg-gradient-to-r from-princeton-orange-950 via-princeton-orange-900 to-autumn-leaf-950"
          notes={notes}
          documents={documents}
          onAddNote={handleAddNote}
          integrations={project.integrations || []}
          boqDocuments={project.boq_documents || []}
          onRefresh={fetchProjectData}
          globalLoading={globalProcessing}
          setGlobalLoading={setGlobalProcessing}
          activeTab="field_ops"
        />
      )}

      {/* Top Level Tab 4: HR */}
      {activeTab === 'hr' && (
        <DepartmentTab
          projectId={project.id}
          departmentName="Human Resources"
          departmentKey="HR"
          description="Site staffing rosters, labor compliance, personnel onboarding, and labor issues. Expected format: PDF, Excel, or Word."
          colorTheme="bg-gradient-to-r from-emerald-950 via-teal-900 to-dark-teal-950"
          notes={notes}
          documents={documents}
          onAddNote={handleAddNote}
          integrations={project.integrations || []}
          boqDocuments={project.boq_documents || []}
          onRefresh={fetchProjectData}
          globalLoading={globalProcessing}
          setGlobalLoading={setGlobalProcessing}
          activeTab="hr"
        />
      )}

      {/* Top Level Tab 5: Legal */}
      {activeTab === 'legal' && (
        <DepartmentTab
          projectId={project.id}
          departmentName="Legal & Compliance"
          departmentKey="Legal"
          description="Subcontractor contracts, environmental permits, regulatory compliance, and legal notices. Expected format: PDF or Word."
          colorTheme="bg-gradient-to-r from-crimson-violet-950 via-deep-crimson-950 to-dark-teal-950"
          notes={notes}
          documents={documents}
          onAddNote={handleAddNote}
          integrations={project.integrations || []}
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
  );
}