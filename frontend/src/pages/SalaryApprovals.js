import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { adminApi } from '../utils/api';
import useAuthStore from '../store/authStore';

export default function SalaryApprovals() {
  const { user } = useAuthStore();
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payroll/revisions/pending', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('hrms_token')}` }
      });
      if (res.ok) {
        setRevisions(await res.json());
      }
    } catch(e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (id) => {
    try {
      const res = await fetch(`/api/payroll/revisions/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('hrms_token')}` }
      });
      if (res.ok) {
        setMsg('✅ Revision approved successfully');
        load();
      } else {
        setMsg('❌ Failed to approve');
      }
    } catch {
      setMsg('❌ Error approving');
    }
  };

  const handleReject = async (id) => {
    try {
      const res = await fetch(`/api/payroll/revisions/${id}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('hrms_token')}` }
      });
      if (res.ok) {
        setMsg('✅ Revision rejected');
        load();
      } else {
        setMsg('❌ Failed to reject');
      }
    } catch {
      setMsg('❌ Error rejecting');
    }
  };

  if (user?.role !== 'management') {
    return (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'80vh'}}>
        <h2 style={{fontSize:24,fontWeight:800,color:'#0f172a'}}>Permission Denied</h2>
        <p style={{color:'#64748b'}}>Only Management can access Salary Approvals.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:'#0b1320'}}>Salary Approvals</h1>
          <p style={{color:'#64748b',fontSize:14,marginTop:2}}>Review and approve salary revisions requested by HR.</p>
        </div>
      </div>

      {msg && <div style={{padding:'12px 16px',background:msg.startsWith('✅')?'#dcfce7':'#fee2e2',color:msg.startsWith('✅')?'#15803d':'#b91c1c',borderRadius:9,marginBottom:16,fontSize:13,fontWeight:600}}>{msg}</div>}

      <div style={{background:'#fff',borderRadius:12,border:'1px solid #e6e9ef',overflow:'hidden'}}>
        {loading ? (
          <div style={{padding:60,textAlign:'center',color:'#94a3b8'}}>Loading...</div>
        ) : revisions.length === 0 ? (
          <div style={{padding:60,textAlign:'center',color:'#94a3b8'}}>No pending salary revisions.</div>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#f8fafc'}}>
                <th style={th}>Employee</th>
                <th style={th}>Requested Basic</th>
                <th style={th}>Requested HRA</th>
                <th style={th}>Requested On</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {revisions.map((r, i) => (
                <tr key={r.id} style={{borderBottom:'1px solid #e6e9ef'}}>
                  <td style={td}>
                    <div style={{fontWeight:600,color:'#0f172a'}}>{r.emp_name}</div>
                    <div style={{fontSize:11.5,color:'#64748b'}}>{r.emp_code}</div>
                  </td>
                  <td style={{...td,fontWeight:600,color:'#0f172a'}}>₹{r.basic_salary}</td>
                  <td style={{...td,fontWeight:600,color:'#0f172a'}}>₹{r.hra}</td>
                  <td style={{...td,color:'#64748b'}}>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td style={td}>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={() => handleApprove(r.id)} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 10px',background:'#16a34a',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>
                        <Check size={14} /> Approve
                      </button>
                      <button onClick={() => handleReject(r.id)} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 10px',background:'#ef4444',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>
                        <X size={14} /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const th = {padding:'12px 16px',textAlign:'left',fontSize:12,fontWeight:700,color:'#64748b',borderBottom:'1px solid #e6e9ef'};
const td = {padding:'12px 16px',fontSize:13};
