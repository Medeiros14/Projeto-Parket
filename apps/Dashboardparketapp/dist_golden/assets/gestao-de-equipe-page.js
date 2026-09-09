/* ═══ Gestão de Equipe — análise individual de membros ═══
 * Rota: /ceo-dashboard/gestao-de-equipe
 * Acesso: superadmin / admin
 * Fontes: user_profiles + user_sessions + kanban_cards (proxy) + orcamento_tracking
 */
import {R as REACT, r as RE, s as SB, j as o} from "./index-DZtetJYP.js";

const C = {
  bg: "#0A0A0A", cardBg: "rgba(255,255,255,0.02)",
  border: "rgba(255,255,255,0.08)",
  textDim: "rgba(255,255,255,0.4)", textMed: "rgba(255,255,255,0.7)",
  accent: "#D4A853", red: "#EF4444", green: "#10B981",
  yellow: "#F59E0B", blue: "#60A5FA", purple: "#A78BFA", teal: "#14B8A6"
};
const ROLE_LABEL = {superadmin:"Super Admin", admin:"Admin", user:"Usuário", ia:"🤖 IA"};
const ROLE_COLOR = {superadmin:C.accent, admin:C.blue, user:"#A1A1AA", ia:C.purple};

function initials(name){
  const p=(name||"").trim().split(/\s+/);
  return ((p[0]?.[0]||"")+(p[1]?.[0]||"")).toUpperCase()||"?";
}
function fmtAgo(ts){
  if(!ts)return"—";
  const d=Math.floor((Date.now()-ts)/86400000);
  if(d<=0)return"hoje";
  if(d===1)return"ontem";
  if(d<30)return`há ${d}d`;
  if(d<365)return`há ${Math.floor(d/30)}m`;
  return`há ${Math.floor(d/365)}a`;
}
function fmtDur(s){
  if(!s||s<0)return"—";
  if(s<60)return`${s}s`;
  if(s<3600)return`${Math.round(s/60)}min`;
  return`${(s/3600).toFixed(1)}h`;
}
function fmtDT(s){
  if(!s)return"—";
  try{return new Date(s).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}catch{return String(s)}
}
function _ua(s){
  s=s||"";
  if(s.includes("iPhone")||s.includes("Android"))return"📱";
  if(s.includes("Edg"))return"Edge";
  if(s.includes("Chrome"))return"Chrome";
  if(s.includes("Firefox"))return"Firefox";
  if(s.includes("Safari"))return"Safari";
  return"Web";
}
function _norm(s){return(s||"").trim().toLowerCase()}

function useData(){
  const[s,setS]=RE.useState({loading:true,profiles:[],cards:[],sessions:[],orcs:[],events:[],me:null});
  RE.useEffect(()=>{
    let alive=true;
    async function load(){
      const{data:{user:me}}=await SB.auth.getUser();
      const[p,k,sess,or,ev]=await Promise.all([
        SB.from("user_profiles").select("id,email,full_name,role,dept_permissions,avatar_color,created_at"),
        SB.from("kanban_cards").select("responsavel,updated_at").not("responsavel","is",null),
        SB.from("user_sessions").select("user_id,login_at,logout_at,duracao_segundos,user_agent").order("login_at",{ascending:false}),
        SB.from("orcamento_tracking").select("vendedor,tempo_segundos"),
        SB.from("card_events").select("user_id,card_id,card_dept_id,action,from_column_slug,to_column_slug,created_at").order("created_at",{ascending:false}).limit(5000)
      ]);
      if(alive)setS({loading:false,profiles:p.data||[],cards:k.data||[],sessions:sess.data||[],orcs:or.data||[],events:ev.data||[],me});
    }
    load();
    const ch=SB.channel("gestao-equipe")
      .on("postgres_changes",{event:"*",schema:"public",table:"user_sessions"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"card_events"},load)
      .subscribe();
    return()=>{alive=false;SB.removeChannel(ch)};
  },[]);
  return s;
}

