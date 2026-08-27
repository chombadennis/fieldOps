import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Create custom Axios client
const apiClient = axios.create({
  baseURL: API_URL,
});

// Configure automatic retry interceptor for serverless database cold starts
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    
    // If request config is missing, reject normally
    if (!config) {
      return Promise.reject(error);
    }
    
    // Setup retry count state
    if (config.retryCount === undefined) {
      config.retryCount = 0;
    }
    
    const maxRetries = 2;
    // Retry on network/connection drops or HTTP 500 (Internal Server Error)
    const shouldRetry = !error.response || error.response.status === 500;
    
    if (shouldRetry && config.retryCount < maxRetries) {
      config.retryCount += 1;
      
      // Wait 1.5 seconds before retrying to allow Neon database to finish boot up
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // Re-run the request
      return apiClient(config);
    }
    
    return Promise.reject(error);
  }
);

export const uploadFile = (file: File, projectId: string | number) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('project_id', String(projectId));
  return apiClient.post('/ai/parse-boq', formData);
};

export const createProject = async (project: { name: string; description: string }) => {
  const response = await apiClient.post('/projects', project);
  return response.data;
};

export const getProject = async (projectId: string) => {
  const response = await apiClient.get(`/projects/${projectId}`);
  return response.data;
};

export const getProjects = async () => {
  const response = await apiClient.get('/projects');
  return response.data;
};

export const updateProject = async (projectId: string, project: { name: string; description: string }) => {
  const response = await apiClient.put(`/projects/${projectId}`, project);
  return response.data;
};

export const deleteProject = async (projectId: string) => {
  const response = await apiClient.delete(`/projects/${projectId}`);
  return response.data;
};

export const getGoogleAuthUrl = async (projectId: string | number, activeTab?: string, pmoSubTab?: string) => {
  const response = await apiClient.get('/integrations/google/auth-url', {
    params: { project_id: projectId, active_tab: activeTab, pmo_sub_tab: pmoSubTab }
  });
  return response.data;
};

export const getOneDriveAuthUrl = async (projectId: string | number, activeTab?: string, pmoSubTab?: string) => {
  const response = await apiClient.get('/integrations/onedrive/auth-url', {
    params: { project_id: projectId, active_tab: activeTab, pmo_sub_tab: pmoSubTab }
  });
  return response.data;
};

export const getGlobalAuthToken = async (projectId: string | number, provider: string) => {
  const response = await apiClient.get(`/projects/${projectId}/integrations/token`, {
    params: { provider }
  });
  return response.data;
};


export const saveIntegration = async (data: {
  project_id: string | number;
  provider: string;
  spreadsheet_id: string;
  sheet_name: string;
  boq_name?: string;
  refresh_token?: string;
  module?: string;
  ipc_certificate_number?: string;
  trade_label?: string;
  tracking_mode?: string;
}) => {
  const q = new URLSearchParams();
  q.append('project_id', String(data.project_id));
  q.append('provider', data.provider);
  q.append('spreadsheet_id', data.spreadsheet_id);
  q.append('sheet_name', data.sheet_name);
  if (data.boq_name) q.append('boq_name', data.boq_name);
  if (data.refresh_token) q.append('refresh_token', data.refresh_token);
  if (data.module) q.append('module', data.module);
  if (data.ipc_certificate_number) q.append('ipc_certificate_number', data.ipc_certificate_number);
  if (data.trade_label) q.append('trade_label', data.trade_label);
  if (data.tracking_mode) q.append('tracking_mode', data.tracking_mode);
  const response = await apiClient.post(`/integrations/save?${q.toString()}`);
  return response.data;
};

export const previewIpcExtraction = async (data: {
  project_id: number | string;
  provider: string;
  spreadsheet_id: string;
  ipc_certificate_number?: string;
  refresh_token?: string;
}) => {
  const response = await apiClient.post(`/integrations/ipc/preview`, data);
  return response.data;
};

export const checkIpcExists = async (projectId: string | number, cloudFileId: string) => {
  const response = await apiClient.get(`/projects/${projectId}/ipc/check-exists`, {
    params: { cloud_file_id: cloudFileId }
  });
  return response.data;
};

export const listCloudSheets = async (params: {
  provider: string;
  refresh_token: string;
  spreadsheet_id: string;
  check_headers?: boolean;
}) => {
  const response = await apiClient.get('/integrations/list-sheets', { params });
  return response.data;
};

export const triggerSyncImport = async (integrationId: number) => {
  const response = await apiClient.post(`/integrations/${integrationId}/sync-import`);
  return response.data;
};

export const deleteIntegration = async (integrationId: number, purgeData: boolean = false) => {
  const response = await apiClient.delete(`/integrations/${integrationId}`, {
    params: { purge_data: purgeData }
  });
  return response.data;
};

export const checkIntegrationUpdate = async (integrationId: number) => {
  try {
    const response = await apiClient.get(`/integrations/${integrationId}/check-update`);
    return response.data;
  } catch (err: any) {
    if (err.response && err.response.status === 404) {
      return { has_updates: false, new_sheets: [] };
    }
    throw err;
  }
};

