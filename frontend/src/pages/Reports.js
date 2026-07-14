import React, { useState, useEffect } from 'react';
import { FileText, Download, Search, Filter, RefreshCw, Calendar, Users, ClipboardList, Clock, LogIn, LogOut, QrCode } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API = '/api';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('hrms_token')}` });

const REPORTS = [
  { key:'daily-attendance',    label:'Daily Attendance',      icon:Calendar,     desc:'Who is present/absent today or any date' },
  { key:'attendance-summary',  label:'Attendance Summary',    icon:ClipboardList,desc:'Monthly present/absent/hours per employee' },
  { key:'employee-details',    label:'Employee Details',      icon:Users,        desc:'Full employee list with designation & DOJ' },
  { key:'log-records',         label:'Log Records',           icon:Clock,        desc:'Raw punch log from biometric devices' },
  { key:'leave-summary',       label:'Leave Summary',         icon:FileText,     desc:'Leave count per employee by type' },
  { key:'leave-entry',         label:'Leave Entry Report',    icon:LogIn,        desc:'Day-wise leave entries with remarks' },
  { key:'outdoor-entry',       label:'OutDoor Entry Report',  icon:LogOut,       desc:'Gate pass / outdoor entry records' },
  { key:'monthly-status',      label:'Monthly Status Report', icon:Calendar,     desc:'Detailed monthly attendance with summary' },
];

const COLS = {
  'daily-attendance':   ['emp_code','name','dept','status','first_in','last_out','punches'],
  'attendance-summary': ['emp_code','name','dept','present','absent','total_hours','ot_hours'],
  'employee-details':   ['emp_code','name','dept','designation','gender','phone','email','doj','status'],
  'log-records':        ['log_time','direction','device'],
  'leave-summary':      ['emp_code','name','dept','leave_type','days'],
  'leave-entry':        ['emp_code','name','dept','date','leave_type','duration','remarks'],
  'outdoor-entry':      ['emp_code','name','date','out_time','expected_return','pass_type','reason','status'],
  'monthly-status':     ['emp_code','name','date','day','status','first_in','last_out','duration','late_by','early_by','ot','shift'],
};

const HDR = {
  emp_code:'Code', name:'Name', dept:'Department', status:'Status',
  day:'Day', duration:'Duration', late_by:'Late By', early_by:'Early By', ot:'OT', shift:'Shift',
  first_in:'First In', last_out:'Last Out', punches:'Punches',
  present:'Present', absent:'Absent', total_hours:'Work Hours', ot_hours:'OT',
  designation:'Designation', gender:'Gender', phone:'Phone', email:'Email', doj:'DOJ',
  log_time:'Log Time', direction:'Direction', device:'Device',
  leave_type:'Leave Type', days:'Days', date:'Date', duration:'Duration', remarks:'Remarks',
  out_time:'Out Time', expected_return:'Return', pass_type:'Type', reason:'Reason',
};

const STATUS_COLOR = {
  Present:'#16a34a', Absent:'#dc2626', approved:'#16a34a',
  pending:'#d97706', rejected:'#dc2626', used:'#64748b',
};

export default function Reports() {
  const [active, setActive] = useState('daily-attendance');
  const [data, setData] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    att_date: new Date().toISOString().split('T')[0],
    from_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0],
    dept: '', emp_code: '', search: '', status: '',
  });

  useEffect(() => {
    fetch(`${API}/reports/departments`, { headers: auth() })
      .then(r => r.json()).then(d => setDepts(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (active === 'daily-attendance') params.append('att_date', filters.att_date);
      if (active === 'log-records') params.append('emp_code', filters.emp_code || '1');
      if (['attendance-summary','leave-summary','leave-entry','outdoor-entry','monthly-status'].includes(active)) {
        params.append('from_date', filters.from_date);
        params.append('to_date', filters.to_date);
      }
      if (filters.dept) params.append('dept', filters.dept);
      if (filters.emp_code && !['log-records'].includes(active)) params.append('emp_code', filters.emp_code);
      if (filters.search) params.append('search', filters.search);

      const r = await fetch(`${API}/reports/${active}?${params}`, { headers: auth() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Failed');
      
      if (active === 'monthly-status') {
        if (Array.isArray(d)) {
          setSummaryData({ is_multi: true, total_employees: d.length });
          let flattened = [];
          d.forEach(emp => {
            (emp.daily || []).forEach(day => {
              flattened.push({ emp_code: emp.emp_code, name: emp.name, ...day });
            });
          });
          setData(flattened);
        } else {
          setSummaryData(d);
          setData(d.daily || []);
        }
      } else {
        setSummaryData(null);
        setData(Array.isArray(d) ? d : []);
      }
    } catch (e) { setError(e.message); setData([]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [active]);

  const exportCSV = () => {
    const cols = COLS[active] || [];
    const header = cols.map(c => HDR[c] || c).join(',');
    const rows = data.map(row => cols.map(c => `"${String(row[c] || '').replace(/"/g,'""')}"`).join(','));
    const csv = [header, ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${active}_${filters.att_date || filters.from_date}.csv`;
    a.click();
  };

  const exportExcel = () => {
    const cols = COLS[active] || [];
    const exportData = data.map(row => {
      const obj = {};
      cols.forEach(c => obj[HDR[c] || c] = row[c]);
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${active}_${filters.att_date || filters.from_date}.xlsx`);
  };

  const exportPDF = () => {
    if (active === 'monthly-status' && summaryData && !summaryData.is_multi) {
      const doc = new jsPDF({ orientation: 'landscape' });
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text('Monthly Status Report (Detailed Work Duration)', doc.internal.pageSize.width / 2, 15, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`${filters.from_date} To ${filters.to_date}`, doc.internal.pageSize.width / 2, 22, { align: 'center' });
      
      doc.setFontSize(9);
      doc.text(`Company: EastCoast HRMS`, 14, 32);
      doc.text(`Printed On : ${new Date().toLocaleString()}`, doc.internal.pageSize.width - 14, 32, { align: 'right' });
      
      doc.setLineWidth(0.5);
      doc.line(14, 35, doc.internal.pageSize.width - 14, 35);
      
      doc.setFont("helvetica", "bold");
      doc.text(`Department:`, 14, 43);
      doc.setFont("helvetica", "normal");
      doc.text(`${summaryData.dept || '—'}`, 35, 43);
      
      doc.setFont("helvetica", "bold");
      doc.text(`Employee:`, 14, 51);
      doc.setFont("helvetica", "normal");
      doc.text(`${summaryData.emp_code} : ${summaryData.name || ''}`, 35, 51);
      
      const metricsText = `Total Work Duration: ${summaryData.total_duration} Hrs. Present: ${summaryData.present} Absent: ${summaryData.absent} WeeklyOff: ${summaryData.weekly_off} Holidays: ${summaryData.holidays} Leaves Taken: ${summaryData.on_leave}\nAverage Working Hrs: ${summaryData.avg_working_hrs}`;
      doc.text(metricsText, 90, 51);

      const dayHeaders = ['Days'];
      const statusRow = ['Status'];
      const inTimeRow = ['InTime'];
      const outTimeRow = ['OutTime'];
      const durRow = ['Duration'];
      const lateRow = ['Late By'];
      const earlyRow = ['Early By'];
      const otRow = ['OT'];
      const shiftRow = ['Shift'];

      data.forEach(d => {
        const dNum = new Date(d.date).getDate().toString().padStart(2, '0');
        const dDay = d.day.charAt(0);
        dayHeaders.push(`${dNum} ${dDay}`);
        
        statusRow.push(d.status || '');
        inTimeRow.push(d.first_in === '—' ? '' : (d.first_in || '').slice(11, 16));
        outTimeRow.push(d.last_out === '—' ? '' : (d.last_out || '').slice(11, 16));
        durRow.push(d.duration === '00:00' ? '' : d.duration);
        lateRow.push(d.late_by === '00:00' ? '' : d.late_by);
        earlyRow.push(d.early_by === '00:00' ? '' : d.early_by);
        otRow.push(d.ot === '00:00' ? '' : d.ot);
        
        let sName = d.shift || '';
        shiftRow.push(sName.substring(0, 8));
      });

      autoTable(doc, {
        startY: 62,
        head: [dayHeaders],
        body: [ statusRow, inTimeRow, outTimeRow, durRow, lateRow, earlyRow, otRow, shiftRow ],
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 1, halign: 'center', lineWidth: 0.1, lineColor: [150, 150, 150] },
        columnStyles: { 0: { fontStyle: 'bold', halign: 'left', cellWidth: 16 } },
        headStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold' },
        margin: { left: 10, right: 10 }
      });

      doc.save(`MonthlyStatus_${summaryData.emp_code}_${filters.from_date}.pdf`);
      return;
    }

    const doc = new jsPDF();
    const cols = COLS[active] || [];
    const tableColumn = cols.map(c => HDR[c] || c);
    const tableRows = data.map(row => cols.map(c => row[c] || ''));
    
    doc.setFontSize(16);
    doc.text(`EastCoast HRMS - ${report?.label || 'Report'}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [tableColumn],
      body: tableRows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [17, 94, 89] }
    });
    doc.save(`${active}_${filters.att_date || filters.from_date}.pdf`);
  };

  const report = REPORTS.find(r => r.key === active);
  const cols = COLS[active] || [];

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0b1320' }}>Reports</h1>
          <p style={{ color:'#64748b', fontSize:14, marginTop:2 }}>Live reports from eSSL biometric system</p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={load} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:9, border:'1px solid #e6e9ef', background:'#fff', cursor:'pointer', fontSize:13 }}>
            <RefreshCw size={14}/> Refresh
          </button>
          <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', padding: 4, borderRadius: 10 }}>
            <button onClick={exportCSV} disabled={!data.length} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:7, border:'none', background: data.length?'#fff':'transparent', color: data.length?'#0b1320':'#9ca3af', cursor: data.length?'pointer':'not-allowed', fontSize:12, fontWeight:600, boxShadow: data.length?'0 1px 2px rgba(0,0,0,0.05)':'none' }}>
              CSV
            </button>
            <button onClick={exportExcel} disabled={!data.length} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:7, border:'none', background: data.length?'#16a34a':'transparent', color: data.length?'#fff':'#9ca3af', cursor: data.length?'pointer':'not-allowed', fontSize:12, fontWeight:600, boxShadow: data.length?'0 1px 2px rgba(0,0,0,0.1)':'none' }}>
              Excel
            </button>
            <button onClick={exportPDF} disabled={!data.length} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:7, border:'none', background: data.length?'#dc2626':'transparent', color: data.length?'#fff':'#9ca3af', cursor: data.length?'pointer':'not-allowed', fontSize:12, fontWeight:600, boxShadow: data.length?'0 1px 2px rgba(0,0,0,0.1)':'none' }}>
              PDF
            </button>
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:20 }}>
        {/* Sidebar */}
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e6e9ef', padding:8, height:'fit-content' }}>
          {REPORTS.map(r => (
            <button key={r.key} onClick={() => { setActive(r.key); setData([]); setSummaryData(null); }} style={{
              display:'flex', alignItems:'center', gap:10, padding:'10px 12px', width:'100%',
              border:'none', borderRadius:9, cursor:'pointer', textAlign:'left',
              background: active===r.key ? '#eff6ff' : 'transparent',
              color: active===r.key ? '#1d4ed8' : '#374151',
              fontWeight: active===r.key ? 700 : 500, fontSize:13, fontFamily:'inherit',
              marginBottom:2,
            }}>
              <r.icon size={16} style={{ flexShrink:0 }}/> {r.label}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div>
          {/* Filters */}
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e6e9ef', padding:'16px 18px', marginBottom:16, display:'flex', flexWrap:'wrap', gap:12, alignItems:'flex-end' }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#0b1320', width:'100%' }}>
              {report?.label} <span style={{ fontWeight:400, color:'#64748b', fontSize:13 }}>— {report?.desc}</span>
            </div>

            {active === 'daily-attendance' && (
              <div style={fld}>
                <label style={lbl}>Date</label>
                <input type="date" value={filters.att_date} onChange={e=>setFilters(p=>({...p,att_date:e.target.value}))} style={inp}/>
              </div>
            )}

            {['attendance-summary','leave-summary','leave-entry','outdoor-entry','monthly-status'].includes(active) && <>
              <div style={fld}><label style={lbl}>From Date</label><input type="date" value={filters.from_date} onChange={e=>setFilters(p=>({...p,from_date:e.target.value}))} style={inp}/></div>
              <div style={fld}><label style={lbl}>To Date</label><input type="date" value={filters.to_date} onChange={e=>setFilters(p=>({...p,to_date:e.target.value}))} style={inp}/></div>
            </>}

            {['log-records', 'monthly-status'].includes(active) && (
              <div style={fld}><label style={lbl}>Employee Code {active === 'log-records' ? '*' : ''}</label><input placeholder="e.g. 1047" value={filters.emp_code} onChange={e=>setFilters(p=>({...p,emp_code:e.target.value}))} style={inp}/></div>
            )}

            {!['log-records', 'outdoor-entry'].includes(active) && (
              <div style={fld}>
                <label style={lbl}>Department</label>
                <select value={filters.dept} onChange={e=>setFilters(p=>({...p,dept:e.target.value}))} style={inp}>
                  <option value="">All Departments</option>
                  {depts.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}

            {['employee-details','leave-entry','attendance-summary'].includes(active) && (
              <div style={fld}><label style={lbl}>Search Name/Code</label><input placeholder="Search..." value={filters.search} onChange={e=>setFilters(p=>({...p,search:e.target.value}))} style={inp}/></div>
            )}

            <button onClick={load} style={{ height:36, padding:'0 16px', borderRadius:8, border:'none', background:'#115e59', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700, alignSelf:'flex-end' }}>
              <Filter size={14} style={{ marginRight:6 }}/>Apply
            </button>
          </div>

          {/* Results */}
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e6e9ef', overflow:'hidden' }}>
            <div style={{ padding:'12px 18px', borderBottom:'1px solid #e6e9ef', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight:700, fontSize:14 }}>{loading ? 'Loading...' : `${data.length} records`}</span>
              {data.length > 0 && <span style={{ fontSize:12, color:'#94a3b8' }}>Showing all {data.length} results</span>}
            </div>

            {error && <div style={{ padding:'16px 18px', color:'#dc2626', fontSize:13 }}>❌ {error}</div>}

            {loading ? (
              <div style={{ padding:60, textAlign:'center', color:'#94a3b8' }}>Loading from eSSL...</div>
            ) : data.length === 0 && !error ? (
              <div style={{ padding:60, textAlign:'center', color:'#94a3b8' }}>
                <FileText size={36} style={{ opacity:0.3, marginBottom:10 }}/>
                <div>No records found. Adjust filters and click Apply.</div>
              </div>
            ) : data.length > 0 && (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
                  <thead>
                    <tr style={{ background:'#f8fafc' }}>
                      {cols.map(c=>(
                        <th key={c} style={{ padding:'10px 14px', textAlign:'left', fontSize:11.5, fontWeight:700, color:'#64748b', borderBottom:'1px solid #e6e9ef', whiteSpace:'nowrap' }}>{HDR[c]||c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row,i)=>(
                      <tr key={i} style={{ background:i%2===0?'#fff':'#fafafa' }}>
                        {cols.map(c=>(
                          <td key={c} style={{ padding:'9px 14px', borderBottom:'1px solid #f1f5f9', fontSize:13, whiteSpace:'nowrap', verticalAlign:'middle' }}>
                            {c==='status' ? (
                              <span style={{ background:(STATUS_COLOR[row[c]]||'#94a3b8')+'18', color:STATUS_COLOR[row[c]]||'#64748b', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:700 }}>{row[c]}</span>
                            ) : c==='emp_code' ? (
                              <span style={{ fontFamily:'monospace', color:'#94a3b8', fontSize:12 }}>{row[c]}</span>
                            ) : c==='dept' ? (
                              row[c] ? <span style={{ background:'#eff6ff', color:'#1d4ed8', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600 }}>{row[c]}</span> : '—'
                            ) : (
                              <span style={{ color: row[c]==='—'||!row[c]?'#cbd5e1':'#0b1320' }}>{row[c]||'—'}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const fld = { display:'flex', flexDirection:'column', gap:4 };
const lbl = { fontSize:11, fontWeight:600, color:'#64748b' };
const inp = { height:36, padding:'0 10px', border:'1px solid #e6e9ef', borderRadius:8, fontSize:13, outline:'none', minWidth:140 };
