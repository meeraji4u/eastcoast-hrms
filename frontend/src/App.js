import React, { useEffect, useState } from 'react';
import AuthFlow from './pages/AuthFlow';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import Leave from './pages/Leave';
import GatePass from './pages/GatePass';
import Roster from './pages/Roster';
import Shifts from './pages/Shifts';
import Devices from './pages/Devices';
import Reports from './pages/Reports';
import Payroll from './pages/Payroll';
import SalaryApprovals from './pages/SalaryApprovals';
import RoleMapping from './pages/RoleMapping';
import UsersPage from './pages/Users';
import useAuthStore from './store/authStore';

const pages = {
  dashboard:Dashboard, employees:Employees, attendance:Attendance,
  leave:Leave, gatepass:GatePass, roster:Roster, shifts:Shifts,
  devices:Devices, reports:Reports, payroll:Payroll, salary_approvals:SalaryApprovals, role_mapping:RoleMapping, users:UsersPage
};

export default function App() {
  const { user, setAuth } = useAuthStore();
  const [page, setPage] = useState('dashboard');

  useEffect(() => {
    const token = localStorage.getItem('hrms_token');
    const savedUser = localStorage.getItem('hrms_user');
    if (token && savedUser && !user) {
      try { setAuth(JSON.parse(savedUser), token); } catch {}
    }
  }, []);

  if (!user) return <AuthFlow onLoginSuccess={(u) => { setAuth(u, localStorage.getItem('hrms_token')); }}/>;

  const PageComponent = pages[page] || Dashboard;

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f4f6fa' }}>
      <Sidebar active={page} onNavigate={setPage}/>
      <div style={{ flex:1, overflow:'auto' }}>
        <div style={{ padding:'28px 32px', maxWidth:1400, margin:'0 auto' }}>
          <PageComponent onNavigate={setPage}/>
        </div>
      </div>
    </div>
  );
}