export const dismissIntegrationSheets = async (integrationId: number, sheetNames: string[]) => {
  const response = await apiClient.post(`/integrations/${integrationId}/dismiss-sheets`, sheetNames);
  return response.data;
};


export const listActiveIntegrationSheets = async (integrationId: number) => {
  const response = await apiClient.get(`/integrations/${integrationId}/sheets`);
  return response.data;
};

export const listCloudFiles = async (provider: string, refreshToken: string, folderId?: string, filterType?: string, projectId?: string | number, module?: string) => {
  const response = await apiClient.get('/integrations/list-files', {
    params: { provider, refresh_token: refreshToken, folder_id: folderId, filter_type: filterType, project_id: projectId, module }
  });
  return response.data;
};

export const convertGoogleCloudFile = async (provider: string, refreshToken: string, fileId: string) => {
  const response = await apiClient.post('/integrations/convert-google-file', null, {
    params: { provider, refresh_token: refreshToken, file_id: fileId }
  });
  return response.data;
};

export const getDocumentStreamUrl = (documentId: number, docType?: string) => {
  const url = `${API_URL}/documents/${documentId}/stream`;
  return docType ? `${url}?doc_type=${docType}` : url;
};

export const getBoqItems = async (boqId: number) => {
  const response = await apiClient.get(`/boqs/${boqId}/items`);
  return response.data;
};

export const updateBoqItems = async (boqId: number, items: any[]) => {
  const response = await apiClient.put(`/boqs/${boqId}/items`, items);
  return response.data;
};

export const deleteBoqDocument = async (boqId: number) => {
  const response = await apiClient.delete(`/boqs/${boqId}`);
  return response.data;
};

export const getIntegrationEmbedUrl = async (integrationId: number, mode: string = 'edit') => {
  const response = await apiClient.get(`/integrations/${integrationId}/embed-url`, {
    params: { mode }
  });
  return response.data;
};

// --- Platform & Collaboration APIs ---
export const getCurrentUser = async (role: string = 'admin') => {
  const response = await apiClient.get('/users/me', { params: { role } });
  return response.data;
};

export const getProjectNotes = async (projectId: string | number, department?: string) => {
  const response = await apiClient.get(`/projects/${projectId}/notes`, {
    params: { department }
  });
  return response.data;
};

export const createProjectNote = async (projectId: string | number, note: { content: string; department: string; is_issue?: boolean; priority?: string }) => {
  const response = await apiClient.post(`/projects/${projectId}/notes`, note);
  return response.data;
};

export const getProjectDocuments = async (projectId: string | number, department?: string) => {
  const response = await apiClient.get(`/projects/${projectId}/documents`, {
    params: { department }
  });
  return response.data;
};

export const createProjectDocument = async (
  projectId: string | number,
  doc: { title: string; file_url: string; department?: string; note_id?: number; file_type?: string; file_size?: number; cloud_file_id?: string; origin?: string; integration_id?: number }
) => {
  const response = await apiClient.post(`/projects/${projectId}/documents`, doc);
  return response.data;
};

export const getDecoupledDocuments = async (projectId: string | number, endpoint: string) => {
  const response = await apiClient.get(`/projects/${projectId}/${endpoint}`);
  return response.data;
};

export const createDecoupledDocument = async (projectId: string | number, endpoint: string, doc: any) => {
  const response = await apiClient.post(`/projects/${projectId}/${endpoint}`, doc);
  return response.data;
};

export const unlinkDecoupledDocument = async (projectId: string | number, endpoint: string, documentId: number) => {
  const response = await apiClient.post(`/projects/${projectId}/${endpoint}/${documentId}/unlink`);
  return response.data;
};

export const deleteDecoupledDocument = async (projectId: string | number, endpoint: string, documentId: number) => {
  const response = await apiClient.delete(`/projects/${projectId}/${endpoint}/${documentId}`);
  return response.data;
};

export const getDocumentEmbedUrl = async (documentId: number, mode: string = 'view', docType?: string) => {
  const response = await apiClient.get(`/documents/${documentId}/embed-url`, {
    params: { mode, doc_type: docType }
  });
  return response.data;
};

export const unlinkProjectDocument = async (projectId: string | number, documentId: number) => {
  const response = await apiClient.post(`/projects/${projectId}/documents/${documentId}/unlink`);
  return response.data;
};

export const deleteProjectDocument = async (projectId: string | number, documentId: number) => {
  const response = await apiClient.delete(`/projects/${projectId}/documents/${documentId}`);
  return response.data;
};

export const getProjectBudgets = async (projectId: string | number) => {
  const response = await apiClient.get(`/projects/${projectId}/budgets`);
  return response.data;
};

export const createProjectBudget = async (projectId: string | number, budget: { category: string; amount: number; description?: string }) => {
  const response = await apiClient.post(`/projects/${projectId}/budgets`, budget);
  return response.data;
};

export const updateProjectBudget = async (projectId: string | number, budgetId: string | number, data: any) => {
  const response = await apiClient.put(`/projects/${projectId}/budgets/${budgetId}`, data);
  return response.data;
};

