import axios from 'axios';

const API_URL = '/api'; // Use the proxy

export const uploadFile = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return axios.post(`${API_URL}/upload`, formData);
};
