import { useState, useEffect, useCallback } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// ─── CORES ────────────────────────────────────────────────────────
const C = {
  bg:"#0b1409", card:"#131d0f", card2:"#1a2910",
  border:"#2a4a18", border2:"#3a6a22",
  green:"#4a8c2a", greenLight:"#6aac3a",
  textPrimary:"#e8dcc8", textSecondary:"#8ab868", textMuted:"#4a6a2a",
  accent:"#c8e878", profit:"#6fcf6f", loss:"#cf6f6f", warn:"#cfcf3f",
  sidebar:"#080f06",
};
const fmt    = n => Number(n).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtInt = n => Number(n).toLocaleString("pt-BR");
const fmtNum = n => {
  // Se é null, undefined ou string vazia, retorna travessão
  if (n === null || n === undefined || n === '') return '—';
  const num = Number(n);
  // Se após conversão é NaN, retorna travessão
  if (isNaN(num)) return '—';
  // Caso contrário, formata normalmente (incluindo 0)
  return num.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
};
const inp = {
  width:"100%", background:C.card2, border:`1px solid ${C.border2}`,
  borderRadius:10, padding:"12px 14px", color:C.textPrimary,
  fontSize:14, fontFamily:"Georgia,serif", outline:"none", boxSizing:"border-box",
};

// ─── HOOK RESPONSIVO ──────────────────────────────────────────────
const useIsMobile = () => {
  const [m,setM] = useState(window.innerWidth < 768);
  useEffect(()=>{
    const fn = ()=>setM(window.innerWidth<768);
    window.addEventListener("resize",fn);
    return ()=>window.removeEventListener("resize",fn);
  },[]);
  return m;
};

