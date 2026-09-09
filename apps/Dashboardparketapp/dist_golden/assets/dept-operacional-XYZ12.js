import{R as REACT,r as RE,s as SB,j as o}from"./index-DZtetJYP.js";
import{R as RELAT_PAGE}from"./relatorios-operacional-pkt1.js";
import{D as t,c as ICC,S as SolicitarComprasPage}from"./dept-layout-BtZpIBbo.js";
function LazyDeptTab({chunk,tabsExport,tabId,label}){
  const[State,setState]=RE.useState({loading:true,err:null,Render:null});
  RE.useEffect(()=>{
    let cancel=false;
    import(chunk).then(m=>{
      if(cancel)return;
      console.log("[LazyDeptTab] loaded",chunk,"keys:",Object.keys(m));
      const tabs=m[tabsExport];
      if(!tabs||!Array.isArray(tabs)){setState({loading:false,err:"Export "+tabsExport+" não encontrado (keys: "+Object.keys(m).join(",")+")",Render:null});return}
      const tab=tabs.find(t=>t.id===tabId);
      if(!tab||!tab.render){setState({loading:false,err:"Tab "+tabId+" não encontrada (ids: "+tabs.map(t=>t.id).join(",")+")",Render:null});return}
      setState({loading:false,err:null,Render:tab.render})
    }).catch(e=>{if(!cancel){console.error("[LazyDeptTab] err",chunk,e);setState({loading:false,err:e.message||String(e),Render:null})}});
    return()=>{cancel=true}
  },[chunk,tabsExport,tabId]);
  if(State.loading)return o.jsx("div",{style:{padding:40,textAlign:"center",color:TEXT_DIM,fontSize:"0.75rem"},children:"Carregando "+label+"..."});
  if(State.err)return o.jsxs("div",{style:{padding:24,color:RED,fontSize:"0.7rem"},children:["Erro ao carregar ",label,": ",State.err]});
  return State.Render?State.Render():null
}
const PMO_SPEC=[
  {id:"acompanhamento",label:"Acompanhamento"},
  {id:"prod",label:"Produtividade"},
  {id:"alertas-crono",label:"Gestão de Riscos"},
  {id:"retencoes",label:"Retenções & Ranking"}
];
const OBRAS_SPEC=[
  {id:"check-diario",label:"Check Diário"},
  {id:"previsao-obras",label:"📅 Previsão de Obras"},
  {id:"acompanhamento",label:"Acompanhamento"},
  {id:"gestao-equipes",label:"Gestão de Equipes"},
  {id:"cronograma-obras",label:"📋 Cronograma"}
];
const ATEND_SPEC=[
  {id:"conversas",label:"💬 Conversas"},
  {id:"grupos",label:"Grupos & NPS"},
  {id:"scripts",label:"Scripts & Templates"},
  {id:"solicitacoes-operacional",label:"🛒 Solicitações Operacional"}
];
import{S as SI}from"./search-DIgyDOtS.js";
import{C as CA}from"./camera-CoxTQuZ8.js";
import{R as RU}from"./ruler-DE-jhn74.js";
import{S as SC}from"./shopping-cart-B8eR9afe.js";
import{P as PE}from"./pen-BvXoYHx_.js";
import{C as CK}from"./circle-check-C9fEuXIz.js";
import{C as CAL}from"./map-pin-i5bI163W.js";
import{U as USERS}from"./users-C9NE0xqT.js";
import"./sistema-ops-data-xhsYTu6a.js";
import"./createLucideIcon-BrbNkm3O.js";
import"./useHandoffs-zCM2waPl.js";
import"./zap-CLVqZ3h5.js";
import"./clock-CeMp6uPA.js";
import"./x-CqWN-PQU.js";
import"./triangle-alert-_aaufXhh.js";
import"./AreaChart-DpkIHS8Q.js";
import"./plus-DJV8hk0e.js";
import"./trash-2-CktFxQAk.js";
import"./refresh-cw-DFTJ8CmQ.js";
import"./eye-pq64b5hR.js";
import"./loader-circle-Cxu-14UL.js";
import"./arrow-right-left-C7PeaHOi.js";
import"./shield-CmimxUQ-.js";
import"./log-out-CnrNCqYt.js";
import"./briefcase-CoQ9adtQ.js";

