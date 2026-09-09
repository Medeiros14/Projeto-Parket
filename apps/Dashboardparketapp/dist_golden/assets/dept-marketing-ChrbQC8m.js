import{r as g,s as u,R as b,j as e}from"./index-DZtetJYP.js";import{D as Y,I as L,e as M,a as q}from"./dept-layout-BtZpIBbo.js";import{S as I,B as R,M as H,F as N,a as $,b as E}from"./modal-DpddCyTD.js";import{g as f,f as A,b as k,O as z,h as d,c as j,d as _,A as G,Y as w,R as P,P as Q}from"./sistema-ops-data-xhsYTu6a.js";import{c as D}from"./createLucideIcon-BrbNkm3O.js";import{C as U}from"./map-pin-i5bI163W.js";import{R as V,X,Y as J,T as Z,B as ee}from"./AreaChart-DpkIHS8Q.js";import{B as ae}from"./BarChart-ChCf130d.js";import{C as te}from"./CartesianGrid-BbDZctHE.js";import{E as se}from"./eye-pq64b5hR.js";import"./useHandoffs-zCM2waPl.js";import"./zap-CLVqZ3h5.js";import"./clock-CeMp6uPA.js";import"./search-DIgyDOtS.js";import"./circle-check-C9fEuXIz.js";import"./x-CqWN-PQU.js";import"./triangle-alert-_aaufXhh.js";import"./plus-DJV8hk0e.js";import"./trash-2-CktFxQAk.js";import"./refresh-cw-DFTJ8CmQ.js";import"./loader-circle-Cxu-14UL.js";import"./arrow-right-left-C7PeaHOi.js";import"./users-C9NE0xqT.js";import"./shield-CmimxUQ-.js";import"./log-out-CnrNCqYt.js";import"./briefcase-CoQ9adtQ.js";/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oe=[["path",{d:"m3 11 18-5v12L3 14v-3z",key:"n962bs"}],["path",{d:"M11.6 16.8a3 3 0 1 1-5.8-1.6",key:"1yl0tm"}]],O=D("megaphone",oe);/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ne=[["path",{d:"m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5",key:"ftymec"}],["rect",{x:"2",y:"6",width:"14",height:"12",rx:"2",key:"158x01"}]],B=D("video",ne);function W(){const[s,h]=g.useState([]),[n,v]=g.useState([]),[m,c]=g.useState([]),[i,y]=g.useState([]),[C,t]=g.useState(!0),l=g.useCallback(async()=>{t(!0);const[{data:o},{data:p},{data:K},{data:F}]=await Promise.all([u.from("marketing_leads_canal").select("*").order("leads",{ascending:!1}),u.from("marketing_leads_mensal").select("*").order("periodo"),u.from("marketing_conteudo").select("*").order("data"),u.from("marketing_campanhas").select("*").order("created_at",{ascending:!1})]);h(o??[]),v(p??[]),c(K??[]),y(F??[]),t(!1)},[]);g.useEffect(()=>{l();const o=u.channel("marketing_realtime").on("postgres_changes",{event:"*",schema:"public",table:"marketing_campanhas"},l).on("postgres_changes",{event:"*",schema:"public",table:"marketing_conteudo"},l).subscribe();return()=>{u.removeChannel(o)}},[l]);const x=async(o,p)=>{await u.from("marketing_conteudo").update({status:p}).eq("id",o),l()},S=async(o,p)=>{await u.from("marketing_campanhas").update({status:p}).eq("id",o),l()},a=async o=>{await u.from("marketing_conteudo").insert({...o,status:"criacao"}),l()},r=s.reduce((o,p)=>o+p.leads,0),T=i.filter(o=>o.status==="ativo").length;return{leadsCanal:s,leadsMensal:n,conteudo:m,campanhas:i,loading:C,refetch:l,totalLeadsMes:r,campanhasAtivas:T,updateConteudoStatus:x,updateCampanhaStatus:S,criarConteudo:a}}const le=[{canal:"Google Ads",leads:28,cpl:"R$ 62",conversao:"32%",gasto:"R$ 1.7k"},{canal:"Instagram",leads:22,cpl:"R$ 108",conversao:"24%",gasto:"R$ 2.4k"},{canal:"Indicacao",leads:35,cpl:"R$ 0",conversao:"45%",gasto:"—"},{canal:"Showroom",leads:7,cpl:"R$ 150",conversao:"57%",gasto:"R$ 1.1k"}],re=[{mes:"Set",leads:62},{mes:"Out",leads:68},{mes:"Nov",leads:75},{mes:"Dez",leads:58},{mes:"Jan",leads:82},{mes:"Fev",leads:92}],ie=[{tipo:"Reel",titulo:"Bastidores Instalacao PKT-048",status:"edicao 50%",data:"Ter",plataforma:"IG"},{tipo:"Carrossel",titulo:"10 Diferenciais Parket",status:"criacao",data:"Qua",plataforma:"IG"},{tipo:"Story",titulo:"Obra PKT-048 — update",status:"agendado",data:"Qui 11h",plataforma:"IG"},{tipo:"Anuncio",titulo:"Google Ads: Piso Premium",status:"A/B test",data:"Seg",plataforma:"Google"},{tipo:"Case",titulo:"Case PKT-042 — Carvalho",status:"roteiro pendente",data:"Sex",plataforma:"Site"}],ce=[{nome:"Piso Premium SP",canal:"Google Ads",orcamento:"R$ 3k/mes",gasto:"R$ 1.7k",leads:28,cpl:"R$ 62",status:"ativo"},{nome:"Marcenaria Luxo",canal:"Instagram",orcamento:"R$ 2k/mes",gasto:"R$ 1.2k",leads:12,cpl:"R$ 100",status:"ativo"},{nome:"Deck & Fachada",canal:"Google Ads",orcamento:"R$ 1.5k/mes",gasto:"R$ 800",leads:8,cpl:"R$ 100",status:"pausado"}];function de(){const{leadsCanal:s,leadsMensal:h,campanhas:n,updateCampanhaStatus:v}=W(),m=s.length>0?s:le,c=h.length>0?h:re,i=n.length>0?n:null,y=i?i.map(t=>({id:t.id,nome:t.nome,canal:t.canal,orcamento:t.orcamento,gasto:t.gasto,leads:t.leads,cpl:t.cpl,status:t.status})):ce.map((t,l)=>({id:String(l),...t})),C={ativo:k,pausado:w,encerrado:P};return e.jsxs("div",{className:"space-y-5",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"text-white mb-1",style:{fontSize:"1rem",fontWeight:600},children:"Analytics de Marketing"}),e.jsx("p",{style:{fontSize:"0.65rem",color:d},children:"Performance por canal, leads e campanhas"})]}),e.jsxs("div",{className:"rounded-xl p-5",style:{background:_,border:`1px solid ${j}`},children:[e.jsx("p",{className:"tracking-[0.2em] uppercase mb-1",style:{fontSize:"0.5rem",color:G},children:"Leads por Mes"}),e.jsx("div",{style:{height:180},children:e.jsx(V,{width:"100%",height:"100%",children:e.jsxs(ae,{data:c,children:[e.jsx(te,{strokeDasharray:"3 3",stroke:"rgba(255,255,255,0.04)"},"cg"),e.jsx(X,{dataKey:"mes",tick:{fill:d,fontSize:10},axisLine:!1},"xa"),e.jsx(J,{tick:{fill:d,fontSize:10},axisLine:!1},"ya"),e.jsx(Z,{content:e.jsx(q,{})},"tt"),e.jsx(ee,{dataKey:"leads",name:"Leads",fill:f,fillOpacity:.6,radius:[4,4,0,0],isAnimationActive:!1},"bar")]})})})]}),e.jsxs("div",{className:"rounded-xl overflow-hidden",style:{border:`1px solid ${j}`},children:[e.jsx("div",{className:"px-4 py-3",style:{background:"rgba(255,255,255,0.02)"},children:e.jsx("p",{style:{fontSize:"0.7rem",fontWeight:600,color:"white"},children:"Performance por Canal"})}),m.map((t,l)=>e.jsxs("div",{className:"flex items-center gap-3 px-4 py-3",style:{borderTop:`1px solid ${j}`},children:[e.jsx("span",{className:"text-white",style:{fontSize:"0.72rem",fontWeight:500,width:90},children:t.canal}),e.jsx("span",{style:{fontSize:"0.65rem",color:f,fontWeight:600,width:40},children:t.leads}),e.jsxs("span",{style:{fontSize:"0.6rem",color:k,width:60},children:["CPL: ",t.cpl]}),e.jsxs("span",{style:{fontSize:"0.6rem",color:A,width:50},children:["Conv: ",t.conversao]}),e.jsxs("span",{className:"ml-auto",style:{fontSize:"0.6rem",color:d},children:["Gasto: ",t.gasto]})]},l))]}),e.jsxs("div",{className:"rounded-xl p-4",style:{background:_,border:`1px solid ${j}`},children:[e.jsx("p",{style:{fontSize:"0.7rem",fontWeight:600,color:"white",marginBottom:12},children:"Campanhas Ativas"}),e.jsx("div",{className:"space-y-2",children:y.map((t,l)=>{const x=t.status==="ativo"?k:w;return e.jsxs("div",{className:"flex items-center gap-3 p-3 rounded-lg",style:{background:"rgba(255,255,255,0.02)",border:`1px solid ${j}`},children:[e.jsx(O,{size:14,style:{color:x}}),e.jsxs("div",{className:"flex-1",children:[e.jsx("p",{className:"text-white",style:{fontSize:"0.72rem"},children:t.nome}),e.jsxs("p",{style:{fontSize:"0.55rem",color:d},children:[t.canal," · Orc: ",t.orcamento," · Gasto: ",t.gasto]})]}),e.jsxs("span",{style:{fontSize:"0.6rem",color:f},children:[t.leads," leads"]}),i?e.jsx(I,{value:t.status,options:["ativo","pausado","encerrado"],onChange:S=>v(t.id,S),colorMap:C}):e.jsx("span",{className:"rounded-full px-2 py-0.5",style:{fontSize:"0.45rem",fontWeight:600,background:`${x}15`,color:x},children:t.status})]},l)})})]})]})}function me(){
  const [mes, setMes] = g.useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [cards, setCards] = g.useState([]);
  const [loading, setLoading] = g.useState(true);
  const [sel, setSel] = g.useState(null);
  const [refreshTick, setRefreshTick] = g.useState(0);

  g.useEffect(() => {
    let alive = true;
    setLoading(true);
    u.from("kanban_cards").select("id,title,details,column_id").eq("dept_id","marketing").then(({data}) => {
      if (!alive) return;
      setCards(data || []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [refreshTick]);

  const ano = mes.getFullYear();
  const mesIdx = mes.getMonth();
  const primDia = new Date(ano, mesIdx, 1);
  const ultDia = new Date(ano, mesIdx + 1, 0);
  const offset = primDia.getDay();
  const totalDays = ultDia.getDate();
  const semanas = Math.ceil((offset + totalDays) / 7);

  const cardsPorDia = {};
  cards.forEach(c => {
    const det = c.details || {};
    if (det.prazo_entrega) {
      const k = String(det.prazo_entrega).slice(0,10);
      cardsPorDia[k] = cardsPorDia[k] || {entrega:[], pub:[]};
      cardsPorDia[k].entrega.push(c);
    }
    if (det.data_publicacao) {
      const k = String(det.data_publicacao).slice(0,10);
      cardsPorDia[k] = cardsPorDia[k] || {entrega:[], pub:[]};
      cardsPorDia[k].pub.push(c);
    }
  });

  const nomesMes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const nomesSemana = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const hojeStr = new Date().toISOString().slice(0,10);

  const prev = () => setMes(new Date(ano, mesIdx - 1, 1));
  const next = () => setMes(new Date(ano, mesIdx + 1, 1));
  const hoje = () => { const d=new Date(); d.setDate(1); d.setHours(0,0,0,0); setMes(d); };

  const cells = [];
  for (let i = 0; i < semanas * 7; i++) {
    const dayNum = i - offset + 1;
    const inMonth = dayNum >= 1 && dayNum <= totalDays;
    const dateStr = inMonth ? (ano + "-" + String(mesIdx+1).padStart(2,"0") + "-" + String(dayNum).padStart(2,"0")) : null;
    const items = inMonth ? (cardsPorDia[dateStr] || {entrega:[], pub:[]}) : {entrega:[], pub:[]};
    cells.push({i, dayNum, inMonth, dateStr, items, isToday: dateStr === hojeStr});
  }

  const btnSt = {background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,color:"#fff",padding:"4px 12px",cursor:"pointer",fontSize:"0.75rem"};
  const detItem = (label, val, color) => e.jsxs("div",{children:[e.jsx("span",{style:{color:"rgba(255,255,255,0.5)"},children:label+": "}), color ? e.jsx("a",{href:val,target:"_blank",rel:"noopener",style:{color:"#60A5FA"},children:"Abrir"}) : val]}, label);

  return e.jsxs("div",{className:"space-y-3",children:[
    e.jsxs("div",{className:"flex items-center justify-between flex-wrap gap-3 mb-2",children:[
      e.jsxs("div",{className:"flex items-center gap-3",children:[
        e.jsx("button",{onClick:prev,style:btnSt,children:"◀"}),
        e.jsx("h2",{style:{color:"#fff",fontSize:"1rem",fontWeight:600,minWidth:200,textAlign:"center"},children: nomesMes[mesIdx] + " " + ano}),
        e.jsx("button",{onClick:next,style:btnSt,children:"▶"}),
        e.jsx("button",{onClick:hoje,style:{...btnSt,fontSize:"0.65rem",color:"rgba(255,255,255,0.7)"},children:"Hoje"}),
        e.jsx("button",{onClick:()=>setRefreshTick(t=>t+1),style:{...btnSt,fontSize:"0.65rem",color:"rgba(255,255,255,0.7)"},children:"↻"})
      ]}),
      e.jsxs("div",{className:"flex items-center gap-4",children:[
        e.jsxs("div",{className:"flex items-center gap-2",children:[
          e.jsx("span",{style:{width:10,height:10,borderRadius:3,background:"#F97316",display:"inline-block"}}),
          e.jsx("span",{style:{color:"rgba(255,255,255,0.7)",fontSize:"0.65rem"},children:"Prazo de entrega"})
        ]}),
        e.jsxs("div",{className:"flex items-center gap-2",children:[
          e.jsx("span",{style:{width:10,height:10,borderRadius:3,background:"#10B981",display:"inline-block"}}),
          e.jsx("span",{style:{color:"rgba(255,255,255,0.7)",fontSize:"0.65rem"},children:"Publicação"})
        ]}),
        e.jsx("span",{style:{color:"rgba(255,255,255,0.4)",fontSize:"0.6rem"},children: cards.length + " cards"})
      ]})
    ]}),
    e.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(7, 1fr)",gap:4,marginBottom:4},children:
      nomesSemana.map(n => e.jsx("div",{style:{color:"rgba(255,255,255,0.5)",fontSize:"0.6rem",fontWeight:700,textAlign:"center",padding:"4px 0",textTransform:"uppercase",letterSpacing:0.5},children:n},n))
    }),
    e.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(7, 1fr)",gap:4},children:
      cells.map(cell => {
        const totEv = cell.items.entrega.length + cell.items.pub.length;
        return e.jsxs("div",{
          style:{
            minHeight:96,
            padding:"4px 6px",
            borderRadius:6,
            background: cell.inMonth ? (cell.isToday ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.02)") : "transparent",
            border: cell.isToday ? "1px solid rgba(59,130,246,0.45)" : (cell.inMonth ? "1px solid rgba(255,255,255,0.05)" : "1px solid transparent"),
            display:"flex",
            flexDirection:"column",
            gap:3,
            overflow:"hidden"
          },
          children:[
            cell.inMonth && e.jsx("div",{style:{color:cell.isToday?"#60A5FA":"rgba(255,255,255,0.5)",fontSize:"0.62rem",fontWeight:cell.isToday?700:500,textAlign:"right"},children:cell.dayNum}),
            ...cell.items.entrega.slice(0,3).map(c => e.jsx("button",{
              onClick:()=>setSel({card:c, tipo:"entrega"}),
              title: c.title,
              style:{background:"rgba(249,115,22,0.15)",border:"1px solid rgba(249,115,22,0.3)",color:"#FB923C",fontSize:"0.55rem",fontWeight:600,padding:"2px 4px",borderRadius:4,cursor:"pointer",textAlign:"left",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%"},
              children:c.title
            }, "e-"+c.id)),
            ...cell.items.pub.slice(0,3).map(c => e.jsx("button",{
              onClick:()=>setSel({card:c, tipo:"pub"}),
              title: c.title,
              style:{background:"rgba(16,185,129,0.15)",border:"1px solid rgba(16,185,129,0.3)",color:"#34D399",fontSize:"0.55rem",fontWeight:600,padding:"2px 4px",borderRadius:4,cursor:"pointer",textAlign:"left",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%"},
              children:c.title
            }, "p-"+c.id)),
            totEv > 6 && e.jsx("span",{style:{color:"rgba(255,255,255,0.4)",fontSize:"0.55rem",textAlign:"center"},children:"+"+(totEv-6)+" mais"})
          ]
        }, "cell-"+cell.i);
      })
    }),
    loading && e.jsx("div",{style:{color:"rgba(255,255,255,0.5)",fontSize:"0.65rem",textAlign:"center",padding:12},children:"Carregando…"}),
    sel && e.jsx("div",{
      style:{position:"fixed",inset:0,zIndex:80,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"},
      onClick:()=>setSel(null),
      children: e.jsxs("div",{
        style:{background:"#111",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:20,maxWidth:520,width:"100%",maxHeight:"82vh",overflow:"auto"},
        onClick:ev=>ev.stopPropagation(),
        children:[
          e.jsx("div",{style:{color:sel.tipo==="entrega"?"#FB923C":"#34D399",fontSize:"0.55rem",fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6},children: sel.tipo==="entrega" ? "Prazo de entrega" : "Publicação"}),
          e.jsx("h3",{style:{color:"#fff",fontSize:"1rem",fontWeight:700,marginBottom:12},children:sel.card.title}),
          e.jsxs("div",{style:{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12},children:[
            ...(()=>{const c=(sel.card.details||{}).canal; const arr=Array.isArray(c)?c:(c?[c]:[]); return arr.map(x=>e.jsx("span",{style:{background:"rgba(59,130,246,0.15)",color:"#3B82F6",fontSize:"0.62rem",padding:"3px 8px",borderRadius:8,fontWeight:600},children:x},"cn-"+x));})(),
            ...(()=>{const c=(sel.card.details||{}).formato; const arr=Array.isArray(c)?c:(c?[c]:[]); return arr.map(x=>e.jsx("span",{style:{background:"rgba(168,85,247,0.15)",color:"#A855F7",fontSize:"0.62rem",padding:"3px 8px",borderRadius:8,fontWeight:600},children:x},"ft-"+x));})(),
            (sel.card.details||{}).tipo_conteudo && e.jsx("span",{style:{background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.7)",fontSize:"0.62rem",padding:"3px 8px",borderRadius:8,fontWeight:600},children:(sel.card.details||{}).tipo_conteudo}),
            (sel.card.details||{}).tipo_tarefa && e.jsx("span",{style:{background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.7)",fontSize:"0.62rem",padding:"3px 8px",borderRadius:8,fontWeight:600},children:(sel.card.details||{}).tipo_tarefa})
          ]}),
          e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:7,fontSize:"0.7rem",color:"rgba(255,255,255,0.85)"},children:[
            (sel.card.details||{}).prazo_entrega && detItem("Entrega", String((sel.card.details||{}).prazo_entrega).slice(0,10), null),
            (sel.card.details||{}).data_publicacao && detItem("Publicação", String((sel.card.details||{}).data_publicacao).slice(0,10), null),
            sel.card.column_id && detItem("Coluna", sel.card.column_id, null),
            (sel.card.details||{}).link_assets && detItem("Assets", (sel.card.details||{}).link_assets, true),
            (sel.card.details||{}).link_final && detItem("Final", (sel.card.details||{}).link_final, true),
            (sel.card.details||{}).link_publicacao && detItem("Publicação (link)", (sel.card.details||{}).link_publicacao, true)
          ]}),
          e.jsx("button",{onClick:()=>setSel(null),style:{marginTop:18,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#fff",padding:"6px 14px",borderRadius:6,cursor:"pointer",fontSize:"0.7rem"},children:"Fechar"})
        ]
      })
    })
  ]});
}
const pe=[{id:"analytics",label:"Analytics",icon:M,render:()=>e.jsx(de,{})},{id:"calendario",label:"Calendario Conteudo",icon:U,render:()=>e.jsx(me,{})}],ue=[],he=[{id:"1",text:"Campanha Google Ads: CPL caiu para R$ 58 — otimizar bid",time:"Hoje 10:00",type:"completed"},{id:"2",text:"Case PKT-039 pendente de aprovacao ha 5 dias",time:"Hoje 08:00",type:"alert"},{id:"3",text:"92 leads no mes — +12% vs mes anterior",time:"Ontem 18:00",type:"completed"},{id:"4",text:"Story PKT-048 agendado para amanha 11h",time:"Ontem 15:00",type:"action"}];// ════════════════════════════════════════════════════════════════
// MARKETING KANBAN PRO V2 — cards estilo ClickUp com validação
// ════════════════════════════════════════════════════════════════

const _MKT_PRIORITIES = [
  {id:"urgente", label:"Urgente", color:"#EF4444", icon:"🔥"},
  {id:"alta",    label:"Alta",    color:"#F97316", icon:"⬆"},
  {id:"media",   label:"Média",   color:"#3B82F6", icon:"●"},
  {id:"baixa",   label:"Baixa",   color:"#6B7280", icon:"⬇"},
];
const _MKT_TIPOS_TAREFA = [
  "Criação de conteúdo","Produção de vídeo","Edição de vídeo","Motion e Animação",
  "Tráfego pago","Copy e Texto","E-mail marketing","Estratégia",
  "Relatório e Análise","Reunião e Briefing","Gestão de perfil","Outro"
];
const _MKT_TIPOS_CONTEUDO = [
  "Institucional","Produto","Oferta e Promo","Educativo","Bastidores","UGC","Depoimento","Data comemorativa","Lançamento"
];
const _MKT_CANAIS = [
  "Instagram","Facebook","TikTok","YouTube","LinkedIn","Pinterest","Google","WhatsApp","E-mail","Site"
];
const _MKT_FORMATOS = [
  "Feed 1:1","Feed 4:5","Feed 1.91:1","Carrossel 1:1","Carrossel 4:5",
  "Stories 9:16","Reels 9:16","Shorts 9:16","Vídeo 16:9","Thumbnail 16:9",
  "Banner 1200x628","Display 300x250","Banner e-mail","Banner site","Pop-up"
];

function _mktPriColor(p){ const f=_MKT_PRIORITIES.find(x=>x.id===p); return f?f.color:"#6B7280"; }
function _mktPriLabel(p){ const f=_MKT_PRIORITIES.find(x=>x.id===p); return f?f.label:"Média"; }

function _mktDateBadge(due){
  if(!due) return null;
  const d = new Date(due);
  const today = new Date(); today.setHours(0,0,0,0);
  const dDate = new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const diff = Math.round((dDate-today)/86400000);
  let txt = d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
  let bg = "rgba(255,255,255,0.05)", color = "rgba(255,255,255,0.6)";
  if(diff<0){ bg="rgba(239,68,68,0.18)"; color="#EF4444"; txt = "atrasou "+Math.abs(diff)+"d"; }
  else if(diff===0){ bg="rgba(234,179,8,0.18)"; color="#EAB308"; txt = "hoje"; }
  else if(diff<=2){ bg="rgba(234,179,8,0.10)"; color="#EAB308"; }
  return {txt,bg,color};
}

// Card visual compacto no kanban
function MarketingCardCompact({card, onOpen}){
  const det = card.details || {};
  const tags = Array.isArray(card.tags) ? card.tags : [];
  const dueBadge = _mktDateBadge(det.prazo_entrega || det.due_date);
  const priColor = _mktPriColor(card.priority);
  const checklist = Array.isArray(det.checklist) ? det.checklist : [];
  const checklistDone = checklist.filter(x=>x.done).length;
  const comments = Array.isArray(det.comments) ? det.comments : [];

  return e.jsxs("div",{
    onClick:onOpen,
    style:{
      background:"#1a1a1a",
      borderLeft:"3px solid "+priColor,
      borderTop:"1px solid rgba(255,255,255,0.06)",
      borderRight:"1px solid rgba(255,255,255,0.06)",
      borderBottom:"1px solid rgba(255,255,255,0.06)",
      borderRadius:6,
      padding:"8px 10px",
      cursor:"pointer",
      display:"flex",
      flexDirection:"column",
      gap:6,
    },
    children:[
      // Tags + canal
      (tags.length>0 || (Array.isArray(det.canal)?det.canal.length>0:!!det.canal)) && e.jsxs("div",{style:{display:"flex",gap:4,flexWrap:"wrap"},children:[
        ...tags.slice(0,3).map((t,i)=>e.jsx("span",{
          style:{background:"rgba(184,170,154,0.15)",color:"#B8AA9A",fontSize:9,padding:"1px 6px",borderRadius:8,fontWeight:600},
          children:t
        },i)),
        ...((Array.isArray(det.canal)?det.canal:(det.canal?[det.canal]:[])).slice(0,3).map((c,i)=>e.jsx("span",{
          style:{background:"rgba(59,130,246,0.15)",color:"#3B82F6",fontSize:9,padding:"1px 6px",borderRadius:8,fontWeight:600},
          children:c
        },"canal-"+i))),
        (Array.isArray(det.canal)?det.canal:(det.canal?[det.canal]:[])).length>3 && e.jsx("span",{
          style:{background:"rgba(59,130,246,0.15)",color:"#3B82F6",fontSize:9,padding:"1px 6px",borderRadius:8,fontWeight:600},
          children:"+"+((Array.isArray(det.canal)?det.canal:(det.canal?[det.canal]:[])).length-3)
        })
      ]}),
      // Título
      e.jsx("div",{style:{color:"#fff",fontSize:12,fontWeight:600,lineHeight:1.3},children:card.title||"(sem título)"}),
      // Subtitle: tipo tarefa
      det.tipo_tarefa && e.jsx("div",{style:{color:"rgba(255,255,255,0.5)",fontSize:10},children:det.tipo_tarefa}),
      // Footer: counters + due + responsável
      e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:6,marginTop:2,flexWrap:"wrap"},children:[
        dueBadge && e.jsx("span",{
          style:{background:dueBadge.bg,color:dueBadge.color,fontSize:9,padding:"1px 5px",borderRadius:4,fontWeight:600},
          children:dueBadge.txt
        }),
        comments.length>0 && e.jsxs("span",{style:{color:"rgba(255,255,255,0.4)",fontSize:9,display:"inline-flex",alignItems:"center",gap:2},children:["💬",comments.length]}),
        det.link_assets && e.jsx("span",{style:{color:"rgba(255,255,255,0.4)",fontSize:9},children:"📎"}),
        det.link_final && e.jsx("span",{style:{color:"#22c55e",fontSize:9},children:"✓"}),
        checklist.length>0 && e.jsxs("span",{style:{color:"rgba(255,255,255,0.4)",fontSize:9,display:"inline-flex",alignItems:"center",gap:2},children:["☑",checklistDone+"/"+checklist.length]}),
        e.jsx("span",{style:{flex:1}}),
        card.responsavel && e.jsx("span",{
          style:{background:"rgba(34,197,94,0.15)",color:"#22c55e",fontSize:9,padding:"1px 5px",borderRadius:4,fontWeight:600},
          children:card.responsavel
        })
      ]})
    ]
  });
}

// Modal expandido — todos os campos validados
function MarketingCardModal({card, cols, onClose, onSave, onDelete}){
  const [draft, setDraft] = b.useState(()=>({
    ...card,
    details: card.details || {},
    tags: Array.isArray(card.tags) ? [...card.tags] : []
  }));
  const [saving, setSaving] = b.useState(false);
  const [errors, setErrors] = b.useState({});

  const updField = (key, val) => setDraft(d=>({...d, [key]:val}));
  const updDetail = (key, val) => setDraft(d=>({...d, details:{...d.details, [key]:val}}));
  const det = draft.details || {};

  // Validação
  const validate = () => {
    const er = {};
    if(!(draft.title||"").trim()) er.title = "Título obrigatório";
    if(!draft.column_id) er.status = "Status obrigatório";
    if(!draft.priority) er.priority = "Prioridade obrigatória";
    if(!(draft.responsavel||"").trim()) er.responsavel = "Responsável obrigatório";
    if(!(det.inicio||"").trim()) er.inicio = "Data de início obrigatória";
    if(!(det.prazo_entrega||"").trim()) er.prazo_entrega = "Prazo obrigatório";
    if(!(det.tipo_tarefa||"").trim()) er.tipo_tarefa = "Tipo de tarefa obrigatório";
    if(!(det.link_final||"").trim()) er.link_final = "Link final obrigatório";
    return er;
  };

  const _save = async () => {
    const er = validate();
    setErrors(er);
    if (Object.keys(er).length) {
      window.alert("Preencha os campos obrigatórios:\n• " + Object.values(er).join("\n• "));
      return;
    }
    setSaving(true);
    try { await onSave(draft); onClose(); }
    catch(err){ window.alert("Erro: "+(err.message||err)); }
    finally { setSaving(false); }
  };

  // Helpers UI
  const labelSt = {color:"rgba(255,255,255,0.55)",fontSize:10,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600,marginBottom:4,display:"flex",alignItems:"center",gap:4};
  const reqSt = {color:"#EF4444",fontSize:11};
  const fieldBaseSt = {width:"100%",background:"#0a0a0a",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"7px 10px",color:"#fff",fontSize:12,outline:"none",boxSizing:"border-box"};
  const fieldErrSt = {...fieldBaseSt,borderColor:"#EF4444"};
  const fld = (key) => errors[key] ? fieldErrSt : fieldBaseSt;

  const sectionTitle = (title, emoji) => e.jsx("div",{
    style:{color:"#B8AA9A",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginTop:14,marginBottom:8,paddingBottom:5,borderBottom:"1px solid rgba(184,170,154,0.2)"},
    children: emoji+" "+title
  });
  const lab = (txt, required) => e.jsxs("div",{style:labelSt,children:[txt, required && e.jsx("span",{style:reqSt,children:"*"})]});
  const sel = (opts, val, onCh, errKey, withEmpty) => e.jsxs("select",{
    value:val||"", onChange:ev=>onCh(ev.target.value), style:{...fld(errKey),cursor:"pointer"},
    children:[
      withEmpty && e.jsx("option",{value:"",children:"—"},"_"),
      ...opts.map(o=>e.jsx("option",{value:o,children:o},o))
    ]
  });
  const selMulti = (opts, val, onCh) => {
    const arr = Array.isArray(val) ? val : (val ? [val] : []);
    const toggle = (o) => {
      const has = arr.includes(o);
      onCh(has ? arr.filter(x=>x!==o) : [...arr, o]);
    };
    return e.jsx("div",{
      style:{display:"flex",flexWrap:"wrap",gap:6,padding:"6px 6px",minHeight:36,borderRadius:6,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"},
      children: opts.map(o => {
        const on = arr.includes(o);
        return e.jsx("button",{
          type:"button",
          onClick:()=>toggle(o),
          style:{
            padding:"3px 9px",
            borderRadius:14,
            fontSize:10.5,
            fontWeight:600,
            border: on ? "1px solid #3B82F6" : "1px solid rgba(255,255,255,0.15)",
            background: on ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.03)",
            color: on ? "#60A5FA" : "rgba(255,255,255,0.6)",
            cursor:"pointer",
            transition:"all 120ms"
          },
          children: o
        }, o);
      })
    });
  };

  // Checklist + Comments + Anexos
  const checklist = Array.isArray(det.checklist) ? det.checklist : [];
  const comments = Array.isArray(det.comments) ? det.comments : [];
  const _addChecklistItem = () => {
    const txt = window.prompt("Item do checklist:");
    if(!txt) return;
    updDetail("checklist", [...checklist, {text:txt.trim(), done:false, id:Date.now()}]);
  };
  const _toggleChecklist = (i) => {
    const upd = [...checklist]; upd[i] = {...upd[i], done:!upd[i].done};
    updDetail("checklist", upd);
  };
  const _delChecklist = (i) => updDetail("checklist", checklist.filter((_,j)=>j!==i));
  const _addComment = () => {
    const txt = window.prompt("Comentário:");
    if(!txt) return;
    updDetail("comments", [...comments, {text:txt.trim(), at:new Date().toISOString(), by:"você"}]);
  };
  const _addTag = () => {
    const t = window.prompt("Nova tag:");
    if(!t) return;
    updField("tags", [...(draft.tags||[]), t.trim()]);
  };

  return e.jsx("div",{
    onClick:onClose,
    style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:99999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,overflow:"auto"},
    children: e.jsxs("div",{
      onClick:(ev)=>ev.stopPropagation(),
      style:{background:"#0f1115",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,minWidth:680,maxWidth:880,width:"100%",maxHeight:"92vh",overflow:"auto",display:"flex",flexDirection:"column"},
      children:[
        // Header
        e.jsxs("div",{style:{padding:"14px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",gap:10,position:"sticky",top:0,background:"#0f1115",zIndex:5},children:[
          e.jsx("span",{
            style:{background:_mktPriColor(draft.priority||"media"),color:"#fff",fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:4,textTransform:"uppercase",letterSpacing:0.5},
            children:_mktPriLabel(draft.priority||"media")
          }),
          e.jsx("input",{
            value:draft.title||"",
            onChange:ev=>updField("title",ev.target.value),
            placeholder:"Título do card *",
            style:{flex:1,background:"transparent",border:"none",borderBottom:errors.title?"2px solid #EF4444":"none",color:"#fff",fontSize:18,fontWeight:600,outline:"none",padding:"4px 0"}
          }),
          e.jsx("button",{
            onClick:_save,disabled:saving,
            style:{background:"#22c55e",color:"#000",border:"none",borderRadius:6,padding:"7px 18px",fontSize:11,fontWeight:700,cursor:saving?"default":"pointer",opacity:saving?0.6:1},
            children:saving?"Salvando...":"Salvar"
          }),
          card.id && e.jsx("button",{
            onClick:async()=>{ if(window.confirm("Excluir card '"+draft.title+"'?")){ await onDelete(); onClose(); } },
            style:{background:"transparent",color:"#EF4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:6,padding:"7px 12px",fontSize:11,fontWeight:600,cursor:"pointer"},
            children:"Excluir"
          }),
          e.jsx("button",{
            onClick:onClose,
            style:{background:"transparent",color:"rgba(255,255,255,0.5)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"7px 10px",fontSize:11,cursor:"pointer"},
            children:"✕"
          })
        ]}),

        // Body
        e.jsxs("div",{style:{padding:"14px 24px 24px",display:"flex",flexDirection:"column",gap:0,flex:1},children:[

          // ──── IDENTIFICAÇÃO ────
          sectionTitle("IDENTIFICAÇÃO","📝"),
          e.jsxs("div",{style:{marginBottom:12},children:[
            lab("Briefing / Descrição", false),
            e.jsx("textarea",{
              rows:5, value:draft.description||"",
              onChange:ev=>updField("description",ev.target.value),
              placeholder:"Descrição/briefing do card...",
              style:{...fieldBaseSt,resize:"vertical",lineHeight:1.5,fontFamily:"inherit"}
            })
          ]}),

          // ──── CONTROLE ────
          sectionTitle("CONTROLE","🎯"),
          e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12},children:[
            e.jsxs("div",{children:[ lab("Status",true), e.jsxs("select",{value:draft.column_id||"",onChange:ev=>updField("column_id",ev.target.value),style:{...fld("status"),cursor:"pointer"},children:[
              e.jsx("option",{value:"",children:"—"},"_"),
              ...cols.map(c=>e.jsx("option",{value:c.slug,children:c.title},c.slug))
            ]}) ]}),
            e.jsxs("div",{children:[ lab("Prioridade",true), e.jsxs("select",{value:draft.priority||"",onChange:ev=>updField("priority",ev.target.value),style:{...fld("priority"),cursor:"pointer"},children:[
              e.jsx("option",{value:"",children:"—"},"_"),
              ..._MKT_PRIORITIES.map(p=>e.jsx("option",{value:p.id,children:p.icon+" "+p.label},p.id))
            ]}) ]}),
            e.jsxs("div",{children:[ lab("Responsável",true), e.jsx("input",{value:draft.responsavel||"",onChange:ev=>updField("responsavel",ev.target.value),placeholder:"Nome do responsável",style:fld("responsavel")}) ]}),
            e.jsxs("div",{children:[ lab("Aprovador",false), e.jsx("input",{value:det.aprovador||"",onChange:ev=>updDetail("aprovador",ev.target.value),placeholder:"Quem aprova",style:fieldBaseSt}) ]})
          ]}),

          // ──── DATAS ────
          sectionTitle("DATAS","📅"),
          e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12},children:[
            e.jsxs("div",{children:[ lab("Início",true), e.jsx("input",{type:"date",value:det.inicio||"",onChange:ev=>updDetail("inicio",ev.target.value),style:fld("inicio")}) ]}),
            e.jsxs("div",{children:[ lab("Prazo de entrega",true), e.jsx("input",{type:"date",value:det.prazo_entrega||"",onChange:ev=>updDetail("prazo_entrega",ev.target.value),style:fld("prazo_entrega")}) ]}),
            e.jsxs("div",{children:[ lab("Data de publicação",false), e.jsx("input",{type:"datetime-local",value:det.data_publicacao||"",onChange:ev=>updDetail("data_publicacao",ev.target.value),style:fieldBaseSt}) ]})
          ]}),

          // ──── CLASSIFICAÇÃO ────
          sectionTitle("CLASSIFICAÇÃO","🏷️"),
          e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12},children:[
            e.jsxs("div",{children:[ lab("Tipo de tarefa",true), sel(_MKT_TIPOS_TAREFA, det.tipo_tarefa, v=>updDetail("tipo_tarefa",v), "tipo_tarefa", true) ]}),
            e.jsxs("div",{children:[ lab("Tipo de conteúdo",false), sel(_MKT_TIPOS_CONTEUDO, det.tipo_conteudo, v=>updDetail("tipo_conteudo",v), null, true) ]}),
            e.jsxs("div",{style:{gridColumn:"1 / -1"},children:[ lab("Canal",false), selMulti(_MKT_CANAIS, det.canal, v=>updDetail("canal",v)) ]}),
            e.jsxs("div",{style:{gridColumn:"1 / -1"},children:[ lab("Formato",false), selMulti(_MKT_FORMATOS, det.formato, v=>updDetail("formato",v)) ]}),
            e.jsxs("div",{style:{gridColumn:"1 / -1"},children:[ lab("Campanha / Sprint",false), e.jsx("input",{value:det.campanha||"",onChange:ev=>updDetail("campanha",ev.target.value),placeholder:"Ex: Black Friday 2025 / Sprint 12",style:fieldBaseSt}) ]})
          ]}),

          // Tags (extra)
          e.jsxs("div",{style:{marginBottom:12},children:[
            e.jsxs("div",{style:{...labelSt,justifyContent:"space-between"},children:[
              e.jsx("span",{children:"TAGS"}),
              e.jsx("button",{onClick:_addTag,style:{background:"none",border:"none",color:"#22c55e",cursor:"pointer",fontSize:14,padding:0},children:"+"})
            ]}),
            (draft.tags||[]).length===0 ? e.jsx("div",{style:{color:"rgba(255,255,255,0.3)",fontSize:11},children:"(sem tags)"}) :
            e.jsx("div",{style:{display:"flex",flexWrap:"wrap",gap:4},children:
              (draft.tags||[]).map((t,i)=>e.jsxs("span",{
                style:{background:"rgba(184,170,154,0.18)",color:"#B8AA9A",fontSize:11,padding:"3px 8px",borderRadius:4,display:"inline-flex",alignItems:"center",gap:4},
                children:[t, e.jsx("button",{onClick:()=>updField("tags",(draft.tags||[]).filter((_,j)=>j!==i)),style:{background:"none",border:"none",color:"#B8AA9A",cursor:"pointer",padding:0,fontSize:13},children:"×"})]
              },i))
            })
          ]}),

          // ──── CONTEÚDO ────
          sectionTitle("CONTEÚDO","✍️"),
          e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:12,marginBottom:12},children:[
            e.jsxs("div",{children:[ lab("Copy do post",false), e.jsx("textarea",{rows:3,value:det.copy||"",onChange:ev=>updDetail("copy",ev.target.value),placeholder:"Texto que vai no post...",style:{...fieldBaseSt,resize:"vertical",fontFamily:"inherit",lineHeight:1.5}}) ]}),
            e.jsxs("div",{children:[ lab("Legenda / Caption",false), e.jsx("textarea",{rows:3,value:det.legenda||"",onChange:ev=>updDetail("legenda",ev.target.value),placeholder:"Legenda do post...",style:{...fieldBaseSt,resize:"vertical",fontFamily:"inherit",lineHeight:1.5}}) ]}),
            e.jsxs("div",{children:[ lab("Roteiro / Script",false), e.jsx("textarea",{rows:4,value:det.roteiro||"",onChange:ev=>updDetail("roteiro",ev.target.value),placeholder:"Roteiro do vídeo/conteúdo...",style:{...fieldBaseSt,resize:"vertical",fontFamily:"inherit",lineHeight:1.5}}) ]})
          ]}),

          // ──── ARQUIVOS ────
          sectionTitle("ARQUIVOS","📁"),
          e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:10,marginBottom:14},children:[
            e.jsxs("div",{children:[ lab("Link Drive (assets)",false), e.jsx("input",{type:"url",value:det.link_assets||"",onChange:ev=>updDetail("link_assets",ev.target.value),placeholder:"https://drive.google.com/...",style:fieldBaseSt}) ]}),
            e.jsxs("div",{children:[ lab("Link Drive (final)",true), e.jsx("input",{type:"url",value:det.link_final||"",onChange:ev=>updDetail("link_final",ev.target.value),placeholder:"https://drive.google.com/... (versão aprovada)",style:fld("link_final")}) ]}),
            e.jsxs("div",{children:[ lab("Link de publicação",false), e.jsx("input",{type:"url",value:det.link_publicacao||"",onChange:ev=>updDetail("link_publicacao",ev.target.value),placeholder:"https://instagram.com/... (após publicar)",style:fieldBaseSt}) ]})
          ]}),

          // ──── CHECKLIST + COMENTÁRIOS ────
          card.id && e.jsxs(b.Fragment,{children:[
            sectionTitle("CHECKLIST","☑"),
            e.jsxs("div",{style:{marginBottom:12},children:[
              e.jsx("button",{onClick:_addChecklistItem,style:{background:"rgba(34,197,94,0.12)",border:"1px solid rgba(34,197,94,0.4)",color:"#22c55e",borderRadius:6,padding:"5px 12px",fontSize:10,fontWeight:600,cursor:"pointer",marginBottom:8},children:"+ Adicionar item"}),
              checklist.length===0 ? e.jsx("div",{style:{color:"rgba(255,255,255,0.3)",fontSize:11},children:"(sem itens)"}) :
              e.jsx("div",{style:{display:"flex",flexDirection:"column",gap:5},children:
                checklist.map((c,i)=>e.jsxs("div",{
                  style:{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"rgba(255,255,255,0.02)",borderRadius:6,border:"1px solid rgba(255,255,255,0.05)"},
                  children:[
                    e.jsx("input",{type:"checkbox",checked:c.done,onChange:()=>_toggleChecklist(i),style:{cursor:"pointer"}}),
                    e.jsx("span",{style:{flex:1,color:c.done?"rgba(255,255,255,0.4)":"#fff",fontSize:12,textDecoration:c.done?"line-through":"none"},children:c.text}),
                    e.jsx("button",{onClick:()=>_delChecklist(i),style:{background:"none",border:"none",color:"rgba(239,68,68,0.5)",cursor:"pointer",fontSize:14},children:"×"})
                  ]
                },c.id||i))
              })
            ]}),

            sectionTitle("COMENTÁRIOS","💬"),
            e.jsxs("div",{style:{marginBottom:8},children:[
              e.jsx("button",{onClick:_addComment,style:{background:"rgba(34,197,94,0.12)",border:"1px solid rgba(34,197,94,0.4)",color:"#22c55e",borderRadius:6,padding:"5px 12px",fontSize:10,fontWeight:600,cursor:"pointer",marginBottom:8},children:"+ Comentário"}),
              comments.length===0 ? e.jsx("div",{style:{color:"rgba(255,255,255,0.3)",fontSize:11},children:"(sem comentários)"}) :
              e.jsx("div",{style:{display:"flex",flexDirection:"column",gap:6},children:
                comments.map((c,i)=>e.jsxs("div",{
                  style:{padding:10,background:"rgba(255,255,255,0.02)",borderRadius:6,border:"1px solid rgba(255,255,255,0.05)"},
                  children:[
                    e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:4},children:[
                      e.jsx("span",{style:{color:"#22c55e",fontSize:10,fontWeight:600},children:c.by||"Usuário"}),
                      e.jsx("span",{style:{color:"rgba(255,255,255,0.3)",fontSize:9},children: new Date(c.at).toLocaleString("pt-BR")})
                    ]}),
                    e.jsx("div",{style:{color:"rgba(255,255,255,0.85)",fontSize:11,lineHeight:1.5,whiteSpace:"pre-wrap"},children:c.text})
                  ]
                },i))
              })
            ]})
          ]})
        ]})
      ]
    })
  });
}

