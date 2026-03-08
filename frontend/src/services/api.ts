import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const uploadFile = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return axios.post(`${API_URL}/upload`, formData);
};

export const createProject = async (project: { name: string; description: string }) => {
  const response = await axios.post(`${API_URL}/projects`, project);
  return response.data;
};

export const getProject = async (projectId: string) => {
  const response = await axios.get(`${API_L_URL}/projects/${projectId}`);
  return response.data;
};

export const getProjects = async () => {
  const response = await axios.get(`${API_URL}/projects`);
  return response.data;
};

export const updateProject = async (projectId: string, project: { name: string; description: string }) => {
  const response = await axios.put(`${API_URL}/projects/${projectId}`, project);
  return response.data;
};

export const deleteProject = async (projectId: string) => {
  const response = await axios.delete(`${API_URL}/projects/${projectId}`);
  return response.data;
};