const TEXT_DIM="rgba(255,255,255,0.4)";
const TEXT_MED="rgba(255,255,255,0.7)";
const BORDER="rgba(255,255,255,0.08)";
const CARD_BG="rgba(255,255,255,0.02)";
const ACCENT="#D4A853";
const BLUE="#3B82F6";
const GREEN="#10B981";
const RED="#EF4444";
const YELLOW="#F59E0B";
const PURPLE="#8B5CF6";
const TEAL="#14B8A6";
/* ═══ Jornada do Projeto — esteira real do kanban operacional ═══ */
const OP_ESTEIRA=[["entrada","Entrada"],["projeto","Projeto"],["pendente","Pendente"],["primeira-vistoria","1ª Vist"],["pre-cronograma","Pré-Crono"],["segunda-vistoria","2ª Vist"],["entrega-material","Material"],["obras-liberadas","Liberada"],["cronograma-final","Crono Final"],["acompanhamento","Acomp"],["obras-finalizadas","Final"]];
const OP_BADGES={"travado":{title:"Travado",color:"#EF4444"},"reparos":{title:"Reparos",color:"#F59E0B"},"reparos-concluidos":{title:"Reparos OK",color:"#10B981"}};
function JornadaTab(){
  const[cards,setCards]=RE.useState([]);
  const[loading,setLoading]=RE.useState(true);
  const[filtroEstagio,setFiltroEstagio]=RE.useState(null);
  RE.useEffect(()=>{
    let alive=true;
    async function load(){
      const{data}=await SB.from("kanban_cards").select("id,title,obra,column_id,details").eq("dept_id","operacional");
      if(alive){setCards(data||[]);setLoading(false)}
    }
    load();
    const ch=SB.channel("jornada-op-"+Math.random().toString(36).slice(2,10)).on("postgres_changes",{event:"*",schema:"public",table:"kanban_cards",filter:"dept_id=eq.operacional"},load).subscribe();
    return()=>{alive=false;SB.removeChannel(ch)};
  },[]);
  if(loading)return o.jsx("div",{style:{padding:40,textAlign:"center",color:TEXT_DIM,fontSize:"0.75rem"},children:"Carregando jornada..."});
  const idxMap=Object.fromEntries(OP_ESTEIRA.map(([s],i)=>[s,i]));
  const rows=cards.map(c=>({...c,_idx:idxMap[c.column_id],_badge:OP_BADGES[c.column_id]||null})).filter(c=>!filtroEstagio||c.column_id===filtroEstagio).sort((a,b)=>{
    if(a._badge&&!b._badge)return 1;
    if(!a._badge&&b._badge)return-1;
    return(b._idx??-1)-(a._idx??-1);
  });
  const counts=OP_ESTEIRA.map(([s])=>cards.filter(c=>c.column_id===s).length);
  const bTrav=cards.filter(c=>c.column_id==="travado").length;
  const bRep=cards.filter(c=>c.column_id==="reparos").length;
  const bRepOk=cards.filter(c=>c.column_id==="reparos-concluidos").length;
  return o.jsxs("div",{style:{padding:16},children:[
    o.jsxs("div",{style:{marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12},children:[
      o.jsxs("div",{children:[
        o.jsx("h2",{style:{fontSize:"1rem",fontWeight:700,color:"#fff",margin:0},children:"Jornada do Projeto"}),
        o.jsxs("p",{style:{fontSize:"0.6rem",color:TEXT_DIM,margin:"4px 0 0"},children:[cards.length," obras · espelha kanban em tempo real"]})
      ]}),
      o.jsxs("div",{style:{display:"flex",gap:8,flexWrap:"wrap"},children:[
        bTrav>0&&o.jsxs("span",{style:{padding:"3px 8px",borderRadius:10,fontSize:"0.55rem",fontWeight:700,background:`${RED}22`,color:RED,textTransform:"uppercase",letterSpacing:"0.05em"},children:[bTrav," Travadas"]}),
        bRep>0&&o.jsxs("span",{style:{padding:"3px 8px",borderRadius:10,fontSize:"0.55rem",fontWeight:700,background:`${YELLOW}22`,color:YELLOW,textTransform:"uppercase",letterSpacing:"0.05em"},children:[bRep," em Reparo"]}),
        bRepOk>0&&o.jsxs("span",{style:{padding:"3px 8px",borderRadius:10,fontSize:"0.55rem",fontWeight:700,background:`${GREEN}22`,color:GREEN,textTransform:"uppercase",letterSpacing:"0.05em"},children:[bRepOk," Reparos OK"]})
      ]})
    ]}),
    o.jsxs("div",{style:{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12,padding:"8px 10px",background:"rgba(255,255,255,0.02)",border:`1px solid ${BORDER}`,borderRadius:6},children:[o.jsxs("button",{onClick:()=>setFiltroEstagio(null),style:{padding:"4px 10px",borderRadius:14,fontSize:"0.55rem",fontWeight:700,border:filtroEstagio===null?"1px solid "+ACCENT:`1px solid ${BORDER}`,background:filtroEstagio===null?ACCENT+"22":"transparent",color:filtroEstagio===null?ACCENT:TEXT_DIM,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.05em"},children:["Todos · ",cards.length]}),OP_ESTEIRA.map(function(p){var sl=p[0];var lb=p[1];var n=cards.filter(function(c){return c.column_id===sl}).length;if(n===0)return null;return o.jsxs("button",{onClick:function(){return setFiltroEstagio(filtroEstagio===sl?null:sl)},style:{padding:"4px 10px",borderRadius:14,fontSize:"0.55rem",fontWeight:700,border:filtroEstagio===sl?"1px solid "+ACCENT:`1px solid ${BORDER}`,background:filtroEstagio===sl?ACCENT+"22":"transparent",color:filtroEstagio===sl?ACCENT:TEXT_DIM,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.05em"},children:[lb," · ",n]},sl)}),Object.keys(OP_BADGES).map(function(sl){var b=OP_BADGES[sl];var n=cards.filter(function(c){return c.column_id===sl}).length;if(n===0)return null;return o.jsxs("button",{onClick:function(){return setFiltroEstagio(filtroEstagio===sl?null:sl)},style:{padding:"4px 10px",borderRadius:14,fontSize:"0.55rem",fontWeight:700,border:filtroEstagio===sl?"1px solid "+b.color:`1px solid ${b.color}55`,background:filtroEstagio===sl?b.color+"22":b.color+"11",color:b.color,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.05em"},children:[b.title," · ",n]},sl)})]}),o.jsx("div",{style:{overflowX:"auto",border:`1px solid ${BORDER}`,borderRadius:8,background:CARD_BG},children:o.jsxs("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:"0.65rem"},children:[
      o.jsx("thead",{children:o.jsxs("tr",{style:{borderBottom:`1px solid ${BORDER}`,background:"rgba(0,0,0,0.25)"},children:[
        o.jsx("th",{style:{textAlign:"left",padding:"10px 12px",color:TEXT_DIM,fontWeight:700,fontSize:"0.55rem",letterSpacing:"0.1em",textTransform:"uppercase",position:"sticky",left:0,background:"rgba(20,20,20,0.95)",minWidth:220,zIndex:1},children:"Obra"}),
        ...OP_ESTEIRA.map(([s,sh],i)=>o.jsxs("th",{style:{padding:"10px 6px",color:TEXT_DIM,fontWeight:700,fontSize:"0.5rem",letterSpacing:"0.05em",textTransform:"uppercase",textAlign:"center",minWidth:64},children:[sh,counts[i]>0?o.jsx("div",{style:{fontSize:"0.6rem",fontWeight:700,color:ACCENT,marginTop:2},children:counts[i]}):null]},s)),
        o.jsx("th",{style:{padding:"10px 12px",color:TEXT_DIM,fontWeight:700,fontSize:"0.55rem",letterSpacing:"0.05em",textTransform:"uppercase",textAlign:"center",minWidth:100},children:"Off-path"})
      ]})}),
      o.jsx("tbody",{children:rows.map(r=>o.jsxs("tr",{onClick:function(){window.location.href="/central-do-cliente/"+r.id},style:{borderBottom:`1px solid ${BORDER}`,cursor:"pointer"},onMouseEnter:function(e){e.currentTarget.style.background="rgba(251,146,60,0.06)"},onMouseLeave:function(e){e.currentTarget.style.background=""},children:[
        o.jsxs("td",{style:{padding:"8px 12px",color:"#fff",fontSize:"0.65rem",position:"sticky",left:0,background:CARD_BG,zIndex:1},children:[
          o.jsx("div",{style:{fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:220},title:r.title||"",children:r.title||"(sem título)"}),
          r.obra?o.jsx("div",{style:{fontSize:"0.5rem",color:TEXT_DIM,marginTop:2},children:r.obra}):null
        ]}),
        ...OP_ESTEIRA.map(([s],i)=>{
          const here=r._idx===i;
          const past=r._idx!==undefined&&r._idx>i;
          let ch="○",cl=TEXT_DIM,sz="0.9rem";
          if(here){ch="●";cl=ACCENT;sz="1rem"}
          else if(past){ch="✓";cl=GREEN;sz="0.85rem"}
          return o.jsx("td",{style:{padding:"8px 4px",textAlign:"center",color:cl,fontSize:sz},children:ch},s)
        }),
        o.jsx("td",{style:{padding:"8px 12px",textAlign:"center"},children:r._badge?o.jsx("span",{style:{padding:"3px 8px",borderRadius:10,fontSize:"0.5rem",fontWeight:700,background:`${r._badge.color}22`,color:r._badge.color,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap"},children:r._badge.title}):o.jsx("span",{style:{color:TEXT_DIM,fontSize:"0.55rem"},children:"—"})})
      ]},r.id))})
    ]})})
  ]})
}

const PERMS=["laudos","agenda","fotos","compras","admin"];
const TIPOS_VISTORIA=[["1vistoria","1ª Vistoria"],["2vistoria","2ª Vistoria"],["acompanhamento","Acompanhamento"],["entrega","Entrega"],["reparo","Reparo"]];
const STATUS_AGENDA=["agendado","confirmado","realizado","cancelado"];
const STATUS_COLORS={pendente:YELLOW,agendada:BLUE,agendado:BLUE,confirmada:PURPLE,confirmado:PURPLE,realizada:GREEN,realizado:GREEN,cancelada:RED,cancelado:RED,em_andamento:BLUE,concluido:GREEN};

function fmtDate(d){if(!d)return"—";try{const dt=new Date(d);if(isNaN(dt))return String(d);return dt.toLocaleDateString("pt-BR")}catch{return String(d)}}
function fmtDateTime(d){if(!d)return"—";try{const dt=new Date(d);if(isNaN(dt))return String(d);return dt.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}catch{return String(d)}}
function daysFromNow(d){if(!d)return null;try{const dt=new Date(d);const now=new Date();return Math.ceil((dt-now)/(1000*60*60*24))}catch{return null}}
function toast(msg,tipo){
  const el=document.createElement("div");
  el.style.cssText=`position:fixed;top:20px;right:20px;padding:12px 18px;border-radius:8px;font-size:0.75rem;z-index:99999;background:${tipo==="error"?"rgba(239,68,68,0.95)":"rgba(16,185,129,0.95)"};color:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.3)`;
  el.textContent=msg;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),3500);
}

function Modal({open,onClose,title,children,footer,width}){
  if(!open)return null;
  return o.jsx("div",{onClick:onClose,style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20},
    children:o.jsxs("div",{onClick:e=>e.stopPropagation(),style:{width:width||480,maxHeight:"90vh",overflowY:"auto",background:"#0d0d0d",border:`1px solid ${BORDER}`,borderRadius:12},children:[
      o.jsxs("div",{style:{padding:"16px 20px",borderBottom:`1px solid ${BORDER}`,display:"flex",justifyContent:"space-between",alignItems:"center"},children:[
        o.jsx("h3",{style:{margin:0,fontSize:"0.9rem",fontWeight:600,color:"#fff"},children:title}),
        o.jsx("button",{onClick:onClose,style:{background:"none",border:"none",color:TEXT_DIM,cursor:"pointer",fontSize:"1.2rem",padding:0,width:24,height:24},children:"×"})
      ]}),
      o.jsx("div",{style:{padding:20},children:children}),
      footer&&o.jsx("div",{style:{padding:"12px 20px",borderTop:`1px solid ${BORDER}`,display:"flex",gap:8,justifyContent:"flex-end"},children:footer})
    ]})
  })
}

function Field({label,children}){
  return o.jsxs("div",{style:{marginBottom:12},children:[
    o.jsx("label",{style:{display:"block",fontSize:"0.55rem",textTransform:"uppercase",letterSpacing:"0.08em",color:TEXT_DIM,marginBottom:4,fontWeight:700},children:label}),
    children
  ]})
}

const inputStyle={width:"100%",padding:"8px 10px",background:"rgba(0,0,0,0.4)",border:`1px solid ${BORDER}`,borderRadius:6,color:"#fff",fontSize:"0.72rem",outline:"none"};
const btnPrimary={padding:"7px 14px",fontSize:"0.7rem",fontWeight:600,border:"none",borderRadius:6,cursor:"pointer",background:ACCENT,color:"#000"};
const btnSecondary={padding:"7px 14px",fontSize:"0.7rem",fontWeight:600,border:`1px solid ${BORDER}`,borderRadius:6,cursor:"pointer",background:"transparent",color:TEXT_MED};
const btnDanger={padding:"7px 14px",fontSize:"0.7rem",fontWeight:600,border:"none",borderRadius:6,cursor:"pointer",background:"rgba(239,68,68,0.15)",color:RED};

function StatusBadge({status}){
  const c=STATUS_COLORS[status]||TEXT_DIM;
  return o.jsx("span",{style:{padding:"2px 8px",borderRadius:10,fontSize:"0.55rem",fontWeight:700,background:`${c}22`,color:c,textTransform:"uppercase",letterSpacing:"0.05em"},children:status||"—"})
}

function CalendarioVistorias({agendamentos,cards,equipe,onCardClick,onAgClick}){
  const[cursor,setCursor]=RE.useState(()=>{const d=new Date();d.setDate(1);return d});
  const year=cursor.getFullYear(),mIdx=cursor.getMonth();
  const firstDay=new Date(year,mIdx,1);
  const daysInMonth=new Date(year,mIdx+1,0).getDate();
  const startWd=firstDay.getDay();
  const byDay={};
  (agendamentos||[]).forEach(ag=>{if(!ag.data_inicio)return;const key=String(ag.data_inicio).slice(0,10);(byDay[key]=byDay[key]||[]).push({kind:"ag",item:ag})});
  (cards||[]).forEach(c=>{const d=c.details||{};[["data_vistoria","1ª Vist."],["data_segunda_vistoria","2ª Vist."],["data_agendada","Agend."]].forEach(([k,lb])=>{const dt=d[k];if(!dt)return;const key=String(dt).slice(0,10);(byDay[key]=byDay[key]||[]).push({kind:"card",item:c,lb})})});
  const fiscalNome=id=>{const f=(equipe||[]).find(e=>e.id===id);return f?f.nome:""};
  const days=[];
  for(let i=0;i<startWd;i++)days.push(null);
  for(let d=1;d<=daysInMonth;d++)days.push(d);
  while(days.length%7!==0)days.push(null);
  const today=new Date();const todayKey=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const monthName=cursor.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  const weekNames=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const prev=()=>{const d=new Date(cursor);d.setMonth(d.getMonth()-1);setCursor(d)};
  const next=()=>{const d=new Date(cursor);d.setMonth(d.getMonth()+1);setCursor(d)};
  const goToday=()=>{const d=new Date();d.setDate(1);setCursor(d)};
  return o.jsxs("div",{style:{background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:8,padding:12},children:[
    o.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12},children:[
      o.jsxs("div",{style:{display:"flex",gap:6,alignItems:"center"},children:[
        o.jsx("button",{onClick:prev,style:{...btnSecondary,padding:"4px 10px",fontSize:"0.7rem"},children:"‹"}),
        o.jsx("button",{onClick:goToday,style:{...btnSecondary,padding:"4px 10px",fontSize:"0.65rem"},children:"Hoje"}),
        o.jsx("button",{onClick:next,style:{...btnSecondary,padding:"4px 10px",fontSize:"0.7rem"},children:"›"})
      ]}),
      o.jsx("h3",{style:{margin:0,fontSize:"0.85rem",fontWeight:700,color:"#fff",textTransform:"capitalize"},children:monthName}),
      o.jsxs("div",{style:{fontSize:"0.6rem",color:TEXT_DIM},children:[(agendamentos||[]).length+" agend. · ",Object.keys(byDay).length," dias com vistoria"]})
    ]}),
    o.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4},children:weekNames.map(wn=>o.jsx("div",{style:{textAlign:"center",fontSize:"0.55rem",fontWeight:700,color:TEXT_DIM,textTransform:"uppercase",padding:"4px 0"},children:wn},wn))}),
    o.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4},children:days.map((d,i)=>{
      if(d===null)return o.jsx("div",{style:{minHeight:80,background:"rgba(0,0,0,0.15)",borderRadius:4}},i);
      const key=`${year}-${String(mIdx+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const items=byDay[key]||[];
      const isToday=key===todayKey;
      const isPast=new Date(key+"T23:59:59")<today&&!isToday;
      const hasOverdue=isPast&&items.some(it=>it.kind==="ag"?!["realizada","cancelada"].includes(it.item.status):true);
      return o.jsxs("div",{style:{minHeight:80,padding:4,background:isToday?"rgba(59,130,246,0.08)":CARD_BG,border:`1px solid ${isToday?"rgba(59,130,246,0.5)":hasOverdue?"rgba(239,68,68,0.35)":BORDER}`,borderRadius:4,display:"flex",flexDirection:"column",gap:2},children:[
        o.jsx("div",{style:{fontSize:"0.6rem",fontWeight:isToday?700:500,color:isToday?BLUE:TEXT_MED,marginBottom:2},children:d}),
        items.slice(0,3).map((it,ix)=>{
          if(it.kind==="ag"){
            const cor=STATUS_COLORS[it.item.status]||BLUE;
            const fn=fiscalNome(it.item.fiscal_id);
            return o.jsxs("div",{onClick:()=>onAgClick&&onAgClick(it.item),title:`${it.item.cliente||""} — ${fn}`,style:{fontSize:"0.48rem",fontWeight:600,padding:"2px 4px",borderRadius:3,background:`${cor}20`,color:cor,borderLeft:`2px solid ${cor}`,cursor:"pointer",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:[(it.item.data_inicio||"").slice(11,16)||"",(it.item.data_inicio||"").slice(11,16)?" ":"",it.item.obra||it.item.cliente||"(sem nome)"]},ix)
          }else{
            return o.jsxs("div",{onClick:()=>onCardClick&&onCardClick(it.item),title:`Card: ${it.item.obra||it.item.title||""}`,style:{fontSize:"0.48rem",fontWeight:500,padding:"2px 4px",borderRadius:3,background:"rgba(245,158,11,0.15)",color:"#FCD34D",borderLeft:`2px solid #F59E0B`,cursor:"pointer",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:[it.lb," ",it.item.obra||it.item.title||""]},ix)
          }
        }),
        items.length>3&&o.jsx("div",{style:{fontSize:"0.48rem",color:TEXT_DIM,fontWeight:600},children:`+${items.length-3}`})
      ]},i)
    })})
  ]})
}