// Kanban completo Marketing
function MarketingKanbanPro(){
  const [cols, setCols] = b.useState([]);
  const [cards, setCards] = b.useState([]);
  const [loading, setLoading] = b.useState(true);
  const [openCard, setOpenCard] = b.useState(null);
  const [search, setSearch] = b.useState("");

  const refetch = b.useCallback(async()=>{
    setLoading(true);
    const [{data:c}, {data:r}] = await Promise.all([
      u.from("kanban_columns").select("*").eq("dept_id","marketing").order("position"),
      u.from("kanban_cards").select("*").eq("dept_id","marketing").order("created_at",{ascending:false})
    ]);
    setCols(c||[]);
    setCards(r||[]);
    setLoading(false);
  },[]);

  b.useEffect(()=>{ refetch(); },[refetch]);

  const onSaveCard = async (draft) => {
    const upd = {
      title: draft.title,
      description: draft.description||null,
      column_id: draft.column_id,
      priority: draft.priority||"media",
      tags: draft.tags||[],
      responsavel: draft.responsavel||null,
      details: draft.details||{}
    };
    if (draft.id) {
      await u.from("kanban_cards").update(upd).eq("id",draft.id);
    } else {
      await u.from("kanban_cards").insert({...upd, dept_id:"marketing"});
    }
    await refetch();
  };
  const onDeleteCard = async () => {
    if (openCard && openCard.id) {
      await u.from("kanban_cards").delete().eq("id",openCard.id);
    }
    await refetch();
  };
  const newCardInColumn = (col_slug) => {
    setOpenCard({title:"",description:"",column_id:col_slug||(cols[0]&&cols[0].slug)||"backlog",priority:"media",tags:[],responsavel:"",details:{},dept_id:"marketing"});
  };

  if (loading) return e.jsx("div",{style:{padding:40,color:"rgba(255,255,255,0.4)",textAlign:"center"},children:"Carregando..."});

  const filteredCards = search.trim()
    ? cards.filter(c=>(c.title||"").toLowerCase().includes(search.toLowerCase()) || (c.description||"").toLowerCase().includes(search.toLowerCase()))
    : cards;

  return e.jsxs("div",{children:[
    // Header
    e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10},children:[
      e.jsxs("div",{children:[
        e.jsx("h2",{style:{color:"#fff",fontSize:16,fontWeight:600,margin:0},children:"Kanban Marketing"}),
        e.jsxs("p",{style:{color:"rgba(255,255,255,0.5)",fontSize:11,margin:"4px 0 0"},children:[cards.length," cards · ",cols.length," colunas"]})
      ]}),
      e.jsxs("div",{style:{display:"flex",gap:8,alignItems:"center"},children:[
        e.jsx("input",{
          value:search,onChange:ev=>setSearch(ev.target.value),
          placeholder:"🔍 buscar...",
          style:{background:"#1a1a1a",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"7px 12px",color:"#fff",fontSize:11,outline:"none",width:200}
        }),
        e.jsx("button",{
          onClick:()=>newCardInColumn(""),
          style:{background:"#22c55e",color:"#000",border:"none",borderRadius:6,padding:"7px 16px",fontSize:11,fontWeight:700,cursor:"pointer"},
          children:"+ Novo card"
        })
      ]})
    ]}),
    // Kanban board
    e.jsx("div",{style:{display:"flex",gap:10,overflowX:"auto",paddingBottom:12,scrollbarColor:"#444 transparent"},children:
      cols.map(col=>{
        const colCards = filteredCards.filter(c=>c.column_id===col.slug);
        return e.jsxs("div",{
          style:{flex:"0 0 280px",background:"#0d1117",borderRadius:10,padding:10,border:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",gap:8,maxHeight:"75vh"},
          children:[
            e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"},children:[
              e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:6},children:[
                e.jsx("span",{style:{width:8,height:8,borderRadius:4,background:col.color,display:"inline-block"}}),
                e.jsx("span",{style:{color:"#fff",fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:0.3},children:col.title}),
                e.jsx("span",{style:{color:"rgba(255,255,255,0.4)",fontSize:10,marginLeft:2},children:colCards.length})
              ]}),
              e.jsx("button",{
                onClick:()=>newCardInColumn(col.slug),
                title:"Novo card nesta coluna",
                style:{background:"none",border:"none",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:14,lineHeight:1,padding:"2px 6px"},
                children:"+"
              })
            ]}),
            e.jsx("div",{style:{display:"flex",flexDirection:"column",gap:6,overflowY:"auto",flex:1},children:
              colCards.map(card=>e.jsx(MarketingCardCompact,{key:card.id,card,onOpen:()=>setOpenCard(card)}))
            })
          ]
        },col.id);
      })
    }),
    openCard && e.jsx(MarketingCardModal,{
      card:openCard, cols, onClose:()=>setOpenCard(null), onSave:onSaveCard, onDelete:onDeleteCard
    })
  ]});
}

