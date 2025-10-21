import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
 withCredentials: true,                     // penting untuk kirim cookie laravel_session
 headers: {
   'Accept': 'application/json',
   'X-Requested-With': 'XMLHttpRequest',    // biar dianggap AJAX oleh Laravel
 },
 xsrfCookieName: 'XSRF-TOKEN',              // standar Sanctum
 xsrfHeaderName: 'X-XSRF-TOKEN',
    

});

// Response interceptor
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
