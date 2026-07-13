import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Users, Shield } from 'lucide-react';
import { adminApi } from '../utils/api';
import useAuthStore from '../store/authStore';

export default function Employees() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'hr_admin' || user?.role === 'it_admin';
  const isItAdmin = user?.role === 'it_admin';

  const [employees, setEmployees] = useState([]);
  const [hrmsRoles, setHrmsRoles] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [updating, setUpdating] = useState('');
  const [salaryModal, setSalaryModal] = useState(null);
  const [salaryForm, setSalaryForm] = useState({basic:0, hra:0});

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [esslRes, hrmsRes] = await Promise.all([
        adminApi.getEsslEmployees(),
        adminApi.getHrmsEmployees().catch(() => ({ data: [] }))
      ]);
      setEmployees(esslRes.data || []);
      
      const roles = {};
      (hrmsRes.data || []).forEach(u => {
        roles[u.emp_code] = u.role;
      });
      setHrmsRoles(roles);
    } catch {
      setError('Failed to load employees');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSync = async () => {
    setSyncing(true); setSyncMsg('');
    try {
      const r = await adminApi.syncEmployees();
      setSyncMsg(`✅ ${r.data.message}`);
      load();
      setTimeout(() => setSyncMsg(''), 5000);
    } catch { setSyncMsg('❌ Sync failed'); }
    setSyncing(false);
  };

  
  const handleSalarySubmit = async (e) => {
    e.preventDefault();
    const isRevision = salaryModal.basic_salary > 0;
    const url = isRevision 
      ? `/api/payroll/salary/${salaryModal.emp_code}/revision`
      : `/api/payroll/salary/${salaryModal.emp_code}`;
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('hrms_token')}` },
        body: JSON.stringify({ basic_salary: salaryForm.basic, hra: salaryForm.hra })
      });
      if (res.ok) {
        alert(isRevision ? "Salary revision submitted for approval!" : "Initial salary set!");
        setSalaryModal(null);
        load();
      } else {
        const d = await res.json();
        alert(d.detail || 'Failed');
      }
    } catch(e) {
      alert('Error saving salary');
    }
  };

  const handleRoleChange = async (empCode, newRole) => {
    setUpdating(empCode);
    try {
      await adminApi.updateRole(empCode, newRole);
      setHrmsRoles(prev => ({ ...prev, [empCode]: newRole }));
    } catch (e) {
      alert("Failed to update role. You may not have permission.");
    }
    setUpdating('');
  };

  const depts = [...new Set(employees.map(e => e.dept).filter(Boolean))].sort();
  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    return (!q || e.name?.toLowerCase().includes(q) || String(e.emp_code).includes(q) || e.dept?.toLowerCase().includes(q))
      && (!deptFilter || e.dept === deptFilter);
  });

  const getAvailableRoles = () => {
    if (isItAdmin) {
      return [{value: 'employee', label: 'Employee'}, {value: 'hr_admin', label: 'HR Admin'}];
    }
    return [
      {value: 'employee', label: 'Employee'},
      {value: 'dept_head', label: 'HOD'},
      {value: 'management', label: 'Management'}
    ];
  };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:'#0b1320'}}>Employees</h1>
          <p style={{color:'#64748b',fontSize:14,marginTop:2}}>
            {loading ? 'Loading...' : `${filtered.length} employees`}
          </p>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          {syncMsg && <span style={{fontSize:12,fontWeight:600,color:syncMsg.startsWith('✅')?'#16a34a':'#dc2626'}}>{syncMsg}</span>}
          <button onClick={handleSync} disabled={syncing} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 14px',borderRadius:9,border:'1px solid #115e59',background:'#fff',color:'#115e59',cursor:syncing?'not-allowed':'pointer',fontSize:13,fontWeight:700,opacity:syncing?0.7:1}}>
            <RefreshCw size={14} style={{animation:syncing?'spin 1s linear infinite':'none'}}/> {syncing?'Syncing...':'Sync from eSSL'}
          </button>
          <button onClick={load} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 14px',borderRadius:9,border:'1px solid #e6e9ef',background:'#fff',cursor:'pointer',fontSize:13}}>
            <RefreshCw size={14}/> Refresh
          </button>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{display:'flex',gap:12,marginBottom:20}}>
        <div style={{position:'relative',flex:1}}>
          <Search size={15} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#94a3b8'}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, code or department..."
            style={{width:'100%',height:40,paddingLeft:36,border:'1px solid #e6e9ef',borderRadius:9,fontSize:13.5,outline:'none',boxSizing:'border-box'}}/>
        </div>
        <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)}
          style={{height:40,padding:'0 12px',border:'1px solid #e6e9ef',borderRadius:9,fontSize:13.5,minWidth:200,outline:'none'}}>
          <option value="">All Departments ({employees.length})</option>
          {depts.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {error && <div style={{padding:'12px 16px',background:'#fee2e2',color:'#b91c1c',borderRadius:9,marginBottom:16,fontSize:13}}>{error}</div>}

      <div style={{background:'#fff',borderRadius:12,border:'1px solid #e6e9ef',overflow:'hidden'}}>
        {loading ? (
          <div style={{padding:60,textAlign:'center',color:'#94a3b8'}}>Loading employees...</div>
        ) : filtered.length===0 ? (
          <div style={{padding:60,textAlign:'center',color:'#94a3b8'}}>
            <Users size={40} style={{opacity:0.3,marginBottom:10}}/><div>No employees found</div>
          </div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:800}}>
              <thead>
                <tr style={{background:'#f8fafc'}}>
                  {['Code','Name','Department','Designation','Status','Salary'].map(h=>(
                    <th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:11.5,fontWeight:700,color:'#64748b',borderBottom:'1px solid #e6e9ef',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                  <th style={{ padding:'12px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'#64748b', borderBottom:'1px solid #e6e9ef' }}>
                    Role Assignment
                    <div style={{fontSize:10, color:'#94a3b8', fontWeight:500, marginTop:2}}>Who can do what</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp,i)=>{
                  const role = hrmsRoles[emp.emp_code];
                  return (
                  <tr key={String(emp.emp_code)+i} style={{background:i%2===0?'#fff':'#fafafa'}}>
                    <td style={td}><span style={{fontFamily:'monospace',color:'#94a3b8',fontSize:12}}>{emp.emp_code}</span></td>
                    <td style={{...td,fontWeight:600}}>{emp.name}</td>
                    <td style={td}>{emp.dept?<span style={{background:'#eff6ff',color:'#1d4ed8',padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:600}}>{emp.dept}</span>:'—'}</td>
                    <td style={{...td,color:'#64748b'}}>{emp.designation||'—'}</td>
                    <td style={td}><span style={{background:emp.status==='Working'||emp.status==='Active'?'#dcfce7':'#f1f5f9',color:emp.status==='Working'||emp.status==='Active'?'#15803d':'#64748b',padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700}}>{emp.status||'Active'}</span></td>

                    <td style={td}>
                      {emp.basic_salary > 0 ? (
                        <div style={{display:'flex',gap:8,alignItems:'center'}}>
                          <span style={{fontWeight:600,color:'#0f172a'}}>₹{emp.basic_salary}</span>
                          {(isAdmin || user?.role==='management') && (
                            <button onClick={()=> { setSalaryModal(emp); setSalaryForm({basic:emp.basic_salary, hra:emp.hra||0}); }} style={{padding:'2px 8px',fontSize:11,background:'#f1f5f9',border:'1px solid #e2e8f0',borderRadius:4,cursor:'pointer',fontWeight:600,color:'#475569'}}>Revise</button>
                          )}
                        </div>
                      ) : (
                        (isAdmin || user?.role==='management') ? (
                          <button onClick={()=> { setSalaryModal(emp); setSalaryForm({basic:0, hra:0}); }} style={{padding:'4px 10px',fontSize:11,background:'#eff6ff',border:'1px solid #bfdbfe',color:'#1d4ed8',borderRadius:6,cursor:'pointer',fontWeight:600}}>Set Salary</button>
                        ) : <span style={{color:'#94a3b8'}}>-</span>
                      )}
                    </td>
                    <td style={td}>
                      {!role ? (
                        <span style={{color:'#94a3b8',fontSize:11}}>Not Synced</span>
                      ) : (
                        isAdmin ? (
                          <select 
                            value={role} 
                            onChange={e => handleRoleChange(emp.emp_code, e.target.value)}
                            disabled={updating === emp.emp_code}
                            style={{
                              padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0',
                              fontSize: 12, outline: 'none', background: '#fff', cursor: 'pointer',
                              opacity: updating === emp.emp_code ? 0.5 : 1
                            }}
                          >
                            <option value={role}>{role.replace('_', ' ').toUpperCase()}</option>
                            {getAvailableRoles().filter(r => r.value !== role).map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{background:'#f1f5f9',padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:600,color:'#475569'}}>
                            {role.replace('_', ' ').toUpperCase()}
                          </span>
                        )
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {salaryModal && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}}>
          <div style={{background:'#fff',padding:24,borderRadius:12,width:320}}>
            <h3 style={{marginTop:0,marginBottom:16,color:'#0f172a',fontSize:18}}>
              {salaryModal.basic_salary > 0 ? 'Request Salary Revision' : 'Set Initial Salary'}
            </h3>
            <div style={{fontSize:13,color:'#64748b',marginBottom:20}}>{salaryModal.name} ({salaryModal.emp_code})</div>
            <form onSubmit={handleSalarySubmit}>
              <label style={{display:'block',fontSize:12,fontWeight:600,color:'#475569',marginBottom:4}}>Basic Salary</label>
              <input type="number" required value={salaryForm.basic} onChange={e=>setSalaryForm({...salaryForm, basic:parseFloat(e.target.value)||0})} style={{width:'100%',padding:8,marginBottom:12,border:'1px solid #cbd5e1',borderRadius:6,boxSizing:'border-box'}}/>
              
              <label style={{display:'block',fontSize:12,fontWeight:600,color:'#475569',marginBottom:4}}>HRA</label>
              <input type="number" required value={salaryForm.hra} onChange={e=>setSalaryForm({...salaryForm, hra:parseFloat(e.target.value)||0})} style={{width:'100%',padding:8,marginBottom:20,border:'1px solid #cbd5e1',borderRadius:6,boxSizing:'border-box'}}/>
              
              <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
                <button type="button" onClick={()=>setSalaryModal(null)} style={{padding:'6px 12px',background:'#f1f5f9',border:'none',borderRadius:6,cursor:'pointer'}}>Cancel</button>
                <button type="submit" style={{padding:'6px 12px',background:'#16a34a',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontWeight:600}}>
                  {salaryModal.basic_salary > 0 ? 'Submit Revision' : 'Save Salary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
const td = {padding:'10px 14px',borderBottom:'1px solid #f1f5f9',fontSize:13,whiteSpace:'nowrap',verticalAlign:'middle'};
