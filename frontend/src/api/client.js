import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({ baseURL: API_BASE })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

export const authApi = {
  getLoginUrl: () => api.get('/auth/login'),
  getMe: () => api.get('/auth/me'),
}

export const emailsApi = {
  list: (params) => api.get('/emails', { params }),
  get: (id) => api.get(`/emails/${id}`),
  listThreads: (params) => api.get('/emails/threads', { params }),
  getThread: (id) => api.get(`/emails/threads/${id}`),
  sync: (full = false) => api.post(`/emails/sync?full=${full}`),
  syncStatus: () => api.get('/emails/sync/status'),
}

export const composeApi = {
  draft: (data) => api.post('/compose/draft', data),
  reply: (data) => api.post('/compose/reply', data),
  send: (data) => api.post('/compose/send', data),
}

export const chatApi = {
  sendMessage: (data) => api.post('/chat/message', data),
  listSessions: () => api.get('/chat/sessions'),
  getSession: (id) => api.get(`/chat/sessions/${id}`),
}

export const categoriesApi = {
  stats: () => api.get('/categories/stats'),
}
