import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Clock, RefreshCw, X, Check } from 'lucide-react';
import useAuthStore from '../store/authStore';

const API = '/api';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('hrms_token')}` });

const fld = { display:'flex', flexDirection:'column', gap:5, marginBottom:14 };
const lbl = { fontSize:12, fontWeight:600, color:'#4b5566' };
const inp = { height:38, padding:'0 10px', border:'1.5px solid #e6e9ef', borderRadius:8, fontSize:13.5, outline:'none', fontFamily:'inherit' };

export default function Shifts() {
  const { user } = useAuthStore();
  const canEdit = ['hr_admin','dept_head'].includes(user?.role);
  const [shifts, setShifts] = useState([]);
  const [selectedShifts, setSelectedShifts] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name:'', code:'', start_time:'09:00', end_time:'17:00', working_hours:8, grace_late:15, grace_early:15, is_night:false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/shifts/`, { headers: auth() });
      setShifts(await r.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ name:'', code:'', start_time:'09:00', end_time:'17:00', working_hours:8, grace_late:15, grace_early:15, is_night:false }); setMsg(''); setShowModal(true); };
  const openEdit = (s) => { if(s.source==='essl') return; setEditing(s); setForm({ name:s.name, code:s.code, start_time:s.start_time, end_time:s.end_time, working_hours:s.working_hours, grace_late:s.grace_late, grace_early:s.grace_early, is_night:s.is_night }); setMsg(''); setShowModal(true); };

  
  const toggleSelect = (id) => {
    const next = new Set(selectedShifts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedShifts(next);
  };
  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedShifts.size} shifts?`)) return;
    try {
      await fetch('/api/shifts/bulk-delete', { method:'POST', headers:{'Content-Type':'application/json', ...auth()}, body:JSON.stringify({ids:Array.from(selectedShifts)}) });
      setSelectedShifts(new Set());
      load();
    } catch(e) {}
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      const url = editing ? `${API}/shifts/${editing.id}` : `${API}/shifts/`;
      const method = editing ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { ...auth(), 'Content-Type':'application/json' }, body: JSON.stringify({ ...form, working_hours: parseFloat(form.working_hours), grace_late: parseInt(form.grace_late), grace_early: parseInt(form.grace_early) }) });
      const d = await r.json();
      if (r.ok) { setMsg('✅ ' + d.message); load(); setTimeout(() => setShowModal(false), 800); }
      else setMsg('❌ ' + (d.detail || 'Failed'));
    } catch { setMsg('❌ Error'); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this shift?')) return;
    await fetch(`${API}/shifts/${id}`, { method:'DELETE', headers: auth() });
    load();
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0b1320' }}>Shift Management</h1>
          <p style={{ color:'#64748b', fontSize:14, marginTop:2 }}>{shifts.length} shifts (eSSL + HRMS)</p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={load} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:9, border:'1px solid #e6e9ef', background:'#fff', cursor:'pointer', fontSize:13 }}><RefreshCw size={14}/> Refresh</button>
          {canEdit && <button onClick={openAdd} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:9, border:'none', background:'#115e59', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700 }}><Plus size={15}/> Add Shift</button>}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
        {loading ? <div style={{ color:'#94a3b8', padding:40 }}>Loading shifts...</div> :
          shifts.map(s => (
            <div key={s.id} onClick={(e)=>{ if(e.target.tagName!=='BUTTON' && e.target.closest('button')==null && canEdit) toggleSelect(s.id); }} style={{ cursor:canEdit?'pointer':'default', outline:selectedShifts.has(s.id)?'2px solid #10b981':'none', background:'#fff', borderRadius:12, border:'1px solid #e6e9ef', padding:'20px 22px', position:'relative' }}>
              <div style={{ position:'absolute', top:12, right:12, display:'flex', gap:6, alignItems:'center' }}>
                <span style={{ background: s.source==='essl'?'#dbeafe':'#f0fdf4', color: s.source==='essl'?'#1d4ed8':'#15803d', padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:700 }}>
                  {s.source==='essl'?'eSSL':'HRMS'}
                </span>
                {canEdit && s.source==='hrms' && <>
                  <button onClick={()=>openEdit(s)} style={{ background:'none', border:'none', cursor:'pointer', color:'#64748b', padding:4 }}><Edit2 size={14}/></button>
                  <button onClick={()=>handleDelete(s.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', padding:4 }}><Trash2 size={14}/></button>
                </>}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, paddingRight:80 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, color:'#0b1320' }}>{s.name}</div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{s.code}</div>
                </div>
                <span style={{ background: s.is_night?'#1e1b4b':'#f0fdf4', color: s.is_night?'#a5b4fc':'#16a34a', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                  {s.is_night?'🌙 Night':'☀️ Day'}
                </span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[['Start Time',s.start_time],['End Time',s.end_time],['Work Hours',`${s.working_hours} hrs`],['Grace (Late)',`${s.grace_late} min`]].map(([label,value])=>(
                  <div key={label} style={{ background:'#f8fafc', borderRadius:8, padding:'8px 12px' }}>
                    <div style={{ fontSize:10, color:'#94a3b8', marginBottom:2 }}>{label}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#0b1320', fontFamily:'monospace' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))
        }
      </div>

      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:32, width:460, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:22 }}>
              <h2 style={{ fontSize:18, fontWeight:800 }}>{editing?'Edit Shift':'Add New Shift'}</h2>
              <button onClick={()=>setShowModal(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#94a3b8' }}>×</button>
            </div>
            {msg && <div style={{ padding:'10px 14px', borderRadius:9, background:msg.startsWith('✅')?'#dcfce7':'#fee2e2', color:msg.startsWith('✅')?'#15803d':'#b91c1c', fontSize:13, marginBottom:16 }}>{msg}</div>}
            <form onSubmit={handleSave}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div style={fld}><label style={lbl}>Shift Name *</label><input style={inp} required value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></div>
                <div style={fld}><label style={lbl}>Shift Code *</label><input style={inp} required value={form.code} onChange={e=>setForm(p=>({...p,code:e.target.value}))}/></div>
                <div style={fld}><label style={lbl}>Start Time</label><input type="time" style={inp} value={form.start_time} onChange={e=>setForm(p=>({...p,start_time:e.target.value}))}/></div>
                <div style={fld}><label style={lbl}>End Time</label><input type="time" style={inp} value={form.end_time} onChange={e=>setForm(p=>({...p,end_time:e.target.value}))}/></div>
                <div style={fld}><label style={lbl}>Working Hours</label><input type="number" step="0.5" style={inp} value={form.working_hours} onChange={e=>setForm(p=>({...p,working_hours:e.target.value}))}/></div>
                <div style={fld}><label style={lbl}>Late Grace (min)</label><input type="number" style={inp} value={form.grace_late} onChange={e=>setForm(p=>({...p,grace_late:e.target.value}))}/></div>
                <div style={{ ...fld, gridColumn:'1/-1', flexDirection:'row', alignItems:'center', gap:10 }}>
                  <input type="checkbox" id="night" checked={form.is_night} onChange={e=>setForm(p=>({...p,is_night:e.target.checked}))} style={{ width:16, height:16 }}/>
                  <label htmlFor="night" style={{ fontSize:13, fontWeight:600, color:'#0b1320', cursor:'pointer' }}>Night Shift</label>
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="button" onClick={()=>setShowModal(false)} style={{ flex:1, height:42, borderRadius:9, border:'1.5px solid #e6e9ef', background:'#fff', cursor:'pointer', fontSize:14, fontWeight:600 }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, height:42, borderRadius:9, border:'none', background:saving?'#9fb7b4':'#115e59', color:'#fff', cursor:saving?'not-allowed':'pointer', fontSize:14, fontWeight:700 }}>
                  {saving?'Saving...':editing?'Update Shift':'Create Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
