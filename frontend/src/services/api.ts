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
  getStudy: (limit = 50, strategy: 'hardest' | 'random' | 'tag' = 'hardest', tagIds?: string[]) =>
    api.get('/cards/study', { params: { limit, strategy, tag_ids: tagIds } }),
  get: (id: string) => api.get(`/cards/${id}`),
  create: (data: CardCreate) => api.post('/cards', data),
  update: (id: string, data: CardUpdate) => api.patch(`/cards/${id}`, data),
  delete: (id: string) => api.delete(`/cards/${id}`),
  review: (id: string, rating: 'forgot' | 'hard' | 'remembered') =>
    api.post(`/cards/${id}/review`, { rating }),
};

// Tags API
export const tagsApi = {
  list: () => api.get<TagListResponse>('/tags'),
  get: (id: string) => api.get<Tag>(`/tags/${id}`),
  create: (data: TagCreate) => api.post<Tag>('/tags', data),
  delete: (id: string) => api.delete(`/tags/${id}`),
};

// Generate API
export const generateApi = {
  generate: (text: string, provider?: string) =>
    api.post('/generate', { text, provider }),
};

// Types
export interface Tag {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface TagCreate {
  name: string;
}

export interface TagListResponse {
  items: Tag[];
  total: number;
}

export interface CardCreate {
  type: 'phrase' | 'sentence';
  target_text: string;
  target_meaning: string;
  context_sentence: string;
  context_translation: string;
  cloze_sentence: string;
  tag_ids?: string[];
}

export interface CardUpdate {
  type?: 'phrase' | 'sentence';
  target_text?: string;
  target_meaning?: string;
  context_sentence?: string;
  context_translation?: string;
  cloze_sentence?: string;
  tag_ids?: string[];
}

export interface Card {
  id: string;
  user_id: string;
  type: 'phrase' | 'sentence';
  target_text: string;
  target_meaning: string;
  context_sentence: string;
  context_translation: string;
  cloze_sentence: string;
  interval: number;
  ease_factor: number;
  next_review: string;
  created_at: string;
  updated_at: string;
  tags: Tag[];
}

export interface CardListResponse {
  items: Card[];
  total: number;
  page: number;
  page_size: number;
}

export default api;

