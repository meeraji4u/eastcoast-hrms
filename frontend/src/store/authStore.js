import { create } from 'zustand';

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('hrms_user') || 'null'),
  token: localStorage.getItem('hrms_token') || null,
  setAuth: (user, token) => {
    localStorage.setItem('hrms_user', JSON.stringify(user));
    localStorage.setItem('hrms_token', token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('hrms_user');
    localStorage.removeItem('hrms_token');
    set({ user: null, token: null });
  },
}));

export default useAuthStore;
