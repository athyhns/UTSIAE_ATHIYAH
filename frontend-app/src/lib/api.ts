import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data: { email: string; password: any }) => 
    apiClient.post('/api/auth/login', data),
  
  register: (data: { name: string; email: string; age: number; password: any }) => 
    apiClient.post('/api/auth/register', data),
};

export const userApi = {
  getUsers: () => apiClient.get('/api/users'),
  getUser: (id: string) => apiClient.get(`/api/users/${id}`),
  updateUser: (id: string, userData: { name?: string; email?: string; age?: number }) => 
    apiClient.put(`/api/users/${id}`, userData),
  deleteUser: (id: string) => apiClient.delete(`/api/users/${id}`),

  // ADMIN ENDPOINTS
  changeUserRole: (id: string, role: 'admin' | 'user') => 
    apiClient.put(`/api/users/${id}/role`, { role }),
};
