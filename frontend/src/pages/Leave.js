import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle, XCircle, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { leaveApi } from '../utils/api';
import useAuthStore from '../store/authStore';

const STATUS_STYLE = {
  pending:  { bg: '#fef3c7', color: '#b45309', label: 'Pending' },
  approved: { bg: '#dcfce7', color: '#15803d', label: 'Approved' },
  rejected: { bg: '#fee2e2', color: '#b91c1c', label: 'Rejected' },
  cancelled:{ bg: '#f1f5f9', color: '#64748b', label: 'Cancelled' },
};

export default function Leave() {
  const { user } = useAuthStore();
  const isAdmin = ['hr_admin','dept_head','it_admin'].includes(user?.role);
  const [tab, setTab] = useState(isAdmin ? 'pending' : 'my');
  const [leaves, setLeaves] = useState([]);
  const [pending, setPending] = useState([]);
  const [types, setTypes] = useState([]);
  const [balance, setBalance] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  
  // Forms
  const [form, setForm] = useState({ leave_type_id:'', from_date:'', to_date:'', reason:'' });
  const [typeForm, setTypeForm] = useState({ name: '', code: '', max_days_per_year: 12, is_paid: true });
  
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = () => {
    setLoading(true);
    const calls = [leaveApi.getMyLeaves(), leaveApi.getLeaveTypes(), leaveApi.getMyBalance()];
    if (isAdmin) calls.push(leaveApi.getPendingApprovals());
    Promise.all(calls).then(([l, t, b, p]) => {
      setLeaves(l.data); setTypes(t.data); setBalance(b.data || []);
      if (p) setPending(p.data);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleApply = async (ev) => {
    ev.preventDefault(); setSaving(true); setMsg('');
    try {
      const from = new Date(form.from_date);
      const to = new Date(form.to_date);
      const days = Math.max(1, Math.ceil((to - from) / (1000*60*60*24)) + 1);
      await leaveApi.applyLeave({ ...form, days, leave_type_id: parseInt(form.leave_type_id) });
      setMsg('✅ Leave applied successfully');
      setForm({ leave_type_id:'', from_date:'', to_date:'', reason:'' });
      load();
      setTimeout(() => setShowModal(false), 1200);
    } catch (e) { setMsg('❌ ' + (e.response?.data?.detail || 'Failed')); }
    finally { setSaving(false); }
  };

  const handleAddType = async (ev) => {
    ev.preventDefault(); setSaving(true);
    try {
      await leaveApi.addLeaveType(typeForm);
      setTypeForm({ name: '', code: '', max_days_per_year: 12, is_paid: true });
      load();
      setShowTypeModal(false);
    } catch (e) { alert("Failed to add type"); }
    finally { setSaving(false); }
  };
  
  const handleDeleteType = async (id) => {
    if(window.confirm("Are you sure you want to delete this leave type?")) {
      try {
        await leaveApi.deleteLeaveType(id);
        load();
      } catch (e) { alert("Failed to delete type"); }
    }
  };

  const handleApprove = async (id) => {
    try { await leaveApi.approveLeave(id, 'Approved'); load(); } catch {}
  };

  const handleReject = async () => {
    try { await leaveApi.rejectLeave(rejectId, rejectReason); setRejectId(null); setRejectReason(''); load(); } catch {}
  };

  const handleCancel = async (id) => {
    if (window.confirm('Cancel this leave request?')) {
      try { await leaveApi.cancelLeave(id); load(); } catch {}
    }
  };

  const displayLeaves = tab === 'pending' ? pending : leaves;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0b1320' }}>Leave Management</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 2 }}>Apply, track and manage leave requests</p>
        </div>
        <div style={{display:'flex', gap:10}}>
          {isAdmin && tab === 'types' && (
            <button onClick={() => setShowTypeModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              <Plus size={15} /> Add Type
            </button>
          )}
          {!isAdmin && (
            <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: 'none', background: '#115e59', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              <Plus size={15} /> Apply Leave
            </button>
          )}
        </div>
      </div>

      {/* Leave balance */}
      {balance.length > 0 && tab !== 'types' && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
          {balance.map(b => (
            <div key={b.leave_type} style={{ background: '#fff', border: '1px solid #e6e9ef', borderRadius: 10, padding: '12px 18px', minWidth: 120 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#115e59' }}>{b.remaining}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{b.leave_type}</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>of {b.total} days</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 10, width: 'fit-content', marginBottom: 20 }}>
          {[['pending', `Pending (${pending.length})`], ['my', 'My Leaves'], ['types', 'Leave Types']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === k ? 700 : 500, background: tab === k ? '#fff' : 'transparent', color: tab === k ? '#0b1320' : '#64748b', boxShadow: tab === k ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>{l}</button>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e6e9ef', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
        ) : tab === 'types' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Name', 'Code', 'Max Days/Year', 'Paid', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e6e9ef' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {types.map((t, i) => (
                <tr key={t.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{...td, fontWeight:600}}>{t.name}</td>
                  <td style={td}><span style={{fontFamily:'monospace'}}>{t.code}</span></td>
                  <td style={td}>{t.max_days}</td>
                  <td style={td}>{t.is_paid ? 'Yes' : 'No'}</td>
                  <td style={td}>
                    <button onClick={() => handleDeleteType(t.id)} style={{...actionBtn, background:'#fee2e2', color:'#dc2626'}}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : displayLeaves.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
            <Clock size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 500 }}>{tab === 'pending' ? 'No pending approvals' : 'No leave requests yet'}</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {(isAdmin && tab === 'pending' ? ['Employee','Type','From','To','Days','Reason','Actions'] : ['Type','From','To','Days','Reason','Status','Actions']).map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e6e9ef', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayLeaves.map((l, i) => {
                const st = STATUS_STYLE[l.status] || STATUS_STYLE.pending;
                return (
                  <tr key={l.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    {isAdmin && tab === 'pending' && <td style={td}><div style={{ fontWeight: 600 }}>{l.employee_name}</div><div style={{ fontSize: 11, color: '#94a3b8' }}>{l.emp_code}</div></td>}
                    <td style={td}>{l.leave_type_name || '—'}</td>
                    <td style={td}>{l.from_date}</td>
                    <td style={td}>{l.to_date}</td>
                    <td style={td}><span style={{ fontWeight: 700, color: '#115e59' }}>{l.days}</span></td>
                    <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.reason || '—'}</td>
                    {tab !== 'pending' && (
                      <td style={td}><span style={{ background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{st.label}</span></td>
                    )}
                    <td style={td}>
                      {isAdmin && tab === 'pending' ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => handleApprove(l.id)} style={{ ...actionBtn, background: '#dcfce7', color: '#15803d' }}>Approve</button>
                          <button onClick={() => setRejectId(l.id)} style={{ ...actionBtn, background: '#fee2e2', color: '#b91c1c' }}>Reject</button>
                        </div>
                      ) : l.status === 'pending' ? (
                        <button onClick={() => handleCancel(l.id)} style={{ ...actionBtn, background: '#f1f5f9', color: '#64748b' }}>Cancel</button>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Apply Leave Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 22 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>Apply for Leave</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8' }}>×</button>
            </div>
            {msg && <div style={{ padding: '10px 14px', borderRadius: 9, background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2', color: msg.startsWith('✅') ? '#15803d' : '#b91c1c', fontSize: 13, marginBottom: 16, fontWeight: 500 }}>{msg}</div>}
            <form onSubmit={handleApply}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={fldStyle}>
                  <label style={lblStyle}>Leave Type *</label>
                  <select required value={form.leave_type_id} onChange={e => setForm(p => ({...p, leave_type_id: e.target.value}))} style={inpStyle}>
                    <option value="">Select type</option>
                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={fldStyle}>
                    <label style={lblStyle}>From Date *</label>
                    <input type="date" required value={form.from_date} onChange={e => setForm(p => ({...p, from_date: e.target.value}))} style={inpStyle} />
                  </div>
                  <div style={fldStyle}>
                    <label style={lblStyle}>To Date *</label>
                    <input type="date" required value={form.to_date} onChange={e => setForm(p => ({...p, to_date: e.target.value}))} style={inpStyle} min={form.from_date} />
                  </div>
                </div>
                <div style={fldStyle}>
                  <label style={lblStyle}>Reason *</label>
                  <textarea required value={form.reason} onChange={e => setForm(p => ({...p, reason: e.target.value}))} rows={3} placeholder="Brief reason for leave..." style={{ ...inpStyle, height: 'auto', padding: '8px 10px', resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, height: 42, borderRadius: 9, border: '1.5px solid #e6e9ef', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex: 2, height: 42, borderRadius: 9, border: 'none', background: saving ? '#9fb7b4' : '#115e59', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700 }}>
                  {saving ? 'Submitting...' : 'Submit Leave Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Leave Type Modal */}
      {showTypeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontWeight: 800, marginBottom: 20 }}>Add Leave Type</h3>
            <form onSubmit={handleAddType}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={fldStyle}>
                  <label style={lblStyle}>Name *</label>
                  <input required value={typeForm.name} onChange={e => setTypeForm(p => ({...p, name: e.target.value}))} placeholder="e.g. Bereavement Leave" style={inpStyle} />
                </div>
                <div style={fldStyle}>
                  <label style={lblStyle}>Code *</label>
                  <input required value={typeForm.code} onChange={e => setTypeForm(p => ({...p, code: e.target.value}))} placeholder="e.g. BL" style={inpStyle} />
                </div>
                <div style={fldStyle}>
                  <label style={lblStyle}>Max Days/Year *</label>
                  <input type="number" required min="1" value={typeForm.max_days_per_year} onChange={e => setTypeForm(p => ({...p, max_days_per_year: parseInt(e.target.value)}))} style={inpStyle} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={typeForm.is_paid} onChange={e => setTypeForm(p => ({...p, is_paid: e.target.checked}))} />
                  <label style={lblStyle}>Is Paid Leave</label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <button type="button" onClick={() => setShowTypeModal(false)} style={{ flex: 1, height: 42, borderRadius: 9, border: '1.5px solid #e6e9ef', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex: 1, height: 42, borderRadius: 9, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Save Type</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontWeight: 800, marginBottom: 14 }}>Reject Leave</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection..." rows={3} style={{ width: '100%', border: '1.5px solid #e6e9ef', borderRadius: 8, padding: '8px 10px', fontSize: 13.5, resize: 'vertical', outline: 'none' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setRejectId(null)} style={{ flex: 1, height: 40, borderRadius: 8, border: '1px solid #e6e9ef', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleReject} style={{ flex: 1, height: 40, borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const td = { padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 13, whiteSpace: 'nowrap', verticalAlign: 'middle' };
const actionBtn = { fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700 };
const fldStyle = { display: 'flex', flexDirection: 'column', gap: 5 };
const lblStyle = { fontSize: 12, fontWeight: 600, color: '#4b5566' };
const inpStyle = { height: 38, padding: '0 10px', border: '1.5px solid #e6e9ef', borderRadius: 8, fontSize: 13.5, outline: 'none' };