function aggregate(profiles,cards,sessions,orcs,events){
  const byName={},now=Date.now();
  for(const c of cards){
    const r=_norm(c.responsavel);if(!r)continue;
    if(!byName[r])byName[r]={total:0,d7:0,d30:0,last:0};
    byName[r].total++;
    const ts=Date.parse(c.updated_at)||0;
    const d=(now-ts)/86400000;
    if(d<=7)byName[r].d7++;
    if(d<=30)byName[r].d30++;
    if(ts>byName[r].last)byName[r].last=ts;
  }
  const byOrc={};
  for(const o of orcs){
    const r=_norm(o.vendedor);if(!r)continue;
    byOrc[r]=(byOrc[r]||0)+(o.tempo_segundos||0);
  }
  const bySess={};
  for(const s of sessions){
    if(!bySess[s.user_id])bySess[s.user_id]=[];
    bySess[s.user_id].push(s);
  }
  // Eventos agregados por user_id
  const byEv={};
  for(const e of events||[]){
    if(!e.user_id)continue;
    if(!byEv[e.user_id])byEv[e.user_id]={move:0,edit:0,create:0,delete:0,total:0,d7:0,d30:0,list:[]};
    const row=byEv[e.user_id];
    row[e.action]=(row[e.action]||0)+1;
    row.total++;
    const ts=Date.parse(e.created_at)||0;
    const d=(now-ts)/86400000;
    if(d<=7)row.d7++;
    if(d<=30)row.d30++;
    if(row.list.length<50)row.list.push(e);
  }
  return profiles.map(p=>{
    const k=_norm(p.full_name);
    const a=byName[k]||{total:0,d7:0,d30:0,last:0};
    const userSess=bySess[p.id]||[];
    const tempo=userSess.reduce((s,x)=>s+(x.duracao_segundos||0),0);
    const ev=byEv[p.id]||{move:0,edit:0,create:0,delete:0,total:0,d7:0,d30:0,list:[]};
    let depts=0;
    try{
      const dp=typeof p.dept_permissions==="string"?JSON.parse(p.dept_permissions):p.dept_permissions;
      if(dp&&typeof dp==="object")depts=Object.keys(dp).length;
    }catch(_){}
    return{...p,_depts:depts,_total:a.total,_d7:a.d7,_d30:a.d30,_last:a.last,_orc:byOrc[k]||0,_sessions:userSess,_tempo:tempo,_lastSess:userSess[0]?.login_at,_ev:ev};
  });
}

function MemberCard({user,onClick}){
  const rc=ROLE_COLOR[user.role]||C.textDim;
  const rl=ROLE_LABEL[user.role]||user.role;
  const ativo=user._d7>0||user._sessions.length>0;
  const lastTs=Math.max(user._last||0,Date.parse(user._lastSess||0)||0);
  return o.jsxs("button",{onClick:()=>onClick(user),style:{width:"100%",textAlign:"left",padding:14,background:C.cardBg,border:`1px solid ${C.border}`,borderRadius:12,cursor:"pointer",transition:"border-color 0.15s",display:"flex",flexDirection:"column",gap:10,color:"#fff",font:"inherit"},onMouseEnter:e=>e.currentTarget.style.borderColor=C.accent+"60",onMouseLeave:e=>e.currentTarget.style.borderColor=C.border,children:[
    o.jsxs("div",{style:{display:"flex",alignItems:"center",gap:10},children:[
      o.jsx("div",{style:{width:38,height:38,borderRadius:10,background:`${user.avatar_color||"#6B7280"}25`,color:user.avatar_color||"#6B7280",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:"0.75rem",flexShrink:0},children:initials(user.full_name)}),
      o.jsxs("div",{style:{flex:1,minWidth:0},children:[
        o.jsx("div",{style:{fontSize:"0.75rem",fontWeight:600,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:user.full_name||"(sem nome)"}),
        o.jsx("div",{style:{fontSize:"0.55rem",color:C.textDim,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginTop:2},children:user.email||"—"})
      ]}),
      ativo?o.jsx("div",{title:"Ativo",style:{width:8,height:8,borderRadius:"50%",background:C.green,flexShrink:0}}):null
    ]}),
    o.jsxs("div",{style:{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"},children:[
      o.jsx("span",{style:{padding:"2px 8px",borderRadius:10,fontSize:"0.48rem",fontWeight:700,background:`${rc}22`,color:rc,textTransform:"uppercase",letterSpacing:"0.05em"},children:rl}),
      user._depts>0?o.jsxs("span",{style:{fontSize:"0.55rem",color:C.textMed},children:[user._depts," depts"]}):null
    ]}),
    o.jsxs("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,paddingTop:8,borderTop:`1px solid ${C.border}`},children:[
      o.jsxs("div",{children:[
        o.jsx("div",{style:{fontSize:"0.42rem",color:C.textDim,textTransform:"uppercase",letterSpacing:"0.08em"},children:"Cards 30d"}),
        o.jsx("div",{style:{fontSize:"0.8rem",fontWeight:700,color:user._d30>0?C.accent:C.textDim,marginTop:2},children:user._d30||"—"})
      ]}),
      o.jsxs("div",{children:[
        o.jsx("div",{style:{fontSize:"0.42rem",color:C.textDim,textTransform:"uppercase",letterSpacing:"0.08em"},children:"Sessões"}),
        o.jsx("div",{style:{fontSize:"0.8rem",fontWeight:700,color:user._sessions.length>0?C.blue:C.textDim,marginTop:2},children:user._sessions.length||"—"})
      ]}),
      o.jsxs("div",{children:[
        o.jsx("div",{style:{fontSize:"0.42rem",color:C.textDim,textTransform:"uppercase",letterSpacing:"0.08em"},children:"Última"}),
        o.jsx("div",{style:{fontSize:"0.62rem",fontWeight:600,color:lastTs?C.textMed:C.textDim,marginTop:2},children:fmtAgo(lastTs)})
      ]})
    ]})
  ]})
}