/* ═══ EQUIPE FISCAL ═══ */
function EquipeFiscalTab(){
  const[equipe,setEquipe]=RE.useState([]);
  const[loading,setLoading]=RE.useState(true);
  const[modal,setModal]=RE.useState(false);
  const[editing,setEditing]=RE.useState(null);
  const[form,setForm]=RE.useState({nome:"",telefone:"",email:"",ativo:true,permissoes:{},whatsapp_group_jid:""});
  const[saving,setSaving]=RE.useState(false);

  const fetchEquipe=RE.useCallback(async()=>{
    setLoading(true);
    const{data}=await SB.from("fiscal_equipe").select("*").order("nome");
    setEquipe(data||[]);
    setLoading(false);
  },[]);

  RE.useEffect(()=>{
    fetchEquipe();
    const ch=SB.channel("fiscal_eq_rt").on("postgres_changes",{event:"*",schema:"public",table:"fiscal_equipe"},fetchEquipe).subscribe();
    return()=>{SB.removeChannel(ch)}
  },[fetchEquipe]);

  const openNew=()=>{setEditing(null);setForm({nome:"",telefone:"",email:"",ativo:true,permissoes:{},whatsapp_group_jid:""});setModal(true)};
  const openEdit=f=>{setEditing(f);setForm({nome:f.nome||"",telefone:f.telefone||"",email:f.email||"",ativo:f.ativo!==false,permissoes:f.permissoes||{},whatsapp_group_jid:f.whatsapp_group_jid||""});setModal(true)};
  const save=async()=>{
    if(!form.nome.trim()){toast("Nome é obrigatório","error");return}
    setSaving(true);
    const payload={nome:form.nome,telefone:form.telefone,email:form.email,ativo:form.ativo,permissoes:form.permissoes,whatsapp_group_jid:form.whatsapp_group_jid||null};
    const{error}=editing?await SB.from("fiscal_equipe").update(payload).eq("id",editing.id):await SB.from("fiscal_equipe").insert(payload);
    setSaving(false);
    if(error){toast("Erro: "+error.message,"error");return}
    toast(editing?"Fiscal atualizado":"Fiscal adicionado");
    setModal(false);
    fetchEquipe();
  };
  const remove=async f=>{
    if(!confirm(`Remover ${f.nome}?`))return;
    const{error}=await SB.from("fiscal_equipe").delete().eq("id",f.id);
    if(error){toast("Erro: "+error.message,"error");return}
    toast("Fiscal removido");
    fetchEquipe();
  };

  return o.jsxs("div",{style:{padding:16},children:[
    o.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16},children:[
      o.jsxs("div",{children:[
        o.jsx("h2",{style:{fontSize:"1rem",fontWeight:600,color:"#fff",margin:0},children:"👥 Equipe Fiscal"}),
        o.jsxs("p",{style:{fontSize:"0.65rem",color:TEXT_DIM,marginTop:4},children:[equipe.length," fiscais cadastrados (",equipe.filter(f=>f.ativo).length," ativos)"]})
      ]}),
      o.jsx("button",{onClick:openNew,style:btnPrimary,children:"+ Adicionar Fiscal"})
    ]}),
    loading?o.jsx("div",{style:{padding:40,textAlign:"center",color:TEXT_DIM,fontSize:"0.75rem"},children:"Carregando..."}):equipe.length===0?o.jsx("div",{style:{padding:40,textAlign:"center",color:TEXT_DIM,fontSize:"0.75rem",border:`1px dashed ${BORDER}`,borderRadius:8},children:"Nenhum fiscal cadastrado."}):o.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:10},children:equipe.map(f=>o.jsxs("div",{style:{padding:14,background:CARD_BG,border:`1px solid ${BORDER}`,borderLeft:`3px solid ${f.ativo?GREEN:TEXT_DIM}`,borderRadius:8},children:[
      o.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8},children:[
        o.jsxs("div",{children:[
          o.jsx("p",{style:{fontSize:"0.8rem",fontWeight:600,color:"#fff",margin:0},children:f.nome}),
          f.ativo?o.jsx("span",{style:{fontSize:"0.5rem",color:GREEN,fontWeight:700,textTransform:"uppercase"},children:"● ativo"}):o.jsx("span",{style:{fontSize:"0.5rem",color:TEXT_DIM,fontWeight:700,textTransform:"uppercase"},children:"○ inativo"})
        ]}),
        o.jsxs("div",{style:{display:"flex",gap:4},children:[
          o.jsx("button",{onClick:()=>openEdit(f),title:"Editar",style:{...btnSecondary,padding:"4px 8px",fontSize:"0.6rem"},children:"✎"}),
          o.jsx("button",{onClick:()=>remove(f),title:"Remover",style:{...btnDanger,padding:"4px 8px",fontSize:"0.6rem"},children:"🗑"})
        ]})
      ]}),
      f.telefone&&o.jsxs("p",{style:{fontSize:"0.65rem",color:TEXT_MED,margin:"2px 0"},children:["📱 ",f.telefone]}),
      f.email&&o.jsxs("p",{style:{fontSize:"0.65rem",color:TEXT_MED,margin:"2px 0"},children:["✉️ ",f.email]}),
      f.permissoes&&Object.keys(f.permissoes).filter(k=>f.permissoes[k]).length>0&&o.jsx("div",{style:{marginTop:8,display:"flex",flexWrap:"wrap",gap:4},children:Object.keys(f.permissoes).filter(k=>f.permissoes[k]).map(k=>o.jsx("span",{style:{padding:"2px 6px",borderRadius:3,fontSize:"0.5rem",background:"rgba(212,168,83,0.12)",color:ACCENT,fontWeight:700,textTransform:"uppercase"},children:k},k))})
    ]},f.id))}),
    o.jsxs(Modal,{open:modal,onClose:()=>setModal(false),title:editing?"Editar Fiscal":"Novo Fiscal",footer:o.jsxs(REACT.Fragment,{children:[
      o.jsx("button",{onClick:()=>setModal(false),style:btnSecondary,children:"Cancelar"}),
      o.jsx("button",{onClick:save,disabled:saving,style:{...btnPrimary,opacity:saving?0.5:1},children:saving?"Salvando...":"Salvar"})
    ]}),children:[
      o.jsx(Field,{label:"Nome *",children:o.jsx("input",{value:form.nome,onChange:e=>setForm({...form,nome:e.target.value}),style:inputStyle})}),
      o.jsx(Field,{label:"Telefone",children:o.jsx("input",{value:form.telefone,onChange:e=>setForm({...form,telefone:e.target.value}),placeholder:"(11) 99999-9999",style:inputStyle})}),
      o.jsx(Field,{label:"Email",children:o.jsx("input",{value:form.email,onChange:e=>setForm({...form,email:e.target.value}),placeholder:"email@exemplo.com",style:inputStyle})}),
      o.jsx(Field,{label:"JID do Grupo WhatsApp (Fiscal vai receber laudos aqui)",children:o.jsxs("div",{children:[
        o.jsx("input",{value:form.whatsapp_group_jid||"",onChange:e=>setForm({...form,whatsapp_group_jid:e.target.value}),placeholder:"120363xxxxxxxxxxxxxxx@g.us",style:inputStyle}),
        o.jsx("p",{style:{fontSize:"0.5rem",color:TEXT_DIM,marginTop:4,fontStyle:"italic"},children:"Sempre que um agendamento for criado pra este fiscal, a info do projeto + checklist vai ser enviada nesse grupo. Deixe vazio pra não enviar."})
      ]})}),
      o.jsx(Field,{label:"Permissões",children:o.jsx("div",{style:{display:"flex",flexWrap:"wrap",gap:8},children:PERMS.map(p=>o.jsxs("label",{style:{display:"flex",alignItems:"center",gap:6,fontSize:"0.7rem",color:TEXT_MED,cursor:"pointer",padding:"4px 10px",background:form.permissoes[p]?`${ACCENT}22`:"rgba(0,0,0,0.3)",border:`1px solid ${form.permissoes[p]?ACCENT:BORDER}`,borderRadius:6},children:[
        o.jsx("input",{type:"checkbox",checked:!!form.permissoes[p],onChange:e=>setForm({...form,permissoes:{...form.permissoes,[p]:e.target.checked}})}),p
      ]},p))})}),
      o.jsx(Field,{label:"Status",children:o.jsxs("label",{style:{display:"flex",alignItems:"center",gap:8,fontSize:"0.72rem",color:TEXT_MED,cursor:"pointer"},children:[
        o.jsx("input",{type:"checkbox",checked:form.ativo,onChange:e=>setForm({...form,ativo:e.target.checked})}),"Ativo"
      ]})})
    ]})
  ]})
}

