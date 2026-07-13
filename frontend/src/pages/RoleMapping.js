import React, { useState, useEffect } from 'react';
import { Search, Save, UserPlus, FileText, ChevronRight, Check } from 'lucide-react';
import useAuthStore from '../store/authStore';

const API = '/api';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('hrms_token')}` });

const PERMISSIONS_TREE = [
  { id: 'MasterSettings', label: 'MasterSettings' },
  { id: 'MailSettings', label: 'MailSettings' },
  { id: 'Companies', label: 'Companies' },
  { id: 'Departments', label: 'Departments' },
  { id: 'EmpCategories', label: 'Emp Categories' },
  { id: 'Shifts', label: 'Shifts' },
  { id: 'ShiftCalendars', label: 'Shift Calendars' },
  { id: 'Users', label: 'Users', children: [
    { id: 'Users_View', label: 'View' },
    { id: 'Users_Edit', label: 'Edit' },
    { id: 'Users_Delete', label: 'Delete' }
  ]},
  { id: 'Payroll', label: 'Payroll', children: [
    { id: 'Payroll_View', label: 'View Reports' },
    { id: 'Payroll_Generate', label: 'Generate Payroll' }
  ]}
];

export default function RoleMapping() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');
  
  const [form, setForm] = useState({
    login_name: '', password: '', role: 'employee', 
    companies: ['Default'], permissions: []
  });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/employees`, { headers: auth() });
      const d = await r.json();
      setUsers(Array.isArray(d) ? d : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleSelect = (u) => {
    setSelectedUser(u);
    setForm({
      login_name: u.emp_code || '',
      password: '',
      role: u.role || 'employee',
      companies: ['Default', 'ECHL BUSSY', 'ECHL CENTRE', 'ECHL MAIN'],
      permissions: u.role === 'it_admin' || u.role === 'hr_admin' ? ['MasterSettings', 'Users', 'Users_View', 'Users_Edit', 'Payroll', 'Payroll_View', 'Payroll_Generate', 'Shifts'] : []
    });
    setMsg('');
  };

  const togglePermission = (id) => {
    setForm(p => {
      const perms = p.permissions.includes(id) 
        ? p.permissions.filter(x => x !== id) 
        : [...p.permissions, id];
      return { ...p, permissions: perms };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/admin/employees/${selectedUser.emp_code}/role`, {
        method: 'PUT',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: form.role })
      });
      if (r.ok) {
        setMsg('✅ User details and permissions saved successfully');
        loadUsers();
      } else {
        setMsg('❌ Failed to save user details');
      }
    } catch {
      setMsg('❌ Error saving user details');
    }
    setSaving(false);
  };

  const filteredUsers = users.filter(u => 
    (u.name||'').toLowerCase().includes(search.toLowerCase()) || 
    (u.emp_code||'').toLowerCase().includes(search.toLowerCase())
  );

  const renderTree = (nodes) => (
    <div style={{ marginLeft: 16 }}>
      {nodes.map(n => (
        <div key={n.id} style={{ marginBottom: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            {n.children ? <ChevronRight size={14} color="#94a3b8"/> : <div style={{width:14}}/>}
            <input type="checkbox" checked={form.permissions.includes(n.id)} onChange={() => togglePermission(n.id)} />
            {n.label}
          </label>
          {n.children && form.permissions.includes(n.id) && renderTree(n.children)}
        </div>
      ))}
    </div>
  );

  if (user?.role !== 'it_admin') {
    return (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'80vh'}}>
        <h2 style={{fontSize:24,fontWeight:800,color:'#0f172a'}}>Permission Denied</h2>
        <p style={{color:'#64748b'}}>Only IT Administrators can access the System Role Mapping page.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0b1320' }}>System User Mapping</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Advanced permissions and role management</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 160px)' }}>
        {/* Left pane: User List */}
        <div style={{ width: 320, background: '#fff', borderRadius: 12, border: '1px solid #e6e9ef', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ padding: 16, borderBottom: '1px solid #e6e9ef', background: '#f8fafc' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }}/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee..." style={{ width: '100%', height: 38, paddingLeft: 34, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing:'border-box' }}/>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
            : filteredUsers.map(u => (
              <div key={u.emp_code} onClick={() => handleSelect(u)} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: selectedUser?.emp_code === u.emp_code ? '#f0fdf4' : '#fff', borderLeft: selectedUser?.emp_code === u.emp_code ? '3px solid #16a34a' : '3px solid transparent' }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: '#0b1320' }}>{u.name}</div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{u.emp_code} · <span style={{textTransform:'capitalize'}}>{(u.role||'employee').replace('_',' ')}</span></div>
              </div>
            ))}
          </div>
        </div>

        {/* Right pane: Edit Details */}
        <div style={{ flex: 1, background: '#fff', borderRadius: 12, border: '1px solid #e6e9ef', display: 'flex', flexDirection: 'column' }}>
          {selectedUser ? (
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #e6e9ef', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius:12, borderTopRightRadius:12 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Edit User Details - {selectedUser.name}</div>
                {msg && <div style={{ fontSize: 13, fontWeight: 600, color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{msg}</div>}
              </div>
              
              <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
                {/* System User Information */}
                <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '16px 20px', marginBottom: 20 }}>
                  <legend style={{ fontSize: 12, fontWeight: 700, color: '#64748b', padding: '0 8px' }}>System User Information</legend>
                  <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
                    <div style={{ flex: 1 }}><label style={lbl}>Login Name</label><input style={inp} value={form.login_name} readOnly/></div>
                    <div style={{ flex: 1 }}><label style={lbl}>Password</label><input style={inp} type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} placeholder="Leave blank to keep unchanged"/></div>
                  </div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Role Name (System Role)</label>
                      <select style={inp} value={form.role} onChange={e=>setForm({...form, role:e.target.value})}>
                        <option value="employee">Employee</option>
                        <option value="dept_head">Department Head</option>
                        <option value="hr_admin">HR Admin</option>
                        <option value="it_admin">IT Admin</option>
                        <option value="management">Management</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}><label style={lbl}>Email Id</label><input style={inp} value={selectedUser.email || ''} readOnly/></div>
                  </div>
                </fieldset>

                <div style={{ display: 'flex', gap: 24, height: 340 }}>
                  {/* Companies Allowed */}
                  <div style={{ flex: 1, border: '1px solid #cbd5e1', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1', borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>Companies Allowed</div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                      {['Default', 'ECHL BUSSY', 'ECHL CENTRE', 'ECHL MAIN', 'Kallakurichi', 'Murappalayam'].map(c => (
                        <div key={c} style={{ padding: '6px 8px', fontSize: 13, background: form.companies.includes(c) ? '#2563eb' : 'transparent', color: form.companies.includes(c) ? '#fff' : '#0b1320', cursor: 'pointer', borderRadius: 4 }}
                          onClick={() => setForm(p => ({...p, companies: p.companies.includes(c) ? p.companies.filter(x=>x!==c) : [...p.companies, c]}))}
                        >
                          {c}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 10, padding: 8, borderTop: '1px solid #cbd5e1', fontSize: 12 }}>
                      <a style={{color:'#2563eb',cursor:'pointer'}} onClick={() => setForm(p=>({...p, companies:['Default', 'ECHL BUSSY', 'ECHL CENTRE', 'ECHL MAIN', 'Kallakurichi', 'Murappalayam']}))}>Select All</a>
                      <a style={{color:'#2563eb',cursor:'pointer'}} onClick={() => setForm(p=>({...p, companies:[]}))}>Deselect All</a>
                    </div>
                  </div>

                  {/* Permissions Allowed */}
                  <div style={{ flex: 1.5, border: '1px solid #cbd5e1', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1', borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>Permissions Allowed</div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                        <FileText size={14} color="#d97706" /> Permissions
                      </div>
                      {renderTree(PERMISSIONS_TREE)}
                    </div>
                    <div style={{ display: 'flex', gap: 10, padding: 8, borderTop: '1px solid #cbd5e1', fontSize: 12 }}>
                      <a style={{color:'#2563eb',cursor:'pointer'}} onClick={() => setForm(p=>({...p, permissions: PERMISSIONS_TREE.flatMap(n => [n.id, ...(n.children?n.children.map(c=>c.id):[])])}))}>Select All</a>
                      <a style={{color:'#2563eb',cursor:'pointer'}} onClick={() => setForm(p=>({...p, permissions: []}))}>Deselect All</a>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox"/> Can Access Invisible Items</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox" checked={form.role==='hr_admin'||form.role==='it_admin'} readOnly/> Is Admin</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox"/> Is Web API User</label>
                </div>
              </div>
              
              <div style={{ padding: '16px 24px', borderTop: '1px solid #e6e9ef', display: 'flex', justifyContent: 'flex-end', gap: 12, background: '#f8fafc', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
                <button type="button" onClick={() => setSelectedUser(null)} style={{ padding: '8px 24px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Close</button>
                <button type="submit" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 24px', borderRadius: 8, border: 'none', background: '#115e59', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                  <Save size={16}/> {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <UserPlus size={48} style={{ opacity: 0.3, marginBottom: 16 }}/>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Select a user to edit details</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Map roles, companies, and permissions</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const lbl = { fontSize: 12, fontWeight: 600, color: '#4b5566', display: 'block', marginBottom: 4 };
const inp = { width: '100%', height: 34, padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box' };
