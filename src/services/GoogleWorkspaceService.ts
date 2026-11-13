
import { getAccessToken } from '../lib/workspaceAuth';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DOCS_API_BASE = 'https://docs.googleapis.com/v1';

export const listFiles = async () => {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  const response = await fetch(`${DRIVE_API_BASE}/files?q=mimeType='application/vnd.google-apps.document'`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.json();
};

export const getDocContent = async (fileId: string) => {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');

  const response = await fetch(`${DOCS_API_BASE}/documents/${fileId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.json();
};

export const uploadAudioToDrive = async (file: File, folderId: string) => {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify({ 
      name: file.name, 
      parents: [folderId] 
  })], { type: 'application/json' }));
  formData.append('file', file);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });

  return response.json();
};