/* ═══ AGENDA VISTORIAS ═══ */
function AgendaVistoriasTab(){
  const[agenda,setAgenda]=RE.useState([]);
  const[equipe,setEquipe]=RE.useState([]);
  const[cards,setCards]=RE.useState([]);
  const[loading,setLoading]=RE.useState(true);
  const[modal,setModal]=RE.useState(false);
  const[editing,setEditing]=RE.useState(null);
  const[form,setForm]=RE.useState({card_id:"",fiscal_id:"",tipo:"1vistoria",data_inicio:"",data_fim:"",obra:"",cliente:"",status:"agendado",notas:""});
  const[saving,setSaving]=RE.useState(false);
  const[filterStatus,setFilterStatus]=RE.useState("all");
  const[cardSearch,setCardSearch]=RE.useState("");

  const fetchAll=RE.useCallback(async()=>{
    setLoading(true);
    const[{data:ag},{data:eq},{data:kc}]=await Promise.all([
      SB.from("fiscal_agenda").select("*").order("data_inicio",{ascending:false}),
      SB.from("fiscal_equipe").select("id,nome,ativo,whatsapp_group_jid").eq("ativo",true).order("nome"),
      SB.from("kanban_cards").select("id,title,obra,column_id,details").eq("dept_id","operacional").order("title").limit(2000)
    ]);
    setAgenda(ag||[]);
    setEquipe(eq||[]);
    setCards(kc||[]);
    setLoading(false);
  },[]);
  RE.useEffect(()=>{
    fetchAll();
    const ch=SB.channel("fiscal_ag_rt").on("postgres_changes",{event:"*",schema:"public",table:"fiscal_agenda"},fetchAll).subscribe();
    return()=>{SB.removeChannel(ch)}
  },[fetchAll]);

  const openNew=()=>{setEditing(null);setCardSearch("");setForm({card_id:"",fiscal_id:"",tipo:"1vistoria",data_inicio:"",data_fim:"",obra:"",cliente:"",status:"agendado",notas:""});setModal(true)};
  const openEdit=ag=>{setEditing(ag);setCardSearch("");setForm({card_id:ag.card_id||"",fiscal_id:ag.fiscal_id||"",tipo:ag.tipo||"1vistoria",data_inicio:ag.data_inicio?ag.data_inicio.slice(0,16):"",data_fim:ag.data_fim?ag.data_fim.slice(0,16):"",obra:ag.obra||"",cliente:ag.cliente||"",status:ag.status||"agendada",notas:ag.notas||""});setModal(true)};
  const onPickCard=id=>{const c=cards.find(x=>x.id===id);setForm(f=>({...f,card_id:id,obra:(c&&c.obra)||"",cliente:(c&&c.title)||""}))};
  const cardsFiltered=RE.useMemo(()=>{
    const q=(cardSearch||"").trim().toLowerCase();
    if(!q)return cards;
    return cards.filter(c=>{
      const t=(c.title||"").toLowerCase();
      const o=(c.obra||"").toLowerCase();
      const co=(c.column_id||"").toLowerCase();
      return t.includes(q)||o.includes(q)||co.includes(q);
    });
  },[cards,cardSearch]);
  const cardSelected=cards.find(c=>c.id===form.card_id)||null;
  const save=async()=>{
    if(!form.data_inicio){toast("Data de início é obrigatória","error");return}
    setSaving(true);
    const payload={card_id:form.card_id||null,fiscal_id:form.fiscal_id||null,tipo:form.tipo,data_inicio:form.data_inicio,data_fim:form.data_fim||null,obra:form.obra,cliente:form.cliente,status:form.status,notas:form.notas||null};
    const{error}=editing?await SB.from("fiscal_agenda").update(payload).eq("id",editing.id):await SB.from("fiscal_agenda").insert(payload);
    setSaving(false);
    if(error){toast("Erro: "+error.message,"error");return}
    // Auto-cria/sincroniza laudo-stub vinculado ao agendamento.
    // Pra novos agendamentos (não-edit) garante 1 laudo "pendente"
    // por (card_id, tipo). Pra edits, atualiza dados-chave do laudo
    // existente (data, fiscal, obra, cliente) sem mexer no checklist.
    try{
      if(form.card_id){
        const fiscalNome=(()=>{const f=equipe.find(e=>e.id===form.fiscal_id);return f?f.nome:null})();
        const dataVist=form.data_inicio?String(form.data_inicio).slice(0,10):null;
        const{data:lex}=await SB.from("fiscal_laudos").select("id,status").eq("card_id",form.card_id).eq("tipo",form.tipo).order("created_at",{ascending:false}).limit(1);
        const found=lex&&lex[0];
        if(!found){
          await SB.from("fiscal_laudos").insert({
            card_id:form.card_id,
            obra:form.obra||"",
            cliente:form.cliente||"",
            tipo:form.tipo,
            fiscal_id:form.fiscal_id||null,
            fiscal_nome:fiscalNome,
            data_vistoria:dataVist,
            status:"pendente",
            servicos_inclusos:[],
            observacoes:form.notas||null
          });
        }else if(found.status!=="concluido"){
          // sincroniza dados-chave sem sobrescrever checklist preenchido
          const upd={};
          if(form.fiscal_id){upd.fiscal_id=form.fiscal_id;upd.fiscal_nome=fiscalNome}
          if(dataVist)upd.data_vistoria=dataVist;
          if(form.obra)upd.obra=form.obra;
          if(form.cliente)upd.cliente=form.cliente;
          if(Object.keys(upd).length>0)await SB.from("fiscal_laudos").update(upd).eq("id",found.id);
        }
      }
    }catch(e){console.warn("[laudo-stub auto-create]",e)}
    // Sinaliza pra LaudosVistoriasTab abrir o laudo deste agendamento ao montar
    if(form.card_id){
      try{
        localStorage.setItem("laudo_open_intent",JSON.stringify({card_id:form.card_id,tipo:form.tipo,ts:Date.now()}));
      }catch(_){}
    }
    // Envia mensagem no grupo WhatsApp do fiscal (se cadastrado) com checklist do laudo
    let waEnviado=false;
    try{
      const fiscal=equipe.find(e=>e.id===form.fiscal_id);
      const jid=fiscal&&fiscal.whatsapp_group_jid;
      if(jid){
        const tipoLb=(TIPOS_VISTORIA.find(t=>t[0]===form.tipo)||[null,form.tipo])[1];
        const dt=form.data_inicio?new Date(form.data_inicio).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—";
        // Checklist por tipo (lista resumida — versão completa fica na aba Laudos)
        const ckLib={
          "1vistoria":[
            "📐 Medição da obra (planta arquitetônica vs real)",
            "🏗 Verificar condição da estrutura (contrapiso, paredes, teto)",
            "💧 Conferir nível de umidade",
            "🔌 Identificar pontos elétricos, hidráulicos, de gás",
            "📏 Anotar pé-direito final e desníveis",
            "📷 Fotos do ambiente (gerais + detalhes)",
            "👥 Avaliar acesso pra equipes + içamento"
          ],
          "2vistoria":[
            "✅ Confirmar contrapiso pronto e nivelado",
            "✅ Verificar instalações elétricas/hidráulicas finalizadas",
            "✅ Conferir pinturas e acabamentos preliminares",
            "📦 Checar local de armazenamento dos materiais",
            "📅 Definir data de entrega de material e início",
            "📷 Fotos atualizadas",
            "🔓 Confirmar liberação da obra"
          ],
          "acompanhamento":[
            "📍 Equipe presente e produzindo?",
            "📦 Materiais/insumos em quantidade adequada?",
            "⚠ Alguma pendência da obra cliente travando?",
            "📐 Andamento conforme cronograma",
            "📷 Fotos do andamento"
          ],
          "entrega":[
            "✅ Tudo instalado conforme projeto?",
            "🔍 Verificar acabamentos finais (rodapé, soleira, encontros)",
            "💧 Limpeza pós-instalação",
            "📷 Fotos finais (gerais + detalhes)",
            "📝 Termo de entrega assinado pelo cliente",
            "⚠ Pendências/ajustes apontados"
          ],
          "reparo":[
            "📝 Descritivo do problema",
            "📷 Fotos do dano",
            "📦 Lista de materiais necessários pro reparo",
            "👥 Equipe alocada e prazo estimado",
            "✅ Reparo executado conforme combinado?",
            "📷 Fotos depois do reparo"
          ]
        };
        const items=ckLib[form.tipo]||[];
        const obraLb=form.obra?` (${form.obra})`:"";
        const cliLb=form.cliente||(cards.find(c=>c.id===form.card_id)||{}).title||"—";
        const editar=editing?" — _atualizado_":"";
        const msgParts=[
          `📋 *${editing?"Vistoria atualizada":"Nova vistoria agendada"}${editar}*`,
          ``,
          `🏗 *${cliLb}*${obraLb}`,
          `📍 Tipo: *${tipoLb}*`,
          `📅 Data: *${dt}*`,
          fiscal&&fiscal.nome?`🧑‍💼 Fiscal: ${fiscal.nome}`:null,
          form.notas?`📝 Notas: ${form.notas}`:null,
          ``,
          `*Pontos a verificar/responder:*`,
          ...items.map(i=>`• ${i}`),
          ``,
          `Pode responder por aqui (texto, áudio ou foto). Cada resposta será vinculada automaticamente ao laudo no sistema.`
        ].filter(Boolean);
        const msg=msgParts.join("\n");
        // Envia via Evolution direto (configs hardcoded — mesmas usadas pelo check-obras)
        const EVO_URL="https://conect.parket.works",EVO_INSTANCE="Parket",EVO_KEY="4eab105201410d6865b86dca76ee9fa3";
        const r=await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`,{method:"POST",headers:{"Content-Type":"application/json",apikey:EVO_KEY},body:JSON.stringify((()=>{const _f=fiscal||{};const _ph=String(_f.telefone||"").replace(/\D/g,"");const _mention=_ph?`${_ph}@s.whatsapp.net`:null;const _msg=_mention?`@${_ph} ${msg}`:msg;return _mention?{number:jid,text:_msg,mentioned:[_mention]}:{number:jid,text:_msg};})())});
        waEnviado=r.ok;
        if(!r.ok)console.warn("[fiscal-wa] erro ao enviar:",r.status);
      }
    }catch(e){console.warn("[fiscal-wa]",e)}
    toast((editing?"Agendamento atualizado":"Agendamento criado")+(waEnviado?" · WhatsApp enviado ao fiscal":" · laudo vinculado")+" · clique em \"Laudos & Vistorias\" pra acompanhar");
    setModal(false);
    fetchAll();
  };
  const remove=async ag=>{
    if(!confirm("Remover este agendamento?"))return;
    const{error}=await SB.from("fiscal_agenda").delete().eq("id",ag.id);
    if(error){toast("Erro: "+error.message,"error");return}
    toast("Agendamento removido");
    fetchAll();
  };
  const mudarStatus=async(ag,st)=>{
    const{error}=await SB.from("fiscal_agenda").update({status:st}).eq("id",ag.id);
    if(error){toast("Erro: "+error.message,"error");return}
    fetchAll();
  };

  const[viewMode,setViewMode]=RE.useState("lista");
  const[filterFiscal,setFilterFiscal]=RE.useState("all");
  const filtrados=agenda.filter(a=>{if(filterStatus!=="all"&&a.status!==filterStatus)return false;if(filterFiscal!=="all"&&a.fiscal_id!==filterFiscal)return false;return true});
  // Agrupamento por fiscal pra vista de lista
  const agrupadosPorFiscal=(()=>{const g={};const ord=[];filtrados.forEach(a=>{const fid=a.fiscal_id||"__sem_fiscal__";if(!g[fid]){g[fid]=[];ord.push(fid)}g[fid].push(a)});return{grupos:g,ordem:ord}})();
  const fiscalNome=id=>{const f=equipe.find(e=>e.id===id);return f?f.nome:"—"};
  const tipoLabel=t=>{const e=TIPOS_VISTORIA.find(x=>x[0]===t);return e?e[1]:t};

  return o.jsxs("div",{style:{padding:16},children:[
    o.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8},children:[
      o.jsxs("div",{children:[
        o.jsx("h2",{style:{fontSize:"1rem",fontWeight:600,color:"#fff",margin:0},children:"📅 Agenda de Vistorias"}),
        o.jsxs("p",{style:{fontSize:"0.65rem",color:TEXT_DIM,marginTop:4},children:[agenda.length," agendamentos totais · ",agenda.filter(a=>["agendado","confirmado"].includes(a.status)).length," ativos"]})
      ]}),
      o.jsxs("div",{style:{display:"flex",gap:8,alignItems:"center"},children:[
        o.jsxs("div",{style:{display:"inline-flex",background:"rgba(0,0,0,0.3)",border:`1px solid ${BORDER}`,borderRadius:6,padding:2},children:[
          o.jsx("button",{onClick:()=>setViewMode("calendario"),style:{padding:"5px 12px",border:"none",borderRadius:4,background:viewMode==="calendario"?ACCENT:"transparent",color:viewMode==="calendario"?"#000":TEXT_MED,fontSize:"0.65rem",fontWeight:600,cursor:"pointer"},children:"📅 Calendário"}),
          o.jsx("button",{onClick:()=>setViewMode("lista"),style:{padding:"5px 12px",border:"none",borderRadius:4,background:viewMode==="lista"?ACCENT:"transparent",color:viewMode==="lista"?"#000":TEXT_MED,fontSize:"0.65rem",fontWeight:600,cursor:"pointer"},children:"📋 Lista"})
        ]}),
        o.jsxs("select",{value:filterFiscal,onChange:e=>setFilterFiscal(e.target.value),style:{...inputStyle,width:"auto"},children:[
          o.jsx("option",{value:"all",children:"Todos fiscais"}),
          ...equipe.map(f=>o.jsx("option",{value:f.id,children:f.nome},f.id))
        ]}),
        o.jsxs("select",{value:filterStatus,onChange:e=>setFilterStatus(e.target.value),style:{...inputStyle,width:"auto"},children:[
          o.jsx("option",{value:"all",children:"Todos status"}),
          ...STATUS_AGENDA.map(s=>o.jsx("option",{value:s,children:s},s))
        ]}),
        o.jsx("button",{onClick:openNew,style:btnPrimary,children:"+ Novo Agendamento"})
      ]})
    ]}),
    loading?o.jsx("div",{style:{padding:40,textAlign:"center",color:TEXT_DIM,fontSize:"0.75rem"},children:"Carregando..."}):viewMode==="calendario"?o.jsx(CalendarioVistorias,{agendamentos:filtrados,cards:cards,equipe:equipe,onAgClick:ag=>openEdit(ag),onCardClick:c=>window.location.href=`/operacional?card=${c.id}`}):filtrados.length===0?o.jsx("div",{style:{padding:40,textAlign:"center",color:TEXT_DIM,fontSize:"0.75rem",border:`1px dashed ${BORDER}`,borderRadius:8},children:"Nenhum agendamento."}):o.jsx("div",{style:{display:"flex",flexDirection:"column",gap:16},children:agrupadosPorFiscal.ordem.map(fid=>{const fis=equipe.find(f=>f.id===fid);const nome=fis?fis.nome:"Sem fiscal atribuído";const items=agrupadosPorFiscal.grupos[fid];const ativos=items.filter(a=>["agendado","confirmado"].includes(a.status)).length;return o.jsxs("div",{children:[o.jsxs("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:8,paddingBottom:6,borderBottom:`1px solid ${BORDER}`},children:[o.jsx("span",{style:{fontSize:"0.8rem",fontWeight:700,color:"#fff"},children:"👤 "+nome}),o.jsxs("span",{style:{fontSize:"0.6rem",color:TEXT_DIM},children:[items.length," agendamento"+(items.length>1?"s":""),ativos>0?` · ${ativos} ativo${ativos>1?"s":""}`:""]})]}),o.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:10},children:items.map(ag=>{
      const dias=daysFromNow(ag.data_inicio);
      const cor=STATUS_COLORS[ag.status]||TEXT_DIM;
      return o.jsxs("div",{style:{padding:12,background:CARD_BG,border:`1px solid ${cor}30`,borderLeft:`3px solid ${cor}`,borderRadius:8},children:[
        o.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6},children:[
          o.jsxs("div",{style:{flex:1,minWidth:0},children:[
            o.jsx("p",{style:{fontSize:"0.75rem",fontWeight:600,color:"#fff",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:ag.cliente||"(sem cliente)"}),
            o.jsx("p",{style:{fontSize:"0.6rem",color:TEXT_DIM,margin:"2px 0 0"},children:ag.obra||"—"})
          ]}),
          o.jsx(StatusBadge,{status:ag.status})
        ]}),
        o.jsxs("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:"0.6rem",color:TEXT_MED,margin:"8px 0"},children:[
          o.jsxs("div",{children:["📅 ",fmtDateTime(ag.data_inicio)]}),
          o.jsxs("div",{children:["🔖 ",tipoLabel(ag.tipo)]}),
          o.jsxs("div",{children:["👤 ",fiscalNome(ag.fiscal_id)]}),
          dias!==null&&o.jsx("div",{style:{color:dias<0?RED:dias<=3?YELLOW:TEXT_DIM,fontWeight:600},children:dias<0?`${Math.abs(dias)}d atraso`:dias===0?"Hoje":dias===1?"Amanhã":`em ${dias}d`})
        ]}),
        ag.notas&&o.jsx("p",{style:{fontSize:"0.6rem",color:TEXT_DIM,margin:"4px 0",fontStyle:"italic"},children:ag.notas}),
        o.jsxs("div",{style:{display:"flex",gap:4,marginTop:8,flexWrap:"wrap"},children:[
          ag.status==="agendada"&&o.jsx("button",{onClick:()=>mudarStatus(ag,"confirmada"),style:{...btnSecondary,padding:"3px 8px",fontSize:"0.55rem"},children:"Confirmar"}),
          ag.status!=="realizada"&&ag.status!=="cancelada"&&o.jsx("button",{onClick:()=>mudarStatus(ag,"realizada"),style:{...btnSecondary,padding:"3px 8px",fontSize:"0.55rem",color:GREEN},children:"✓ Realizada"}),
          ag.status!=="cancelada"&&o.jsx("button",{onClick:()=>mudarStatus(ag,"cancelada"),style:{...btnSecondary,padding:"3px 8px",fontSize:"0.55rem",color:RED},children:"Cancelar"}),
          o.jsx("button",{onClick:()=>openEdit(ag),style:{...btnSecondary,padding:"3px 8px",fontSize:"0.55rem"},children:"✎"}),
          o.jsx("button",{onClick:()=>remove(ag),style:{...btnDanger,padding:"3px 8px",fontSize:"0.55rem"},children:"🗑"}),
          ag.card_id&&o.jsx("button",{onClick:()=>window.location.href=`/operacional?card=${ag.card_id}`,style:{...btnSecondary,padding:"3px 8px",fontSize:"0.55rem",color:BLUE},children:"→ Card"})
        ]})
      ]},ag.id)
    })})]},fid)})}),
    o.jsxs(Modal,{open:modal,onClose:()=>setModal(false),title:editing?"Editar Agendamento":"Novo Agendamento",width:540,footer:o.jsxs(REACT.Fragment,{children:[
      o.jsx("button",{onClick:()=>setModal(false),style:btnSecondary,children:"Cancelar"}),
      o.jsx("button",{onClick:save,disabled:saving,style:{...btnPrimary,opacity:saving?0.5:1},children:saving?"Salvando...":"Salvar"})
    ]}),children:[
      o.jsx(Field,{label:`Card vinculado (${cards.length} projetos do Operacional)`,children:cardSelected?o.jsxs("div",{style:{display:"flex",alignItems:"center",gap:8,padding:10,background:`${BLUE}10`,border:`1px solid ${BLUE}40`,borderRadius:6},children:[
        o.jsxs("div",{style:{flex:1,minWidth:0},children:[
          o.jsx("div",{style:{fontSize:"0.72rem",fontWeight:700,color:"white",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:cardSelected.title||cardSelected.obra||"(sem título)"}),
          o.jsxs("div",{style:{fontSize:"0.55rem",color:TEXT_DIM,marginTop:2},children:[(cardSelected.obra||"sem código")," · ",cardSelected.column_id||"—"]})
        ]}),
        o.jsx("button",{onClick:()=>{onPickCard("");setCardSearch("")},style:{...btnSecondary,padding:"3px 8px",fontSize:"0.55rem"},children:"× Trocar"})
      ]}):o.jsxs("div",{children:[
        o.jsx("input",{value:cardSearch,onChange:e=>setCardSearch(e.target.value),placeholder:"Buscar por nome, OS, ou coluna...",style:inputStyle}),
        o.jsx("div",{style:{maxHeight:200,overflowY:"auto",border:`1px solid ${BORDER}`,borderRadius:6,marginTop:4,background:"rgba(0,0,0,0.2)"},children:cardsFiltered.length===0?o.jsx("div",{style:{padding:14,textAlign:"center",fontSize:"0.65rem",color:TEXT_DIM},children:"Nenhum projeto encontrado"}):cardsFiltered.slice(0,80).map(c=>o.jsxs("div",{onClick:()=>{onPickCard(c.id);setCardSearch("")},style:{padding:"7px 10px",borderBottom:`1px solid ${BORDER}`,cursor:"pointer",display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"},onMouseEnter:e=>{e.currentTarget.style.background="rgba(59,130,246,0.08)"},onMouseLeave:e=>{e.currentTarget.style.background="transparent"},children:[
          o.jsxs("div",{style:{flex:1,minWidth:0},children:[
            o.jsx("div",{style:{fontSize:"0.65rem",fontWeight:600,color:"white",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:c.title||c.obra||"(sem título)"}),
            o.jsxs("div",{style:{fontSize:"0.5rem",color:TEXT_DIM,marginTop:1},children:[(c.obra||"sem código")," · ",c.column_id||"—"]})
          ]}),
          o.jsx("span",{style:{fontSize:"0.5rem",padding:"1px 5px",borderRadius:4,background:`${BLUE}20`,color:BLUE,fontWeight:700},children:"+ Vincular"})
        ]},c.id))}),
        cardsFiltered.length>80&&o.jsxs("div",{style:{fontSize:"0.5rem",color:TEXT_DIM,marginTop:3},children:["Mostrando 80 de ",cardsFiltered.length," — refine a busca pra ver mais"]})
      ]})}),
      o.jsxs("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8},children:[
        o.jsx(Field,{label:"Fiscal",children:o.jsxs("select",{value:form.fiscal_id,onChange:e=>setForm({...form,fiscal_id:e.target.value}),style:inputStyle,children:[o.jsx("option",{value:"",children:"— Selecionar —"}),...equipe.map(f=>o.jsx("option",{value:f.id,children:f.nome},f.id))]})}),
        o.jsx(Field,{label:"Tipo",children:o.jsx("select",{value:form.tipo,onChange:e=>setForm({...form,tipo:e.target.value}),style:inputStyle,children:TIPOS_VISTORIA.map(t=>o.jsx("option",{value:t[0],children:t[1]},t[0]))})})
      ]}),
      o.jsx(Field,{label:"Data e horário do agendamento *",children:o.jsx("input",{type:"datetime-local",value:form.data_inicio,onChange:e=>setForm({...form,data_inicio:e.target.value,data_fim:e.target.value}),style:inputStyle})}),
      o.jsxs("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8},children:[
        o.jsx(Field,{label:"Obra",children:o.jsx("input",{value:form.obra,onChange:e=>setForm({...form,obra:e.target.value}),placeholder:"PKT000000",style:inputStyle})}),
        o.jsx(Field,{label:"Cliente",children:o.jsx("input",{value:form.cliente,onChange:e=>setForm({...form,cliente:e.target.value}),style:inputStyle})})
      ]}),
      o.jsx(Field,{label:"Status",children:o.jsx("select",{value:form.status,onChange:e=>setForm({...form,status:e.target.value}),style:inputStyle,children:STATUS_AGENDA.map(s=>o.jsx("option",{value:s,children:s},s))})}),
      o.jsx(Field,{label:"Notas",children:o.jsx("textarea",{value:form.notas,onChange:e=>setForm({...form,notas:e.target.value}),rows:3,placeholder:"Observações...",style:inputStyle})})
    ]})
  ]})
}

/* ═══ LAUDOS & VISTORIAS — port completo do Fiscal (lazy) ═══ */
function LaudosVistoriasTab(){
  const[Comp,setComp]=RE.useState(null);
  const[err,setErr]=RE.useState(null);
  RE.useEffect(()=>{
    let alive=true;
    import("./laudos-vistorias-tab-v1.js")
      .then(m=>{if(alive)setComp(()=>m.LaudosVistoriasTab)})
      .catch(e=>{if(alive){console.error("[LaudosVistoriasTab load]",e);setErr(e.message||String(e))}});
    return()=>{alive=false}
  },[]);
  if(err)return o.jsxs("div",{style:{padding:24,color:"#EF4444",fontSize:"0.75rem"},children:["Erro ao carregar Laudos: ",err]});
  if(!Comp)return o.jsx("div",{style:{padding:40,textAlign:"center",color:TEXT_DIM,fontSize:"0.75rem"},children:"Carregando Laudos & Vistorias..."});
  return o.jsx(Comp,{})
}

/* ═══ GESTÃO FISCAL (dashboard) ═══ */
function GestaoFiscalTab(){
  const[cards,setCards]=RE.useState([]);
  const[agenda,setAgenda]=RE.useState([]);
  const[loading,setLoading]=RE.useState(true);
  const load=RE.useCallback(async()=>{
    setLoading(true);
    const[{data:c},{data:a}]=await Promise.all([
      SB.from("kanban_cards").select("id,column_id,details").eq("dept_id","operacional").limit(2000),
      SB.from("fiscal_agenda").select("id,status,data_inicio").limit(500)
    ]);
    setCards(c||[]);
    setAgenda(a||[]);
    setLoading(false);
  },[]);
  RE.useEffect(()=>{load()},[load]);

  const byCol={};
  cards.forEach(c=>{byCol[c.column_id]=(byCol[c.column_id]||0)+1});
  const cols=Object.entries(byCol).sort((a,b)=>b[1]-a[1]);
  const comVistoria=cards.filter(c=>c.details&&(c.details.data_vistoria||c.details.data_agendada)).length;
  const pendAgend=cards.length-comVistoria;
  const agendAtivas=agenda.filter(a=>["agendado","confirmado"].includes(a.status)).length;
  const realizadas=agenda.filter(a=>a.status==="realizada").length;

  return o.jsxs("div",{style:{padding:16},children:[
    o.jsx("h2",{style:{fontSize:"1rem",fontWeight:600,color:"#fff",marginBottom:4},children:"📊 Gestão Fiscal — Operacional"}),
    o.jsx("p",{style:{fontSize:"0.65rem",color:TEXT_DIM,marginBottom:16},children:"Visão geral dos cards e agendamentos"}),
    loading?o.jsx("div",{style:{padding:40,textAlign:"center",color:TEXT_DIM,fontSize:"0.75rem"},children:"Carregando..."}):o.jsxs(REACT.Fragment,{children:[
      o.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:16},children:[
        o.jsxs("div",{style:{padding:12,background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.25)",borderRadius:8},children:[
          o.jsx("p",{style:{fontSize:"0.5rem",textTransform:"uppercase",color:TEXT_DIM,letterSpacing:"0.1em",margin:0},children:"Total cards"}),
          o.jsx("p",{style:{fontSize:"1.4rem",fontWeight:700,color:GREEN,margin:0},children:cards.length})
        ]}),
        o.jsxs("div",{style:{padding:12,background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.25)",borderRadius:8},children:[
          o.jsx("p",{style:{fontSize:"0.5rem",textTransform:"uppercase",color:TEXT_DIM,letterSpacing:"0.1em",margin:0},children:"Vistoria agendada"}),
          o.jsx("p",{style:{fontSize:"1.4rem",fontWeight:700,color:BLUE,margin:0},children:comVistoria})
        ]}),
        o.jsxs("div",{style:{padding:12,background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:8},children:[
          o.jsx("p",{style:{fontSize:"0.5rem",textTransform:"uppercase",color:TEXT_DIM,letterSpacing:"0.1em",margin:0},children:"Pendentes"}),
          o.jsx("p",{style:{fontSize:"1.4rem",fontWeight:700,color:YELLOW,margin:0},children:pendAgend})
        ]}),
        o.jsxs("div",{style:{padding:12,background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.25)",borderRadius:8},children:[
          o.jsx("p",{style:{fontSize:"0.5rem",textTransform:"uppercase",color:TEXT_DIM,letterSpacing:"0.1em",margin:0},children:"Agendam. ativos"}),
          o.jsx("p",{style:{fontSize:"1.4rem",fontWeight:700,color:PURPLE,margin:0},children:agendAtivas})
        ]}),
        o.jsxs("div",{style:{padding:12,background:"rgba(20,184,166,0.08)",border:"1px solid rgba(20,184,166,0.25)",borderRadius:8},children:[
          o.jsx("p",{style:{fontSize:"0.5rem",textTransform:"uppercase",color:TEXT_DIM,letterSpacing:"0.1em",margin:0},children:"Realizados"}),
          o.jsx("p",{style:{fontSize:"1.4rem",fontWeight:700,color:TEAL,margin:0},children:realizadas})
        ]})
      ]}),
      o.jsx("p",{style:{fontSize:"0.55rem",textTransform:"uppercase",color:TEXT_DIM,letterSpacing:"0.1em",marginBottom:8},children:"Distribuição por coluna"}),
      o.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8},children:cols.map(([col,qtd])=>o.jsxs("div",{style:{padding:10,background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:6,display:"flex",justifyContent:"space-between",alignItems:"center"},children:[
        o.jsx("span",{style:{fontSize:"0.65rem",color:TEXT_MED},children:col}),
        o.jsx("span",{style:{fontSize:"0.75rem",fontWeight:700,color:"#fff"},children:qtd})
      ]},col))})
    ]})
  ]})
}

const FISCAL_SUB=[
  {id:"gestao-fiscal",label:"Gestão Fiscal",render:()=>o.jsx(GestaoFiscalTab,{})},
  {id:"equipe",label:"Equipe Fiscal",render:()=>o.jsx(EquipeFiscalTab,{})},
  {id:"agenda",label:"Agenda Vistorias",render:()=>o.jsx(AgendaVistoriasTab,{})},
  {id:"kanban-semanal",label:"🗂 Kanban Semanal",render:()=>o.jsx(LazyDeptTab,{chunk:"./kanban-fiscal-semanal-pkt1.js",tabsExport:"kanbanFiscalSemanalTabs",tabId:"kanban-semanal",label:"🗂 Kanban Semanal"})},
  {id:"laudos",label:"Laudos & Vistorias",render:()=>o.jsx(LaudosVistoriasTab,{})}
];
const PROD_SUB=PMO_SPEC.map(sp=>({id:sp.id,label:sp.label,render:()=>o.jsx(LazyDeptTab,{chunk:"./dept-pmo-CGcKSWcu.js",tabsExport:"pmoTabs",tabId:sp.id,label:sp.label})}));
const OBRAS_SUB=OBRAS_SPEC.map(sp=>({id:sp.id,label:sp.label,render:sp.id==="previsao-obras"?(()=>o.jsx("iframe",{src:"/previsao-obras.html?_emb=1",style:{width:"100%",height:"calc(100vh - 220px)",minHeight:"600px",border:"none",borderRadius:8,background:"#0a0a0a",display:"block"}})):()=>o.jsx(LazyDeptTab,{chunk:"./dept-obras-Cis-W8dN.js",tabsExport:"obrasTabs",tabId:sp.id,label:sp.label})}));
const ATEND_SUB=ATEND_SPEC.map(sp=>({id:sp.id,label:sp.label,render:()=>o.jsx(LazyDeptTab,{chunk:"./dept-atendimento-BCyjzWV1.js",tabsExport:"atendimentoTabs",tabId:sp.id,label:sp.label})}));

function SetorPage({title,subtitle,color,subTabs}){
  const[active,setActive]=RE.useState((subTabs[0]||{}).id);
  const current=subTabs.find(t=>t.id===active)||subTabs[0];
  return o.jsxs("div",{style:{padding:0},children:[
    o.jsxs("div",{style:{padding:"16px 20px 0",borderBottom:`1px solid ${BORDER}`},children:[
      o.jsxs("div",{style:{marginBottom:12},children:[
        o.jsx("h1",{style:{fontSize:"1.2rem",fontWeight:700,color:"#fff",margin:0},children:title}),
        subtitle&&o.jsx("p",{style:{fontSize:"0.7rem",color:TEXT_DIM,margin:"4px 0 0"},children:subtitle})
      ]}),
      o.jsx("div",{style:{display:"flex",gap:4,overflowX:"auto",paddingBottom:0},children:subTabs.map(t=>{
        const sel=t.id===current.id;
        return o.jsx("button",{onClick:()=>setActive(t.id),style:{padding:"8px 14px",border:"none",background:"transparent",color:sel?color:TEXT_MED,borderBottom:sel?`2px solid ${color}`:"2px solid transparent",fontSize:"0.72rem",fontWeight:sel?700:500,cursor:"pointer",whiteSpace:"nowrap"},children:t.label},t.id)
      })})
    ]}),
    o.jsx("div",{style:{padding:"8px 0"},children:current?current.render():null})
  ]})
}

const TABS=[
  {id:"spec-relatorios",label:"📊 Relatórios",icon:ICC,section:"Específico",render:()=>o.jsx(RELAT_PAGE,{})},
  {id:"spec-fiscal",label:"Fiscal",icon:ICC,section:"Específico",render:()=>o.jsx(SetorPage,{title:"Fiscal",subtitle:"Equipe, Agenda de Vistorias, Laudos e Gestão",color:BLUE,subTabs:FISCAL_SUB})},
  {id:"spec-prod",label:"Produtividade",icon:ICC,section:"Específico",render:()=>o.jsx(SetorPage,{title:"Produtividade",subtitle:"Acompanhamento, Produtividade, Riscos e Ranking",color:PURPLE,subTabs:PROD_SUB})},
  {id:"spec-obras",label:"Obras",icon:ICC,section:"Específico",render:()=>o.jsx(SetorPage,{title:"Obras",subtitle:"Diário, Acompanhamento, Gestão de Equipes",color:YELLOW,subTabs:OBRAS_SUB})},
  {id:"spec-atend",label:"Atendimento",icon:ICC,section:"Específico",render:()=>o.jsx(SetorPage,{title:"Atendimento",subtitle:"Grupos, NPS, Scripts e Templates",color:TEAL,subTabs:ATEND_SUB})},
  {id:"jornada",label:"🗺️ Jornada",icon:ICC,section:"Específico",render:()=>o.jsx(JornadaTab,{})},
  {id:"solicitar-compras-ops",label:"🛒 Solicitar Compras",icon:ICC,section:"Específico",render:()=>o.jsx(SolicitarComprasPage,{})},
  {id:"equipe-atividade",label:"👥 Equipe & Atividade",icon:ICC,section:"Específico",render:()=>o.jsx("iframe",{src:"https://instala.parket.works/admin/central?embed=1",style:{width:"100%",height:"calc(100vh - 220px)",minHeight:"600px",border:"none",borderRadius:8,background:"#0a0a0a",display:"block"}})}
];

const TEAM=[
  {name:"Dany",role:"Coordenadora de Obras",avatar:"DA",avatarColor:"#EF4444",status:"online"},
  {name:"Felipe",role:"Fiscal / Atendimento",avatar:"FE",avatarColor:"#3B82F6",status:"online"},
  {name:"Vinicius",role:"CS / Atendimento",avatar:"VI",avatarColor:"#14B8A6",status:"online"},
  {name:"Natalia",role:"PMO / Produtividade",avatar:"NA",avatarColor:"#8B5CF6",status:"online"},
  {name:"Thaiane",role:"Projetos",avatar:"TH",avatarColor:"#F59E0B",status:"online"}
];

function DeptOperacionalPage(){
  const switcherRef=REACT.useRef(null);
  const QA=[
    {label:"Nova Vistoria",icon:SI,color:BLUE,onClick:()=>{var f;(f=switcherRef.current)==null||f.call(switcherRef,"spec-fiscal"),setTimeout(()=>document.dispatchEvent(new CustomEvent("open-nova-vistoria")),80)}},
    
    {label:"Diário Obra",icon:PE,color:PURPLE,onClick:()=>document.dispatchEvent(new CustomEvent("open-novo-diario"))},
    {label:"Foto Obra",icon:CA,color:YELLOW,onClick:()=>document.dispatchEvent(new CustomEvent("open-foto-obra"))},
    {label:"Checklist",icon:CK,color:GREEN,onClick:()=>{var f;return(f=switcherRef.current)==null?void 0:f.call(switcherRef,"spec-fiscal")}},
    {label:"Medição",icon:RU,color:TEAL,onClick:()=>{var f;return(f=switcherRef.current)==null?void 0:f.call(switcherRef,"spec-fiscal")}},
    {label:"Solicitar Compras",icon:SC,color:GREEN,onClick:()=>document.dispatchEvent(new CustomEvent("open-solicitar-compras"))}
  ];
  /* Busca no kanban */
  const[search,setSearch]=RE.useState("");
  /* Helper: equipe pode ser array de {nome,funcao} */
  const _f=v=>Array.isArray(v)?v.map(x=>x&&typeof x==="object"?(x.nome||x.name||""):String(x||"")).filter(Boolean).join(", "):(v&&typeof v==="object")?(v.nome||v.name||""):String(v||"");
  const cardFilter=RE.useCallback(c=>{
    if(!search.trim())return true;
    const det=c.details||{};
    const q=search.trim().toLowerCase();
    const hay=[c.title,c.subtitle,c.obra,c.responsavel,det.endereco,det.servicos,det.vendedor,_f(det.equipe),det.fiscal_responsavel,det.cidade,det.estado].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  },[search]);
  const kanbanHeaderExtra=o.jsx("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:10},children:o.jsx("input",{value:search,onChange:e=>setSearch(e.target.value),placeholder:"🔍 Buscar projeto, cliente, endereço, serviço, equipe…",style:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"7px 12px",fontSize:"0.7rem",color:"#fff",outline:"none",width:"100%",maxWidth:480}})});
  return o.jsx(t,{deptId:"operacional",baseRoute:"operacional",team:TEAM,quickActions:QA,activity:[],extraTabs:TABS,tabSwitcherRef:switcherRef,cardFilter:cardFilter,kanbanHeaderExtra:kanbanHeaderExtra})
}

export{DeptOperacionalPage,JornadaTab};
