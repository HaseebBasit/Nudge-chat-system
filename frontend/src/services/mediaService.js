import { BASE_URL, apiRequest } from './api.js';

export const uploadMediaFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiRequest('/api/media/upload', {
    method: 'POST',
    body: formData
  });

  return response.media;
};

export const getMediaUrl = (fileId) => {
  if (!fileId) return '';
  const token = localStorage.getItem('nudge_token');
  return `${BASE_URL}/media/${fileId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
};
