import { useEffect } from 'react';
import api from '../api/axiosClient';

export const useTokenRefresh = () => {
  useEffect(() => {
    const checkTokenExpiry = () => {
      const token = sessionStorage.getItem('token');
      if (!token) return;

      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp = payload.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        const timeUntilExpiry = exp - now;

        // Refresh token 5 minutes before expiry
        if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
          const refreshToken = sessionStorage.getItem('refreshToken');
          if (refreshToken) {
            api.post('/refresh', { refreshToken })
              .then(response => {
                sessionStorage.setItem('token', response.data.token);
              })
              .catch(() => {
                // Refresh failed, clear tokens and redirect to login
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('refreshToken');
                window.location.href = '/login';
              });
          }
        }
      } catch (error) {
        console.error('Error parsing token:', error);
      }
    };

    // Check immediately
    checkTokenExpiry();

    // Set up interval to check every minute
    const interval = setInterval(checkTokenExpiry, 60000);

    return () => clearInterval(interval);
  }, []);
};
