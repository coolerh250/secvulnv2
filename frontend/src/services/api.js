import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

// Auth
export const authApi = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  me:    ()                   => api.get('/auth/me'),
};

// Vulnerabilities
export const vulnApi = {
  list:              (params = {}) => api.get('/vulnerabilities', { params }),
  get:               (id)          => api.get(`/vulnerabilities/${id}`),
  updateStatus:      (id, status)  => api.put(`/vulnerabilities/${id}/status`, { handle_status: status }),
  addNote:           (id, text)    => api.post(`/vulnerabilities/${id}/notes`, { text }),
  setRiskAcceptance: (id, data)    => api.post(`/vulnerabilities/${id}/risk-acceptance`, data),
  remove:            (id)          => api.delete(`/vulnerabilities/${id}`),
};

// Dashboard
export const dashboardApi = {
  stats:   () => api.get('/dashboard/stats'),
  trend:   () => api.get('/dashboard/trend'),
  reviews: () => api.get('/dashboard/reviews'),
};

// Devices
export const deviceApi = {
  getTypes: ()         => api.get('/devices/types'),
  list:    ()          => api.get('/devices'),
  create:  (data)      => api.post('/devices', data),
  update:  (id, data)  => api.put(`/devices/${id}`, data),
  remove:  (id)        => api.delete(`/devices/${id}`),
  scan:    (id)        => api.post(`/devices/${id}/scan`),
  scanAll: ()          => api.post('/devices/scan-all'),
};

// Per-device vulnerability tracking
export const deviceVulnApi = {
  list:              (deviceId)                  => api.get(`/devices/${deviceId}/vulnerabilities`),
  updateStatus:      (deviceId, vulnId, status)  => api.put(`/devices/${deviceId}/vulnerabilities/${vulnId}/status`, { handle_status: status }),
  addNote:           (deviceId, vulnId, text)    => api.post(`/devices/${deviceId}/vulnerabilities/${vulnId}/notes`, { text }),
  setRiskAcceptance: (deviceId, vulnId, data)    => api.post(`/devices/${deviceId}/vulnerabilities/${vulnId}/risk-acceptance`, data),
};

// Users
export const userApi = {
  list:   ()         => api.get('/users'),
  create: (data)     => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  remove: (id)       => api.delete(`/users/${id}`),
};

// AI Analysis
export const aiApi = {
  analyze: (vuln, lang) => api.post('/ai/analyze', { vuln, lang }),
};

// Settings
export const settingsApi = {
  get:          ()     => api.get('/settings'),
  update:       (data) => api.put('/settings', data),
  testEmail:    ()     => api.post('/settings/test-email'),
  testWebhook:  ()     => api.post('/settings/test-webhook'),
  testSource:   (id)   => api.post(`/settings/sources/${id}/test`),
  syncSource:   (id)   => api.post(`/settings/sources/${id}/sync`),
};

export default api;
