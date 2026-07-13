import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Monitor, Activity, Plus } from 'lucide-react';

const API = '/api';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('hrms_token')}` });

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [summary, setSummary] = useState({ total:0, online:0, offline:0 });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [newDevice, setNewDevice] = useState({ name:'', ip:'', location:'' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [devs, summ] = await Promise.all([
        fetch(`${API}/devices/`, { headers: auth() }).then(r=>r.json()),
        fetch(`${API}/devices/summary`, { headers: auth() }).then(r=>r.json()),
      ]);
      setDevices(Array.isArray(devs)?devs:[]);
      setSummary(summ || { total:0, online:0, offline:0 });
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API}/devices/`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify(newDevice)
      });
      if (res.ok) {
        setShowModal(false);
        setNewDevice({name:'', ip:'', location:''});
        load();
      } else {
        alert("Failed to add device");
      }
    } catch (err) {
      alert("Error adding device");
    }
    setSaving(false);
  };

  const filteredDevices = devices.filter(d => {
    if (filter === 'online') return d.is_online;
    if (filter === 'offline') return !d.is_online;
    return true;
  });

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0b1320' }}>Device Status</h1>
          <p style={{ color:'#64748b', fontSize:14, marginTop:2 }}>eSSL biometric device monitoring · Auto-refreshes every 60s</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:12, color:'#94a3b8' }}>Last: {lastRefresh.toLocaleTimeString()}</span>
          <button onClick={load} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:9, border:'1px solid #e6e9ef', background:'#fff', cursor:'pointer', fontSize:13 }}>
            <RefreshCw size={14}/> Refresh
          </button>
          <button onClick={() => setShowModal(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:9, border:'none', background:'#115e59', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>
            <Plus size={16}/> Add Device
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        {[
          { label:'Total Devices', value:summary.total, icon:Monitor, color:'#115e59' },
          { label:'Online', value:summary.online, icon:Wifi, color:'#16a34a' },
          { label:'Offline', value:summary.offline, icon:WifiOff, color:'#dc2626' },
        ].map(s=>(
          <div key={s.label} style={{ background:'#fff', borderRadius:12, padding:'20px 22px', border:'1px solid #e6e9ef', display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ width:44, height:44, borderRadius:11, background:s.color+'18', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <s.icon size={20} color={s.color}/>
            </div>
            <div>
              <div style={{ fontSize:24, fontWeight:800, color:'#0b1320' }}>{s.value}</div>
              <div style={{ fontSize:12, color:'#64748b' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        {['all','online','offline'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:600, border:filter===f?'1px solid #115e59':'1px solid #e6e9ef', background:filter===f?'#115e59':'#fff', color:filter===f?'#fff':'#64748b', cursor:'pointer', textTransform:'capitalize' }}>
            {f}
          </button>
        ))}
      </div>

      {/* Device list */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e6e9ef', overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:60, textAlign:'center', color:'#94a3b8' }}>
            <Activity size={32} style={{ opacity:0.3, marginBottom:10 }}/>
            <div>Loading device status from eSSL...</div>
          </div>
        ) : devices.length === 0 ? (
          <div style={{ padding:60, textAlign:'center', color:'#94a3b8' }}>
            <Monitor size={40} style={{ opacity:0.3, marginBottom:12 }}/>
            <div style={{ fontSize:15, fontWeight:500 }}>No devices found</div>
            <div style={{ fontSize:13, marginTop:4 }}>Check eSSL Devices table in etimetracklite1</div>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#f8fafc' }}>
                {['Status','Device Name','Type','IP Address','Port','Location','Today Logs','Last Connected'].map(h=>(
                  <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:11.5, fontWeight:700, color:'#64748b', borderBottom:'1px solid #e6e9ef', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map((d,i)=>(
                <tr key={d.device_id || i} style={{ background:i%2===0?'#fff':'#fafafa' }}>
                  <td style={td}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:10, height:10, borderRadius:'50%', background:d.is_online?'#4ade80':'#f87171', boxShadow:d.is_online?'0 0 6px #4ade80':'none' }}/>
                      <span style={{ fontSize:12, fontWeight:700, color:d.is_online?'#15803d':'#dc2626' }}>{d.is_online?'Online':'Offline'}</span>
                    </div>
                  </td>
                  <td style={{ ...td, fontWeight:600 }}>{d.name}</td>
                  <td style={td}>{d.type}</td>
                  <td style={{ ...td, fontFamily:'monospace', fontSize:12 }}>{d.ip}</td>
                  <td style={{ ...td, fontFamily:'monospace', fontSize:12 }}>{d.port}</td>
                  <td style={td}>{d.location}</td>
                  <td style={td}>
                    <span style={{ background:'#eff6ff', color:'#1d4ed8', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:700 }}>{d.today_logs}</span>
                  </td>
                  <td style={{ ...td, fontSize:12, color:'#64748b' }}>{d.last_connected || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}>
          <div style={{ background:'#fff', padding:24, borderRadius:12, width:400 }}>
            <div style={{ fontSize:18, fontWeight:700, marginBottom:20 }}>Add eSSL Device</div>
            <form onSubmit={handleAdd}>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#4b5566', marginBottom:6 }}>Device Name *</label>
                  <input required value={newDevice.name} onChange={e=>setNewDevice({...newDevice, name:e.target.value})} style={{ width:'100%', height:38, padding:'0 10px', border:'1.5px solid #e6e9ef', borderRadius:8, fontSize:13 }} placeholder="e.g. Main Gate" />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#4b5566', marginBottom:6 }}>IP Address *</label>
                  <input required value={newDevice.ip} onChange={e=>setNewDevice({...newDevice, ip:e.target.value})} style={{ width:'100%', height:38, padding:'0 10px', border:'1.5px solid #e6e9ef', borderRadius:8, fontSize:13 }} placeholder="192.168.1.100" />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#4b5566', marginBottom:6 }}>Location</label>
                  <input value={newDevice.location} onChange={e=>setNewDevice({...newDevice, location:e.target.value})} style={{ width:'100%', height:38, padding:'0 10px', border:'1.5px solid #e6e9ef', borderRadius:8, fontSize:13 }} placeholder="Optional" />
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:24 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #e6e9ef', background:'#fff', cursor:'pointer', fontSize:13 }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding:'8px 16px', borderRadius:8, border:'none', background:'#115e59', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                  {saving ? 'Saving...' : 'Add Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const td = { padding:'10px 14px', borderBottom:'1px solid #f1f5f9', fontSize:13, whiteSpace:'nowrap', verticalAlign:'middle' };
