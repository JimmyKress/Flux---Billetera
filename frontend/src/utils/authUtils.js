export const logout = () => {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('refreshToken');
  window.location.href = '/login';
};

export const isAuthenticated = () => {
  const token = sessionStorage.getItem('token');
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;
    return Date.now() < exp;
  } catch {
    return false;
  }
};

export const getTokenPayload = () => {
  const token = sessionStorage.getItem('token');
  if (!token) return null;

  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
};
