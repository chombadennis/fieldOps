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

export const getGoogleAuthUrl = async (projectId: string) => {
  const response = await apiClient.get(`/integrations/google/auth-url?project_id=${projectId}`);
  return response.data;
};

export const getOneDriveAuthUrl = async (projectId: string) => {
  const response = await apiClient.get(`/integrations/onedrive/auth-url?project_id=${projectId}`);
  return response.data;
};

export const saveIntegration = async (data: {
  project_id: number;
  provider: string;
  spreadsheet_id: string;
  sheet_name: string;
  refresh_token?: string;
  boq_name?: string;
}) => {
  const response = await apiClient.post('/integrations/save', null, { params: data });
  return response.data;
};

export const listCloudSheets = async (params: {
  provider: string;
  refresh_token: string;
  spreadsheet_id: string;
}) => {
  const response = await apiClient.get('/integrations/list-sheets', { params });
  return response.data;
};

export const triggerSyncImport = async (integrationId: number) => {
  const response = await apiClient.post(`/integrations/${integrationId}/sync-import`);
  return response.data;
};

export const deleteIntegration = async (integrationId: number) => {
  const response = await apiClient.delete(`/integrations/${integrationId}`);
  return response.data;
};

export const checkIntegrationUpdate = async (integrationId: number) => {
  const response = await apiClient.get(`/integrations/${integrationId}/check-update`);
  return response.data;
};

export const listActiveIntegrationSheets = async (integrationId: number) => {
  const response = await apiClient.get(`/integrations/${integrationId}/sheets`);
  return response.data;
};

export const listCloudFiles = async (provider: string, refreshToken: string, folderId?: string) => {
  const response = await apiClient.get('/integrations/list-files', {
    params: { provider, refresh_token: refreshToken, folder_id: folderId }
  });
  return response.data;
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
