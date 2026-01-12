import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const { access_token, refresh_token: newRefreshToken } = response.data;
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', newRefreshToken);
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: (email: string, password: string) =>
    api.post('/auth/register', { email, password }),
  login: (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    return api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  getCurrentUser: () => api.get('/users/me'),
};

// Cards API
export const cardsApi = {
  list: (page = 1, pageSize = 20, cardType?: string) =>
    api.get('/cards', { params: { page, page_size: pageSize, card_type: cardType } }),
  getDue: (limit = 20) => api.get('/cards/due', { params: { limit } }),
  get: (id: string) => api.get(`/cards/${id}`),
  create: (data: CardCreate) => api.post('/cards', data),
  update: (id: string, data: Partial<CardCreate>) => api.patch(`/cards/${id}`, data),
  delete: (id: string) => api.delete(`/cards/${id}`),
  review: (id: string, rating: 'forgot' | 'hard' | 'easy') =>
    api.post(`/cards/${id}/review`, { rating }),
};

// Generate API
export const generateApi = {
  generate: (text: string, provider?: string) =>
    api.post('/generate', { text, provider }),
};

// Types
export interface CardCreate {
  type: 'phrase' | 'sentence';
  target_text: string;
  target_meaning: string;
  context_sentence: string;
  context_translation: string;
  cloze_sentence: string;
}

export interface Card extends CardCreate {
  id: string;
  user_id: string;
  interval: number;
  ease_factor: number;
  next_review: string;
  created_at: string;
  updated_at: string;
}

export interface CardListResponse {
  items: Card[];
  total: number;
  page: number;
  page_size: number;
}

export default api;
