import React, { useState, useEffect } from 'react';
import { Users, UserCheck, UserX, Clock, TrendingUp, AlertCircle, Activity, Calendar, ClipboardList, DollarSign, QrCode, CalendarDays, RefreshCw, Monitor, Shield } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { attendanceApi } from '../utils/api';
import useAuthStore from '../store/authStore';

const StatCard = ({icon:Icon,label,value,color='#115e59',sub,onClick}) => (
  <div onClick={onClick} style={{background:'#fff',borderRadius:12,padding:'20px 22px',border:'1px solid #e6e9ef',display:'flex',alignItems:'center',gap:16,cursor:onClick?'pointer':'default',transition:'box-shadow 0.15s'}} onMouseEnter={e=>{if(onClick)e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)';}} onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';}}>
    <div style={{width:48,height:48,borderRadius:12,background:color+'18',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon size={22} color={color}/></div>
    <div>
      <div style={{fontSize:26,fontWeight:800,color:'#0b1320',lineHeight:1.2}}>{value??'—'}</div>
      <div style={{fontSize:12.5,color:'#64748b',marginTop:2}}>{label}</div>
      {sub&&<div style={{fontSize:11,color:color,marginTop:2,fontWeight:600}}>{sub}</div>}
    </div>
  </div>
);

const QuickAction = ({icon:Icon,label,color,onClick}) => (
  <button onClick={onClick} style={{background:'#fff',border:'1px solid #e6e9ef',borderRadius:12,padding:'16px',display:'flex',flexDirection:'column',alignItems:'center',gap:8,cursor:'pointer',width:'100%',transition:'all 0.15s',fontFamily:'inherit'}} onMouseEnter={e=>{e.currentTarget.style.background=color+'08';e.currentTarget.style.borderColor=color;}} onMouseLeave={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.borderColor='#e6e9ef';}}>
    <div style={{width:40,height:40,borderRadius:10,background:color+'18',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon size={20} color={color}/></div>
    <span style={{fontSize:12,fontWeight:600,color:'#0b1320',textAlign:'center'}}>{label}</span>
  </button>
);

function ITAdminDashboard({stats,loading,onNavigate}) {
  const [syncing,setSyncing] = useState(false);
  const [syncMsg,setSyncMsg] = useState('');
  const [lastSync,setLastSync] = useState(localStorage.getItem('last_sync')||'Never');
  const today = new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  const handleSync = async () => {
    setSyncing(true); setSyncMsg('');
    try {
      const token = localStorage.getItem('hrms_token');
      const r = await fetch('/api/admin/sync-employees',{method:'POST',headers:{Authorization:`Bearer ${token}`}});
      const d = await r.json();
      const msg = r.ok ? `✅ ${d.new_employees} new employees synced from eSSL` : `❌ ${d.detail||'Sync failed'}`;
      setSyncMsg(msg);
      const now = new Date().toLocaleString('en-IN');
      setLastSync(now); localStorage.setItem('last_sync',now);
    } catch(e) { setSyncMsg('❌ Sync failed'); }
    setSyncing(false);
    setTimeout(()=>setSyncMsg(''),5000);
  };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:28}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:'#0b1320'}}>IT Admin Dashboard</h1>
          <p style={{color:'#64748b',fontSize:14,marginTop:4}}>{today}</p>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8}}>
          <button onClick={handleSync} disabled={syncing} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 16px',borderRadius:9,border:'1px solid #115e59',background:'#fff',color:'#115e59',cursor:syncing?'not-allowed':'pointer',fontSize:13,fontWeight:700,opacity:syncing?0.7:1}}>
            <RefreshCw size={14} style={{animation:syncing?'spin 1s linear infinite':'none'}}/> {syncing?'Syncing...':'Sync from eSSL'}
          </button>
          <span style={{fontSize:11,color:'#94a3b8'}}>Last sync: {lastSync}</span>
          {syncMsg && <span style={{fontSize:12,fontWeight:600,color:syncMsg.startsWith('✅')?'#16a34a':'#dc2626'}}>{syncMsg}</span>}
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* System status */}
      <div style={{background:'linear-gradient(135deg,#0b3f3b,#115e59)',borderRadius:12,padding:'14px 22px',color:'#fff',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:10,height:10,borderRadius:'50%',background:'#4ade80',boxShadow:'0 0 8px #4ade80'}}/>
          <span style={{fontWeight:700}}>All Systems Operational</span>
          <span style={{color:'rgba(255,255,255,0.6)',fontSize:13}}>eSSL · PostgreSQL · Redis · Nginx</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:16,fontSize:12,color:'rgba(255,255,255,0.5)'}}>
          <span>192.168.1.23 (eSSL)</span>
          <span>192.168.0.74 (HRMS)</span>
          <span style={{background:'rgba(255,255,255,0.1)',padding:'2px 8px',borderRadius:6,color:'rgba(255,255,255,0.8)'}}>Auto-sync: 02:00 daily</span>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:16,marginBottom:24}}>
        <StatCard icon={Users} label="Total Employees" value={loading?'…':stats?.total_employees} color="#115e59"/>
        <StatCard icon={UserCheck} label="Present Today" value={loading?'…':stats?.present_today} color="#16a34a"/>
        <StatCard icon={UserX} label="Absent Today" value={loading?'…':stats?.absent_today} color="#dc2626"/>
        <StatCard icon={Clock} label="Late Today" value={loading?'…':(stats?.late_today||0)} color="#d97706"/>
      </div>

      {/* Charts */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:24}}>
        <div style={{background:'#fff',borderRadius:12,padding:'20px 22px',border:'1px solid #e6e9ef'}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:18,color:'#0b1320'}}>Attendance Trend (Last 14 Days)</div>
          {stats?.trend?.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={stats.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="date" tick={{fontSize:10}} tickFormatter={d=>d?.slice(5)}/>
                <YAxis tick={{fontSize:10}}/>
                <Tooltip contentStyle={{fontSize:12,borderRadius:8}}/>
                <Line type="monotone" dataKey="present" stroke="#115e59" strokeWidth={2.5} dot={{r:3}} name="Present"/>
              </LineChart>
            </ResponsiveContainer>
          ) : <div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:13}}><Activity size={32} style={{marginBottom:8,opacity:0.4}}/><div>Loading trend data...</div></div>}
        </div>
        <div style={{background:'#fff',borderRadius:12,padding:'20px 22px',border:'1px solid #e6e9ef'}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:18,color:'#0b1320'}}>Department Attendance</div>
          {stats?.dept_stats?.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.dept_stats.slice(0,8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="dept" tick={{fontSize:8}} angle={-30} textAnchor="end" interval={0}/>
                <YAxis tick={{fontSize:10}}/>
                <Tooltip contentStyle={{fontSize:11,borderRadius:8}}/>
                <Bar dataKey="present" fill="#115e59" radius={[4,4,0,0]} name="Present"/>
                <Bar dataKey="total" fill="#e6f4f2" radius={[4,4,0,0]} name="Total"/>
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:13}}><TrendingUp size={32} style={{marginBottom:8,opacity:0.4}}/><div>Loading...</div></div>}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{background:'#fff',borderRadius:12,padding:'20px 22px',border:'1px solid #e6e9ef'}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:16,color:'#0b1320'}}>Quick Actions</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          <QuickAction icon={Users} label="Manage Users" color="#115e59" onClick={()=>onNavigate?.('users')}/>
          <QuickAction icon={Shield} label="Roles" color="#7c3aed" onClick={()=>onNavigate?.('role_mapping')}/>
          <QuickAction icon={Monitor} label="Devices" color="#0891b2" onClick={()=>onNavigate?.('devices')}/>
          <QuickAction icon={RefreshCw} label="Sync Data" color="#16a34a" onClick={handleSync}/>
        </div>
      </div>
    </div>
  );
}

