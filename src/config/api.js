import axios from 'axios'

// Gunakan URL API dari environment (Vercel / lokal)
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api'

// Buat instance axios global
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // biarkan true, walau Sanctum token tidak butuh cookie
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
})

// === Request Interceptor ===
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      // kirim token Sanctum di header Authorization
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// === Response Interceptor ===
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // kalau token expired / invalid
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