if(typeof window!=="undefined"){window._MarketingKanbanPro=MarketingKanbanPro;}
function Be(){
  const s=b.useRef(null);
  const [fSearch, sFSearch] = g.useState("");
  const h=[{label:"Novo Post",icon:L,color:f,onClick:()=>{var n;(n=s.current)==null||n.call(s,"calendario"),setTimeout(()=>document.dispatchEvent(new CustomEvent("open-novo-conteudo")),80)}},{label:"Analytics",icon:M,color:A,onClick:()=>{var n;return(n=s.current)==null?void 0:n.call(s,"analytics")}},{label:"Campanha",icon:O,color:k,onClick:()=>{var n;return(n=s.current)==null?void 0:n.call(s,"analytics")}},{label:"Cases",icon:B,color:z,badge:"1",onClick:()=>{var n;return(n=s.current)==null?void 0:n.call(s,"calendario")}}];
  const headerExtra = e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"6px 12px",minWidth:220,marginLeft:"auto"},children:[
    e.jsx("span",{style:{fontSize:13,color:"rgba(255,255,255,0.5)",flexShrink:0,lineHeight:1},children:"🔍"}),
    e.jsx("input",{type:"text",value:fSearch,onChange:ev=>sFSearch(ev.target.value),placeholder:"Buscar card...",style:{flex:1,fontSize:"0.65rem",background:"none",border:"none",outline:"none",color:"white",minWidth:120}}),
    fSearch && e.jsx("button",{onClick:()=>sFSearch(""),style:{background:"none",border:"none",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:13,padding:0,lineHeight:1},title:"Limpar",children:"×"})
  ]});
  const cardFilter = fSearch ? (card) => {
    const q = fSearch.toLowerCase();
    const det = card.details || {};
    if ((card.title||"").toLowerCase().includes(q)) return true;
    if ((det.tipo_tarefa||"").toLowerCase().includes(q)) return true;
    if ((det.tipo_conteudo||"").toLowerCase().includes(q)) return true;
    const canalArr = Array.isArray(det.canal) ? det.canal : (det.canal?[det.canal]:[]);
    if (canalArr.some(c => (c||"").toLowerCase().includes(q))) return true;
    const fmtArr = Array.isArray(det.formato) ? det.formato : (det.formato?[det.formato]:[]);
    if (fmtArr.some(c => (c||"").toLowerCase().includes(q))) return true;
    if ((det.campanha||"").toLowerCase().includes(q)) return true;
    return false;
  } : undefined;
  return e.jsx(Y,{deptId:"marketing",extraTabs:pe,team:ue,quickActions:h,activity:he,tabSwitcherRef:s,kanbanHeaderExtra:headerExtra,cardFilter})
}
export{Be as DeptMarketingPage};