export const getProjectIPCs = async (projectId: string | number) => {
  const response = await apiClient.get(`/projects/${projectId}/ipcs`);
  return response.data;
};

export const createProjectIPC = async (projectId: string | number, ipc: { certificate_number: string; amount_claimed: number; status?: string }) => {
  const response = await apiClient.post(`/projects/${projectId}/ipcs`, ipc);
  return response.data;
};

export const updateProjectIPC = async (projectId: string | number, ipcId: string | number, data: any) => {
  const response = await apiClient.put(`/projects/${projectId}/ipc/records/${ipcId}`, data);
  return response.data;
};

export const updateProjectMilestoneClaim = async (projectId: string | number, claimId: string | number, data: any) => {
  const response = await apiClient.put(`/projects/${projectId}/milestone_claims/${claimId}`, data);
  return response.data;
};

export const validateBudget = async (data: { project_id: number; provider: string; spreadsheet_id: string; refresh_token?: string; trade_label?: string }): Promise<{ valid: boolean; reason?: string; previously_flagged?: boolean }> => {
  const response = await apiClient.post('/integrations/budget/validate', data);
  return response.data;
};

export const previewBudgetExtraction = async (data: { project_id: number; provider: string; spreadsheet_id: string; refresh_token?: string; trade_label?: string }) => {
  const response = await apiClient.post('/integrations/budget/preview', data);
  return response.data;
};

export const commitBudgetExtraction = async (data: {
  project_id: number;
  contract_id?: number;
  original_contract_sum: number;
  appraised_budget?: number;
  earned_value?: number;
  remaining_balance?: number;
  percent_used?: number;
  categories?: any[];
  integration_id?: number;
  file_url?: string;
  title?: string;
  trade_label?: string;
  expected_count?: number;
  project_title_found?: string;
  module?: string;
}) => {
  const response = await apiClient.post('/integrations/budget/commit', data);
  return response.data;
};

export const updateIntegrationModule = async (integrationId: string | number, module: string) => {
  const response = await apiClient.put(`/integrations/${integrationId}/module`, { module });
  return response.data;
};

export const updateBudgetWorkbookMatrix = async (data: {
  project_id: number;
  integration_id?: number;
  old_trade_label?: string;
  trade_label?: string;
  categories?: any[];
}) => {
  const response = await apiClient.post('/integrations/budget/update-matrix', data);
  return response.data;
};

export const validateActivitySchedule = async (projectId: string | number, data: {
  project_id: number;
  provider: string;
  spreadsheet_id: string;
  filename: string;
  refresh_token?: string;
  trade_label?: string;
  selected_sheets?: string[];
}): Promise<{ valid: boolean; reason?: string; extracted_data?: any }> => {
  const response = await apiClient.post(`/projects/${projectId}/activity_schedule/validate`, data);
  return response.data;
};

export const previewActivityScheduleExtraction = async (projectId: string | number, data: {
  project_id: number;
  provider: string;
  spreadsheet_id: string;
  filename: string;
  refresh_token?: string;
  trade_label?: string;
  selected_sheets?: string[];
}) => {
  const response = await apiClient.post(`/projects/${projectId}/activity_schedule/preview`, data);
  return response.data;
};

export const commitActivityScheduleExtraction = async (projectId: string | number, data: {
  project_id: number;
  contract_id?: number;
  integration_id?: number;
  file_url?: string;
  title?: string;
  items?: any[];
}) => {
  const response = await apiClient.post(`/projects/${projectId}/activity_schedule/commit`, data);
  return response.data;
};

export const getActivityScheduleItems = async (projectId: string | number, documentId: string | number) => {
  const response = await apiClient.get(`/projects/${projectId}/activity_schedule/documents/${documentId}/items`);
  return response.data;
};

export const updateActivityScheduleItems = async (projectId: string | number, documentId: string | number, items: any[]) => {
  const response = await apiClient.post(`/projects/${projectId}/activity_schedule/documents/${documentId}/items`, { items });
  return response.data;
};

// --- Milestone Claims APIs ---

export const validateMilestoneClaim = async (projectId: string | number, data: {
  project_id: number;
  provider: string;
  spreadsheet_id: string;
  filename: string;
  refresh_token?: string;
  selected_sheets?: string[];
}): Promise<{ valid: boolean; reason?: string; extracted_data?: any }> => {
  const response = await apiClient.post(`/projects/${projectId}/milestone_claims/validate`, data);
  return response.data;
};

export const previewMilestoneClaimExtraction = async (projectId: string | number, data: {
  project_id: number;
  provider: string;
  spreadsheet_id: string;
  filename: string;
  refresh_token?: string;
  selected_sheets?: string[];
}) => {
  const response = await apiClient.post(`/projects/${projectId}/milestone_claims/preview`, data);
  return response.data;
};

export const commitMilestoneClaimExtraction = async (projectId: string | number, data: {
  project_id: number;
  contract_id?: number;
  integration_id?: number;
  file_url?: string;
  title?: string;
  metrics?: any;
  items?: any[];
}) => {
  const response = await apiClient.post(`/projects/${projectId}/milestone_claims/commit`, data);
  return response.data;
};
