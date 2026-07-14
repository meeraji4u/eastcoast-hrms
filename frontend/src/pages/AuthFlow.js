import React, { useState, useRef, useEffect } from "react";
import { authApi } from "../utils/api";
import ECHL_LOGO from "../utils/logo";
import { ShieldCheck, Mail, KeyRound, ArrowRight, ArrowLeft, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, UserCheck } from "lucide-react";

const inputStyle = { height:46, borderRadius:10, border:"1.5px solid rgba(255,255,255,0.2)", padding:"0 14px", fontSize:14.5, color:"#fff", outline:"none", width:"100%", background:"rgba(255,255,255,0.1)", transition:"border-color 0.15s", fontFamily:"inherit", boxSizing:"border-box" };
const linkBtn = { background:"none", border:"none", color:"rgba(255,255,255,0.8)", fontWeight:700, cursor:"pointer", padding:0, fontSize:12.5, fontFamily:"inherit" };

const Banner = ({type="error",children}) => {
  const c = type==="success" ? {bg:"rgba(22,163,74,0.2)",fg:"#86efac"} : {bg:"rgba(220,38,38,0.2)",fg:"#fca5a5"};
  const Icon = type==="success" ? CheckCircle2 : AlertCircle;
  return <div style={{display:"flex",alignItems:"flex-start",gap:8,padding:"10px 12px",borderRadius:10,background:c.bg,color:c.fg,fontSize:13,fontWeight:500,marginBottom:16}}><Icon size={16} style={{flexShrink:0,marginTop:1}}/><span>{children}</span></div>;
};

const OtpInput = ({value,onChange,length=6}) => {
  const refs = useRef([]);
  const digits = value.split("").concat(Array(length).fill("")).slice(0,length);
  const handleChange = (i,v) => {
    if(!/^\d*$/.test(v)) return;
    const next=digits.slice(); next[i]=v.slice(-1);
    onChange(next.join("").replace(/\s/g,""));
    if(v&&i<length-1) refs.current[i+1]?.focus();
  };
  const handleKeyDown = (i,e) => { if(e.key==="Backspace"&&!digits[i]&&i>0) refs.current[i-1]?.focus(); };
  return <div style={{display:"flex",gap:8,justifyContent:"center"}}>{digits.map((d,i)=><input key={i} ref={el=>refs.current[i]=el} value={d} onChange={e=>handleChange(i,e.target.value)} onKeyDown={e=>handleKeyDown(i,e)} inputMode="numeric" maxLength={1} style={{width:44,height:52,textAlign:"center",fontSize:22,fontWeight:700,borderRadius:10,border:"1.5px solid rgba(255,255,255,0.3)",outline:"none",color:"#fff",background:"rgba(255,255,255,0.1)"}}/>)}</div>;
};

