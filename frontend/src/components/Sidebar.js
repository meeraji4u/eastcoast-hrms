import React, { useState } from 'react';
import { LayoutDashboard, Users, Calendar, ClipboardList, Clock, DollarSign, LogOut, Building2, ChevronLeft, ChevronRight, User, QrCode, Monitor, CalendarDays, FileText, Shield } from 'lucide-react';
import useAuthStore from '../store/authStore';

const navItems = [
  { key:'dashboard',  label:'Dashboard',   icon:LayoutDashboard, roles:['hr_admin','management','dept_head','employee','it_admin'] },
  { key:'users',      label:'User Management', icon:Users,       roles:['it_admin'] },
  { key:'role_mapping',label:'Role Mapping',icon:Shield,           roles:['it_admin'] },
  { key:'employees',  label:'Employees',   icon:Users,           roles:['hr_admin'] },
  { key:'attendance', label:'Attendance',  icon:Calendar,        roles:['hr_admin','dept_head','employee','management'] },
  { key:'leave',      label:'Leave',       icon:ClipboardList,   roles:['hr_admin','dept_head','employee','management'] },
  { key:'gatepass',   label:'Gate Pass',   icon:QrCode,          roles:['hr_admin','dept_head','employee','management'] },
  { key:'roster',     label:'Duty Roster', icon:CalendarDays,    roles:['hr_admin','dept_head'] },
  { key:'shifts',     label:'Shifts',      icon:Clock,           roles:['hr_admin','dept_head'] },
  { key:'devices',    label:'Devices',     icon:Monitor,         roles:['hr_admin','it_admin'] },
  { key:'reports',    label:'Reports',     icon:FileText,        roles:['hr_admin','management','dept_head'] },
  { key:'payroll',    label:'Payroll',     icon:DollarSign,      roles:['hr_admin','management','employee'] },
];

export default function Sidebar({ active, onNavigate }) {
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const allowed = navItems.filter(n => n.roles.includes(user?.role));

  return (
    <div style={{ width:collapsed?64:220, minHeight:'100vh', background:'linear-gradient(180deg,#0b3f3b 0%,#115e59 100%)', display:'flex', flexDirection:'column', transition:'width 0.2s', flexShrink:0, position:'relative' }}>
      <div style={{ padding:collapsed?'20px 15px':'20px 18px', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ width:34, height:34, borderRadius:9, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Building2 size={18} color="#fff"/>
        </div>
        {!collapsed && <div><div style={{ fontWeight:800, fontSize:14, color:'#fff' }}>EastCoast</div><div style={{ fontSize:10, color:'rgba(255,255,255,0.6)' }}>HRMS</div></div>}
      </div>
      <nav style={{ flex:1, padding:'10px 0', overflowY:'auto' }}>
        {allowed.map(item => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button key={item.key} onClick={()=>onNavigate(item.key)} style={{ display:'flex', alignItems:'center', gap:12, padding:collapsed?'10px 20px':'10px 18px', width:'100%', border:'none', cursor:'pointer', background:isActive?'rgba(255,255,255,0.15)':'transparent', color:isActive?'#fff':'rgba(255,255,255,0.65)', fontWeight:isActive?700:500, fontSize:13.5, borderLeft:isActive?'3px solid #f0653e':'3px solid transparent', transition:'all 0.15s', whiteSpace:'nowrap', overflow:'hidden', fontFamily:'inherit' }}>
              <Icon size={17} style={{ flexShrink:0 }}/>{!collapsed && item.label}
            </button>
          );
        })}
      </nav>
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.1)', padding:'10px 0' }}>
        {!collapsed && (
          <div style={{ padding:'8px 18px 10px', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <User size={14} color="#fff"/>
            </div>
            <div style={{ overflow:'hidden' }}>
              <div style={{ fontSize:11.5, fontWeight:700, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.name}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', textTransform:'capitalize' }}>{user?.role?.replace('_',' ')}</div>
            </div>
          </div>
        )}
        <button onClick={logout} style={{ display:'flex', alignItems:'center', gap:12, padding:collapsed?'10px 20px':'10px 18px', width:'100%', border:'none', cursor:'pointer', background:'transparent', color:'rgba(255,255,255,0.6)', fontSize:13.5, fontFamily:'inherit' }}>
          <LogOut size={17} style={{ flexShrink:0 }}/>{!collapsed && 'Logout'}
        </button>
      </div>
      <button onClick={()=>setCollapsed(c=>!c)} style={{ position:'absolute', top:22, right:-12, width:24, height:24, borderRadius:'50%', background:'#fff', border:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 1px 4px rgba(0,0,0,0.15)' }}>
        {collapsed?<ChevronRight size={13} color="#115e59"/>:<ChevronLeft size={13} color="#115e59"/>}
      </button>
    </div>
  );
}