function HRDashboard({stats,loading,onNavigate}) {
  const [syncing,setSyncing] = useState(false);
  const [syncMsg,setSyncMsg] = useState('');
  const [lastSync,setLastSync] = useState(localStorage.getItem('last_sync')||'Never');
  const today = new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  const handleSync = async () => {
    setSyncing(true); setSyncMsg('');
    try {
      const token = localStorage.getItem('hrms_token');
      const r = await fetch('/api/admin/sync-employees',{method:'POST',headers:{Authorization:`Bearer ${token}`}});
      const d = await r.json();
      const msg = r.ok ? `✅ ${d.new_employees} new employees synced from eSSL` : `❌ ${d.detail||'Sync failed'}`;
      setSyncMsg(msg);
      const now = new Date().toLocaleString('en-IN');
      setLastSync(now); localStorage.setItem('last_sync',now);
    } catch(e) { setSyncMsg('❌ Sync failed'); }
    setSyncing(false);
    setTimeout(()=>setSyncMsg(''),5000);
  };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:28}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:'#0b1320'}}>HR Dashboard</h1>
          <p style={{color:'#64748b',fontSize:14,marginTop:4}}>{today}</p>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8}}>
          <button onClick={handleSync} disabled={syncing} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 16px',borderRadius:9,border:'1px solid #115e59',background:'#fff',color:'#115e59',cursor:syncing?'not-allowed':'pointer',fontSize:13,fontWeight:700,opacity:syncing?0.7:1}}>
            <RefreshCw size={14} style={{animation:syncing?'spin 1s linear infinite':'none'}}/> {syncing?'Syncing...':'Sync from eSSL'}
          </button>
          <span style={{fontSize:11,color:'#94a3b8'}}>Last sync: {lastSync}</span>
          <span style={{background:'rgba(17,94,89,0.1)',padding:'2px 8px',borderRadius:6,color:'#115e59',fontSize:11,fontWeight:'bold',marginTop:4}}>Auto-sync: 02:00 daily</span>
          {syncMsg && <span style={{fontSize:12,fontWeight:600,color:syncMsg.startsWith('✅')?'#16a34a':'#dc2626'}}>{syncMsg}</span>}
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:16,marginBottom:24}}>
        <StatCard icon={Users} label="Total Employees" value={loading?'…':stats?.total_employees} color="#115e59"/>
        <StatCard icon={UserCheck} label="Present Today" value={loading?'…':stats?.present_today} color="#16a34a"/>
        <StatCard icon={UserX} label="Absent Today" value={loading?'…':stats?.absent_today} color="#dc2626"/>
        <StatCard icon={Clock} label="Late Today" value={loading?'…':(stats?.late_today||0)} color="#d97706"/>
      </div>

      {/* Charts */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:24}}>
        <div style={{background:'#fff',borderRadius:12,padding:'20px 22px',border:'1px solid #e6e9ef'}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:18,color:'#0b1320'}}>Attendance Trend (Last 14 Days)</div>
          {stats?.trend?.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={stats.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="date" tick={{fontSize:10}} tickFormatter={d=>d?.slice(5)}/>
                <YAxis tick={{fontSize:10}}/>
                <Tooltip contentStyle={{fontSize:12,borderRadius:8}}/>
                <Line type="monotone" dataKey="present" stroke="#115e59" strokeWidth={2.5} dot={{r:3}} name="Present"/>
              </LineChart>
            </ResponsiveContainer>
          ) : <div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:13}}><Activity size={32} style={{marginBottom:8,opacity:0.4}}/><div>Loading trend data...</div></div>}
        </div>
        <div style={{background:'#fff',borderRadius:12,padding:'20px 22px',border:'1px solid #e6e9ef'}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:18,color:'#0b1320'}}>Department Attendance</div>
          {stats?.dept_stats?.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.dept_stats.slice(0,8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="dept" tick={{fontSize:8}} angle={-30} textAnchor="end" interval={0}/>
                <YAxis tick={{fontSize:10}}/>
                <Tooltip contentStyle={{fontSize:11,borderRadius:8}}/>
                <Bar dataKey="present" fill="#115e59" radius={[4,4,0,0]} name="Present"/>
                <Bar dataKey="total" fill="#e6f4f2" radius={[4,4,0,0]} name="Total"/>
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:13}}><TrendingUp size={32} style={{marginBottom:8,opacity:0.4}}/><div>Loading...</div></div>}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{background:'#fff',borderRadius:12,padding:'20px 22px',border:'1px solid #e6e9ef'}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:16,color:'#0b1320'}}>Quick Actions</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:12}}>
          <QuickAction icon={Users} label="Employees" color="#115e59" onClick={()=>onNavigate?.('employees')}/>
          <QuickAction icon={Calendar} label="Attendance" color="#1d4ed8" onClick={()=>onNavigate?.('attendance')}/>
          <QuickAction icon={ClipboardList} label="Approve Leaves" color="#7c3aed" onClick={()=>onNavigate?.('leave')}/>
          <QuickAction icon={DollarSign} label="Payroll" color="#16a34a" onClick={()=>onNavigate?.('payroll')}/>
          <QuickAction icon={CalendarDays} label="Duty Roster" color="#dc2626" onClick={()=>onNavigate?.('roster')}/>
          <QuickAction icon={Activity} label="Reports" color="#0891b2" onClick={()=>onNavigate?.('reports')}/>
        </div>
      </div>
    </div>
  );
}

