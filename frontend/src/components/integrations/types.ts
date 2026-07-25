export interface Integration {
  id: number;
  provider: string;
  spreadsheet_id: string;
  sheet_name: string;
  boq_name: string | null;
  last_synced_at: string | null;
  preview_only?: boolean;
  validation_status?: string | null;
  validation_score?: number | null;
  validation_issues?: string[] | null;
  validation_summary?: string | null;
  module?: string;
}

export interface DocumentIntegrationsProps {
  projectId: string;
  integrations: Integration[];
  onRefresh: () => void;
  globalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;
  moduleContext: 'ipc' | 'budget' | 'department';
  departmentName?: string;
  apiEndpoint?: string;
  activeTab?: string;
  pmoSubTab?: string;
  titlePrefix?: string;
}