const Shell = ({children}) => (
  <div style={{minHeight:"100vh",display:"flex",position:"relative",overflow:"hidden"}}>
    <style>{".spin{animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    <div style={{position:"absolute",inset:0,background:"url(/hospital_banner.png) center/cover no-repeat"}}/>
    <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,rgba(11,63,59,0.85) 0%,rgba(17,94,89,0.7) 40%,rgba(15,76,129,0.85) 100%)"}}/>
    <div style={{position:"absolute",top:-100,right:-100,width:400,height:400,borderRadius:"50%",background:"rgba(255,255,255,0.04)"}}/>
    <div style={{position:"absolute",bottom:-150,left:-100,width:500,height:500,borderRadius:"50%",background:"rgba(255,255,255,0.03)"}}/>
    <div style={{position:"relative",zIndex:1,display:"flex",width:"100%",minHeight:"100vh"}}>
      <div style={{flex:"0 0 45%",display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"48px 52px",color:"#fff"}}>
        <div>
          <div style={{marginBottom:40}}>
            <img src="/logo.png" alt="East Coast Hospitals" style={{width:220,height:"auto",display:"block",filter:"brightness(0) invert(1)"}}/>
            <div style={{fontWeight:600,fontSize:11,color:"rgba(255,255,255,0.5)",letterSpacing:"0.1em",textTransform:"uppercase",marginTop:10}}>HRMS Portal</div>
          </div>
          <h1 style={{fontSize:32,fontWeight:900,lineHeight:1.2,letterSpacing:"-0.02em",marginBottom:20}}>One system for<br/><span style={{color:"rgba(255,255,255,0.65)"}}>your entire workforce.</span></h1>
          <p style={{fontSize:14,color:"rgba(255,255,255,0.6)",lineHeight:1.8,maxWidth:320,marginBottom:28}}>Attendance, leave, shifts and payroll — powered by live eSSL biometric data from all hospital locations.</p>
          {["Live biometric attendance sync","Leave & shift management","Gate pass QR system","Geo-fence punch verification","Role-based dashboards"].map(f=>(
            <div key={f} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{width:18,height:18,borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><CheckCircle2 size={11} color="rgba(255,255,255,0.9)"/></div>
              <span style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>{f}</span>
            </div>
          ))}
        </div>
        <div style={{fontSize:11.5,color:"rgba(255,255,255,0.35)"}}>© 2026 East Coast Hospitals Ltd · Pondicherry<br/>36 Years of Trust · NABH Certified · ISO 9001:2015</div>
      </div>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 60px"}}>
        <div style={{width:"100%",maxWidth:420,background:"rgba(255,255,255,0.09)",borderRadius:20,padding:"36px 32px",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.15)"}}>
          {children}
        </div>
      </div>
    </div>
  </div>
);

const Hdr = ({icon:Icon,title,sub,onBack}) => (
  <div style={{marginBottom:26}}>
    {onBack&&<button onClick={onBack} style={{...linkBtn,display:"flex",alignItems:"center",gap:4,marginBottom:14,color:"rgba(255,255,255,0.55)",fontSize:12}}><ArrowLeft size={13}/>Back</button>}
    <div style={{width:40,height:40,borderRadius:10,background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12}}><Icon size={20} color="#fff"/></div>
    <h1 style={{fontSize:22,fontWeight:800,color:"#fff"}}>{title}</h1>
    {sub&&<p style={{fontSize:13,color:"rgba(255,255,255,0.55)",marginTop:4}}>{sub}</p>}
  </div>
);

const Fld = ({label,children}) => <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:16}}><label style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.7)"}}>{label}</label>{children}</div>;