function DeptHeadDashboard({stats,loading,onNavigate}) {
  const {user} = useAuthStore();
  return (
    <div>
      <div style={{marginBottom:28}}>
        <h1 style={{fontSize:22,fontWeight:800,color:'#0b1320'}}>Department Dashboard</h1>
        <p style={{color:'#64748b',fontSize:14,marginTop:4}}>Welcome, {user?.name} · {new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:16,marginBottom:24}}>
        <StatCard icon={Users} label="Total Employees" value={loading?'…':(stats?.total_employees||'—')} color="#115e59"/>
        <StatCard icon={UserCheck} label="Present Today" value={loading?'…':(stats?.present_today||0)} color="#16a34a"/>
        <StatCard icon={UserX} label="Absent" value={loading?'…':(stats?.absent_today||0)} color="#dc2626"/>
        <StatCard icon={ClipboardList} label="Pending Leaves" value="—" color="#d97706" sub="Awaiting approval"/>
        <StatCard icon={QrCode} label="Gate Passes" value="—" color="#7c3aed" sub="Pending approval"/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:20}}>
        <div style={{background:'#fff',borderRadius:12,padding:'20px 22px',border:'1px solid #e6e9ef'}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:18}}>Team Attendance Trend</div>
          {stats?.trend?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.trend}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="date" tick={{fontSize:10}} tickFormatter={d=>d?.slice(5)}/><YAxis tick={{fontSize:10}}/><Tooltip contentStyle={{fontSize:12,borderRadius:8}}/><Line type="monotone" dataKey="present" stroke="#115e59" strokeWidth={2.5} dot={{r:3}} name="Present"/></LineChart>
            </ResponsiveContainer>
          ) : <div style={{textAlign:'center',padding:60,color:'#94a3b8'}}>Loading...</div>}
        </div>
        <div style={{background:'#fff',borderRadius:12,padding:'20px 22px',border:'1px solid #e6e9ef'}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:16}}>Quick Actions</div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <QuickAction icon={ClipboardList} label="Approve Leaves" color="#7c3aed" onClick={()=>onNavigate?.('leave')}/>
            <QuickAction icon={QrCode} label="Gate Pass Requests" color="#d97706" onClick={()=>onNavigate?.('gatepass')}/>
            <QuickAction icon={Calendar} label="Team Attendance" color="#1d4ed8" onClick={()=>onNavigate?.('attendance')}/>
            <QuickAction icon={CalendarDays} label="Duty Roster" color="#115e59" onClick={()=>onNavigate?.('roster')}/>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmployeeDashboard({onNavigate, stats, loading}) {
  const {user} = useAuthStore();
  const now = new Date();
  const greeting = now.getHours()<12?'Good Morning':now.getHours()<17?'Good Afternoon':'Good Evening';
  
  // Find today's log
  const todayStr = now.toISOString().split('T')[0];
  const todayLog = stats?.daily?.find(d => d.date === todayStr);
  const isLate = todayLog && todayLog.late_by && todayLog.late_by !== "00:00";
  
  return (
    <div>
      <div style={{marginBottom:28, display:'flex', alignItems:'center', gap:16}}>
        <div style={{width:64, height:64, borderRadius:'50%', overflow:'hidden', background:'#e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #fff', boxShadow:'0 2px 8px rgba(0,0,0,0.1)', flexShrink:0}}>
          <img src={`/api/photos/${user?.emp_code}.jpg`} alt="Profile" style={{width:'100%', height:'100%', objectFit:'cover'}} onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
          <User size={32} color="#94a3b8" style={{display:'none'}} />
        </div>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:'#0b1320'}}>{greeting}, {(user?.name || '').split(' ')[0]}!</h1>
          <p style={{color:'#64748b',fontSize:14,marginTop:4}}>{now.toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
        </div>
      </div>
      <div style={{background:'linear-gradient(135deg,#115e59,#1d4ed8)',borderRadius:16,padding:'24px 28px',color:'#fff',marginBottom:24,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.7)',marginBottom:4}}>Today's Attendance</div>
          <div style={{fontSize:28,fontWeight:800,display:'flex',alignItems:'center',gap:12}}>
            {loading ? '...' : (todayLog ? (todayLog.status === 'P' ? 'Present' : todayLog.status) : '—')}
            {isLate && <span style={{background:'#dc2626',color:'#fff',fontSize:12,padding:'2px 8px',borderRadius:6,fontWeight:700}}>LATE ({todayLog.late_by})</span>}
          </div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.7)',marginTop:4}}>Emp Code: {user?.emp_code}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.7)'}}>Shift</div>
          <div style={{fontSize:18,fontWeight:700}}>{todayLog?.shift || '—'}</div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:14,marginBottom:24}}>
        <StatCard icon={UserCheck} label="Present This Month" value={loading ? '...' : (stats?.present || 0)} color="#16a34a"/>
        <StatCard icon={UserX} label="Absent" value={loading ? '...' : (stats?.absent || 0)} color="#dc2626"/>
        <StatCard icon={Clock} label="Work Hours" value={loading ? '...' : (stats?.total_duration || "00:00")} color="#115e59"/>
        <StatCard icon={ClipboardList} label="Leave Balance" value="—" color="#d97706"/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div style={{background:'#fff',borderRadius:12,padding:'20px 22px',border:'1px solid #e6e9ef'}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:16}}>Quick Actions</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <QuickAction icon={ClipboardList} label="Apply Leave" color="#7c3aed" onClick={()=>onNavigate?.('leave')}/>
            <QuickAction icon={QrCode} label="Gate Pass" color="#d97706" onClick={()=>onNavigate?.('gatepass')}/>
            <QuickAction icon={Calendar} label="My Attendance" color="#115e59" onClick={()=>onNavigate?.('attendance')}/>
            <QuickAction icon={DollarSign} label="My Payslip" color="#16a34a" onClick={()=>onNavigate?.('payroll')}/>
          </div>
        </div>
        <div style={{background:'#fff',borderRadius:12,padding:'20px 22px',border:'1px solid #e6e9ef'}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>Recent Attendance</div>
          <div style={{color:'#94a3b8',fontSize:13,textAlign:'center',padding:'20px 0'}}><Calendar size={32} style={{opacity:0.3,marginBottom:8}}/><div>Click Attendance to view your punch log</div></div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({onNavigate}) {
  const {user} = useAuthStore();
  const [stats,setStats] = useState(null);
  const [loading,setLoading] = useState(true);
  
  useEffect(()=>{ 
    const loadStats = async () => {
      setLoading(true);
      try {
        if (user?.role === 'employee') {
          const now = new Date();
          const r = await attendanceApi.getMyAttendance(now.getFullYear(), now.getMonth() + 1);
          setStats(r.data);
        } else {
          const r = await attendanceApi.getDashboardStats();
          setStats(r.data);
        }
      } catch (e) {}
      setLoading(false);
    };
    loadStats();
    
    // Connect WebSocket for real-time punches
    const ws = new WebSocket(`ws://${window.location.hostname}:8000/api/attendance/ws/punches`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if(data.type === 'NEW_PUNCH') {
        loadStats();
      }
    };
    return () => ws.close();
  },[user?.role]);

  const role = user?.role;
  if(role==='employee') return <EmployeeDashboard stats={stats} loading={loading} onNavigate={onNavigate}/>;
  if(role==='dept_head') return <DeptHeadDashboard stats={stats} loading={loading} onNavigate={onNavigate}/>;
  if(role==='hr_admin') return <HRDashboard stats={stats} loading={loading} onNavigate={onNavigate}/>;
  return <ITAdminDashboard stats={stats} loading={loading} onNavigate={onNavigate}/>;
}
