import axios from 'axios';

const API = process.env.REACT_APP_API_URL || '/api';
const client = axios.create({ baseURL: API });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('hrms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('hrms_token');
      localStorage.removeItem('hrms_user');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (emp_code, password) => client.post('/auth/login', { emp_code, password }),
  requestActivationOtp: (emp_code) => client.post('/auth/activate/request-otp', { emp_code, purpose: 'activate' }),
  verifyActivation: (emp_code, otp, new_password) => client.post('/auth/activate/verify', { emp_code, otp, purpose: 'activate', new_password }),
  requestResetOtp: (emp_code) => client.post('/auth/forgot-password/request-otp', { emp_code, purpose: 'reset' }),
  verifyReset: (emp_code, otp, new_password) => client.post('/auth/forgot-password/verify', { emp_code, otp, purpose: 'reset', new_password }),
  resendOtp: (emp_code, purpose) => client.post('/auth/resend-otp', { emp_code, purpose }),
  changePassword: (old_password, new_password) => client.post('/auth/change-password', { old_password, new_password }),
  me: () => client.get('/auth/me'),
};

export const adminApi = {
  getEsslEmployees: () => client.get('/admin/essl-employees'),
  getHrmsEmployees: () => client.get('/admin/employees'),
  syncEmployees: () => client.post('/admin/sync-employees'),
  updateRole: (empCode, role) => client.put(`/admin/employees/${empCode}/role`, { role }),
  createEmployee: (data) => client.post('/admin/employees', data),
  deactivate: (code) => client.post(`/admin/employees/${code}/deactivate`),
  reactivate: (code) => client.post(`/admin/employees/${code}/reactivate`),
  getDepartments: () => client.get('/departments'),
  getCompanies: () => client.get('/companies'),
  resetPassword: (empCode, password) => client.put(`/admin/employees/${empCode}/reset-password`, { password }),
};

export const attendanceApi = {
  getMyAttendance: (year, month) => client.get(`/attendance/my?year=${year}&month=${month}`),
  getEmployeeAttendance: (emp_code, year, month) => client.get(`/attendance/employee/${emp_code}?year=${year}&month=${month}`),
  getDashboardStats: () => client.get('/attendance/dashboard'),
  getTeamAttendance: (date) => client.get(`/attendance/team?date=${date}`),
};

export const leaveApi = {
  getMyLeaves: () => client.get('/leave/my'),
  applyLeave: (data) => client.post('/leave/apply', data),
  cancelLeave: (id) => client.post(`/leave/${id}/cancel`),
  getPendingApprovals: () => client.get('/leave/pending'),
  approveLeave: (id, remarks) => client.post(`/leave/${id}/approve`, { remarks }),
  rejectLeave: (id, reason) => client.post(`/leave/${id}/reject`, { reason }),
  getLeaveTypes: () => client.get('/leave/types'),
  addLeaveType: (data) => client.post('/leave/types', data),
  deleteLeaveType: (id) => client.delete(`/leave/types/${id}`),
  getMyBalance: () => client.get('/leave/balance'),
};

export const payrollApi = {
  getMyPayslips: () => client.get('/payroll/my-slips'),
  getAllPayrolls: (month, year) => client.get(`/payroll/list?month=${month}&year=${year}`),
  getPayslip: (id) => client.get(`/payroll/${id}`),
};

export const deviceApi = {
  getDevices: () => client.get('/devices/'),
  getSummary: () => client.get('/devices/summary'),
};

export const gatepassApi = {
  apply: (data) => client.post('/gatepass/apply', data),
  my: () => client.get('/gatepass/my'),
  pending: () => client.get('/gatepass/pending'),
  all: () => client.get('/gatepass/all'),
  approve: (id) => client.post(`/gatepass/${id}/approve`, {}),
  reject: (id, reason) => client.post(`/gatepass/${id}/reject`, { reason }),
  verify: (token) => client.get(`/gatepass/verify/${token}`),
};

export const rosterApi = {
  get: (params) => client.get('/roster/', { params }),
  assign: (data) => client.post('/roster/assign', data),
  bulkAssign: (data) => client.post('/roster/bulk-assign', data),
  delete: (id) => client.delete(`/roster/${id}`),
};

export const shiftApi = {
  getAll: () => client.get('/shifts/'),
  create: (data) => client.post('/shifts/', data),
  update: (id, data) => client.put(`/shifts/${id}`, data),
  delete: (id) => client.delete(`/shifts/${id}`),
  assign: (data) => client.post('/shifts/assign', data),
  getAssignments: () => client.get('/shifts/assignments'),
};

export const settingsApi = {
  get: () => client.get('/settings/'),
  update: (data) => client.put('/settings/', data),
};

export default client;
