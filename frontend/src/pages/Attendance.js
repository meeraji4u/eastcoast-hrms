import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, CheckCircle, XCircle, AlertCircle, Download, Search } from 'lucide-react';
import { attendanceApi } from '../utils/api';
import useAuthStore from '../store/authStore';

const STATUS_STYLE = {
  P:  { bg:'#dcfce7', color:'#15803d', label:'Present' },
  A:  { bg:'#fee2e2', color:'#b91c1c', label:'Absent' },
  WO: { bg:'#fef3c7', color:'#b45309', label:'Week Off' },
  H:  { bg:'#dbeafe', color:'#1d4ed8', label:'Holiday' },
  L:  { bg:'#fce7f3', color:'#be185d', label:'Leave' },
};

export default function Attendance() {
  const { user } = useAuthStore();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [empCode, setEmpCode] = useState(user?.emp_code || '');
  const [searchCode, setSearchCode] = useState('');
  const [employees, setEmployees] = useState([]);
  const isAdmin = ['hr_admin','management','dept_head','it_admin'].includes(user?.role);

  useEffect(() => {
    if (isAdmin) {
      fetch('/api/admin/employees', { headers: { Authorization: `Bearer ${localStorage.getItem('hrms_token')}` } })
        .then(r => r.json())
        .then(d => {
          const list = Array.isArray(d) ? d : [];
          setEmployees(list);
          if (list.length > 0 && (!empCode || empCode === 'admin' || empCode === 'ADMIN001')) {
            setEmpCode(list[0].emp_code);
          }
        }).catch(()=>{});
    }
  }, [isAdmin]);

  const load = (code, y, m) => {
    setLoading(true);
    const fn = (isAdmin && code !== user?.emp_code)
      ? attendanceApi.getEmployeeAttendance(code, y, m)
      : attendanceApi.getMyAttendance(y, m);
    fn.then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  };

  useEffect(() => { load(empCode, year, month); }, [year, month, empCode]);

  const prevMonth = () => { if(month===1){setMonth(12);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if(month===12){setMonth(1);setYear(y=>y+1);}else setMonth(m=>m+1); };
  const monthName = new Date(year, month-1).toLocaleString('default', {month:'long', year:'numeric'});

  const downloadPDF = () => {
    const token = localStorage.getItem('hrms_token');
    const url = `/api/report/monthly-pdf?emp_code=${empCode}&year=${year}&month=${month}`;
    fetch(url, {headers:{Authorization:`Bearer ${token}`}})
      .then(r => r.blob()).then(b => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = `attendance_${empCode}_${year}_${month}.pdf`;
        a.click();
      }).catch(() => alert('PDF download failed'));
  };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:'#0b1320'}}>Attendance</h1>
          <p style={{color:'#64748b',fontSize:14,marginTop:2}}>Monthly punch log from eSSL biometric device</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {isAdmin && (
            <div style={{display:'flex',alignItems:'center',gap:8,background:'#fff',border:'1px solid #e6e9ef',borderRadius:9,padding:'6px 12px'}}>
              <Search size={14} color="#94a3b8"/>
              <input value={searchCode} onChange={e=>setSearchCode(e.target.value)}
                placeholder="Emp code..." style={{border:'none',outline:'none',fontSize:13,width:90}}
                onKeyDown={e=>{if(e.key==='Enter'){setEmpCode(searchCode.trim());}}}/>
              <button onClick={()=>setEmpCode(searchCode.trim())} style={{background:'#115e59',color:'#fff',border:'none',borderRadius:6,padding:'3px 10px',cursor:'pointer',fontSize:12,fontWeight:700}}>Go</button>
              <button onClick={()=>{setSearchCode('');setEmpCode(user?.emp_code||'');}} style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:11}}>My</button>
            </div>
          )}
          <button onClick={prevMonth} style={navBtn}><ChevronLeft size={16}/></button>
          <span style={{fontWeight:700,fontSize:15,minWidth:160,textAlign:'center',color:'#0b1320'}}>{monthName}</span>
          <button onClick={nextMonth} style={navBtn}><ChevronRight size={16}/></button>
          <button onClick={downloadPDF} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:9,border:'none',background:'#115e59',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:700}}>
            <Download size={14}/> PDF
          </button>
        </div>
      </div>

      {isAdmin && empCode !== user?.emp_code && (
        <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:9,padding:'10px 16px',marginBottom:16,fontSize:13,color:'#1d4ed8',fontWeight:600}}>
          Viewing: Employee {employees.find(e=>e.emp_code===empCode)?.name || empCode} — <button onClick={()=>{setSearchCode('');setEmpCode(user?.emp_code||'');}} style={{background:'none',border:'none',color:'#1d4ed8',cursor:'pointer',fontWeight:700,textDecoration:'underline'}}>Back to my attendance</button>
        </div>
      )}

      {loading ? (
        <div style={{textAlign:'center',padding:80,color:'#94a3b8'}}>Loading attendance from eSSL...</div>
      ) : !data ? (
        <div style={{background:'#fff',borderRadius:12,border:'1px solid #e6e9ef',padding:60,textAlign:'center',color:'#94a3b8'}}>
          <AlertCircle size={40} style={{marginBottom:12,opacity:0.4}}/>
          <div style={{fontSize:15,fontWeight:500}}>No attendance data</div>
          <div style={{fontSize:13,marginTop:4}}>Check eSSL connection or try a different period</div>
        </div>
      ) : (
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:14,marginBottom:24}}>
            {[
              {label:'Present',value:data.present,icon:CheckCircle,color:'#16a34a'},
              {label:'Absent',value:data.absent,icon:XCircle,color:'#dc2626'},
              {label:'Week Off',value:data.weekly_off,icon:AlertCircle,color:'#d97706'},
              {label:'Work Hours',value:data.total_duration,icon:Clock,color:'#115e59'},
              {label:'Avg/Day',value:data.avg_hrs_per_day,icon:Clock,color:'#7c3aed'},
            ].map(s=>(
              <div key={s.label} style={{background:'#fff',borderRadius:10,padding:'14px 16px',border:'1px solid #e6e9ef',display:'flex',alignItems:'center',gap:12}}>
                <s.icon size={20} color={s.color}/>
                <div>
                  <div style={{fontSize:18,fontWeight:800,color:'#0b1320'}}>{s.value??'—'}</div>
                  <div style={{fontSize:11,color:'#64748b'}}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e6e9ef',overflow:'hidden'}}>
            <div style={{padding:'14px 18px',borderBottom:'1px solid #e6e9ef',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:700,fontSize:14,color:'#0b1320'}}>Daily Log</span>
              <span style={{fontSize:12,color:'#94a3b8'}}>Emp: {empCode}</span>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:600}}>
                <thead>
                  <tr style={{background:'#f8fafc'}}>
                    {['Date','Day','Status','First In','Last Out','Duration','Punches'].map(h=>(
                      <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11.5,fontWeight:700,color:'#64748b',borderBottom:'1px solid #e6e9ef',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.daily||[]).map((d,i)=>{
                    const st = STATUS_STYLE[d.status]||STATUS_STYLE.A;
                    return (
                      <tr key={d.date} style={{background:i%2===0?'#fff':'#fafafa'}}>
                        <td style={td}>{d.date}</td>
                        <td style={{...td,color:'#64748b'}}>{d.day}</td>
                        <td style={td}><span style={{background:st.bg,color:st.color,padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700}}>{st.label}</span></td>
                        <td style={{...td,fontFamily:'monospace'}}>{d.first_in||'—'}</td>
                        <td style={{...td,fontFamily:'monospace'}}>{d.last_out||'—'}</td>
                        <td style={{...td,fontFamily:'monospace',fontWeight:600,color:d.status==='P'?'#115e59':'#94a3b8'}}>{d.duration||'00:00'}</td>
                        <td style={td}>{d.punch_count||'—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
const navBtn = {width:34,height:34,borderRadius:8,border:'1px solid #e6e9ef',background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'};
const td = {padding:'10px 14px',borderBottom:'1px solid #f1f5f9',fontSize:13,whiteSpace:'nowrap',verticalAlign:'middle'};