// ─── API HELPER ───────────────────────────────────────────────────
const getToken = ()=> localStorage.getItem("gm_token");
const apiFetch = async (path, opts={}) => {
  try {
    const apiUrl = process.env.REACT_APP_API_URL || '';
    console.log(`🔄 Requisição: ${apiUrl}/api${path}`);
    
    const res = await fetch(`${apiUrl}/api${path}`,{
      ...opts,
      headers:{
        "Content-Type":"application/json",
        ...(getToken()?{Authorization:`Bearer ${getToken()}`}:{}),
        ...opts.headers,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    
    console.log(`📬 Resposta ${path}: ${res.status}`);
    
    if(res.status===401){
      console.warn("⚠️ Token inválido - fazendo logout");
      localStorage.removeItem("gm_token");
      localStorage.removeItem("gm_user");
      window.location.reload();
      return;
    }
    
    const text = await res.text();
    console.log(`📄 Conteúdo bruto: ${text.substring(0, 100)}...`);
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      console.error(`❌ Erro ao fazer parse do JSON:`, parseErr);
      console.error(`Conteúdo recebido:`, text);
      throw new Error(`Resposta inválida (JSON parse error): ${text.substring(0, 100)}`);
    }
    
    if(!res.ok) {
      const errorMsg = data.error || data.erro || `HTTP ${res.status}`;
      throw new Error(errorMsg);
    }
    
    console.log(`✅ ${path} sucesso`);
    return data;
  } catch(err) {
    console.error(`❌ Erro em ${path}:`, err.message);
    throw err;
  }
};

// ─── COMPONENTES BASE ─────────────────────────────────────────────
const Label = ({children,req})=>(
  <div style={{fontSize:11,color:C.textSecondary,marginBottom:6,letterSpacing:0.8,textTransform:"uppercase",fontWeight:"bold"}}>
    {children}{req&&<span style={{color:C.loss}}> *</span>}
  </div>
);
const Input = ({label,value,onChange,placeholder,type="text",req,prefix,suffix,disabled})=>(
  <div style={{marginBottom:14}}>
    {label&&<Label req={req}>{label}</Label>}
    <div style={{position:"relative",display:"flex",alignItems:"center"}}>
      {prefix&&<span style={{position:"absolute",left:14,color:C.textSecondary,fontSize:14,pointerEvents:"none"}}>{prefix}</span>}
      <input disabled={disabled} type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{...inp,paddingLeft:prefix?34:14,paddingRight:suffix?50:14,opacity:disabled?.6:1}}/>
      {suffix&&<span style={{position:"absolute",right:14,color:C.textMuted,fontSize:12}}>{suffix}</span>}
    </div>
  </div>
);
const Select = ({label,value,onChange,options,req})=>(
  <div style={{marginBottom:14}}>
    {label&&<Label req={req}>{label}</Label>}
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{...inp,color:value?C.textPrimary:C.textMuted}}>
      <option value="">Selecione...</option>
      {options.map(o=>(
        <option key={typeof o==="string"?o:o.id}
          value={typeof o==="string"?o:o.nome}
          style={{background:C.card2}}>
          {typeof o==="string"?o:o.nome}
        </option>
      ))}
    </select>
  </div>
);
const Btn = ({onClick,children,color=C.green,style:s={},type="button",disabled=false})=>(
  <button type={type} onClick={onClick} disabled={disabled} style={{
    background:disabled?"#2a2a2a":`linear-gradient(135deg,${color},${color}cc)`,
    border:"none",borderRadius:12,padding:"14px 20px",color:disabled?"#666":"#fff",
    fontSize:15,cursor:disabled?"not-allowed":"pointer",fontFamily:"Georgia,serif",
    fontWeight:"bold",width:"100%",letterSpacing:0.5,...s,
  }}>{children}</button>
);
const Badge = ({cor,texto})=>{
  const m={verde:[C.profit+"22",C.profit,C.profit+"44"],vermelho:[C.loss+"22",C.loss,C.loss+"44"],amarelo:[C.warn+"22",C.warn,C.warn+"44"],azul:["#6f9fcf22","#6f9fcf","#6f9fcf44"]};
  const [bg,tx,bd]=m[cor]||m.azul;
  return <span style={{background:bg,color:tx,border:`1px solid ${bd}`,borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:"bold"}}>{texto}</span>;
};
const Modal = ({title,onClose,children})=>(
  <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
    <div onClick={e=>e.stopPropagation()} style={{background:C.bg,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:480,maxHeight:"92vh",overflowY:"auto",borderTop:`2px solid ${C.green}`,borderLeft:`1px solid ${C.border}`,borderRight:`1px solid ${C.border}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 20px 14px",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:C.bg,zIndex:10}}>
        <div style={{fontWeight:"bold",color:C.accent,fontSize:17}}>{title}</div>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.textMuted,fontSize:24,cursor:"pointer"}}>✕</button>
      </div>
      <div style={{padding:"20px 20px 30px"}}>{children}</div>
    </div>
  </div>
);
const InfoRow = ({label,value})=>(
  <div style={{padding:"11px 0",borderBottom:`1px solid ${C.card2}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
    <div style={{fontSize:12,color:C.textMuted}}>{label}</div>
    <div style={{fontSize:14,color:C.textPrimary}}>{value}</div>
  </div>
);
const StatCard = ({label,value,sub,cor})=>(
  <div style={{background:C.card,borderRadius:14,padding:"16px 14px",border:`1px solid ${C.border}`,flex:1,minWidth:0}}>
    <div style={{fontSize:11,color:C.textMuted,marginBottom:6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{label}</div>
    <div style={{fontSize:20,fontWeight:"bold",color:cor||C.accent}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:C.textMuted,marginTop:4}}>{sub}</div>}
  </div>
);
const Spinner = ()=>(
  <div style={{textAlign:"center",padding:"60px 20px",color:C.textMuted}}>
    <div style={{fontSize:40,marginBottom:12,animation:"spin 1s linear infinite",display:"inline-block"}}>⏳</div>
    <div>Carregando...</div>
  </div>
);

// ════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════
function LoginPage({onLogin}){
  const [user,setUser] = useState("admin");
  const [pass,setPass] = useState("");
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);
  const [modo,setModo] = useState("login"); // "login" | "resetar-master"
  const [novaSenha,setNovaSenha] = useState("");
  const [resetUserMaster,setResetUserMaster] = useState("");
  const [mensagem,setMensagem] = useState("");
  const [masterKey,setMasterKey] = useState("");

  const handleLogin = async e => {
    e.preventDefault();
    setLoading(true); setError(""); setMensagem("");
    try{
      const data = await apiFetch("/login",{method:"POST",body:{username:user,password:pass}});
      localStorage.setItem("gm_token",data.token);
      localStorage.setItem("gm_user",data.username);
      onLogin(data);
    }catch(err){
      setError(err.message||"Erro ao fazer login");
    }finally{
      setLoading(false);
    }
  };

  const handleResetarMaster = async e => {
    e.preventDefault();
    setLoading(true); setError(""); setMensagem("");
    try{
      await apiFetch("/resetar-senha-master",{method:"POST",body:{username:resetUserMaster,masterKey,novaSenha}});
      setMensagem("✅ Senha alterada com sucesso! Faça login com sua nova senha.");
      setTimeout(() => {
        setModo("login");
        setResetUserMaster("");
        setMasterKey("");
        setNovaSenha("");
        setPass("");
        setUser("admin");
      }, 2000);
    }catch(err){
      setError(err.message||"Erro ao redefinir senha");
    }finally{
      setLoading(false);
    }
  };

  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"Georgia,serif"}}>
      <div style={{background:C.card,borderRadius:24,padding:"40px 36px",width:"100%",maxWidth:400,border:`1px solid ${C.border}`,boxShadow:"0 24px 60px rgba(0,0,0,0.6)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:72,marginBottom:12}}>🐂</div>
          <div style={{fontSize:28,fontWeight:"bold",color:C.accent,letterSpacing:1}}>GadoMarket Pro</div>
          <div style={{fontSize:11,color:C.textMuted,letterSpacing:2,textTransform:"uppercase",marginTop:6}}>Gestão de Compra e Venda</div>
        </div>

        {modo==="login" && (
          <form onSubmit={handleLogin}>
            <Input label="Usuário" value={user} onChange={setUser} placeholder="admin" req/>
            <Input label="Senha" value={pass} onChange={setPass} placeholder="••••••••" type="password" req/>
            {error&&(
              <div style={{background:"#3a0a0a",border:`1px solid ${C.loss}55`,borderRadius:10,padding:"10px 14px",marginBottom:16,color:C.loss,fontSize:13}}>
                ⚠️ {error}
              </div>
            )}
            <Btn type="submit" disabled={loading}>
              {loading?"⏳ Entrando...":"🔐 Entrar"}
            </Btn>
            <div style={{textAlign:"center",marginTop:16}}>
              <button type="button" onClick={()=>{setModo("resetar-master"); setError(""); setResetUserMaster(""); setMasterKey(""); setNovaSenha("");}} style={{background:"none",border:"none",color:C.accent,textDecoration:"underline",cursor:"pointer",fontSize:12}}>
                🔑 Resetar minha Senha
              </button>
            </div>
          </form>
        )}

        {modo==="resetar-master" && (
          <form onSubmit={handleResetarMaster}>
            <div style={{marginBottom:16,color:C.textMuted,fontSize:13}}>
              Use seu código secreto para resetar a senha
            </div>
            <Input label="Usuário" value={resetUserMaster} onChange={setResetUserMaster} placeholder="admin" req/>
            <Input label="Código Secreto" value={masterKey} onChange={setMasterKey} placeholder="••••••••••••••" type="password" req/>
            <Input label="Nova Senha" value={novaSenha} onChange={setNovaSenha} placeholder="••••••••" type="password" req/>
            {error&&(
              <div style={{background:"#3a0a0a",border:`1px solid ${C.loss}55`,borderRadius:10,padding:"10px 14px",marginBottom:16,color:C.loss,fontSize:13}}>
                ⚠️ {error}
              </div>
            )}
            {mensagem&&(
              <div style={{background:"#0a3a0a",border:`1px solid ${C.profit}55`,borderRadius:10,padding:"10px 14px",marginBottom:16,color:C.profit,fontSize:12}}>
                {mensagem}
              </div>
            )}
            <Btn type="submit" disabled={loading}>
              {loading?"⏳ Alterando...":"✅ Resetar Senha"}
            </Btn>
            <div style={{textAlign:"center",marginTop:16}}>
              <button type="button" onClick={()=>{setModo("login"); setError(""); setMasterKey(""); setNovaSenha(""); setResetUserMaster("");}} style={{background:"none",border:"none",color:C.greenLight,textDecoration:"underline",cursor:"pointer",fontSize:12}}>
                Voltar para login
              </button>
            </div>
          </form>
        )}

        <div style={{textAlign:"center",marginTop:24,fontSize:11,color:C.textMuted,borderTop:`1px solid ${C.border}`,paddingTop:20}}>
          GadoMarket Pro v2.0 • Acesso seguro com JWT
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SIDEBAR (desktop)
// ════════════════════════════════════════════════════════════════
function Sidebar({aba,setAba,novaOp,setNovaOp,user,onLogout}){
  const nav=[
    {id:"operacoes",icon:"📋",label:"Operações"},
    {id:"cadastros",icon:"👥",label:"Cadastros"},
    {id:"relatorio",icon:"📊",label:"Relatório"},
  ];
  return(
    <div style={{width:260,minHeight:"100vh",background:C.sidebar,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",overflow:"auto",flexShrink:0}}>
      <div style={{padding:"24px 20px 18px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:22,fontWeight:"bold",color:C.accent,fontFamily:"Georgia,serif",letterSpacing:1}}>🐂 GadoMarket</div>
        <div style={{fontSize:10,color:C.textMuted,letterSpacing:2,textTransform:"uppercase",marginTop:4}}>Gestão Pecuária Pro</div>
      </div>

      <div style={{padding:"16px 14px 8px"}}>
        <Btn onClick={()=>setNovaOp(!novaOp)} color={novaOp?"#3a1a1a":C.green}
          style={{fontSize:13,padding:"12px 16px"}}>
          {novaOp?"✕ Cancelar":"+ Nova Operação"}
        </Btn>
      </div>

      <nav style={{flex:1,padding:"8px 10px"}}>
        {nav.map(n=>(
          <button key={n.id} onClick={()=>{setAba(n.id);setNovaOp(false);}}
            style={{
              width:"100%",display:"flex",alignItems:"center",gap:12,
              padding:"12px 14px",borderRadius:10,border:"none",cursor:"pointer",
              background:aba===n.id&&!novaOp?`${C.green}22`:"transparent",
              color:aba===n.id&&!novaOp?C.accent:C.textMuted,
              fontSize:14,fontFamily:"Georgia,serif",marginBottom:4,
              borderLeft:`3px solid ${aba===n.id&&!novaOp?C.green:"transparent"}`,
              transition:"all .15s",
            }}>
            <span style={{fontSize:18}}>{n.icon}</span>
            <span style={{fontWeight:aba===n.id&&!novaOp?"bold":"normal"}}>{n.label}</span>
          </button>
        ))}
      </nav>

      <div style={{padding:"14px",borderTop:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:"10px 12px",background:C.card2,borderRadius:10,border:`1px solid ${C.border}`}}>
          <div style={{width:32,height:32,background:C.green+"33",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>👤</div>
          <div>
            <div style={{fontSize:13,color:C.textPrimary,fontWeight:"bold"}}>{user?.username||"admin"}</div>
            <div style={{fontSize:10,color:C.textMuted}}>Administrador</div>
          </div>
        </div>
        <button onClick={onLogout} style={{width:"100%",padding:"10px",borderRadius:10,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,cursor:"pointer",fontFamily:"Georgia,serif",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          🚪 Sair
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// NOVA OPERAÇÃO — 3 etapas
// ════════════════════════════════════════════════════════════════
function NovaOperacao({dados,onSalvo,onVoltar,isMobile}){
  const [etapa,setEtapa]=useState(1);
  const [form,setForm]=useState({cliente:"",frigorifico:"",sexo:"",cabecas:"",pesoPorCabeca:"",valorCompraArroba:"",valorVendaArroba:""});
  const [despesas,setDespesas]=useState([{descricao:"",valor:""}]);
  const [saving,setSaving]=useState(false);
  const [salvo,setSalvo]=useState(false);
  const [tipoAdicao,setTipoAdicao]=useState("lote"); // "lote" ou "individual"
  const [animaisIndividuais,setAnimaisIndividuais]=useState([]);
  const [novoAnimal,setNovoAnimal]=useState({sexo:"",peso:""});

  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  
  // Se adicionar individual, calcular com base nos animais
  const cabecas=tipoAdicao==="individual"?animaisIndividuais.length:Number(form.cabecas)||0;
  const pesoCab=tipoAdicao==="individual"?(animaisIndividuais.length>0?animaisIndividuais.reduce((s,a)=>s+Number(a.peso||0),0)/animaisIndividuais.length:0):(Number(form.pesoPorCabeca)||0);
  const pesoTotal=tipoAdicao==="individual"?animaisIndividuais.reduce((s,a)=>s+Number(a.peso||0),0):cabecas*pesoCab;
  const arrobas=parseFloat((pesoTotal/30).toFixed(2));
  const compraArr=Number(form.valorCompraArroba)||0, vendaArr=Number(form.valorVendaArroba)||0;
  const totalCompra=parseFloat((arrobas*compraArr).toFixed(2));
  const totalVenda=parseFloat((arrobas*vendaArr).toFixed(2));
  const totalDesp=despesas.reduce((s,d)=>s+(Number(d.valor)||0),0);
  const lucro=parseFloat((totalVenda-totalCompra-totalDesp).toFixed(2));
  const margem=totalVenda>0?((lucro/totalVenda)*100).toFixed(1):0;

  const addDesp=()=>setDespesas(d=>[...d,{descricao:"",valor:""}]);
  const setDesp=(i,k,v)=>setDespesas(d=>d.map((x,idx)=>idx===i?{...x,[k]:v}:x));
  const remDesp=i=>setDespesas(d=>d.filter((_,idx)=>idx!==i));

  const adicionarAnimal=()=>{
    if(!novoAnimal.sexo||!novoAnimal.peso) return;
    setAnimaisIndividuais([...animaisIndividuais,{...novoAnimal}]);
    setNovoAnimal({sexo:"",peso:""});
  };

  const removerAnimal=i=>setAnimaisIndividuais(animaisIndividuais.filter((_,idx)=>idx!==i));

  const salvar = async ()=>{
    if(!form.cliente||!form.sexo||!cabecas) {
      console.warn("⚠️ Validação falhou:", {cliente:form.cliente, sexo:form.sexo, cabecas});
      alert("⚠️ Por favor preencha: Cliente, Sexo e Cabeças");
      return;
    }
    
    if(!form.valorCompraArroba||!form.valorVendaArroba) {
      alert("⚠️ Por favor preencha: Valor de Compra e Venda por Arroba");
      return;
    }
    
    setSaving(true);
    const clienteId = dados.clientes.find(c=>c.nome===form.cliente)?.id||null;
    const frigoId = dados.frigorificos.find(f=>f.nome===form.frigorifico)?.id||null;
    
    console.log("📤 Salvando operação:", {clienteId, frigoId, cabecas, compraArr, vendaArr, pesoCab, pesoTotal, arrobas, totalCompra, totalVenda, lucro});
    
    try{
      const payload = {
        data:new Date().toLocaleDateString("pt-BR"),
        cliente_id:clienteId,
        frigorificos_id:frigoId,
        sexo:form.sexo,
        cabecas,
        pesoPorCabeca:pesoCab,
        pesoTotal,
        arrobas,
        valorCompra:compraArr,
        valorVenda:vendaArr,
        precoCompra:compraArr,
        precoVenda:vendaArr,
        totalCompra,
        totalVenda,
        lucro,
        margem,
        observacoes:form.observacoes||""
      };
      
      console.log("📨 Payload:", payload);
      
      const resultado = await apiFetch("/operacoes",{method:"POST",body:payload});
      
      console.log("✅ Operação salva com sucesso:", resultado);
      setSalvo(true);
      await onSalvo();
      setTimeout(()=>{setSalvo(false);onVoltar();},1800);
    }catch(e){
      console.error("❌ Erro ao salvar operação:", e.message);
      console.error("Stack:", e.stack);
      alert("❌ Erro ao salvar: "+e.message);
    }
    finally{setSaving(false);}
  };

  if(salvo) return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 20px",textAlign:"center"}}>
      <div style={{fontSize:80,marginBottom:20}}>✅</div>
      <div style={{fontSize:22,fontWeight:"bold",color:C.accent}}>Operação registrada!</div>
      <div style={{color:C.textMuted,marginTop:8}}>Redirecionando...</div>
    </div>
  );

  const Steps=()=>(
    <div style={{display:"flex",marginBottom:24,background:C.card,borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}`}}>
      {[["1","Dados"],["2","Preços"],["3","Despesas"]].map(([n,l],i)=>(
        <div key={n} onClick={()=>{if(Number(n)<=etapa)setEtapa(Number(n));}}
          style={{flex:1,padding:"12px 0",textAlign:"center",background:etapa===i+1?C.green:etapa>i+1?C.green+"44":"transparent",cursor:"pointer",borderRight:i<2?`1px solid ${C.border}`:"none"}}>
          <div style={{fontSize:16,fontWeight:"bold",color:etapa===i+1?"#fff":etapa>i+1?C.greenLight:C.textMuted}}>{n}</div>
          <div style={{fontSize:10,color:etapa===i+1?"#fff":C.textMuted,marginTop:2}}>{l}</div>
        </div>
      ))}
    </div>
  );

  const twoCol = !isMobile;

  return(
    <div style={{paddingBottom:20}}>
      <Steps/>

      {/* ETAPA 1 */}
      {etapa===1&&(
        <div>
          <div style={{fontSize:16,fontWeight:"bold",color:C.accent,marginBottom:20}}>👤 Dados da Operação</div>
          <div style={{display:"grid",gridTemplateColumns:twoCol?"1fr 1fr":"1fr",gap:twoCol?16:0}}>
            <Select label="Nome do Cliente" value={form.cliente} onChange={v=>set("cliente",v)} options={dados.clientes.map(c=>c.nome)} req/>
            <Select label="Nome do Frigorífico" value={form.frigorifico} onChange={v=>set("frigorifico",v)} options={dados.frigorificos.map(f=>f.nome)} req/>
          </div>
          <div style={{marginBottom:14}}>
            <Label req>Sexo do Animal</Label>
            <div style={{display:"flex",gap:10}}>
              {["Boi","Vaca"].map(s=>(
                <div key={s} onClick={()=>set("sexo",s)}
                  style={{flex:1,padding:"16px 0",textAlign:"center",background:form.sexo===s?C.green:C.card2,border:`2px solid ${form.sexo===s?C.greenLight:C.border}`,borderRadius:12,cursor:"pointer",transition:"all .2s"}}>
                  <div style={{fontSize:32,marginBottom:4}}>{s==="Boi"?"🐂":"🐄"}</div>
                  <div style={{fontSize:14,fontWeight:"bold",color:form.sexo===s?"#fff":C.textSecondary}}>{s}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Escolher tipo de adição */}
          <div style={{marginBottom:20}}>
            <Label>Tipo de Adição</Label>
            <div style={{display:"flex",gap:10}}>
              {[{id:"lote",label:"📦 Por Lote"},{id:"individual",label:"🐄 Individuais"}].map(t=>(
                <div key={t.id} onClick={()=>setTipoAdicao(t.id)}
                  style={{flex:1,padding:"12px 0",textAlign:"center",background:tipoAdicao===t.id?C.green:C.card2,border:`2px solid ${tipoAdicao===t.id?C.greenLight:C.border}`,borderRadius:12,cursor:"pointer",fontSize:13,fontWeight:"bold",color:tipoAdicao===t.id?"#fff":C.textSecondary}}>
                  {t.label}
                </div>
              ))}
            </div>
          </div>

          {/* Adição por Lote */}
          {tipoAdicao==="lote"&&(
            <div style={{display:"flex",gap:10}}>
              <div style={{flex:1}}><Input label="Qtd Cabeças" value={form.cabecas} onChange={v=>set("cabecas",v)} placeholder="Ex: 50" type="number" req/></div>
              <div style={{flex:1}}><Input label="Peso por Cabeça" value={form.pesoPorCabeca} onChange={v=>set("pesoPorCabeca",v)} placeholder="Ex: 480" type="number" suffix="kg"/></div>
            </div>
          )}

          {/* Adição Individual */}
          {tipoAdicao==="individual"&&(
            <div style={{background:C.card2,borderRadius:12,padding:16,border:`1px solid ${C.border}`,marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:"bold",color:C.accent,marginBottom:12}}>Adicionar Cabeça Individual</div>
              <div style={{display:"grid",gridTemplateColumns:tipoAdicao==="individual"?"1fr 1fr 1fr":"1fr",gap:8,marginBottom:12}}>
                <Select label="Sexo" value={novoAnimal.sexo} onChange={v=>setNovoAnimal({...novoAnimal,sexo:v})} options={["Boi","Vaca"]}/>
                <Input label="Peso" value={novoAnimal.peso} onChange={v=>setNovoAnimal({...novoAnimal,peso:v})} placeholder="kg" type="number" suffix="kg"/>
                <div style={{display:"flex",alignItems:"flex-end"}}><Btn onClick={adicionarAnimal} color={C.greenLight} style={{width:"100%"}}>+</Btn></div>
              </div>
              
              {/* Lista de animais adicionados */}
              {animaisIndividuais.length>0&&(
                <div style={{marginTop:12,maxHeight:"200px",overflowY:"auto"}}>
                  <div style={{fontSize:11,color:C.textMuted,marginBottom:8,fontWeight:"bold"}}>Animais Adicionados ({animaisIndividuais.length})</div>
                  {animaisIndividuais.map((a,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.card,padding:"8px 12px",borderRadius:8,marginBottom:6,border:`1px solid ${C.border}`,fontSize:12}}>
                      <span>{a.sexo==="Boi"?"🐂":"🐄"} {a.peso}kg</span>
                      <button onClick={()=>removerAnimal(i)} style={{background:"none",border:"none",color:C.loss,cursor:"pointer",fontSize:14}}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {pesoTotal>0&&(
            <div style={{background:C.card2,borderRadius:12,padding:16,marginBottom:14,border:`1px solid ${C.border}`}}>
              <div style={{fontSize:11,color:C.textMuted,marginBottom:10,letterSpacing:1}}>RESUMO DO LOTE</div>
              <div style={{display:"flex",justifyContent:"space-around"}}>
                <div style={{textAlign:"center"}}><div style={{fontSize:11,color:C.textMuted}}>Peso Total</div><div style={{fontSize:18,fontWeight:"bold",color:C.accent}}>{fmtInt(pesoTotal)}kg</div></div>
                <div style={{width:1,background:C.border}}/>
                <div style={{textAlign:"center"}}><div style={{fontSize:11,color:C.textMuted}}>Total @</div><div style={{fontSize:18,fontWeight:"bold",color:C.accent}}>{fmt(arrobas)}</div></div>
                <div style={{width:1,background:C.border}}/>
                <div style={{textAlign:"center"}}><div style={{fontSize:11,color:C.textMuted}}>Cabeças</div><div style={{fontSize:18,fontWeight:"bold",color:C.accent}}>{cabecas}</div></div>
              </div>
            </div>
          )}
          <Btn onClick={()=>{if(form.cliente&&form.sexo&&cabecas)setEtapa(2);}}>Próximo →</Btn>
        </div>
      )}

      {/* ETAPA 2 */}
      {etapa===2&&(
        <div>
          <div style={{fontSize:16,fontWeight:"bold",color:C.accent,marginBottom:20}}>💲 Valores por Arroba</div>
          <div style={{display:"grid",gridTemplateColumns:twoCol?"1fr 1fr":"1fr",gap:twoCol?16:0}}>
            <Input label="Valor de Compra por @" value={form.valorCompraArroba} onChange={v=>set("valorCompraArroba",v)} placeholder="Ex: 290" type="number" prefix="R$" req/>
            <Input label="Valor de Venda por @" value={form.valorVendaArroba} onChange={v=>set("valorVendaArroba",v)} placeholder="Ex: 315" type="number" prefix="R$" req/>
          </div>
          {compraArr>0&&vendaArr>0&&(
            <div style={{marginBottom:20}}>
              <div style={{display:"flex",gap:10,marginBottom:10}}>
                <div style={{flex:1,background:"#4a0a0a33",borderRadius:12,padding:14,border:"1px solid #cf6f6f44",textAlign:"center"}}>
                  <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>TOTAL COMPRA</div>
                  <div style={{fontSize:16,fontWeight:"bold",color:C.loss}}>R$ {fmt(totalCompra)}</div>
                  <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>R$ {compraArr}/@</div>
                </div>
                <div style={{flex:1,background:"#0a4a0a33",borderRadius:12,padding:14,border:"1px solid #6fcf6f44",textAlign:"center"}}>
                  <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>TOTAL VENDA</div>
                  <div style={{fontSize:16,fontWeight:"bold",color:C.profit}}>R$ {fmt(totalVenda)}</div>
                  <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>R$ {vendaArr}/@</div>
                </div>
              </div>
              <div style={{background:C.card2,borderRadius:12,padding:14,border:`1px solid ${C.border}`,textAlign:"center"}}>
                <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>MARGEM BRUTA (sem despesas)</div>
                <div style={{fontSize:22,fontWeight:"bold",color:totalVenda-totalCompra>=0?C.profit:C.loss}}>R$ {fmt(totalVenda-totalCompra)}</div>
                <div style={{fontSize:12,color:C.textMuted,marginTop:4}}>R$ {fmt(vendaArr-compraArr)} por @ · {fmt(arrobas)} arrobas</div>
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:10}}>
            <Btn onClick={()=>setEtapa(1)} color="#2a3a1a" style={{flex:1}}>← Voltar</Btn>
            <Btn onClick={()=>{if(form.valorCompraArroba&&form.valorVendaArroba)setEtapa(3);}}>Próximo →</Btn>
          </div>
        </div>
      )}

      {/* ETAPA 3 */}
      {etapa===3&&(
        <div>
          <div style={{fontSize:16,fontWeight:"bold",color:C.accent,marginBottom:6}}>📋 Despesas</div>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:20}}>Frete, medicamentos, comissões, etc.</div>

          <div style={{display:"grid",gridTemplateColumns:twoCol?"1fr 1fr":"1fr",gap:twoCol?16:0,marginBottom:10}}>
            {despesas.map((d,i)=>(
              <div key={i} style={{background:C.card2,borderRadius:12,padding:14,border:`1px solid ${C.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:12,color:C.textSecondary,fontWeight:"bold"}}>Despesa {i+1}</div>
                  {despesas.length>1&&<button onClick={()=>remDesp(i)} style={{background:"none",border:"none",color:C.loss,fontSize:18,cursor:"pointer"}}>✕</button>}
                </div>
                <Select value={d.descricao} onChange={v=>setDesp(i,"descricao",v)}
                  options={["Frete","Medicamentos","Alimentação","Comissão","Pedágio","Estadias","Mão de obra","Vacinas","Exames","Outros"]}/>
                <Input value={d.valor} onChange={v=>setDesp(i,"valor",v)} placeholder="0,00" type="number" prefix="R$"/>
              </div>
            ))}
          </div>

          <button onClick={addDesp} style={{width:"100%",background:"transparent",border:`1px dashed ${C.border2}`,borderRadius:12,padding:"12px 0",color:C.textSecondary,fontSize:14,cursor:"pointer",fontFamily:"Georgia,serif",marginBottom:20}}>
            + Adicionar despesa
          </button>

          {/* Resumo Final */}
          <div style={{background:C.card,borderRadius:16,padding:20,marginBottom:20,border:`2px solid ${lucro>=0?C.green:"#7a1a1a"}`}}>
            <div style={{fontSize:13,color:C.textSecondary,fontWeight:"bold",marginBottom:16,letterSpacing:1,textTransform:"uppercase"}}>📊 Resumo da Operação</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:C.textMuted,fontSize:13}}>Cliente</span><span style={{color:C.textPrimary,fontSize:13,fontWeight:"bold"}}>{form.cliente}</span></div>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:C.textMuted,fontSize:13}}>Frigorífico</span><span style={{color:C.textPrimary,fontSize:13}}>{form.frigorifico||"—"}</span></div>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:C.textMuted,fontSize:13}}>Lote</span><span style={{color:C.textPrimary,fontSize:13}}>{form.sexo==="Boi"?"🐂":"🐄"} {cabecas} cab · {fmtInt(pesoTotal)}kg · {fmt(arrobas)}@</span></div>
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}/>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:C.textMuted,fontSize:13}}>Total Compra</span><span style={{color:C.loss,fontSize:14,fontWeight:"bold"}}>- R$ {fmt(totalCompra)}</span></div>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:C.textMuted,fontSize:13}}>Total Venda</span><span style={{color:C.profit,fontSize:14,fontWeight:"bold"}}>+ R$ {fmt(totalVenda)}</span></div>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:C.textMuted,fontSize:13}}>Despesas</span><span style={{color:C.warn,fontSize:14,fontWeight:"bold"}}>- R$ {fmt(totalDesp)}</span></div>
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{color:C.textPrimary,fontSize:15,fontWeight:"bold"}}>LUCRO LÍQUIDO</span>
                  <span style={{fontSize:22,fontWeight:"bold",color:lucro>=0?C.profit:C.loss}}>{lucro>=0?"+":""}R$ {fmt(lucro)}</span>
                </div>
                <div style={{display:"flex",justifyContent:"flex-end",marginTop:4}}>
                  <span style={{fontSize:12,color:C.textMuted}}>Margem: {margem}%</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{display:"flex",gap:10}}>
            <Btn onClick={()=>setEtapa(2)} color="#2a3a1a" style={{flex:1}}>← Voltar</Btn>
            <Btn onClick={salvar} disabled={saving}>{saving?"⏳ Salvando...":"✅ Salvar Operação"}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// OPERAÇÕES
