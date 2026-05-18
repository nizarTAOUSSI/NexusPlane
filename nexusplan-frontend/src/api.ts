import axios, { type InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

function isPublicAuthRequest(config: InternalAxiosRequestConfig): boolean {
  const rawUrl = (config.url || '').split('?')[0];
  const markers = ['/auth/login', '/auth/register', '/auth/google-login', '/auth/refresh'];
  return markers.some(m => rawUrl.includes(m));
}

api.interceptors.request.use(
  (config) => {
    const skipAuth = isPublicAuthRequest(config);

    const token = localStorage.getItem('access_token');
    if (token && config.headers && !skipAuth) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers && skipAuth) {
      delete config.headers.Authorization;
    }

    const rawUser = localStorage.getItem('user_info');
    if (rawUser && config.headers && !skipAuth) {
      try {
        const u = JSON.parse(rawUser) as { id?: string; is_superuser?: boolean };
        if (u.id) {
          config.headers['X-User-Id'] = u.id;
        }
        if (u.is_superuser) {
          config.headers['X-Is-Superuser'] = 'true';
        }
      } catch {}
    } else if (config.headers && skipAuth) {
      delete config.headers['X-User-Id'];
      delete config.headers['X-Is-Superuser'];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const skipRefresh =
      !originalRequest ||
      isPublicAuthRequest(originalRequest);

    if (error.response?.status === 401 && !originalRequest._retry && !skipRefresh) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
          const response = await axios.post(`${base}/auth/refresh/`, {
            refresh: refreshToken,
          });

          const newAccessToken = response.data.access;
          localStorage.setItem('access_token', newAccessToken);

          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          return api(originalRequest);
        } catch (refreshError) {
          console.error("Refresh token failed", refreshError);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