function MemberDrawer({user,onClose}){
  const[evState,setEvState]=RE.useState({events:[],loading:true,total:null,showingAll:false});
  const[page,setPage]=RE.useState(0);
  RE.useEffect(()=>{
    if(!user)return;
    setPage(0);
    setEvState({events:[],loading:true,total:null,showingAll:false});
    let alive=true;
    (async()=>{
      const[{data,count}]=await Promise.all([
        SB.from("card_events").select("card_id,card_dept_id,action,from_column_slug,to_column_slug,created_at,details",{count:"exact"}).eq("user_id",user.id).order("created_at",{ascending:false}).limit(500)
      ]);
      if(alive)setEvState({events:data||[],loading:false,total:count||(data||[]).length,showingAll:false});
    })();
    const ch=SB.channel("user-events-"+user.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"card_events",filter:`user_id=eq.${user.id}`},payload=>{
      if(alive)setEvState(s=>({...s,events:[payload.new,...s.events].slice(0,Math.max(s.events.length+1,500)),total:(s.total||0)+1}));
    }).subscribe();
    return()=>{alive=false;SB.removeChannel(ch)};
  },[user?.id]);
  async function loadAll(){
    if(!user)return;
    setEvState(s=>({...s,loading:true}));
    const{data}=await SB.from("card_events").select("card_id,card_dept_id,action,from_column_slug,to_column_slug,created_at,details").eq("user_id",user.id).order("created_at",{ascending:false});
    setEvState(s=>({...s,events:data||[],loading:false,showingAll:true,total:(data||[]).length}));
  }
  if(!user)return null;
  const rc=ROLE_COLOR[user.role]||C.textDim;
  const rl=ROLE_LABEL[user.role]||user.role;
  let depts={};
  try{
    const dp=typeof user.dept_permissions==="string"?JSON.parse(user.dept_permissions):user.dept_permissions;
    if(dp&&typeof dp==="object")depts=dp;
  }catch(_){}
  return o.jsx("div",{onClick:onClose,style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:9999,display:"flex",justifyContent:"flex-end"},children:o.jsxs("div",{onClick:e=>e.stopPropagation(),style:{width:600,maxWidth:"95vw",height:"100vh",background:C.bg,borderLeft:`1px solid ${C.border}`,overflowY:"auto",padding:24},children:[
    o.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,gap:12},children:[
      o.jsxs("div",{style:{display:"flex",alignItems:"center",gap:14},children:[
        o.jsx("div",{style:{width:56,height:56,borderRadius:14,background:`${user.avatar_color||"#6B7280"}25`,color:user.avatar_color||"#6B7280",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:"1.1rem"},children:initials(user.full_name)}),
        o.jsxs("div",{children:[
          o.jsx("h2",{style:{fontSize:"1rem",fontWeight:700,color:"#fff",margin:0},children:user.full_name||"(sem nome)"}),
          o.jsx("p",{style:{fontSize:"0.65rem",color:C.textMed,margin:"3px 0 6px"},children:user.email||"—"}),
          o.jsx("span",{style:{padding:"3px 10px",borderRadius:10,fontSize:"0.5rem",fontWeight:700,background:`${rc}22`,color:rc,textTransform:"uppercase",letterSpacing:"0.05em"},children:rl})
        ]})
      ]}),
      o.jsx("button",{onClick:onClose,style:{background:"none",border:"none",color:C.textDim,fontSize:"1.5rem",cursor:"pointer",width:32,height:32,padding:0,lineHeight:1},children:"×"})
    ]}),
    o.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:24},children:[
      o.jsxs("div",{style:{padding:10,background:C.cardBg,border:`1px solid ${C.border}`,borderRadius:8},children:[
        o.jsx("div",{style:{fontSize:"0.42rem",color:C.textDim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4},children:"Sessões"}),
        o.jsx("div",{style:{fontSize:"1rem",fontWeight:700,color:C.blue},children:user._sessions.length||0})
      ]}),
      o.jsxs("div",{style:{padding:10,background:C.cardBg,border:`1px solid ${C.border}`,borderRadius:8},children:[
        o.jsx("div",{style:{fontSize:"0.42rem",color:C.textDim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4},children:"Tempo logado"}),
        o.jsx("div",{style:{fontSize:"1rem",fontWeight:700,color:C.purple},children:fmtDur(user._tempo)})
      ]}),
      o.jsxs("div",{style:{padding:10,background:C.cardBg,border:`1px solid ${C.border}`,borderRadius:8},children:[
        o.jsx("div",{style:{fontSize:"0.42rem",color:C.textDim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4},children:"Cards 30d"}),
        o.jsx("div",{style:{fontSize:"1rem",fontWeight:700,color:C.accent},children:user._d30||0})
      ]}),
      o.jsxs("div",{style:{padding:10,background:C.cardBg,border:`1px solid ${C.border}`,borderRadius:8},children:[
        o.jsx("div",{style:{fontSize:"0.42rem",color:C.textDim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4},children:"Orçamento"}),
        o.jsx("div",{style:{fontSize:"1rem",fontWeight:700,color:C.teal},children:fmtDur(user._orc)})
      ]})
    ]}),
    o.jsxs("div",{style:{marginBottom:24},children:[
      o.jsxs("h3",{style:{fontSize:"0.6rem",fontWeight:700,color:C.textDim,textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 10px"},children:["Sessões (",user._sessions.length,")"]}),
      user._sessions.length===0?
        o.jsx("p",{style:{fontSize:"0.65rem",color:C.textDim,fontStyle:"italic"},children:"Sem sessões registradas (tracking começou em 11/05/2026)"}):
        o.jsx("div",{style:{overflowX:"auto",border:`1px solid ${C.border}`,borderRadius:6,background:C.cardBg},children:o.jsxs("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:"0.58rem"},children:[
          o.jsx("thead",{children:o.jsxs("tr",{style:{borderBottom:`1px solid ${C.border}`,background:"rgba(0,0,0,0.25)"},children:[
            o.jsx("th",{style:{textAlign:"left",padding:"8px 10px",color:C.textDim,fontWeight:700,fontSize:"0.48rem",letterSpacing:"0.08em",textTransform:"uppercase"},children:"Login"}),
            o.jsx("th",{style:{textAlign:"left",padding:"8px 10px",color:C.textDim,fontWeight:700,fontSize:"0.48rem",letterSpacing:"0.08em",textTransform:"uppercase"},children:"Logout"}),
            o.jsx("th",{style:{textAlign:"right",padding:"8px 10px",color:C.textDim,fontWeight:700,fontSize:"0.48rem",letterSpacing:"0.08em",textTransform:"uppercase"},children:"Duração"}),
            o.jsx("th",{style:{textAlign:"left",padding:"8px 10px",color:C.textDim,fontWeight:700,fontSize:"0.48rem",letterSpacing:"0.08em",textTransform:"uppercase"},children:"Dispositivo"})
          ]})}),
          o.jsx("tbody",{children:user._sessions.slice(0,30).map((s,i)=>o.jsxs("tr",{style:{borderBottom:`1px solid ${C.border}`},children:[
            o.jsx("td",{style:{padding:"7px 10px",color:"#fff"},children:fmtDT(s.login_at)}),
            o.jsx("td",{style:{padding:"7px 10px",color:s.logout_at?C.textMed:C.green,fontWeight:s.logout_at?400:600},children:s.logout_at?fmtDT(s.logout_at):"em sessão"}),
            o.jsx("td",{style:{padding:"7px 10px",textAlign:"right",color:C.textMed},children:s.duracao_segundos?fmtDur(s.duracao_segundos):"—"}),
            o.jsx("td",{style:{padding:"7px 10px",color:C.textDim,fontSize:"0.55rem"},title:s.user_agent,children:_ua(s.user_agent)})
          ]},i))})
        ]})})
    ]}),
    o.jsxs("div",{style:{marginBottom:24},children:[
      o.jsxs("h3",{style:{fontSize:"0.6rem",fontWeight:700,color:C.textDim,textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 10px"},children:["Departamentos (",Object.keys(depts).length,")"]}),
      Object.keys(depts).length===0?
        o.jsx("p",{style:{fontSize:"0.65rem",color:C.textDim,fontStyle:"italic"},children:"Sem permissões cadastradas"}):
        o.jsx("div",{style:{display:"flex",gap:6,flexWrap:"wrap"},children:Object.keys(depts).map(d=>o.jsx("span",{style:{padding:"4px 10px",borderRadius:6,fontSize:"0.55rem",fontWeight:600,background:"rgba(96,165,250,0.15)",color:C.blue,letterSpacing:"0.03em"},children:d},d))})
    ]}),
    o.jsxs("div",{children:[
      o.jsxs("h3",{style:{fontSize:"0.6rem",fontWeight:700,color:C.textDim,textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 10px"},children:["Ações no kanban (",user._ev.total,")"]}),
      o.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:12},children:[
        o.jsxs("div",{style:{padding:8,background:C.cardBg,border:`1px solid ${C.border}`,borderRadius:6,textAlign:"center"},children:[
          o.jsx("div",{style:{fontSize:"1rem",fontWeight:700,color:C.blue},children:user._ev.move||0}),
          o.jsx("div",{style:{fontSize:"0.45rem",color:C.textDim,textTransform:"uppercase",letterSpacing:"0.06em",marginTop:2},children:"Movidos"})
        ]}),
        o.jsxs("div",{style:{padding:8,background:C.cardBg,border:`1px solid ${C.border}`,borderRadius:6,textAlign:"center"},children:[
          o.jsx("div",{style:{fontSize:"1rem",fontWeight:700,color:C.accent},children:user._ev.edit||0}),
          o.jsx("div",{style:{fontSize:"0.45rem",color:C.textDim,textTransform:"uppercase",letterSpacing:"0.06em",marginTop:2},children:"Editados"})
        ]}),
        o.jsxs("div",{style:{padding:8,background:C.cardBg,border:`1px solid ${C.border}`,borderRadius:6,textAlign:"center"},children:[
          o.jsx("div",{style:{fontSize:"1rem",fontWeight:700,color:C.green},children:user._ev.create||0}),
          o.jsx("div",{style:{fontSize:"0.45rem",color:C.textDim,textTransform:"uppercase",letterSpacing:"0.06em",marginTop:2},children:"Criados"})
        ]}),
        o.jsxs("div",{style:{padding:8,background:C.cardBg,border:`1px solid ${C.border}`,borderRadius:6,textAlign:"center"},children:[
          o.jsx("div",{style:{fontSize:"1rem",fontWeight:700,color:C.red},children:user._ev.delete||0}),
          o.jsx("div",{style:{fontSize:"0.45rem",color:C.textDim,textTransform:"uppercase",letterSpacing:"0.06em",marginTop:2},children:"Deletados"})
        ]})
      ]}),
      (function(){
        const total=evState.total||0;
        const list=evState.events||[];
        const pageSize=50;
        const maxPages=evState.showingAll?Math.ceil(list.length/pageSize):Math.min(10,Math.ceil(list.length/pageSize));
        const curPage=Math.min(page,Math.max(0,maxPages-1));
        const slice=list.slice(curPage*pageSize,curPage*pageSize+pageSize);
        const isLastBufferPage=!evState.showingAll&&list.length>=500&&curPage===maxPages-1;
        const moreThanBuffer=!evState.showingAll&&total>list.length;
        const showLoadAllBtn=moreThanBuffer||(list.length>=500&&!evState.showingAll);
        if(evState.loading&&list.length===0)return o.jsx("p",{style:{fontSize:"0.6rem",color:C.textDim,padding:"10px 0"},children:"Carregando histórico…"});
        if(list.length===0)return o.jsx("p",{style:{fontSize:"0.6rem",color:C.textDim,fontStyle:"italic",padding:"10px 0"},children:"Sem ações registradas (tracking começou em 11/05/2026)"});
        return o.jsxs("div",{children:[
          o.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6},children:[
            o.jsxs("div",{style:{fontSize:"0.5rem",color:C.textDim,textTransform:"uppercase",letterSpacing:"0.08em"},children:[
              evState.showingAll?`Timeline completa (${total} eventos)`:`Timeline · página ${curPage+1}/${maxPages} · mostrando ${slice.length} de ${total}`
            ]}),
            evState.loading?o.jsx("span",{style:{fontSize:"0.5rem",color:C.textDim},children:"carregando…"}):null
          ]}),
          o.jsx("div",{style:{maxHeight:380,overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:6,background:C.cardBg},children:slice.map((e,i)=>{
            const actMeta={move:{cl:C.blue,lb:"→",txt:(e.from_column_slug||"?")+" → "+(e.to_column_slug||"?")},edit:{cl:C.accent,lb:"✎",txt:"editou"},create:{cl:C.green,lb:"+",txt:"criou em "+(e.to_column_slug||"—")},delete:{cl:C.red,lb:"×",txt:"deletou de "+(e.from_column_slug||"—")}};
            const m=actMeta[e.action]||{cl:C.textDim,lb:"·",txt:e.action};
            return o.jsxs("div",{style:{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderBottom:i<slice.length-1?`1px solid ${C.border}`:"none",fontSize:"0.55rem"},children:[
              o.jsx("span",{style:{width:18,height:18,borderRadius:"50%",background:`${m.cl}22`,color:m.cl,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:"0.55rem",flexShrink:0},children:m.lb}),
              o.jsx("span",{style:{flex:1,color:C.textMed,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:m.txt}),
              o.jsx("span",{style:{color:C.textDim,fontSize:"0.5rem",flexShrink:0},children:e.card_dept_id||""}),
              o.jsx("span",{style:{color:C.textDim,fontSize:"0.5rem",flexShrink:0},title:fmtDT(e.created_at),children:fmtAgo(Date.parse(e.created_at))})
            ]},(e.created_at||"")+"-"+i)
          })}),
          o.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginTop:10,flexWrap:"wrap"},children:[
            o.jsxs("div",{style:{display:"flex",gap:6},children:[
              o.jsx("button",{disabled:curPage===0,onClick:()=>setPage(p=>Math.max(0,p-1)),style:{padding:"6px 12px",fontSize:"0.55rem",fontWeight:600,background:curPage===0?"rgba(255,255,255,0.02)":C.cardBg,color:curPage===0?C.textDim:C.textMed,border:`1px solid ${C.border}`,borderRadius:5,cursor:curPage===0?"default":"pointer",textTransform:"uppercase",letterSpacing:"0.05em"},children:"← Anterior"}),
              o.jsx("button",{disabled:curPage>=maxPages-1,onClick:()=>setPage(p=>Math.min(maxPages-1,p+1)),style:{padding:"6px 12px",fontSize:"0.55rem",fontWeight:600,background:curPage>=maxPages-1?"rgba(255,255,255,0.02)":C.cardBg,color:curPage>=maxPages-1?C.textDim:C.textMed,border:`1px solid ${C.border}`,borderRadius:5,cursor:curPage>=maxPages-1?"default":"pointer",textTransform:"uppercase",letterSpacing:"0.05em"},children:"Próxima →"})
            ]}),
            showLoadAllBtn?o.jsx("button",{disabled:evState.loading,onClick:loadAll,style:{padding:"6px 14px",fontSize:"0.55rem",fontWeight:700,background:`${C.accent}22`,color:C.accent,border:`1px solid ${C.accent}50`,borderRadius:5,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.05em"},children:`Ver completo (${total||"todos"} eventos) →`}):null,
            evState.showingAll?o.jsxs("span",{style:{fontSize:"0.5rem",color:C.green,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"},children:["✓ Histórico completo carregado"]}):null
          ]})
        ]})
      })()
    ]})
  ]})});
}