// ════════════════════════════════════════════════════════════════
function Operacoes({dados,onRefresh,isMobile}){
  const [detalhe,setDetalhe]=useState(null);
  const [busca,setBusca]=useState("");
  const [deleting,setDeleting]=useState(false);

  // Helper para resolver nomes a partir de IDs
  const getClienteNome = (op) => op.cliente || (dados.clientes.find(c=>c.id===op.cliente_id)?.nome || "Desconhecido");
  const getFrigoNome = (op) => op.frigorifico || (dados.frigorificos.find(f=>f.id===op.frigorificos_id)?.nome || "Desconhecido");

  const lista=dados.operacoes.filter(o=>{
    const clienteNome = getClienteNome(o);
    const frigoNome = getFrigoNome(o);
    return clienteNome.toLowerCase().includes(busca.toLowerCase())||
           frigoNome.toLowerCase().includes(busca.toLowerCase());
  });
  const totalLucro=dados.operacoes.reduce((s,o)=>s+(o.lucro||0),0);
  const totalFat=dados.operacoes.reduce((s,o)=>s+(o.totalVenda||0),0);
  const totalCab=dados.operacoes.reduce((s,o)=>s+(o.cabecas||0),0);
  const totalOps=dados.operacoes.length;

  const excluir = async id=>{
    if(!window.confirm("Excluir esta operação?")) return;
    setDeleting(true);
    try{
      await apiFetch(`/operacoes/${id}`,{method:"DELETE"});
      setDetalhe(null);
      await onRefresh();
    }catch(e){alert(e.message);}
    finally{setDeleting(false);}
  };

  const exportarPDF = async (operacao) => {
    try {
      const element = document.getElementById('modal-detalhes-conteudo');
      if (!element) return;
      
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`operacao_${operacao.cliente_id}_${operacao.data}.pdf`);
    } catch (e) {
      console.error('Erro ao exportar PDF:', e);
      alert('Erro ao gerar PDF: ' + e.message);
    }
  };

  return(
    <div>
      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:16}}>
        <StatCard label="Faturamento" value={`R$ ${(totalFat/1000).toFixed(0)}k`} sub="total vendas" cor={C.profit}/>
        <StatCard label="Lucro Total" value={`R$ ${(totalLucro/1000).toFixed(0)}k`} sub="líquido" cor={C.accent}/>
        <StatCard label="Operações" value={totalOps} sub="registradas" cor={C.textPrimary}/>
        <StatCard label="Cabeças" value={fmtInt(totalCab)} sub="negociadas" cor={C.textSecondary}/>
      </div>

      {/* Busca */}
      <div style={{display:"flex",background:C.card2,borderRadius:10,border:`1px solid ${C.border2}`,padding:"10px 14px",marginBottom:16,gap:8,alignItems:"center"}}>
        <span>🔍</span>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por cliente ou frigorífico..."
          style={{flex:1,background:"transparent",border:"none",outline:"none",color:C.textPrimary,fontSize:14,fontFamily:"Georgia,serif"}}/>
        {busca&&<button onClick={()=>setBusca("")} style={{background:"none",border:"none",color:C.textMuted,cursor:"pointer",fontSize:16}}>✕</button>}
      </div>

      {lista.length===0&&(
        <div style={{textAlign:"center",padding:"60px 0",color:C.textMuted}}>
          <div style={{fontSize:48,marginBottom:12}}>📋</div>
          <div>{busca?"Nenhuma operação encontrada":"Nenhuma operação registrada ainda"}</div>
        </div>
      )}

      {/* DESKTOP TABLE */}
      {!isMobile && lista.length>0&&(
        <div style={{background:C.card,borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"Georgia,serif"}}>
            <thead>
              <tr style={{background:C.card2}}>
                {["","Cliente","Frigorífico","Cabeças","Arrobas","Compra/@","Venda/@","Lucro","Status","Data"].map(h=>(
                  <th key={h} style={{padding:"12px 14px",textAlign:"left",color:C.textMuted,fontSize:11,fontWeight:"bold",textTransform:"uppercase",letterSpacing:0.8,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((o,idx)=>(
                <tr key={o.id} onClick={()=>setDetalhe(o)}
                  style={{cursor:"pointer",background:idx%2===0?"transparent":C.card2+"44",transition:"background .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.green+"22"}
                  onMouseLeave={e=>e.currentTarget.style.background=idx%2===0?"transparent":C.card2+"44"}>
                  <td style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}22`}}>
                    <span style={{fontSize:22}}>{o.sexo==="Boi"?"🐂":"🐄"}</span>
                  </td>
                  <td style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}22`,color:C.textPrimary,fontWeight:"bold",fontSize:14}}>{getClienteNome(o)}</td>
                  <td style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}22`,color:C.textMuted,fontSize:13}}>{getFrigoNome(o)||"—"}</td>
                  <td style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}22`,color:C.textPrimary,fontSize:14,textAlign:"right"}}>{o.cabecas}</td>
                  <td style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}22`,color:C.textPrimary,fontSize:14,textAlign:"right"}}>{fmt(o.arrobasTotal)}</td>
                  <td style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}22`,color:C.textMuted,fontSize:13,textAlign:"right"}}>R$ {fmt(o.valorCompraArroba)}</td>
                  <td style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}22`,color:C.textMuted,fontSize:13,textAlign:"right"}}>R$ {fmt(o.valorVendaArroba)}</td>
                  <td style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}22`,textAlign:"right"}}>
                    <span style={{fontSize:15,fontWeight:"bold",color:o.lucro>=0?C.profit:C.loss}}>{o.lucro>=0?"+":""}R$ {fmt(o.lucro)}</span>
                  </td>
                  <td style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}22`}}>
                    <Badge cor={o.status==="Concluída"?"verde":"amarelo"} texto={o.status}/>
                  </td>
                  <td style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}22`,color:C.textMuted,fontSize:12,whiteSpace:"nowrap"}}>{o.data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MOBILE CARDS */}
      {isMobile && lista.map(o=>(
        <div key={o.id} onClick={()=>setDetalhe(o)} style={{background:C.card,borderRadius:16,marginBottom:12,border:`1px solid ${C.border}`,cursor:"pointer",overflow:"hidden"}}>
          <div style={{background:C.card2,padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:24}}>{o.sexo==="Boi"?"🐂":"🐄"}</span>
              <div>
                <div style={{fontSize:14,fontWeight:"bold",color:C.textPrimary}}>{getClienteNome(o)}</div>
                <div style={{fontSize:11,color:C.textMuted}}>{getFrigoNome(o)||"Sem frigorífico"}</div>
              </div>
            </div>
            <Badge cor={o.status==="Concluída"?"verde":"amarelo"} texto={o.status}/>
          </div>
          <div style={{padding:"12px 16px"}}>
            <div style={{display:"flex",marginBottom:12}}>
              <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:10,color:C.textMuted}}>Cabeças</div><div style={{fontSize:17,fontWeight:"bold",color:C.textPrimary}}>{o.cabecas}</div></div>
              <div style={{width:1,background:C.border}}/>
              <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:10,color:C.textMuted}}>Arrobas</div><div style={{fontSize:17,fontWeight:"bold",color:C.textPrimary}}>{fmt(o.arrobasTotal)}</div></div>
              <div style={{width:1,background:C.border}}/>
              <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:10,color:C.textMuted}}>Peso Total</div><div style={{fontSize:17,fontWeight:"bold",color:C.textPrimary}}>{fmtInt(o.pesoTotal)}kg</div></div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.card2,borderRadius:10,padding:"10px 14px"}}>
              <div>
                <div style={{fontSize:10,color:C.textMuted}}>Compra → Venda</div>
                <div style={{fontSize:13,color:C.textSecondary}}>R$ {o.valorCompraArroba}/@ → R$ {o.valorVendaArroba}/@</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:C.textMuted}}>Lucro Líquido</div>
                <div style={{fontSize:18,fontWeight:"bold",color:o.lucro>=0?C.profit:C.loss}}>{o.lucro>=0?"+":""}R$ {fmt(o.lucro)}</div>
              </div>
            </div>
            <div style={{fontSize:11,color:C.textMuted,marginTop:8,textAlign:"right"}}>📅 {o.data}</div>
          </div>
        </div>
      ))}

      {/* MODAL DETALHE */}
      {detalhe&&(
        <Modal title="Detalhes da Operação" onClose={()=>setDetalhe(null)}>
          <div id="modal-detalhes-conteudo">
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:56}}>{detalhe.sexo==="Boi"?"🐂":"🐄"}</div>
              <div style={{fontSize:20,fontWeight:"bold",color:C.accent}}>{getClienteNome(detalhe)}</div>
              <div style={{color:C.textMuted,fontSize:13,marginTop:4}}>{getFrigoNome(detalhe)}</div>
              <div style={{marginTop:8}}><Badge cor={detalhe.status==="Concluída"?"verde":"amarelo"} texto={detalhe.status}/></div>
            </div>
            <InfoRow label="📅 Data" value={detalhe.data}/>
            <InfoRow label="Tipo" value={detalhe.sexo}/>
            <InfoRow label="🐄 Cabeças" value={`${detalhe.cabecas} animais`}/>
            <InfoRow label="⚖️ Peso por cabeça" value={`${fmtNum(detalhe.pesoPorCabeca)} kg`}/>
            <InfoRow label="⚖️ Peso total" value={`${fmtNum(detalhe.pesoTotal)} kg`}/>
            <InfoRow label="@ Arrobas totais" value={`${fmtNum(detalhe.arrobasTotal)} @`}/>
            <InfoRow label="💲 Compra/@" value={`R$ ${fmtNum(detalhe.valorCompraArroba)}`}/>
            <InfoRow label="💲 Venda/@" value={`R$ ${fmtNum(detalhe.valorVendaArroba)}`}/>
            <InfoRow label="🔴 Total Compra" value={`R$ ${fmtNum(detalhe.totalCompra)}`}/>
            <InfoRow label="🟢 Total Venda" value={`R$ ${fmtNum(detalhe.totalVenda)}`}/>

            {detalhe.despesas?.length>0&&(
              <div style={{background:C.card2,borderRadius:12,padding:14,margin:"14px 0",border:`1px solid ${C.border}`}}>
                <div style={{fontSize:12,color:C.textSecondary,fontWeight:"bold",marginBottom:10,textTransform:"uppercase",letterSpacing:0.8}}>📋 Despesas</div>
                {detalhe.despesas.map((d,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<detalhe.despesas.length-1?`1px solid ${C.border}`:"none"}}>
                    <span style={{fontSize:13,color:C.textPrimary}}>{d.descricao}</span>
                    <span style={{fontSize:13,color:C.warn,fontWeight:"bold"}}>R$ {fmt(d.valor)}</span>
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
                  <span style={{fontSize:13,fontWeight:"bold",color:C.textPrimary}}>Total Despesas</span>
                  <span style={{fontSize:14,fontWeight:"bold",color:C.warn}}>R$ {fmt(detalhe.totalDespesas)}</span>
                </div>
              </div>
            )}

            <div style={{background:detalhe.lucro>=0?"#0a3a0a":"#3a0a0a",borderRadius:14,padding:20,border:`2px solid ${detalhe.lucro>=0?C.green:"#7a1a1a"}`,textAlign:"center"}}>
              <div style={{fontSize:12,color:C.textMuted,marginBottom:6,letterSpacing:1}}>LUCRO LÍQUIDO</div>
              <div style={{fontSize:30,fontWeight:"bold",color:detalhe.lucro>=0?C.profit:C.loss}}>{detalhe.lucro>=0?"+":""}R$ {fmtNum(detalhe.lucro)}</div>
              <div style={{fontSize:12,color:C.textMuted,marginTop:6}}>
                Margem: {detalhe.totalVenda>0?((detalhe.lucro/detalhe.totalVenda)*100).toFixed(1):0}%
              </div>
            </div>
          </div>

          <div style={{display:"flex",gap:10,marginTop:16}}>
            <button onClick={()=>exportarPDF(detalhe)}
              style={{flex:1,background:C.accent,border:"none",borderRadius:12,padding:14,color:C.bg,fontSize:14,cursor:"pointer",fontFamily:"Georgia,serif",fontWeight:"bold"}}>
              📄 Exportar PDF
            </button>
            <button onClick={()=>excluir(detalhe.id)} disabled={deleting}
              style={{flex:1,background:"#3a0a0a",border:"none",borderRadius:12,padding:14,color:C.loss,fontSize:14,cursor:deleting?"not-allowed":"pointer",fontFamily:"Georgia,serif",opacity:deleting?.6:1}}>
              {deleting?"⏳ Excluindo...":"🗑 Excluir"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CADASTROS
// ════════════════════════════════════════════════════════════════
function Cadastros({dados,onRefresh,isMobile}){
  const [aba,setAba]=useState("clientes");
  const [saving,setSaving]=useState(false);

  // ── Novo cadastro
  const [modalNovoCli,setModalNovoCli]=useState(false);
  const [modalNovoFri,setModalNovoFri]=useState(false);
  const [fNovoCli,setFNovoCli]=useState({nome:"",telefone:"",cidade:""});
  const [fNovoFri,setFNovoFri]=useState({nome:"",cidade:""});

  // ── Detalhe / edição
  const [cliSel,setCliSel]=useState(null);   // cliente selecionado para ver/editar
  const [friSel,setFriSel]=useState(null);   // frigorífico selecionado para ver/editar
  const [editandoCli,setEditandoCli]=useState(false);
  const [editandoFri,setEditandoFri]=useState(false);
  const [fEditCli,setFEditCli]=useState({nome:"",telefone:"",cidade:""});
  const [fEditFri,setFEditFri]=useState({nome:"",cidade:""});

  // ── Abrir detalhe
  const abrirCli = c => { setCliSel(c); setFEditCli({nome:c.nome,telefone:c.telefone||"",cidade:c.cidade||""}); setEditandoCli(false); };
  const abrirFri = f => { setFriSel(f); setFEditFri({nome:f.nome,cidade:f.cidade||""}); setEditandoFri(false); };

  // ── Novo cliente
  const salvarNovoCli=async()=>{
    if(!fNovoCli.nome) return;
    setSaving(true);
    try{
      await apiFetch("/clientes",{method:"POST",body:fNovoCli});
      setFNovoCli({nome:"",telefone:"",cidade:""});
      setModalNovoCli(false);
      await onRefresh("clientes");
    }catch(e){alert(e.message);}
    finally{setSaving(false);}
  };

  // ── Novo frigorífico
  const salvarNovoFri=async()=>{
    if(!fNovoFri.nome) return;
    setSaving(true);
    try{
      await apiFetch("/frigorificos",{method:"POST",body:fNovoFri});
      setFNovoFri({nome:"",cidade:""});
      setModalNovoFri(false);
      await onRefresh("frigorificos");
    }catch(e){alert(e.message);}
    finally{setSaving(false);}
  };

  // ── Editar cliente
  const salvarEditCli=async()=>{
    if(!fEditCli.nome||!cliSel) return;
    setSaving(true);
    try{
      await apiFetch(`/clientes/${cliSel.id}`,{method:"PUT",body:fEditCli});
      setEditandoCli(false);
      setCliSel({...cliSel,...fEditCli});
      await onRefresh("clientes");
    }catch(e){alert(e.message);}
    finally{setSaving(false);}
  };

  // ── Editar frigorífico
  const salvarEditFri=async()=>{
    if(!fEditFri.nome||!friSel) return;
    setSaving(true);
    try{
      await apiFetch(`/frigorificos/${friSel.id}`,{method:"PUT",body:fEditFri});
      setEditandoFri(false);
      setFriSel({...friSel,...fEditFri});
      await onRefresh("frigorificos");
    }catch(e){alert(e.message);}
    finally{setSaving(false);}
  };

  // ── Excluir cliente
  const excluirCli=async()=>{
    if(!window.confirm(`Excluir "${cliSel?.nome}"?`)) return;
    try{
      await apiFetch(`/clientes/${cliSel.id}`,{method:"DELETE"});
      setCliSel(null);
      await onRefresh("clientes");
    }catch(e){alert(e.message);}
  };

  // ── Excluir frigorífico
  const excluirFri=async()=>{
    if(!window.confirm(`Excluir "${friSel?.nome}"?`)) return;
    try{
      await apiFetch(`/frigorificos/${friSel.id}`,{method:"DELETE"});
      setFriSel(null);
      await onRefresh("frigorificos");
    }catch(e){alert(e.message);}
  };

  const cardStyle = {
    background:C.card, borderRadius:14, border:`1px solid ${C.border}`,
    padding:16, cursor:"pointer", transition:"border-color .15s",
    display:"flex", justifyContent:"space-between", alignItems:"center",
  };

  return(
    <div>
      {/* Abas */}
      <div style={{display:"flex",gap:0,margin:"16px 0",background:C.card,borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}`}}>
        {[["clientes","👥 Clientes"],["frigorificos","🏭 Frigoríficos"]].map(([k,l])=>(
          <button key={k} onClick={()=>setAba(k)}
            style={{flex:1,padding:"13px 0",border:"none",background:aba===k?C.green:"transparent",color:aba===k?"#fff":C.textMuted,cursor:"pointer",fontSize:13,fontFamily:"Georgia,serif",fontWeight:aba===k?"bold":"normal"}}>
            {l}
          </button>
        ))}
      </div>

      {/* ── ABA CLIENTES ── */}
      {aba==="clientes"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:11,color:C.textSecondary,letterSpacing:1.5,textTransform:"uppercase",fontWeight:"bold"}}>{dados.clientes.length} cadastrados</div>
            <button onClick={()=>setModalNovoCli(true)} style={{background:`linear-gradient(135deg,${C.green},${C.greenLight})`,border:"none",borderRadius:8,padding:"8px 16px",color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"Georgia,serif",fontWeight:"bold"}}>
              + Novo Cliente
            </button>
          </div>

          {dados.clientes.length===0&&(
            <div style={{textAlign:"center",padding:"50px 0",color:C.textMuted}}>
              <div style={{fontSize:40,marginBottom:10}}>👤</div>
              <div>Nenhum cliente cadastrado</div>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":dados.clientes.length>2?"1fr 1fr":"1fr",gap:10}}>
            {dados.clientes.map(c=>(
              <div key={c.id} style={cardStyle} onClick={()=>abrirCli(c)}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.green}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:44,height:44,background:C.green+"22",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,border:`1px solid ${C.green}33`}}>👤</div>
                  <div>
                    <div style={{fontSize:15,fontWeight:"bold",color:C.accent}}>{c.nome}</div>
                    {c.telefone&&<div style={{fontSize:12,color:C.textMuted,marginTop:2}}>📞 {c.telefone}</div>}
                    {c.cidade&&<div style={{fontSize:12,color:C.textMuted,marginTop:1}}>📍 {c.cidade}</div>}
                  </div>
                </div>
                <span style={{fontSize:14,color:C.textMuted,marginLeft:8}}>›</span>
              </div>
            ))}
          </div>

          {/* Modal Novo Cliente */}
          {modalNovoCli&&(
            <Modal title="➕ Novo Cliente" onClose={()=>setModalNovoCli(false)}>
              <Input label="Nome completo" value={fNovoCli.nome} onChange={v=>setFNovoCli({...fNovoCli,nome:v})} placeholder="Ex: João da Silva" req/>
              <Input label="Telefone / WhatsApp" value={fNovoCli.telefone} onChange={v=>setFNovoCli({...fNovoCli,telefone:v})} placeholder="(00) 99999-9999"/>
              <Input label="Cidade - Estado" value={fNovoCli.cidade} onChange={v=>setFNovoCli({...fNovoCli,cidade:v})} placeholder="Ex: Campo Grande - MS"/>
              <Btn onClick={salvarNovoCli} disabled={saving}>{saving?"⏳ Salvando...":"✅ Cadastrar Cliente"}</Btn>
            </Modal>
          )}

          {/* Modal Detalhe/Edição Cliente */}
          {cliSel&&(
            <Modal title={editandoCli?"✏️ Editar Cliente":"👤 Detalhe do Cliente"} onClose={()=>setCliSel(null)}>
              {!editandoCli?(
                <>
                  {/* Visualização */}
                  <div style={{textAlign:"center",marginBottom:24}}>
                    <div style={{width:72,height:72,background:C.green+"22",borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 12px",border:`2px solid ${C.green}44`}}>👤</div>
                    <div style={{fontSize:20,fontWeight:"bold",color:C.accent}}>{cliSel.nome}</div>
                  </div>
                  <InfoRow label="📞 Telefone" value={cliSel.telefone||"Não informado"}/>
                  <InfoRow label="📍 Cidade" value={cliSel.cidade||"Não informado"}/>

                  <div style={{display:"flex",gap:10,marginTop:24}}>
                    <Btn onClick={()=>setEditandoCli(true)} color={C.green} style={{flex:1}}>
                      ✏️ Editar
                    </Btn>
                    <button onClick={excluirCli}
                      style={{flex:1,background:"#3a0a0a",border:"none",borderRadius:12,padding:"14px",color:C.loss,fontSize:14,cursor:"pointer",fontFamily:"Georgia,serif",fontWeight:"bold"}}>
                      🗑 Excluir
                    </button>
                  </div>
                </>
              ):(
                <>
                  {/* Edição */}
                  <Input label="Nome completo" value={fEditCli.nome} onChange={v=>setFEditCli({...fEditCli,nome:v})} placeholder="Ex: João da Silva" req/>
                  <Input label="Telefone / WhatsApp" value={fEditCli.telefone} onChange={v=>setFEditCli({...fEditCli,telefone:v})} placeholder="(00) 99999-9999"/>
                  <Input label="Cidade - Estado" value={fEditCli.cidade} onChange={v=>setFEditCli({...fEditCli,cidade:v})} placeholder="Ex: Campo Grande - MS"/>
                  <div style={{display:"flex",gap:10,marginTop:8}}>
                    <Btn onClick={()=>setEditandoCli(false)} color="#2a3a1a" style={{flex:1}}>← Cancelar</Btn>
                    <Btn onClick={salvarEditCli} disabled={saving}>{saving?"⏳ Salvando...":"✅ Salvar"}</Btn>
                  </div>
                </>
              )}
            </Modal>
          )}
        </div>
      )}

      {/* ── ABA FRIGORÍFICOS ── */}
      {aba==="frigorificos"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:11,color:C.textSecondary,letterSpacing:1.5,textTransform:"uppercase",fontWeight:"bold"}}>{dados.frigorificos.length} cadastrados</div>
            <button onClick={()=>setModalNovoFri(true)} style={{background:`linear-gradient(135deg,${C.green},${C.greenLight})`,border:"none",borderRadius:8,padding:"8px 16px",color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"Georgia,serif",fontWeight:"bold"}}>
              + Novo Frigorífico
            </button>
          </div>

          {dados.frigorificos.length===0&&(
            <div style={{textAlign:"center",padding:"50px 0",color:C.textMuted}}>
              <div style={{fontSize:40,marginBottom:10}}>🏭</div>
              <div>Nenhum frigorífico cadastrado</div>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":dados.frigorificos.length>2?"1fr 1fr":"1fr",gap:10}}>
            {dados.frigorificos.map(f=>(
              <div key={f.id} style={cardStyle} onClick={()=>abrirFri(f)}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.green}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:44,height:44,background:C.green+"22",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,border:`1px solid ${C.green}33`}}>🏭</div>
                  <div>
                    <div style={{fontSize:15,fontWeight:"bold",color:C.accent}}>{f.nome}</div>
                    {f.cidade&&<div style={{fontSize:12,color:C.textMuted,marginTop:2}}>📍 {f.cidade}</div>}
                  </div>
                </div>
                <span style={{fontSize:14,color:C.textMuted,marginLeft:8}}>›</span>
              </div>
            ))}
          </div>

          {/* Modal Novo Frigorífico */}
          {modalNovoFri&&(
            <Modal title="➕ Novo Frigorífico" onClose={()=>setModalNovoFri(false)}>
              <Input label="Nome do frigorífico" value={fNovoFri.nome} onChange={v=>setFNovoFri({...fNovoFri,nome:v})} placeholder="Ex: JBS - Barretos" req/>
              <Input label="Cidade - Estado" value={fNovoFri.cidade} onChange={v=>setFNovoFri({...fNovoFri,cidade:v})} placeholder="Ex: Barretos - SP"/>
              <Btn onClick={salvarNovoFri} disabled={saving}>{saving?"⏳ Salvando...":"✅ Cadastrar Frigorífico"}</Btn>
            </Modal>
          )}

          {/* Modal Detalhe/Edição Frigorífico */}
          {friSel&&(
            <Modal title={editandoFri?"✏️ Editar Frigorífico":"🏭 Detalhe do Frigorífico"} onClose={()=>setFriSel(null)}>
              {!editandoFri?(
                <>
                  {/* Visualização */}
                  <div style={{textAlign:"center",marginBottom:24}}>
                    <div style={{width:72,height:72,background:C.green+"22",borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 12px",border:`2px solid ${C.green}44`}}>🏭</div>
                    <div style={{fontSize:20,fontWeight:"bold",color:C.accent}}>{friSel.nome}</div>
                  </div>
                  <InfoRow label="📍 Cidade" value={friSel.cidade||"Não informado"}/>

                  <div style={{display:"flex",gap:10,marginTop:24}}>
                    <Btn onClick={()=>setEditandoFri(true)} color={C.green} style={{flex:1}}>
                      ✏️ Editar
                    </Btn>
                    <button onClick={excluirFri}
                      style={{flex:1,background:"#3a0a0a",border:"none",borderRadius:12,padding:"14px",color:C.loss,fontSize:14,cursor:"pointer",fontFamily:"Georgia,serif",fontWeight:"bold"}}>
                      🗑 Excluir
                    </button>
                  </div>
                </>
              ):(
                <>
                  {/* Edição */}
                  <Input label="Nome do frigorífico" value={fEditFri.nome} onChange={v=>setFEditFri({...fEditFri,nome:v})} placeholder="Ex: JBS - Barretos" req/>
                  <Input label="Cidade - Estado" value={fEditFri.cidade} onChange={v=>setFEditFri({...fEditFri,cidade:v})} placeholder="Ex: Barretos - SP"/>
                  <div style={{display:"flex",gap:10,marginTop:8}}>
                    <Btn onClick={()=>setEditandoFri(false)} color="#2a3a1a" style={{flex:1}}>← Cancelar</Btn>
                    <Btn onClick={salvarEditFri} disabled={saving}>{saving?"⏳ Salvando...":"✅ Salvar"}</Btn>
                  </div>
                </>
              )}
            </Modal>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// RELATÓRIO
// ════════════════════════════════════════════════════════════════
function Relatorio({dados,isMobile}){
  const ops=dados.operacoes;
  const totalVenda=ops.reduce((s,o)=>s+o.totalVenda,0);
  const totalCompra=ops.reduce((s,o)=>s+o.totalCompra,0);
  const totalDesp=ops.reduce((s,o)=>s+o.totalDespesas,0);
  const totalLucro=ops.reduce((s,o)=>s+o.lucro,0);
  const totalCab=ops.reduce((s,o)=>s+o.cabecas,0);
  const totalArr=ops.reduce((s,o)=>s+o.arrobasTotal,0);
  const mediaLucro=ops.length?totalLucro/ops.length:0;
  const bois=ops.filter(o=>o.sexo==="Boi"),vacas=ops.filter(o=>o.sexo==="Vaca");
  const lucBois=bois.reduce((s,o)=>s+o.lucro,0),lucVacas=vacas.reduce((s,o)=>s+o.lucro,0);
  const porCliente=ops.reduce((acc,o)=>{acc[o.cliente]=(acc[o.cliente]||0)+o.lucro;return acc;},{});
  const ranking=Object.entries(porCliente).sort((a,b)=>b[1]-a[1]);
  const maxLuc=Math.max(...Object.values(porCliente),1);

  return(
    <div style={{paddingTop:16}}>
      <div style={{fontSize:11,color:C.textSecondary,letterSpacing:1.5,textTransform:"uppercase",fontWeight:"bold",marginBottom:16}}>📊 Relatório Geral</div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:14}}>
        <StatCard label="Faturamento Total" value={`R$ ${(totalVenda/1000).toFixed(0)}k`} cor={C.profit}/>
        <StatCard label="Lucro Líquido" value={`R$ ${(totalLucro/1000).toFixed(0)}k`} cor={C.accent}/>
        <StatCard label="Total Compras" value={`R$ ${(totalCompra/1000).toFixed(0)}k`} cor={C.loss}/>
        <StatCard label="Total Despesas" value={`R$ ${(totalDesp/1000).toFixed(0)}k`} cor={C.warn}/>
      </div>

      <div style={{background:C.card,borderRadius:14,padding:16,marginBottom:14,border:`1px solid ${C.border}`}}>
        <div style={{fontSize:12,color:C.textSecondary,fontWeight:"bold",marginBottom:14,textTransform:"uppercase",letterSpacing:0.8}}>📦 Volume Negociado</div>
        <div style={{display:"flex"}}>
          <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:10,color:C.textMuted}}>Operações</div><div style={{fontSize:22,fontWeight:"bold",color:C.textPrimary}}>{ops.length}</div></div>
          <div style={{width:1,background:C.border}}/>
          <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:10,color:C.textMuted}}>Cabeças</div><div style={{fontSize:22,fontWeight:"bold",color:C.textPrimary}}>{fmtInt(totalCab)}</div></div>
          <div style={{width:1,background:C.border}}/>
          <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:10,color:C.textMuted}}>Arrobas</div><div style={{fontSize:22,fontWeight:"bold",color:C.textPrimary}}>{(totalArr/1000).toFixed(1)}k</div></div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
        {/* Por sexo */}
        <div style={{background:C.card,borderRadius:14,padding:16,border:`1px solid ${C.border}`}}>
          <div style={{fontSize:12,color:C.textSecondary,fontWeight:"bold",marginBottom:14,textTransform:"uppercase",letterSpacing:0.8}}>🐂 Lucro por Tipo</div>
          <div style={{display:"flex",gap:10}}>
            {[["🐂","Bois",bois.length,lucBois],["🐄","Vacas",vacas.length,lucVacas]].map(([ic,nm,qt,lc])=>(
              <div key={nm} style={{flex:1,background:C.card2,borderRadius:10,padding:14,textAlign:"center",border:`1px solid ${C.border}`}}>
                <div style={{fontSize:28}}>{ic}</div>
                <div style={{fontSize:12,color:C.textMuted,marginTop:4}}>{nm} ({qt} ops)</div>
                <div style={{fontSize:17,fontWeight:"bold",color:lc>=0?C.profit:C.loss,marginTop:6}}>R$ {fmt(lc)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Média */}
        <div style={{background:C.card2,borderRadius:14,padding:16,border:`1px solid ${C.border}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          <div style={{fontSize:11,color:C.textMuted,letterSpacing:1}}>LUCRO MÉDIO POR OPERAÇÃO</div>
          <div style={{fontSize:30,fontWeight:"bold",color:mediaLucro>=0?C.profit:C.loss,marginTop:10}}>
            {mediaLucro>=0?"+":""}R$ {fmt(mediaLucro)}
          </div>
          <div style={{fontSize:12,color:C.textMuted,marginTop:6}}>{ops.length} operações no total</div>
        </div>
      </div>

      {/* Ranking clientes */}
      {ranking.length>0&&(
        <div style={{background:C.card,borderRadius:14,padding:16,border:`1px solid ${C.border}`}}>
          <div style={{fontSize:12,color:C.textSecondary,fontWeight:"bold",marginBottom:14,textTransform:"uppercase",letterSpacing:0.8}}>👥 Ranking de Lucro por Cliente</div>
          {ranking.map(([cli,luc],idx)=>(
            <div key={cli} style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:12,color:C.textMuted,fontWeight:"bold",width:20}}>#{idx+1}</span>
                  <span style={{fontSize:14,color:C.textPrimary}}>{cli}</span>
                </div>
                <span style={{fontSize:14,fontWeight:"bold",color:luc>=0?C.profit:C.loss}}>R$ {fmt(luc)}</span>
              </div>
              <div style={{background:C.card2,borderRadius:4,height:8}}>
                <div style={{background:luc>=0?`linear-gradient(90deg,${C.green},${C.greenLight})`:C.loss,height:"100%",width:`${(Math.abs(luc)/maxLuc)*100}%`,borderRadius:4,transition:"width .5s"}}/>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN APP (após login)
// ════════════════════════════════════════════════════════════════
function MainApp({user,onLogout}){
  const isMobile = useIsMobile();
  const [aba,setAba]=useState("operacoes");
  const [novaOp,setNovaOp]=useState(false);
  const [dados,setDados]=useState({operacoes:[],clientes:[],frigorificos:[]});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const fetchAll = useCallback(async()=>{
    try{
      console.log("📥 Carregando operações...");
      const ops = await apiFetch("/operacoes");
      console.log("✅ Operações carregadas:", ops.length);
      
      console.log("📥 Carregando clientes...");
      const clis = await apiFetch("/clientes");
      console.log("✅ Clientes carregados:", clis.length);
      
      console.log("📥 Carregando frigorificos...");
      const fris = await apiFetch("/frigorificos");
      console.log("✅ Frigorificos carregados:", fris.length);
      
      setDados({operacoes:ops,clientes:clis,frigorificos:fris});
      console.log("✅ Todos os dados carregados com sucesso!");
    }catch(e){
      console.error("❌ Erro ao carregar dados:", e);
      setError(e.message||"Erro ao carregar dados");
    }finally{
      setLoading(false);
    }
  },[]);

  const fetchOne = useCallback(async(entity)=>{
    try{
      const data = await apiFetch(`/${entity}`);
      setDados(d=>({...d,[entity]:data}));
    }catch(e){console.error(e);}
  },[]);

  useEffect(()=>{fetchAll();},[fetchAll]);

  const nav=[
    {id:"operacoes",icon:"📋",label:"Operações"},
    {id:"cadastros",icon:"👥",label:"Cadastros"},
    {id:"relatorio",icon:"📊",label:"Relatório"},
  ];

  if(loading) return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:64,marginBottom:16}}>🐂</div>
        <div style={{color:C.textMuted,fontSize:16}}>Carregando dados...</div>
      </div>
    </div>
  );

  if(error) return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif",padding:20}}>
      <div style={{background:C.card,borderRadius:20,padding:32,maxWidth:500,textAlign:"center",border:`1px solid ${C.border}`}}>
        <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
        <div style={{color:C.loss,fontSize:16,marginBottom:8,fontWeight:"bold"}}>Erro ao carregar dados</div>
        <div style={{color:C.textMuted,fontSize:13,marginBottom:20,whiteSpace:"pre-wrap",textAlign:"left",background:C.card2,padding:12,borderRadius:8,border:`1px solid ${C.border}`,maxHeight:150,overflowY:"auto"}}>
          {error}
        </div>
        <div style={{display:"flex",gap:10}}>
          <Btn onClick={()=>{setError("");setLoading(true);fetchAll();}} style={{flex:1}}>🔄 Tentar novamente</Btn>
          <Btn onClick={onLogout} color={C.loss} style={{flex:1}}>🚪 Sair</Btn>
        </div>
      </div>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"Georgia,'Times New Roman',serif",color:C.textPrimary,display:"flex"}}>

      {/* SIDEBAR — desktop */}
      {!isMobile&&(
        <Sidebar aba={aba} setAba={setAba} novaOp={novaOp} setNovaOp={setNovaOp} user={user} onLogout={onLogout}/>
      )}

      {/* MAIN CONTENT */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,maxWidth:isMobile?430:undefined,margin:isMobile?"0 auto":undefined,paddingBottom:isMobile?90:0}}>

        {/* HEADER — mobile */}
        {isMobile&&(
          <div style={{background:"linear-gradient(135deg,#0f2009,#1a3a10)",padding:"16px 18px 12px",position:"sticky",top:0,zIndex:200,borderBottom:`2px solid ${C.green}`,boxShadow:"0 4px 24px rgba(0,0,0,0.6)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:20,fontWeight:"bold",color:C.accent,letterSpacing:1}}>🐂 GadoMarket Pro</div>
                <div style={{fontSize:10,color:C.textMuted,letterSpacing:2,textTransform:"uppercase",marginTop:1}}>Gestão de Compra e Venda</div>
              </div>
              {!novaOp
                ?<button onClick={()=>setNovaOp(true)} style={{background:`linear-gradient(135deg,${C.green},${C.greenLight})`,border:"none",borderRadius:12,padding:"10px 14px",color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"Georgia,serif",fontWeight:"bold"}}>+ Nova Op.</button>
                :<button onClick={()=>setNovaOp(false)} style={{background:"#3a0a0a",border:"none",borderRadius:12,padding:"10px 14px",color:C.loss,fontSize:12,cursor:"pointer",fontFamily:"Georgia,serif"}}>✕ Cancelar</button>
              }
            </div>
          </div>
        )}

        {/* HEADER — desktop (quando em nova operação) */}
        {!isMobile&&(
          <div style={{background:"linear-gradient(135deg,#0e1c0b,#152610)",padding:"18px 28px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
            <div style={{fontSize:15,color:C.textSecondary,fontWeight:"bold",textTransform:"uppercase",letterSpacing:1}}>
              {novaOp?"➕ Nova Operação":aba==="operacoes"?"📋 Operações":aba==="cadastros"?"👥 Cadastros":"📊 Relatório"}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{fontSize:12,color:C.textMuted}}>👤 {user?.username}</div>
              <button onClick={onLogout} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 14px",color:C.textMuted,cursor:"pointer",fontFamily:"Georgia,serif",fontSize:12}}>
                🚪 Sair
              </button>
            </div>
          </div>
        )}

        {/* CONTEÚDO */}
        <div style={{padding:isMobile?"0 16px":"0 28px",paddingTop:isMobile?0:20,flex:1,overflowY:"auto"}}>
          {novaOp
            ?<div style={{paddingTop:20,maxWidth:700}}>
                {isMobile&&<div style={{fontSize:11,color:C.textMuted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:20,fontWeight:"bold"}}>➕ Nova Operação</div>}
                <NovaOperacao dados={dados} onSalvo={fetchAll} onVoltar={()=>setNovaOp(false)} isMobile={isMobile}/>
              </div>
            :<>
                {aba==="operacoes"&&<Operacoes dados={dados} onRefresh={fetchAll} isMobile={isMobile}/>}
                {aba==="cadastros"&&<Cadastros dados={dados} onRefresh={fetchOne} isMobile={isMobile}/>}
                {aba==="relatorio"&&<Relatorio dados={dados} isMobile={isMobile}/>}
              </>
          }
        </div>

        {/* BOTTOM NAV — mobile */}
        {isMobile&&!novaOp&&(
          <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"#080f06",borderTop:`2px solid ${C.border}`,display:"flex",padding:"10px 0 20px",zIndex:200}}>
            {nav.map(n=>(
              <button key={n.id} onClick={()=>setAba(n.id)}
                style={{flex:1,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <span style={{fontSize:aba===n.id?24:20,transition:"all .2s"}}>{n.icon}</span>
                <span style={{fontSize:10,color:aba===n.id?C.accent:C.textMuted,fontFamily:"Georgia,serif",fontWeight:aba===n.id?"bold":"normal"}}>{n.label}</span>
                {aba===n.id&&<div style={{width:5,height:5,background:C.greenLight,borderRadius:"50%"}}/>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ROOT — gerencia autenticação
// ════════════════════════════════════════════════════════════════
export default function App(){
  const [user,setUser]=useState(null);
  const [checking,setChecking]=useState(true);
  const [sessionError,setSessionError]=useState("");

  useEffect(()=>{
    const token=localStorage.getItem("gm_token");
    const username=localStorage.getItem("gm_user");
    if(token&&username){
      // Verifica se o token ainda é válido
      apiFetch("/me").then(data=>{
        setUser({token,username:data.username});
        console.log("✅ Sessão validada:", data.username);
      }).catch((err)=>{
        console.error("❌ Erro ao validar sessão:", err.message);
        localStorage.removeItem("gm_token");
        localStorage.removeItem("gm_user");
        setSessionError(err.message);
      }).finally(()=>setChecking(false));
    }else{
      setChecking(false);
    }
  },[]);

  const handleLogin=data=>{
    console.log("✅ Login bem-sucedido:", data.username);
    localStorage.setItem("gm_token",data.token);
    localStorage.setItem("gm_user",data.username);
    setUser(data);
  };

  const handleLogout=()=>{
    console.log("🚪 Logout");
    localStorage.removeItem("gm_token");
    localStorage.removeItem("gm_user");
    setUser(null);
  };

  if(checking) return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif"}}>
      <div style={{textAlign:"center",color:C.textMuted}}>
        <div style={{fontSize:56,marginBottom:12}}>🐂</div>
        <div>Verificando sessão...</div>
        {sessionError&&<div style={{fontSize:12,color:C.loss,marginTop:12}}>Erro: {sessionError}</div>}
      </div>
    </div>
  );

  if(!user) return <LoginPage onLogin={handleLogin}/>;
  return <MainApp user={user} onLogout={handleLogout}/>;
}
