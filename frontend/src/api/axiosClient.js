import axios from 'axios';

//const baseURL = (import.meta?.env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
 

const baseURL = ('http://localhost:4000/api');

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

const api = axios.create({
  baseURL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(config=>{
  const t = sessionStorage.getItem('token');
  if(t) config.headers.Authorization = 'Bearer ' + t;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 429) {
      const path = String(window.location?.pathname || '');
      const isAdminRoute = path === '/login/admin' || path.startsWith('/admin');

      const msg =
        error.response?.data?.msg ||
        'Se detectó mucha actividad. Por favor esperá 1 minuto e intentá nuevamente.';

      sessionStorage.removeItem('token');
      sessionStorage.removeItem('refreshToken');
      sessionStorage.setItem('rateLimitMessage', String(msg));
      sessionStorage.setItem('rateLimitUntil', String(Date.now() + 60 * 1000));

      window.location.href = isAdminRoute ? '/login/admin' : '/login';
      return Promise.reject(error);
    }
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = 'Bearer ' + token;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = sessionStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        // No refresh token, redirect to login
        sessionStorage.removeItem('token');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${baseURL}/refresh`, { refreshToken });
        const { token: newToken } = response.data;
        
        sessionStorage.setItem('token', newToken);
        originalRequest.headers.Authorization = 'Bearer ' + newToken;
        
        processQueue(null, newToken);
        
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        
        // Refresh failed, clear tokens and redirect to login
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('refreshToken');
        window.location.href = '/login';
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
