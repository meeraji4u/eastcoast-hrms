import { create } from 'zustand';

const useStore = create((set) => ({
  user: null,
  sidebarOpen: true,
  activeModule: 'dashboard',

  setUser: (user) => set({ user }),
  logout: () => {
    localStorage.removeItem('hrms_token');
    localStorage.removeItem('hrms_user');
    set({ user: null, activeModule: 'dashboard' });
  },
  setActiveModule: (mod) => set({ activeModule: mod }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));

export default useStore;
