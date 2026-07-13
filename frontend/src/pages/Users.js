import React, { useState, useEffect } from 'react';
import { Search, Users, Shield, Key, Plus, Lock, Check } from 'lucide-react';
import { adminApi } from '../utils/api';
import useAuthStore from '../store/authStore';

export default function UsersPage() {
  const { user } = useAuthStore();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState('');
  
  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Forms
  const [newPassword, setNewPassword] = useState('');
  const [newUser, setNewUser] = useState({ emp_code: '', name: '', email: '', role: 'employee' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getHrmsEmployees();
      setEmployees(res.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleRoleChange = async (empCode, newRole) => {
    setUpdating(empCode);
    try {
      await adminApi.updateRole(empCode, newRole);
      setEmployees(prev => prev.map(e => e.emp_code === empCode ? { ...e, role: newRole } : e));
    } catch (e) {
      alert("Failed to update role. You may not have permission.");
    }
    setUpdating('');
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      await adminApi.resetPassword(selectedUser.emp_code, newPassword);
      alert('Password reset successfully!');
      setShowReset(false);
      setNewPassword('');
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to reset password');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await adminApi.createEmployee(newUser);
      alert('User created successfully!');
      setShowCreate(false);
      setNewUser({ emp_code: '', name: '', email: '', role: 'employee' });
      load();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to create user');
    }
  };

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    return (!q || e.name?.toLowerCase().includes(q) || String(e.emp_code).includes(q));
  });

  const availableRoles = ['employee', 'hr_admin', 'it_admin', 'dept_head', 'management'];

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:'#0b1320'}}>User Management</h1>
          <p style={{color:'#64748b',fontSize:14,marginTop:2}}>
            {loading ? 'Loading...' : `${filtered.length} users in system`}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 14px',borderRadius:9,background:'#115e59',color:'#fff',border:'none',cursor:'pointer',fontSize:13,fontWeight:700}}>
          <Plus size={16}/> Create User
        </button>
      </div>

      <div style={{display:'flex',gap:12,marginBottom:20}}>
        <div style={{position:'relative',flex:1}}>
          <Search size={15} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#94a3b8'}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or emp code..."
            style={{width:'100%',height:40,paddingLeft:36,border:'1px solid #e6e9ef',borderRadius:9,fontSize:13.5,outline:'none',boxSizing:'border-box'}}/>
        </div>
      </div>

      <div style={{background:'#fff',borderRadius:12,border:'1px solid #e6e9ef',overflow:'hidden'}}>
        {loading ? (
          <div style={{padding:60,textAlign:'center',color:'#94a3b8'}}>Loading users...</div>
        ) : filtered.length === 0 ? (
          <div style={{padding:60,textAlign:'center',color:'#94a3b8'}}>
            <Users size={40} style={{opacity:0.3,marginBottom:10,margin:'0 auto'}}/>
            <div>No users found</div>
          </div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:800}}>
              <thead>
                <tr style={{background:'#f8fafc'}}>
                  {['Code', 'Name', 'Email', 'Status', 'Role', 'Actions'].map(h=>(
                    <th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:11.5,fontWeight:700,color:'#64748b',borderBottom:'1px solid #e6e9ef',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp,i)=>(
                  <tr key={emp.emp_code} style={{background:i%2===0?'#fff':'#fafafa'}}>
                    <td style={td}><span style={{fontFamily:'monospace',color:'#94a3b8',fontSize:12}}>{emp.emp_code}</span></td>
                    <td style={{...td,fontWeight:600}}>{emp.name}</td>
                    <td style={td}>{emp.email || '—'}</td>
                    <td style={td}>
                      <span style={{background:emp.is_active?'#dcfce7':'#fee2e2',color:emp.is_active?'#15803d':'#b91c1c',padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700}}>
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={td}>
                      <select 
                        value={emp.role || 'employee'} 
                        onChange={e => handleRoleChange(emp.emp_code, e.target.value)}
                        disabled={updating === emp.emp_code}
                        style={{
                          padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0',
                          fontSize: 12, outline: 'none', background: '#fff', cursor: 'pointer',
                          opacity: updating === emp.emp_code ? 0.5 : 1
                        }}
                      >
                        {availableRoles.map(r => (
                          <option key={r} value={r}>{r.replace('_', ' ').toUpperCase()}</option>
                        ))}
                      </select>
                    </td>
                    <td style={td}>
                      <button 
                        onClick={() => { setSelectedUser(emp); setShowReset(true); }}
                        style={{display:'flex',alignItems:'center',gap:4,padding:'4px 8px',borderRadius:6,background:'#f1f5f9',border:'1px solid #e2e8f0',color:'#475569',cursor:'pointer',fontSize:11,fontWeight:600}}
                      >
                        <Key size={12}/> Reset Pass
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showReset && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3 style={{marginTop:0,marginBottom:16,color:'#0b1320',display:'flex',alignItems:'center',gap:8}}>
              <Lock size={18} color="#115e59"/> Reset Password
            </h3>
            <p style={{fontSize:13,color:'#64748b',marginBottom:16}}>Resetting password for <b>{selectedUser?.name}</b> ({selectedUser?.emp_code})</p>
            <form onSubmit={handleResetPassword}>
              <div style={{marginBottom:16}}>
                <label style={{display:'block',fontSize:12,fontWeight:600,color:'#475569',marginBottom:6}}>New Password</label>
                <input type="text" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required minLength={6}
                  style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid #e2e8f0',outline:'none',boxSizing:'border-box',fontSize:13}}/>
              </div>
              <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                <button type="button" onClick={()=>setShowReset(false)} style={btnLight}>Cancel</button>
                <button type="submit" style={btnPrimary}>Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreate && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3 style={{marginTop:0,marginBottom:16,color:'#0b1320',display:'flex',alignItems:'center',gap:8}}>
              <Users size={18} color="#115e59"/> Create New User
            </h3>
            <form onSubmit={handleCreateUser}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
                <div>
                  <label style={{display:'block',fontSize:12,fontWeight:600,color:'#475569',marginBottom:6}}>Employee Code *</label>
                  <input type="text" value={newUser.emp_code} onChange={e=>setNewUser({...newUser,emp_code:e.target.value})} required
                    style={inputStyle}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:12,fontWeight:600,color:'#475569',marginBottom:6}}>Full Name *</label>
                  <input type="text" value={newUser.name} onChange={e=>setNewUser({...newUser,name:e.target.value})} required
                    style={inputStyle}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:12,fontWeight:600,color:'#475569',marginBottom:6}}>Email (Optional)</label>
                  <input type="email" value={newUser.email} onChange={e=>setNewUser({...newUser,email:e.target.value})}
                    style={inputStyle}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:12,fontWeight:600,color:'#475569',marginBottom:6}}>Role *</label>
                  <select value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value})} style={inputStyle}>
                    {availableRoles.map(r => <option key={r} value={r}>{r.replace('_', ' ').toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              <div style={{fontSize:11,color:'#64748b',marginBottom:16}}>
                Note: The user will need to log in and set up their password, or you can manually reset it.
              </div>
              <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                <button type="button" onClick={()=>setShowCreate(false)} style={btnLight}>Cancel</button>
                <button type="submit" style={btnPrimary}>Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const td = {padding:'10px 14px',borderBottom:'1px solid #f1f5f9',fontSize:13,whiteSpace:'nowrap',verticalAlign:'middle'};
const modalOverlay = {position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(15,23,42,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50};
const modalContent = {background:'#fff',padding:24,borderRadius:16,width:'100%',maxWidth:400,boxShadow:'0 10px 25px rgba(0,0,0,0.1)'};
const inputStyle = {width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid #e2e8f0',outline:'none',boxSizing:'border-box',fontSize:13};
const btnLight = {padding:'8px 16px',borderRadius:8,border:'1px solid #e2e8f0',background:'#fff',color:'#475569',cursor:'pointer',fontSize:13,fontWeight:600};
const btnPrimary = {padding:'8px 16px',borderRadius:8,border:'none',background:'#115e59',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600};