const Btn = ({children,loading,...rest}) => (
  <button {...rest} disabled={loading||rest.disabled} style={{height:46,borderRadius:10,border:"none",background:(loading||rest.disabled)?"rgba(255,255,255,0.25)":"rgba(255,255,255,0.95)",color:"#0b3f3b",fontWeight:800,fontSize:14.5,width:"100%",cursor:(loading||rest.disabled)?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit"}}>
    {loading?<Loader2 size={17} className="spin"/>:children}
  </button>
);

const Resend = ({cooldown,onClick}) => (
  <div style={{textAlign:"center",marginTop:18,fontSize:12.5,color:"rgba(255,255,255,0.45)"}}>
    Didn't get the code?{" "}
    {cooldown>0?<span style={{fontWeight:600,color:"rgba(255,255,255,0.65)"}}>Resend in {cooldown}s</span>:<button onClick={onClick} style={linkBtn}>Resend OTP</button>}
  </div>
);

export default function AuthFlow({onLoginSuccess}) {
  const [view,setView] = useState("login");
  const [empCode,setEmpCode] = useState("");
  const [password,setPassword] = useState("");
  const [showPw,setShowPw] = useState(false);
  const [otp,setOtp] = useState("");
  const [newPw,setNewPw] = useState("");
  const [newPw2,setNewPw2] = useState("");
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [success,setSuccess] = useState("");
  const [emailHint,setEmailHint] = useState("");
  const [cooldown,setCooldown] = useState(0);
  const [activationInfo,setActivationInfo] = useState(null);

  useEffect(()=>{ if(cooldown<=0) return; const t=setInterval(()=>setCooldown(s=>s-1),1000); return ()=>clearInterval(t); },[cooldown]);
  const reset=()=>{setError("");setSuccess("");setOtp("");};

  // Login
  const doLogin=async(e)=>{ e.preventDefault(); reset(); setLoading(true); try{ const {data}=await authApi.login(empCode.trim(),password); localStorage.setItem("hrms_token",data.access_token); localStorage.setItem("hrms_user",JSON.stringify(data.user)); onLoginSuccess?.(data.user); }catch(err){setError(err?.response?.data?.detail||"Login failed. Check your credentials.");} finally{setLoading(false);} };

  // Step 1: Check activation method
  const doCheckActivation=async(e)=>{ e.preventDefault(); reset(); setLoading(true); try{ const r=await fetch(`/api/auth/activation-method/${empCode.trim()}`); const d=await r.json(); if(!r.ok) throw new Error(d.detail||"Not found"); setActivationInfo(d); if(d.has_email){ const r2=await authApi.requestActivationOtp(empCode.trim()); setEmailHint(r2.data.email_hint); setCooldown(45); setView("activate-otp"); } else { setView("activate-direct"); } }catch(err){setError(err?.response?.data?.detail||err.message||"Employee code not found. Contact HR.");} finally{setLoading(false);} };

  // OTP activation (with email)
  const doActivateOtp=async(e)=>{ e.preventDefault(); reset(); if(newPw.length<6) return setError("Min 6 characters"); if(newPw!==newPw2) return setError("Passwords do not match"); setLoading(true); try{ const {data}=await authApi.verifyActivation(empCode.trim(),otp,newPw); localStorage.setItem("hrms_token",data.access_token); localStorage.setItem("hrms_user",JSON.stringify(data.user)); setSuccess("Activated!"); setTimeout(()=>onLoginSuccess?.(data.user),800); }catch(err){setError(err?.response?.data?.detail||"Verification failed");} finally{setLoading(false);} };

  // Direct activation (no email)
  const doDirectActivate=async(e)=>{ e.preventDefault(); reset(); if(newPw.length<6) return setError("Min 6 characters"); if(newPw!==newPw2) return setError("Passwords do not match"); setLoading(true); try{ const r=await fetch("/api/auth/activate/direct",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({emp_code:empCode.trim(),new_password:newPw,confirm_password:newPw2})}); const data=await r.json(); if(!r.ok) throw new Error(data.detail||"Failed"); localStorage.setItem("hrms_token",data.access_token); localStorage.setItem("hrms_user",JSON.stringify(data.user)); setSuccess("Account activated!"); setTimeout(()=>onLoginSuccess?.(data.user),800); }catch(err){setError(err.message||"Failed");} finally{setLoading(false);} };

  // Reset password
  const doResetReq=async(e)=>{ e.preventDefault(); reset(); setLoading(true); try{ const {data}=await authApi.requestResetOtp(empCode.trim()); setEmailHint(data.email_hint); setView("reset-otp"); setCooldown(45); }catch(err){setError(err?.response?.data?.detail||"Could not send OTP. Contact HR.");} finally{setLoading(false);} };
  const doResetVerify=async(e)=>{ e.preventDefault(); reset(); if(newPw.length<6) return setError("Min 6 characters"); if(newPw!==newPw2) return setError("Passwords do not match"); setLoading(true); try{ const {data}=await authApi.verifyReset(empCode.trim(),otp,newPw); localStorage.setItem("hrms_token",data.access_token); localStorage.setItem("hrms_user",JSON.stringify(data.user)); setSuccess("Password reset!"); setTimeout(()=>onLoginSuccess?.(data.user),800); }catch(err){setError(err?.response?.data?.detail||"Reset failed");} finally{setLoading(false);} };
  const doResend=async(purpose)=>{ try{ const {data}=await authApi.resendOtp(empCode.trim(),purpose); setEmailHint(data.email_hint); setCooldown(45); }catch(err){setError(err?.response?.data?.detail||"Failed");} };

  if(view==="login") return (
    <Shell>
      <Hdr icon={ShieldCheck} title="Welcome back" sub="Sign in with your employee code"/>
      {error&&<Banner>{error}</Banner>}
      <form onSubmit={doLogin}>
        <Fld label="Employee Code"><input style={inputStyle} placeholder="e.g. 1047" value={empCode} onChange={e=>setEmpCode(e.target.value)} required autoFocus/></Fld>
        <Fld label="Password">
          <div style={{position:"relative"}}>
            <input type={showPw?"text":"password"} style={{...inputStyle,paddingRight:42}} placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required/>
            <button type="button" onClick={()=>setShowPw(s=>!s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.5)"}}>
              {showPw?<EyeOff size={16}/>:<Eye size={16}/>}
            </button>
          </div>
        </Fld>
        <Btn type="submit" loading={loading}>Continue <ArrowRight size={15}/></Btn>
      </form>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:18}}>
        <button onClick={()=>{reset();setView("activate-req");}} style={linkBtn}>Activate account</button>
        <button onClick={()=>{reset();setView("reset-req");}} style={linkBtn}>Forgot password?</button>
      </div>
    </Shell>
  );

  if(view==="activate-req") return (
    <Shell>
      <Hdr icon={ShieldCheck} title="Activate account" sub="First time login — enter your employee code" onBack={()=>{reset();setView("login");}}/>
      {error&&<Banner>{error}</Banner>}
      <div style={{background:"rgba(255,255,255,0.06)",borderRadius:10,padding:"12px 14px",marginBottom:20,fontSize:13,color:"rgba(255,255,255,0.75)"}}>
        💡 Use your eSSL employee code (same number on your ID card)
      </div>
      <form onSubmit={doCheckActivation}>
        <Fld label="Employee Code"><input style={inputStyle} placeholder="e.g. 1047" value={empCode} onChange={e=>setEmpCode(e.target.value)} required autoFocus/></Fld>
        <Btn type="submit" loading={loading}>Continue <ArrowRight size={15}/></Btn>
      </form>
    </Shell>
  );

  if(view==="activate-otp") return (
    <Shell>
      <Hdr icon={KeyRound} title="Verify & set password" sub={`OTP sent to ${emailHint}`} onBack={()=>{reset();setView("activate-req");}}/>
      {error&&<Banner>{error}</Banner>}
      {success&&<Banner type="success">{success}</Banner>}
      <form onSubmit={doActivateOtp}>
        <Fld label="6-digit OTP"><OtpInput value={otp} onChange={setOtp}/></Fld>
        <Fld label="New Password"><input type="password" style={inputStyle} placeholder="Min 6 characters" value={newPw} onChange={e=>setNewPw(e.target.value)} required/></Fld>
        <Fld label="Confirm Password"><input type="password" style={inputStyle} placeholder="Re-enter" value={newPw2} onChange={e=>setNewPw2(e.target.value)} required/></Fld>
        <Btn type="submit" loading={loading} disabled={otp.length!==6}>Activate account</Btn>
      </form>
      <Resend cooldown={cooldown} onClick={()=>doResend("activate")}/>
    </Shell>
  );

  if(view==="activate-direct") return (
    <Shell>
      <Hdr icon={UserCheck} title={`Hello, ${activationInfo?.name?.split(" ")[0]||"Employee"}`} sub="Set your password to activate your account" onBack={()=>{reset();setView("activate-req");}}/>
      {error&&<Banner>{error}</Banner>}
      {success&&<Banner type="success">{success}</Banner>}
      <div style={{background:"rgba(255,255,255,0.08)",borderRadius:10,padding:"12px 14px",marginBottom:20,fontSize:13,color:"rgba(255,255,255,0.8)"}}>
        Employee Code: <strong>{empCode}</strong><br/>
        <span style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:4,display:"block"}}>No email registered — set your own password directly</span>
      </div>
      <form onSubmit={doDirectActivate}>
        <Fld label="New Password"><input type="password" style={inputStyle} placeholder="Min 6 characters" value={newPw} onChange={e=>setNewPw(e.target.value)} required/></Fld>
        <Fld label="Confirm Password"><input type="password" style={inputStyle} placeholder="Re-enter password" value={newPw2} onChange={e=>setNewPw2(e.target.value)} required/></Fld>
        <Btn type="submit" loading={loading}>Activate My Account</Btn>
      </form>
    </Shell>
  );

  if(view==="reset-req") return (
    <Shell>
      <Hdr icon={KeyRound} title="Reset password" sub="Enter your employee code" onBack={()=>{reset();setView("login");}}/>
      {error&&<Banner>{error}</Banner>}
      <form onSubmit={doResetReq}>
        <Fld label="Employee Code"><input style={inputStyle} placeholder="e.g. 1047" value={empCode} onChange={e=>setEmpCode(e.target.value)} required autoFocus/></Fld>
        <Btn type="submit" loading={loading}><Mail size={15}/>Send OTP to my email</Btn>
      </form>
    </Shell>
  );

  if(view==="reset-otp") return (
    <Shell>
      <Hdr icon={KeyRound} title="Set new password" sub={`OTP sent to ${emailHint}`} onBack={()=>{reset();setView("reset-req");}}/>
      {error&&<Banner>{error}</Banner>}
      {success&&<Banner type="success">{success}</Banner>}
      <form onSubmit={doResetVerify}>
        <Fld label="6-digit OTP"><OtpInput value={otp} onChange={setOtp}/></Fld>
        <Fld label="New Password"><input type="password" style={inputStyle} placeholder="Min 6 characters" value={newPw} onChange={e=>setNewPw(e.target.value)} required/></Fld>
        <Fld label="Confirm Password"><input type="password" style={inputStyle} placeholder="Re-enter" value={newPw2} onChange={e=>setNewPw2(e.target.value)} required/></Fld>
        <Btn type="submit" loading={loading} disabled={otp.length!==6}>Reset password</Btn>
      </form>
      <Resend cooldown={cooldown} onClick={()=>doResend("reset")}/>
    </Shell>
  );

  return null;
}
