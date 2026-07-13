import React, { useState, useEffect, useRef } from 'react';
import { Plus, CheckCircle, XCircle, Clock, QrCode, Scan } from 'lucide-react';
import useAuthStore from '../store/authStore';

const API = '/api';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('hrms_token')}` });
const fld = { display:'flex', flexDirection:'column', gap:5, marginBottom:14 };
const lbl = { fontSize:12, fontWeight:600, color:'#4b5566' };
const inp = { height:38, padding:'0 10px', border:'1.5px solid #e6e9ef', borderRadius:8, fontSize:13.5, outline:'none', fontFamily:'inherit' };

const STATUS = {
  pending:  { bg:'#fef3c7', color:'#b45309', label:'Pending' },
  approved: { bg:'#dcfce7', color:'#15803d', label:'Approved' },
  rejected: { bg:'#fee2e2', color:'#b91c1c', label:'Rejected' },
  used:     { bg:'#f1f5f9', color:'#64748b', label:'Used' },
};

function QRModal({ token, onClose }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin+'/api/gatepass/verify/'+token)}`;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'#fff', borderRadius:16, padding:32, width:320, textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ fontWeight:800, fontSize:18, marginBottom:4 }}>Gate Pass QR Code</div>
        <p style={{ fontSize:13, color:'#64748b', marginBottom:20 }}>Show this to security at exit</p>
        <img src={qrUrl} alt="QR Code" style={{ width:200, height:200, borderRadius:12, border:'1px solid #e6e9ef' }}/>
        <p style={{ fontSize:11, color:'#94a3b8', marginTop:12, wordBreak:'break-all' }}>Token: {token?.slice(0,20)}...</p>
        <button onClick={onClose} style={{ marginTop:20, width:'100%', height:42, borderRadius:9, border:'none', background:'#115e59', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:14 }}>Close</button>
      </div>
    </div>
  );
}