export function GestaoDeEquipePage(){
  const data=useData();
  const[openUser,setOpenUser]=RE.useState(null);
  const[search,setSearch]=RE.useState("");
  const[roleFilter,setRoleFilter]=RE.useState("all");
  const[deptFilter,setDeptFilter]=RE.useState("all");
  if(data.loading)return o.jsx("div",{style:{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",color:C.textDim,fontSize:"0.8rem"},children:"Carregando gestão de equipe…"});
  const me=data.profiles.find(p=>p.id===data.me?.id);
  if(!me||(me.role!=="superadmin"&&me.role!=="admin")){
    return o.jsx("div",{style:{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24},children:o.jsxs("div",{style:{textAlign:"center",maxWidth:380},children:[
      o.jsx("div",{style:{fontSize:"2.5rem",marginBottom:12},children:"🔒"}),
      o.jsx("h2",{style:{fontSize:"1rem",fontWeight:700,color:"#fff",margin:"0 0 8px"},children:"Acesso restrito"}),
      o.jsx("p",{style:{fontSize:"0.7rem",color:C.textMed,margin:"0 0 20px"},children:"Gestão de Equipe é exclusiva pra Super Admins e Admins."}),
      o.jsx("a",{href:"/ceo-dashboard",style:{display:"inline-block",padding:"8px 16px",fontSize:"0.65rem",fontWeight:600,background:C.accent,color:"#000",borderRadius:6,textDecoration:"none"},children:"Voltar"})
    ]})});
  }
  const enriched=aggregate(data.profiles,data.cards,data.sessions,data.orcs,data.events);
  // Lista de setores únicos extraídos do dept_permissions de cada profile
  const allDepts=(()=>{
    const set=new Set();
    for(const p of data.profiles){
      try{
        const dp=typeof p.dept_permissions==="string"?JSON.parse(p.dept_permissions):p.dept_permissions;
        if(dp&&typeof dp==="object")for(const k of Object.keys(dp))set.add(k);
      }catch(_){}
    }
    return Array.from(set).sort();
  })();
  const _userHasDept=(u,d)=>{
    try{
      const dp=typeof u.dept_permissions==="string"?JSON.parse(u.dept_permissions):u.dept_permissions;
      return !!(dp&&typeof dp==="object"&&dp[d]);
    }catch(_){return false;}
  };
  const filtered=enriched.filter(u=>{
    if(roleFilter!=="all"&&u.role!==roleFilter)return false;
    if(deptFilter!=="all"&&!_userHasDept(u,deptFilter))return false;
    const q=search.trim().toLowerCase();
    if(q&&!((u.full_name||"")+" "+(u.email||"")).toLowerCase().includes(q))return false;
    return true;
  }).sort((a,b)=>{
    const aL=Math.max(a._last||0,Date.parse(a._lastSess||0)||0);
    const bL=Math.max(b._last||0,Date.parse(b._lastSess||0)||0);
    return bL-aL;
  });
  const totalAtivos=enriched.filter(u=>u._d7>0||u._sessions.length>0).length;
  const totalSessoes=data.sessions.length;
  const totalTempo=enriched.reduce((s,u)=>s+u._tempo,0);
  return o.jsxs("div",{style:{minHeight:"100vh",background:C.bg,padding:"20px 24px"},children:[
    o.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,gap:12,flexWrap:"wrap"},children:[
      o.jsxs("div",{children:[
        o.jsx("a",{href:"/ceo-dashboard",style:{color:C.textDim,fontSize:"0.6rem",textDecoration:"none",letterSpacing:"0.05em"},children:"← CEO Dashboard"}),
        o.jsx("h1",{style:{fontSize:"1.4rem",fontWeight:700,color:"#fff",margin:"6px 0 0"},children:"Gestão de Equipe"}),
        o.jsxs("p",{style:{fontSize:"0.65rem",color:C.textMed,margin:"4px 0 0"},children:[data.profiles.length," membros · análise individual · realtime"]})
      ]}),
      o.jsxs("div",{style:{display:"flex",gap:8},children:[
        o.jsxs("div",{style:{padding:"8px 12px",background:C.cardBg,border:`1px solid ${C.border}`,borderRadius:8,minWidth:80},children:[
          o.jsx("div",{style:{fontSize:"0.42rem",color:C.textDim,textTransform:"uppercase",letterSpacing:"0.08em"},children:"Ativos"}),
          o.jsx("div",{style:{fontSize:"1rem",fontWeight:700,color:C.green,marginTop:2},children:totalAtivos})
        ]}),
        o.jsxs("div",{style:{padding:"8px 12px",background:C.cardBg,border:`1px solid ${C.border}`,borderRadius:8,minWidth:80},children:[
          o.jsx("div",{style:{fontSize:"0.42rem",color:C.textDim,textTransform:"uppercase",letterSpacing:"0.08em"},children:"Sessões"}),
          o.jsx("div",{style:{fontSize:"1rem",fontWeight:700,color:C.blue,marginTop:2},children:totalSessoes})
        ]}),
        o.jsxs("div",{style:{padding:"8px 12px",background:C.cardBg,border:`1px solid ${C.border}`,borderRadius:8,minWidth:80},children:[
          o.jsx("div",{style:{fontSize:"0.42rem",color:C.textDim,textTransform:"uppercase",letterSpacing:"0.08em"},children:"Tempo"}),
          o.jsx("div",{style:{fontSize:"1rem",fontWeight:700,color:C.purple,marginTop:2},children:fmtDur(totalTempo)})
        ]})
      ]})
    ]}),
    o.jsxs("div",{style:{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"},children:[
      o.jsx("input",{value:search,onChange:e=>setSearch(e.target.value),placeholder:"🔍 Buscar membro…",style:{flex:"1 1 280px",padding:"8px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:6,color:"#fff",fontSize:"0.7rem",outline:"none"}}),
      o.jsxs("select",{value:roleFilter,onChange:e=>setRoleFilter(e.target.value),style:{padding:"8px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:6,color:"#fff",fontSize:"0.7rem",outline:"none"},children:[
        o.jsx("option",{value:"all",children:"Todos roles"},"all"),
        o.jsx("option",{value:"superadmin",children:"Super Admin"},"sa"),
        o.jsx("option",{value:"admin",children:"Admin"},"a"),
        o.jsx("option",{value:"user",children:"Usuário"},"u")
      ]}),
      o.jsxs("select",{value:deptFilter,onChange:e=>setDeptFilter(e.target.value),style:{padding:"8px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:6,color:"#fff",fontSize:"0.7rem",outline:"none",minWidth:160},children:[
        o.jsx("option",{value:"all",children:"Todos setores"},"all"),
        ...allDepts.map(d=>o.jsx("option",{value:d,children:d.charAt(0).toUpperCase()+d.slice(1).replace(/[-_]/g," ")},d))
      ]}),
      o.jsxs("span",{style:{fontSize:"0.6rem",color:C.textDim,alignSelf:"center",marginLeft:"auto"},children:[filtered.length," resultados"]})
    ]}),
    o.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12},children:filtered.map(u=>o.jsx(MemberCard,{user:u,onClick:setOpenUser},u.id))}),
    openUser?o.jsx(MemberDrawer,{user:openUser,onClose:()=>setOpenUser(null)}):null
  ]});
}
