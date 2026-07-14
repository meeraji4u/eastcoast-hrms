import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Users, RefreshCw, Trash2 } from 'lucide-react';
import useAuthStore from '../store/authStore';

const API = '/api';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('hrms_token')}` });
const fld = { display:'flex', flexDirection:'column', gap:5, marginBottom:14 };
const lbl = { fontSize:12, fontWeight:600, color:'#4b5566' };
const inp = { height:38, padding:'0 10px', border:'1.5px solid #e6e9ef', borderRadius:8, fontSize:13.5, outline:'none', fontFamily:'inherit' };

const SHIFT_COLORS = ['#115e59','#1d4ed8','#7c3aed','#dc2626','#d97706','#16a34a','#0891b2','#be185d'];

export default function Roster() {
  const { user } = useAuthStore();
  const canEdit = ['hr_admin','dept_head'].includes(user?.role);
  const [roster, setRoster] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoster, setSelectedRoster] = useState(new Set());
  const [showModal, setShowModal] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [mode, setMode] = useState('week');
  const [filters, setFilters] = useState({ from_date: new Date().toISOString().split('T')[0], to_date: '', dept:'' });
  const [form, setForm] = useState({ emp_code:'', shift_code:'', shift_name:'', roster_date: new Date().toISOString().split('T')[0], notes:'' });
  const [formEmpDetails, setFormEmpDetails] = useState(null);
  const [formCurrentShift, setFormCurrentShift] = useState(null);
  const [bulk, setBulk] = useState({ dept_name:'', search:'', shift_code:'', shift_name:'', from_date:'', to_date:'', notes:'' });
  const [bulkEmps, setBulkEmps] = useState([]);
  const [selectedEmps, setSelectedEmps] = useState([]);
  const [loadingEmps, setLoadingEmps] = useState(false);
  const [showWeekly, setShowWeekly] = useState(false);
  const [weekEmp, setWeekEmp] = useState('');
  const [weekStart, setWeekStart] = useState(new Date().toISOString().split('T')[0]);
  const [weekShifts, setWeekShifts] = useState({});
  const [weekEmpDetails, setWeekEmpDetails] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (form.emp_code && form.emp_code.length >= 2 && form.roster_date) {
      fetch(`/api/admin/employees`, { headers: auth() })
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d)) {
            const emp = d.find(e => e.emp_code.toLowerCase() === form.emp_code.toLowerCase());
            setFormEmpDetails(emp || null);
          }
        });
      
      fetch(`/api/roster/?emp_code=${form.emp_code}&from_date=${form.roster_date}&to_date=${form.roster_date}`, { headers: auth() })
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d) && d.length > 0) {
            setFormCurrentShift(d[0]);
          } else {
            setFormCurrentShift(null);
          }
        });
    } else {
      setFormEmpDetails(null);
      setFormCurrentShift(null);
    }
  }, [form.emp_code, form.roster_date]);

  useEffect(() => {
    if (weekEmp && weekEmp.length >= 2 && weekStart) {
      // Fetch employee info
      fetch(`/api/admin/employees`, { headers: auth() })
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d)) {
            const emp = d.find(e => e.emp_code.toLowerCase() === weekEmp.toLowerCase());
            setWeekEmpDetails(emp || null);
          }
        });
      
      // Fetch existing roster for the week
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 6);
      fetch(`/api/roster/?emp_code=${weekEmp}&from_date=${weekStart}&to_date=${end.toISOString().split('T')[0]}`, { headers: auth() })
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d)) {
            const existing = {};
            d.forEach(r => existing[r.roster_date] = r.shift_code);
            setWeekShifts(existing);
          }
        });
    } else {
      setWeekEmpDetails(null);
      setWeekShifts({});
    }
  }, [weekEmp, weekStart]);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v])=>v)));
    try {
      const [r, s, d] = await Promise.all([
        fetch(`${API}/roster/?${params}`, { headers: auth() }).then(r=>r.json()),
        fetch(`${API}/shifts/`, { headers: auth() }).then(r=>r.json()),
        fetch(`${API}/departments`, { headers: auth() }).then(r=>r.json()),
      ]);
      setRoster(Array.isArray(r)?r:[]);
      setShifts(Array.isArray(s)?s:[]);
      setDepts(Array.isArray(d)?d:[]);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const shiftColor = (code) => SHIFT_COLORS[Math.abs([...code].reduce((a,c)=>a+c.charCodeAt(0),0)) % SHIFT_COLORS.length];

  const handleAssign = async (e) => {
    e.preventDefault(); setSaving(true); setMsg('');
    const selectedShift = shifts.find(s=>s.code===form.shift_code);
    const payload = { ...form, shift_name: selectedShift?.name || form.shift_code };
    try {
      const r = await fetch(`${API}/roster/assign`, { method:'POST', headers:{...auth(),'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const d = await r.json();
      if(r.ok) { setMsg('✅ '+d.message); load(); setTimeout(()=>setShowModal(false),800); }
      else setMsg('❌ '+(d.detail||'Failed'));
    } catch { setMsg('❌ Error'); }
    setSaving(false);
  };

  const handleBulk = async (e) => {
    e.preventDefault(); setSaving(true); setMsg('');
    const selectedShift = shifts.find(s=>s.code===bulk.shift_code);
    const payload = { ...bulk, shift_name: selectedShift?.name || bulk.shift_code, emp_codes: selectedEmps };
    try {
      const r = await fetch(`${API}/roster/bulk-assign`, { method:'POST', headers:{...auth(),'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const d = await r.json();
      if(r.ok) { setMsg('✅ '+d.message); load(); setTimeout(()=>setShowBulk(false),1000); }
      else setMsg('❌ '+(d.detail||'Failed'));
    } catch { setMsg('❌ Error'); }
    setSaving(false);
  };

  const searchEmployees = async (dept, searchTerm) => {
    setLoadingEmps(true);
    try {
      const p = new URLSearchParams();
      if (dept) p.append('dept', dept);
      if (searchTerm) p.append('search', searchTerm);
      const r = await fetch(`/api/reports/employee-details?${p}`, { headers: auth() });
      const d = await r.json();
      setBulkEmps(Array.isArray(d) ? d : []);
    } catch {}
    setLoadingEmps(false);
  };

  const handleDeptChange = async (e) => {
    const dept = e.target.value;
    setBulk(p=>({...p, dept_name:dept}));
    setSelectedEmps([]);
    if (!dept && !bulk.search) { setBulkEmps([]); return; }
    await searchEmployees(dept, bulk.search);
  };

  const handleSearchChange = async (e) => {
    const s = e.target.value;
    setBulk(p=>({...p, search:s}));
    if (!bulk.dept_name && !s) { setBulkEmps([]); return; }
    await searchEmployees(bulk.dept_name, s);
  };

  const handleWeekly = async (e) => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      const start = new Date(weekStart);
      let count = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const shiftCode = weekShifts[dateStr];
        if (!shiftCode) continue;
        const selectedShift = shifts.find(s=>s.code===shiftCode);
        await fetch(`${API}/roster/assign`, { method:'POST', headers:{...auth(),'Content-Type':'application/json'},
          body: JSON.stringify({ emp_code: weekEmp, shift_code: shiftCode, shift_name: selectedShift?.name||shiftCode, roster_date: dateStr, notes:'' }) });
        count++;
      }
      setMsg(`✅ ${count} days assigned for ${weekEmp}`);
      load();
      setTimeout(()=>setShowWeekly(false),1200);
    } catch { setMsg('❌ Error'); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if(!window.confirm('Remove this roster entry?')) return;
    await fetch(`${API}/roster/${id}`, { method:'DELETE', headers: auth() });
    load();
  };

  // Group by date for calendar view
  const byDate = roster.reduce((acc,r)=>{ acc[r.roster_date]=(acc[r.roster_date]||[]); acc[r.roster_date].push(r); return acc; },{});
  const dates = Object.keys(byDate).sort();

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0b1320' }}>Duty Roster</h1>
          <p style={{ color:'#64748b', fontSize:14, marginTop:2 }}>{roster.length} roster entries</p>
        </div>
        {canEdit && (
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>{setMsg('');setWeekShifts({});setShowWeekly(true);}} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:9, border:'1px solid #7c3aed', background:'#fff', color:'#7c3aed', cursor:'pointer', fontSize:13, fontWeight:700 }}>
              <Calendar size={14}/> Weekly Assign
            </button>
            <button onClick={()=>{setMsg('');setShowBulk(true);}} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:9, border:'1px solid #115e59', background:'#fff', color:'#115e59', cursor:'pointer', fontSize:13, fontWeight:700 }}>
              <Users size={14}/> Bulk Assign
            </button>
            <button onClick={()=>{setMsg('');setShowModal(true);}} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:9, border:'none', background:'#115e59', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700 }}>
              <Plus size={15}/> Assign Single
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:12, marginBottom:20, background:'#fff', border:'1px solid #e6e9ef', borderRadius:12, padding:'14px 18px', flexWrap:'wrap', alignItems:'flex-end' }}>
        {[['from_date','From Date','date'],['to_date','To Date','date']].map(([k,label,type])=>(
          <div key={k} style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <label style={{ fontSize:11, fontWeight:600, color:'#64748b' }}>{label}</label>
            <input type={type} value={filters[k]} onChange={e=>setFilters(p=>({...p,[k]:e.target.value}))} style={{ height:36, padding:'0 10px', border:'1px solid #e6e9ef', borderRadius:8, fontSize:13, outline:'none' }}/>
          </div>
        ))}
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <label style={{ fontSize:11, fontWeight:600, color:'#64748b' }}>Department</label>
          <select value={filters.dept} onChange={e=>setFilters(p=>({...p,dept:e.target.value}))} style={{ height:36, padding:'0 10px', border:'1px solid #e6e9ef', borderRadius:8, fontSize:13, minWidth:160, outline:'none' }}>
            <option value="">All Departments</option>
            {depts.map(d=><option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </div>
        <button onClick={load} style={{ height:36, padding:'0 16px', borderRadius:8, border:'none', background:'#115e59', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700 }}>Apply</button>
      </div>

      {/* Roster table */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e6e9ef', overflow:'hidden' }}>
        {loading ? <div style={{ padding:60, textAlign:'center', color:'#94a3b8' }}>Loading roster...</div>
        : roster.length===0 ? <div style={{ padding:60, textAlign:'center', color:'#94a3b8' }}>
            <Calendar size={40} style={{ opacity:0.3, marginBottom:12 }}/>
            <div style={{ fontSize:15, fontWeight:500 }}>No roster entries found</div>
            {canEdit && <div style={{ fontSize:13, marginTop:4 }}>Use "Assign Single" or "Bulk Assign" to create roster</div>}
          </div>
        : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr style={{ background:'#f8fafc' }}>
              {['Date','Employee','Department','Shift','Notes',canEdit?'Actions':''].filter(Boolean).map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11.5, fontWeight:700, color:'#64748b', borderBottom:'1px solid #e6e9ef', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {roster.map((r,i)=>(
                <tr key={r.id} style={{ background:i%2===0?'#fff':'#fafafa' }}>
                  <td style={td}>{r.roster_date}</td>
                  <td style={td}><div style={{ fontWeight:600 }}>{r.emp_name}</div><div style={{ fontSize:11, color:'#94a3b8' }}>{r.emp_code}</div></td>
                  <td style={td}>{r.dept_name||'—'}</td>
                  <td style={td}>
                    <span style={{ background:shiftColor(r.shift_code||'X')+'18', color:shiftColor(r.shift_code||'X'), padding:'3px 10px', borderRadius:6, fontSize:11, fontWeight:700 }}>
                      {r.shift_code} · {r.shift_name}
                    </span>
                  </td>
                  <td style={{ ...td, color:'#64748b' }}>{r.notes||'—'}</td>
                  {canEdit && <td style={td}>
                    <button onClick={()=>handleDelete(r.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', padding:4 }}><Trash2 size={14}/></button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Assign Single Modal */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:32, width:460, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:22 }}>
              <h2 style={{ fontSize:18, fontWeight:800 }}>Assign Shift</h2>
              <button onClick={()=>setShowModal(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#94a3b8' }}>×</button>
            </div>
            {msg&&<div style={{ padding:'10px 14px', borderRadius:9, background:msg.startsWith('✅')?'#dcfce7':'#fee2e2', color:msg.startsWith('✅')?'#15803d':'#b91c1c', fontSize:13, marginBottom:16 }}>{msg}</div>}
            <form onSubmit={handleAssign}>
              <div style={fld}>
                <label style={lbl}>Employee Code *</label>
                <input style={inp} required placeholder="e.g. 1047" value={form.emp_code} onChange={e=>setForm(p=>({...p,emp_code:e.target.value}))}/>
                {formEmpDetails && <div style={{fontSize:11, color:'#16a34a', fontWeight:600}}>{formEmpDetails.name} · {formEmpDetails.dept_name || 'No Dept'}</div>}
                {formCurrentShift && <div style={{fontSize:11, color:'#d97706', fontWeight:600}}>Current Shift: {formCurrentShift.shift_name}</div>}
              </div>
              <div style={fld}><label style={lbl}>Date *</label><input type="date" style={inp} required value={form.roster_date} onChange={e=>setForm(p=>({...p,roster_date:e.target.value}))}/></div>
              <div style={fld}><label style={lbl}>Shift *</label>
                <select style={inp} required value={form.shift_code} onChange={e=>setForm(p=>({...p,shift_code:e.target.value}))}>
                  <option value="">Select shift</option>
                  {shifts.map(s=><option key={s.id} value={s.code}>{s.name} ({s.code})</option>)}
                </select>
              </div>
              <div style={fld}><label style={lbl}>Notes</label><input style={inp} placeholder="Optional" value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/></div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowModal(false)} style={{ flex:1, height:42, borderRadius:9, border:'1.5px solid #e6e9ef', background:'#fff', cursor:'pointer', fontSize:14, fontWeight:600 }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, height:42, borderRadius:9, border:'none', background:saving?'#9fb7b4':'#115e59', color:'#fff', cursor:saving?'not-allowed':'pointer', fontSize:14, fontWeight:700 }}>{saving?'Saving...':'Assign Shift'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Weekly Day-wise Assign Modal */}
      {showWeekly && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:32, width:520, maxHeight:'88vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div><h2 style={{ fontSize:18, fontWeight:800 }}>Weekly Day-wise Assign</h2><p style={{ fontSize:13, color:'#64748b', marginTop:2 }}>Pick a shift for each day of the week</p></div>
              <button onClick={()=>setShowWeekly(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#94a3b8' }}>×</button>
            </div>
            {msg&&<div style={{ padding:'10px 14px', borderRadius:9, background:msg.startsWith('✅')?'#dcfce7':'#fee2e2', color:msg.startsWith('✅')?'#15803d':'#b91c1c', fontSize:13, marginBottom:16 }}>{msg}</div>}
            <form onSubmit={handleWeekly}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <div style={fld}>
                  <label style={lbl}>Employee Code *</label>
                  <input style={inp} required placeholder="e.g. 1047" value={weekEmp} onChange={e=>setWeekEmp(e.target.value)}/>
                  {weekEmpDetails && <div style={{fontSize:11, color:'#16a34a', fontWeight:600}}>{weekEmpDetails.name} · {weekEmpDetails.dept_name || 'No Dept'}</div>}
                </div>
                <div style={fld}><label style={lbl}>Week Starting *</label><input type="date" style={inp} required value={weekStart} onChange={e=>setWeekStart(e.target.value)}/></div>
              </div>
              <div style={{ border:'1px solid #e6e9ef', borderRadius:10, overflow:'hidden', marginBottom:18 }}>
                {[0,1,2,3,4,5,6].map(i => {
                  const d = new Date(weekStart); d.setDate(d.getDate()+i);
                  const dateStr = d.toISOString().split('T')[0];
                  const dayName = d.toLocaleDateString('en-IN',{weekday:'short'});
                  return (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 14px', background:i%2===0?'#fff':'#f8fafc', borderBottom:i<6?'1px solid #f1f5f9':'none' }}>
                      <div style={{ width:90, fontSize:12.5 }}>
                        <div style={{ fontWeight:700 }}>{dayName}</div>
                        <div style={{ color:'#94a3b8', fontSize:11 }}>{dateStr.slice(5)}</div>
                      </div>
                      <select value={weekShifts[dateStr]||''} onChange={e=>setWeekShifts(p=>({...p,[dateStr]:e.target.value}))}
                        style={{ flex:1, height:34, padding:'0 10px', border:'1px solid #e6e9ef', borderRadius:8, fontSize:12.5, outline:'none' }}>
                        <option value="">— No assignment —</option>
                        {shifts.map(s=><option key={s.id} value={s.code}>{s.name} ({s.start_time}-{s.end_time})</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowWeekly(false)} style={{ flex:1, height:42, borderRadius:9, border:'1.5px solid #e6e9ef', background:'#fff', cursor:'pointer', fontSize:14, fontWeight:600 }}>Cancel</button>
                <button type="submit" disabled={saving||!weekEmp} style={{ flex:2, height:42, borderRadius:9, border:'none', background:(saving||!weekEmp)?'#9fb7b4':'#7c3aed', color:'#fff', cursor:(saving||!weekEmp)?'not-allowed':'pointer', fontSize:14, fontWeight:700 }}>{saving?'Assigning...':'Assign Week'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Assign Modal */}
      {showBulk && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:32, width:480, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:22 }}>
              <div><h2 style={{ fontSize:18, fontWeight:800 }}>Bulk Department Assign</h2><p style={{ fontSize:13, color:'#64748b', marginTop:2 }}>Assign one shift to all employees in a department</p></div>
              <button onClick={()=>setShowBulk(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#94a3b8' }}>×</button>
            </div>
            {msg&&<div style={{ padding:'10px 14px', borderRadius:9, background:msg.startsWith('✅')?'#dcfce7':'#fee2e2', color:msg.startsWith('✅')?'#15803d':'#b91c1c', fontSize:13, marginBottom:16 }}>{msg}</div>}
            <form onSubmit={handleBulk}>
              <div style={fld}><label style={lbl}>Department (Optional filter)</label>
                <select style={inp} value={bulk.dept_name} onChange={handleDeptChange}>
                  <option value="">All departments</option>
                  {depts.map(d=><option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>

              <div style={fld}><label style={lbl}>Search Employee (Name or Code)</label>
                <input style={inp} placeholder="Search..." value={bulk.search} onChange={handleSearchChange} />
              </div>
              
              {(bulk.dept_name || bulk.search || bulkEmps.length > 0) && (
                <div style={{...fld, border:'1px solid #e6e9ef', borderRadius:8, padding:10, maxHeight:140, overflowY:'auto'}}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <label style={lbl}>Select Employees (Optional)</label>
                    <label style={{fontSize:11, color:'#115e59', cursor:'pointer'}} onClick={() => setSelectedEmps(bulkEmps.length === selectedEmps.length ? [] : bulkEmps.map(e=>e.emp_code))}>
                      {bulkEmps.length > 0 && selectedEmps.length === bulkEmps.length ? 'Deselect All' : 'Select All'}
                    </label>
                  </div>
                  {loadingEmps ? <div style={{fontSize:12, color:'#94a3b8'}}>Loading...</div> : bulkEmps.length===0 ? <div style={{fontSize:12, color:'#94a3b8'}}>No employees found</div> : (
                    <div style={{display:'flex', flexDirection:'column', gap:6}}>
                      {bulkEmps.map(emp => (
                        <label key={emp.emp_code} style={{display:'flex', alignItems:'center', gap:8, fontSize:12.5}}>
                          <input type="checkbox" checked={selectedEmps.includes(emp.emp_code)} onChange={(e) => {
                            if (e.target.checked) setSelectedEmps(p=>[...p, emp.emp_code]);
                            else setSelectedEmps(p=>p.filter(id=>id!==emp.emp_code));
                          }} />
                          {emp.name} ({emp.emp_code})
                        </label>
                      ))}
                    </div>
                  )}
                  <div style={{fontSize:11, color:'#64748b', marginTop:8}}>* If none selected, it applies to all employees in the department.</div>
                </div>
              )}
              <div style={fld}><label style={lbl}>Shift *</label>
                <select style={inp} required value={bulk.shift_code} onChange={e=>setBulk(p=>({...p,shift_code:e.target.value}))}>
                  <option value="">Select shift</option>
                  {shifts.map(s=><option key={s.id} value={s.code}>{s.name} ({s.code})</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={fld}><label style={lbl}>From Date *</label><input type="date" style={inp} required value={bulk.from_date} onChange={e=>setBulk(p=>({...p,from_date:e.target.value}))}/></div>
                <div style={fld}><label style={lbl}>To Date *</label><input type="date" style={inp} required value={bulk.to_date} onChange={e=>setBulk(p=>({...p,to_date:e.target.value}))}/></div>
              </div>
              <div style={fld}><label style={lbl}>Notes</label><input style={inp} placeholder="Optional" value={bulk.notes} onChange={e=>setBulk(p=>({...p,notes:e.target.value}))}/></div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowBulk(false)} style={{ flex:1, height:42, borderRadius:9, border:'1.5px solid #e6e9ef', background:'#fff', cursor:'pointer', fontSize:14, fontWeight:600 }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, height:42, borderRadius:9, border:'none', background:saving?'#9fb7b4':'#115e59', color:'#fff', cursor:saving?'not-allowed':'pointer', fontSize:14, fontWeight:700 }}>{saving?'Assigning...':'Bulk Assign Shifts'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const td = { padding:'10px 14px', borderBottom:'1px solid #f1f5f9', fontSize:13, whiteSpace:'nowrap', verticalAlign:'middle' };