export default function GatePass() {
  const { user } = useAuthStore();
  const isApprover = ['hr_admin','dept_head'].includes(user?.role);
  const [tab, setTab] = useState(isApprover ? 'pending' : 'my');
  const [myPasses, setMyPasses] = useState([]);
  const [pending, setPending] = useState([]);
  const [allPasses, setAllPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showQR, setShowQR] = useState(null);
  const [showReject, setShowReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [form, setForm] = useState({ reason:'', pass_date: new Date().toISOString().split('T')[0], out_time:'', expected_return:'', pass_type:'personal' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [scanResult, setScanResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [my, pend, all] = await Promise.all([
        fetch(`${API}/gatepass/my`, { headers: auth() }).then(r=>r.json()),
        isApprover ? fetch(`${API}/gatepass/pending`, { headers: auth() }).then(r=>r.json()) : Promise.resolve([]),
        isApprover ? fetch(`${API}/gatepass/all`, { headers: auth() }).then(r=>r.json()) : Promise.resolve([]),
      ]);
      setMyPasses(Array.isArray(my)?my:[]);
      setPending(Array.isArray(pend)?pend:[]);
      setAllPasses(Array.isArray(all)?all:[]);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleApply = async (e) => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      const r = await fetch(`${API}/gatepass/apply`, { method:'POST', headers:{...auth(),'Content-Type':'application/json'}, body:JSON.stringify(form) });
      const d = await r.json();
      if(r.ok) { setMsg('✅ Gate pass applied'); load(); setTimeout(()=>setShowModal(false),1000); }
      else setMsg('❌ '+(d.detail||'Failed'));
    } catch { setMsg('❌ Error'); }
    setSaving(false);
  };

  const handleApprove = async (id) => {
    await fetch(`${API}/gatepass/${id}/approve`, { method:'POST', headers:{...auth(),'Content-Type':'application/json'}, body:JSON.stringify({remarks:''}) });
    load();
  };

  const handleReject = async () => {
    await fetch(`${API}/gatepass/${showReject}/reject`, { method:'POST', headers:{...auth(),'Content-Type':'application/json'}, body:JSON.stringify({reason:rejectReason}) });
    setShowReject(null); setRejectReason(''); load();
  };

  const handleScan = async () => {
    if (!scanInput.trim()) return;
    try {
      const token = scanInput.includes('/') ? scanInput.split('/').pop() : scanInput;
      const r = await fetch(`${API}/gatepass/verify/${token}`, { headers: auth() });
      setScanResult(await r.json());
    } catch { setScanResult({valid:false,message:'Error verifying'}); }
  };

  const displayList = tab==='pending' ? pending : tab==='all' ? allPasses : myPasses;

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0b1320' }}>Gate Pass</h1>
          <p style={{ color:'#64748b', fontSize:14, marginTop:2 }}>QR-based exit pass system</p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          {isApprover && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', background:'#fff', border:'1px solid #e6e9ef', borderRadius:9 }}>
              <Scan size={14} color="#115e59"/>
              <input value={scanInput} onChange={e=>setScanInput(e.target.value)} placeholder="Scan/enter QR token..." style={{ border:'none', outline:'none', fontSize:13, width:160 }} onKeyDown={e=>e.key==='Enter'&&handleScan()}/>
              <button onClick={handleScan} style={{ background:'#115e59', color:'#fff', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12, fontWeight:700 }}>Verify</button>
            </div>
          )}
          <button onClick={()=>{setMsg('');setShowModal(true);}} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:9, border:'none', background:'#115e59', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700 }}>
            <Plus size={15}/> Apply Gate Pass
          </button>
        </div>
      </div>

      {scanResult && (
        <div style={{ padding:'16px 20px', borderRadius:12, marginBottom:20, background:scanResult.valid?'#dcfce7':'#fee2e2', border:`1px solid ${scanResult.valid?'#86efac':'#fca5a5'}` }}>
          <div style={{ fontWeight:700, fontSize:15, color:scanResult.valid?'#15803d':'#b91c1c' }}>
            {scanResult.valid?'✅ Valid Gate Pass':'❌ Invalid Gate Pass'} — {scanResult.message}
          </div>
          {scanResult.valid && <div style={{ fontSize:13, marginTop:6, color:'#374151' }}>
            {scanResult.emp_name} ({scanResult.emp_code}) · Out: {scanResult.out_time} · Return: {scanResult.expected_return} · {scanResult.reason}
          </div>}
          <button onClick={()=>{setScanResult(null);setScanInput('');}} style={{ marginTop:8, background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#64748b', textDecoration:'underline' }}>Clear</button>
        </div>
      )}

      {isApprover && (
        <div style={{ display:'flex', gap:4, background:'#f1f5f9', padding:4, borderRadius:10, width:'fit-content', marginBottom:20 }}>
          {[['pending',`Pending (${pending.length})`],['all','All Passes'],['my','My Passes']].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{ padding:'7px 16px', borderRadius:7, border:'none', cursor:'pointer', fontSize:13, fontWeight:tab===k?700:500, background:tab===k?'#fff':'transparent', color:tab===k?'#0b1320':'#64748b', boxShadow:tab===k?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>{l}</button>
          ))}
        </div>
      )}

      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e6e9ef', overflow:'hidden' }}>
        {loading ? <div style={{ padding:60, textAlign:'center', color:'#94a3b8' }}>Loading...</div>
        : displayList.length===0 ? <div style={{ padding:60, textAlign:'center', color:'#94a3b8' }}><QrCode size={36} style={{ opacity:0.3, marginBottom:10 }}/><div style={{ fontSize:14, fontWeight:500 }}>No gate passes found</div></div>
        : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr style={{ background:'#f8fafc' }}>
              {(isApprover?['Employee','Date','Out','Return','Type','Reason','Status','Actions']:['Date','Out','Return','Type','Reason','Status','QR']).map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11.5, fontWeight:700, color:'#64748b', borderBottom:'1px solid #e6e9ef', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {displayList.map((gp,i)=>{
                const st = STATUS[gp.status]||STATUS.pending;
                return <tr key={gp.id} style={{ background:i%2===0?'#fff':'#fafafa' }}>
                  {isApprover && <td style={td}><div style={{ fontWeight:600 }}>{gp.emp_name}</div><div style={{ fontSize:11, color:'#94a3b8' }}>{gp.emp_code}</div></td>}
                  <td style={td}>{gp.pass_date}</td>
                  <td style={{ ...td, fontFamily:'monospace', fontWeight:600 }}>{gp.out_time}</td>
                  <td style={{ ...td, fontFamily:'monospace' }}>{gp.expected_return}</td>
                  <td style={td}><span style={{ background:'#f1f5f9', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600, textTransform:'capitalize' }}>{gp.pass_type}</span></td>
                  <td style={{ ...td, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis' }}>{gp.reason}</td>
                  <td style={td}><span style={{ background:st.bg, color:st.color, padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:700 }}>{st.label}</span></td>
                  <td style={td}>
                    {isApprover && gp.status==='pending' ? (
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>handleApprove(gp.id)} style={{ ...abtn, background:'#dcfce7', color:'#15803d' }}>Approve</button>
                        <button onClick={()=>setShowReject(gp.id)} style={{ ...abtn, background:'#fee2e2', color:'#b91c1c' }}>Reject</button>
                      </div>
                    ) : gp.status==='approved' && gp.qr_token ? (
                      <button onClick={()=>setShowQR(gp.qr_token)} style={{ ...abtn, background:'#eff6ff', color:'#1d4ed8', display:'flex', alignItems:'center', gap:4 }}><QrCode size={12}/>View QR</button>
                    ) : '—'}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:32, width:460, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:22 }}>
              <h2 style={{ fontSize:18, fontWeight:800 }}>Apply Gate Pass</h2>
              <button onClick={()=>setShowModal(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#94a3b8' }}>×</button>
            </div>
            {msg && <div style={{ padding:'10px 14px', borderRadius:9, background:msg.startsWith('✅')?'#dcfce7':'#fee2e2', color:msg.startsWith('✅')?'#15803d':'#b91c1c', fontSize:13, marginBottom:16 }}>{msg}</div>}
            <form onSubmit={handleApply}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div style={fld}><label style={lbl}>Date *</label><input type="date" style={inp} required value={form.pass_date} onChange={e=>setForm(p=>({...p,pass_date:e.target.value}))}/></div>
                <div style={fld}><label style={lbl}>Pass Type</label>
                  <select style={inp} value={form.pass_type} onChange={e=>setForm(p=>({...p,pass_type:e.target.value}))}>
                    <option value="personal">Personal</option>
                    <option value="official">Official</option>
                    <option value="medical">Medical</option>
                  </select>
                </div>
                <div style={fld}><label style={lbl}>Out Time *</label><input type="time" style={inp} required value={form.out_time} onChange={e=>setForm(p=>({...p,out_time:e.target.value}))}/></div>
                <div style={fld}><label style={lbl}>Expected Return *</label><input type="time" style={inp} required value={form.expected_return} onChange={e=>setForm(p=>({...p,expected_return:e.target.value}))}/></div>
                <div style={{ ...fld, gridColumn:'1/-1' }}><label style={lbl}>Reason *</label><textarea required value={form.reason} onChange={e=>setForm(p=>({...p,reason:e.target.value}))} rows={3} style={{ ...inp, height:'auto', padding:'8px 10px', resize:'vertical' }}/></div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:8 }}>
                <button type="button" onClick={()=>setShowModal(false)} style={{ flex:1, height:42, borderRadius:9, border:'1.5px solid #e6e9ef', background:'#fff', cursor:'pointer', fontSize:14, fontWeight:600 }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, height:42, borderRadius:9, border:'none', background:saving?'#9fb7b4':'#115e59', color:'#fff', cursor:saving?'not-allowed':'pointer', fontSize:14, fontWeight:700 }}>{saving?'Submitting...':'Submit Gate Pass'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQR && <QRModal token={showQR} onClose={()=>setShowQR(null)}/>}

      {showReject && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:380, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontWeight:800, marginBottom:14 }}>Reject Gate Pass</h3>
            <textarea value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Reason for rejection..." rows={3} style={{ width:'100%', border:'1.5px solid #e6e9ef', borderRadius:8, padding:'8px 10px', fontSize:13.5, resize:'vertical', outline:'none', boxSizing:'border-box' }}/>
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button onClick={()=>setShowReject(null)} style={{ flex:1, height:40, borderRadius:8, border:'1px solid #e6e9ef', background:'#fff', cursor:'pointer' }}>Cancel</button>
              <button onClick={handleReject} style={{ flex:1, height:40, borderRadius:8, border:'none', background:'#dc2626', color:'#fff', cursor:'pointer', fontWeight:700 }}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const td = { padding:'10px 14px', borderBottom:'1px solid #f1f5f9', fontSize:13, whiteSpace:'nowrap', verticalAlign:'middle' };
const abtn = { fontSize:11, padding:'4px 10px', borderRadius:6, border:'none', cursor:'pointer', fontWeight:700 };
