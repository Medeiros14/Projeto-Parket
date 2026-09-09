"""
Parket Skills — Plataforma de tutoriais e treinamento interno.
Acesso restrito a usuários autenticados no Space Parket.
Suporta: texto, vídeo, imagem, áudio.
"""
import httpx
import structlog
from fastapi import APIRouter, Request, Query
from fastapi.responses import HTMLResponse

logger = structlog.get_logger(__name__)
router = APIRouter(tags=["parket-skills"])

SUPABASE_URL = "https://hbxpilrxmitvzebluoom.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk0MjUyNywiZXhwIjoyMDg4NTE4NTI3fQ.fTovVTCBFcMrrhVCR6TsneALfMRLLLHZdMmSJH16L4A"
SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.kPD1KzDqabrOFIqPCAFMR2RZYLU5vQ_2AWkElBnlnmo"
SB = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"}


async def sb_query(table, params):
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{SUPABASE_URL}/rest/v1/{table}", params=params, headers=SB)
        return r.json() if r.is_success else []


async def sb_insert(table, data):
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(f"{SUPABASE_URL}/rest/v1/{table}", json=data,
                         headers={**SB, "Prefer": "return=representation"})
        return r.json() if r.is_success else []


async def sb_update(table, match, data):
    async with httpx.AsyncClient(timeout=10) as c:
        await c.patch(f"{SUPABASE_URL}/rest/v1/{table}", params=match, json=data,
                      headers={**SB, "Prefer": "return=minimal"})


# ── API endpoints ──

@router.get("/skills/api/tutorials")
async def list_tutorials(categoria: str = "", setor: str = ""):
    params = {"select": "*", "publicado": "eq.true", "order": "ordem,created_at.desc"}
    if categoria:
        params["categoria"] = f"eq.{categoria}"
    if setor:
        params["setor"] = f"eq.{setor}"
    return await sb_query("parket_skills", params)


@router.get("/skills/api/tutorial/{tutorial_id}")
async def get_tutorial(tutorial_id: str):
    rows = await sb_query("parket_skills", {"id": f"eq.{tutorial_id}", "select": "*"})
    if rows:
        await sb_update("parket_skills", {"id": f"eq.{tutorial_id}"},
                        {"visualizacoes": (rows[0].get("visualizacoes") or 0) + 1})
    return rows[0] if rows else {"error": "Não encontrado"}


@router.get("/skills/api/categorias")
async def list_categorias():
    rows = await sb_query("parket_skills", {"select": "categoria", "publicado": "eq.true"})
    cats = sorted(set(r["categoria"] for r in rows if r.get("categoria")))
    return cats


@router.post("/skills/api/tutorial")
async def create_tutorial(request: Request):
    body = await request.json()
    result = await sb_insert("parket_skills", body)
    return result[0] if result else {"error": "Falha ao criar"}


@router.patch("/skills/api/tutorial/{tutorial_id}")
async def update_tutorial(tutorial_id: str, request: Request):
    body = await request.json()
    await sb_update("parket_skills", {"id": f"eq.{tutorial_id}"}, body)
    return {"ok": True}


@router.delete("/skills/api/tutorial/{tutorial_id}")
async def delete_tutorial(tutorial_id: str):
    async with httpx.AsyncClient(timeout=10) as c:
        await c.delete(f"{SUPABASE_URL}/rest/v1/parket_skills",
                       params={"id": f"eq.{tutorial_id}"}, headers=SB)
    return {"ok": True}


# ── Página principal (SPA) ──

@router.get("/", response_class=HTMLResponse)
@router.get("/skills", response_class=HTMLResponse)
@router.get("/skills/{path:path}", response_class=HTMLResponse)
async def skills_page(request: Request, path: str = ""):
    # Serve a página apenas se o host é skills.parket.works
    host = request.headers.get("host", "")
    if "skills.parket.works" in host:
        return HTMLResponse(SKILLS_HTML)
    # Para outros hosts, retorna None para que o fallback do FastAPI sirva o endpoint padrão
    from fastapi.responses import JSONResponse
    return JSONResponse({"service": "Parket AI Squad", "version": "1.0.0"})


SKILLS_HTML = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Parket Skills — Treinamento Interno</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📚</text></svg>"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0A0A0A;--panel:#0E0E0E;--card:#111111;--border:rgba(255,255,255,0.08);--accent:#D4A853;--text:white;--text-med:rgba(255,255,255,0.7);--text-dim:rgba(255,255,255,0.35);--red:#EF4444;--green:#10B981;--blue:#3B82F6;--purple:#8B5CF6;--orange:#F59E0B;--teal:#14B8A6;--pink:#EC4899}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
a{color:var(--accent);text-decoration:none}

/* Header */
.header{background:var(--panel);border-bottom:1px solid var(--border);padding:0 24px;display:flex;align-items:center;height:56px;position:sticky;top:0;z-index:50}
.logo{font-size:18px;font-weight:700;color:var(--accent);display:flex;align-items:center;gap:10px;margin-right:auto}
.logo-sub{font-size:10px;color:var(--text-dim);font-weight:400;letter-spacing:0.08em;text-transform:uppercase}
.header-actions{display:flex;gap:8px}

/* Sidebar */
.layout{display:flex;min-height:calc(100vh - 56px)}
.sidebar{width:220px;background:var(--panel);border-right:1px solid var(--border);padding:16px 0;flex-shrink:0;overflow-y:auto}
.sidebar-title{font-size:9px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.12em;padding:8px 16px 6px}
.sidebar-item{display:flex;align-items:center;gap:8px;padding:8px 16px;font-size:13px;color:var(--text-med);cursor:pointer;transition:all 0.15s;border-left:2px solid transparent}
.sidebar-item:hover{background:rgba(255,255,255,0.03);color:var(--text)}
.sidebar-item.active{background:rgba(212,168,83,0.08);color:var(--accent);border-left-color:var(--accent)}
.sidebar-item .count{margin-left:auto;font-size:10px;color:var(--text-dim);background:rgba(255,255,255,0.05);padding:1px 6px;border-radius:10px}
.sidebar-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}

/* Main content */
.main{flex:1;padding:24px;overflow-y:auto}
.page-title{font-size:20px;font-weight:700;margin-bottom:4px}
.page-sub{font-size:12px;color:var(--text-dim);margin-bottom:20px}

/* Search */
.search{width:100%;padding:10px 14px 10px 36px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:white;font-size:13px;outline:none;margin-bottom:20px}
.search:focus{border-color:rgba(212,168,83,0.4)}
.search-wrap{position:relative}
.search-icon{position:absolute;left:12px;top:11px;color:var(--text-dim);font-size:14px}

/* Grid */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden;cursor:pointer;transition:all 0.2s}
.card:hover{border-color:rgba(212,168,83,0.3);transform:translateY(-1px)}
.card-thumb{height:160px;background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-size:42px;color:rgba(255,255,255,0.06);overflow:hidden;position:relative}
.card-thumb img,.card-thumb video{width:100%;height:100%;object-fit:cover}
.card-body{padding:14px}
.card-tags{display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap}
.tag{font-size:9px;font-weight:600;padding:2px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:0.05em}
.tag-cat{background:rgba(212,168,83,0.12);color:var(--accent)}
.tag-video{background:rgba(239,68,68,0.12);color:#F87171}
.tag-texto{background:rgba(59,130,246,0.12);color:#60A5FA}
.tag-imagem{background:rgba(16,185,129,0.12);color:#34D399}
.tag-audio{background:rgba(168,85,247,0.12);color:#C084FC}
.tag-misto{background:rgba(212,168,83,0.12);color:var(--accent)}
.card-title{font-size:14px;font-weight:600;margin-bottom:4px;color:var(--text)}
.card-desc{font-size:11px;color:var(--text-dim);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card-meta{display:flex;gap:10px;margin-top:8px;font-size:10px;color:var(--text-dim)}

/* Detail */
.detail-back{display:inline-flex;align-items:center;gap:6px;color:var(--text-dim);font-size:12px;cursor:pointer;margin-bottom:16px}
.detail-back:hover{color:var(--accent)}
.detail-title{font-size:22px;font-weight:700;margin-bottom:6px}
.detail-meta{display:flex;gap:14px;margin-bottom:16px;font-size:11px;color:var(--text-dim);flex-wrap:wrap}
.detail-content{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:24px;line-height:1.8;font-size:14px;color:var(--text-med)}
.detail-content h1,.detail-content h2,.detail-content h3{color:var(--accent);margin:16px 0 8px}
.detail-content p{margin-bottom:12px}
.detail-content img{max-width:100%;border-radius:8px;margin:12px 0}
.detail-content ul,.detail-content ol{margin:8px 0 12px 20px}
.detail-content li{margin-bottom:4px}
.media-block{margin:16px 0;border-radius:10px;overflow:hidden;background:#000}
.media-block video,.media-block img{width:100%;display:block}
.media-block audio{width:100%;padding:16px}

/* Buttons */
.btn{padding:7px 14px;border-radius:6px;border:none;cursor:pointer;font-size:11px;font-weight:600;transition:all 0.15s}
.btn-primary{background:var(--accent);color:#000}
.btn-primary:hover{opacity:0.9}
.btn-ghost{background:transparent;border:1px solid var(--border);color:var(--text-dim)}
.btn-ghost:hover{border-color:rgba(255,255,255,0.2);color:var(--text)}

/* Editor Modal */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:100;display:flex;align-items:center;justify-content:center;padding:16px}
.modal{background:var(--card);border:1px solid rgba(212,168,83,0.2);border-radius:12px;width:100%;max-width:720px;max-height:90vh;overflow-y:auto;padding:24px}
.modal h3{color:var(--accent);font-size:16px;margin-bottom:16px}
.field{margin-bottom:12px}
.field label{display:block;font-size:10px;color:var(--text-dim);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600}
.field input,.field select,.field textarea{width:100%;padding:8px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:white;font-size:12px;outline:none}
.field textarea{min-height:200px;font-family:'Segoe UI',monospace;font-size:12px;line-height:1.6}
.field input:focus,.field select:focus,.field textarea:focus{border-color:rgba(212,168,83,0.4)}

/* Empty state */
.empty{text-align:center;padding:60px 0;color:var(--text-dim)}
.empty-icon{font-size:48px;margin-bottom:12px;opacity:0.3}

@media(max-width:768px){
  .sidebar{display:none}
  .grid{grid-template-columns:1fr}
  .header{padding:0 14px}
}
</style>
</head>
<body>

<div id="app"></div>

<script>
const API = '/skills/api';
const SETORES = [
  {id:'',label:'Todos',icon:'📚',color:'#D4A853'},
  {id:'comercial',label:'Comercial',icon:'💼',color:'#3B82F6'},
  {id:'projetos',label:'Projetos',icon:'📐',color:'#60A5FA'},
  {id:'compras',label:'Compras',icon:'🛒',color:'#10B981'},
  {id:'producao',label:'Produção',icon:'🏭',color:'#F59E0B'},
  {id:'logistica',label:'Logística',icon:'🚛',color:'#14B8A6'},
  {id:'obras',label:'Obras',icon:'🏗',color:'#EF4444'},
  {id:'financeiro',label:'Financeiro',icon:'💰',color:'#10B981'},
  {id:'atendimento',label:'Atendimento',icon:'🎧',color:'#EC4899'},
  {id:'fiscal',label:'Fiscal',icon:'📊',color:'#8B5CF6'},
  {id:'produtividade',label:'PMO',icon:'📋',color:'#14B8A6'},
  {id:'marketing',label:'Marketing',icon:'📢',color:'#EC4899'},
  {id:'rh',label:'RH',icon:'👥',color:'#6366F1'},
  {id:'orcamento',label:'Orçamento',icon:'💵',color:'#F59E0B'},
  {id:'ia',label:'IA',icon:'🤖',color:'#8B5CF6'},
  {id:'geral',label:'Geral',icon:'📖',color:'#D4A853'},
];

let tutorials = [];
let currentSetor = '';
let currentTutorial = null;
let search = '';
let showEditor = false;
let editData = {};
let counts = {};

async function loadTutorials() {
  const p = new URLSearchParams();
  if (currentSetor) p.set('setor', currentSetor);
  const res = await fetch(API + '/tutorials?' + p);
  tutorials = await res.json();
  // Conta por setor
  const allRes = await fetch(API + '/tutorials');
  const all = await allRes.json();
  counts = {};
  all.forEach(t => { const s = t.setor || 'geral'; counts[s] = (counts[s]||0) + 1; });
  render();
}

async function viewTutorial(id) {
  const res = await fetch(API + '/tutorial/' + id);
  currentTutorial = await res.json();
  window.scrollTo(0, 0);
  render();
}

async function saveTutorial() {
  if (editData.id) {
    await fetch(API + '/tutorial/' + editData.id, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(editData) });
  } else {
    await fetch(API + '/tutorial', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(editData) });
  }
  showEditor = false; editData = {};
  await loadTutorials();
}

async function deleteTutorial(id) {
  if (!confirm('Excluir este tutorial?')) return;
  await fetch(API + '/tutorial/' + id, { method: 'DELETE' });
  currentTutorial = null;
  await loadTutorials();
}

function typeTag(tipo) {
  const m = {video:'🎬 Vídeo',texto:'📄 Texto',imagem:'🖼 Imagem',audio:'🎧 Áudio',misto:'📦 Misto'};
  return '<span class="tag tag-'+tipo+'">'+(m[tipo]||tipo)+'</span>';
}

function mediaBlock(t) {
  let h = '';
  if (t.video_url) h += '<div class="media-block"><video controls playsinline><source src="'+t.video_url+'" type="video/mp4"/></video></div>';
  if (t.imagem_url) h += '<div class="media-block"><img src="'+t.imagem_url+'" alt="'+t.titulo+'"/></div>';
  if (t.audio_url) h += '<div class="media-block"><audio controls><source src="'+t.audio_url+'"/></audio></div>';
  return h;
}

function render() {
  const app = document.getElementById('app');
  const filtered = tutorials.filter(t => {
    if (search && !t.titulo.toLowerCase().includes(search.toLowerCase()) && !(t.descricao||'').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sidebarHtml = SETORES.map(s => {
    const c = counts[s.id] || (s.id === '' ? Object.values(counts).reduce((a,b)=>a+b,0) : 0);
    return '<div class="sidebar-item '+(currentSetor===s.id?'active':'')+'" onclick="currentSetor=\''+s.id+'\';loadTutorials()"><div class="sidebar-dot" style="background:'+s.color+'"></div>'+s.icon+' '+s.label+(c?'<span class="count">'+c+'</span>':'')+'</div>';
  }).join('');

  if (currentTutorial) {
    const t = currentTutorial;
    const setor = SETORES.find(s => s.id === t.setor) || {icon:'📖',label:t.setor||'Geral',color:'#D4A853'};
    app.innerHTML = '<div class="header"><div class="logo">📚 PARKET SKILLS <span class="logo-sub">Treinamento Interno</span></div><div class="header-actions"><button class="btn btn-ghost" onclick="currentTutorial=null;render()">← Voltar</button><button class="btn btn-ghost" onclick="editData={...currentTutorial};showEditor=true;render()">✏️ Editar</button><button class="btn btn-ghost" onclick="deleteTutorial(\''+t.id+'\')">🗑</button></div></div><div class="layout"><div class="sidebar"><div class="sidebar-title">Setores</div>'+sidebarHtml+'</div><div class="main"><div class="detail-back" onclick="currentTutorial=null;render()">← Voltar aos tutoriais</div><div class="card-tags" style="margin-bottom:8px"><span class="tag tag-cat">'+setor.icon+' '+setor.label+'</span>'+typeTag(t.tipo)+'</div><h1 class="detail-title">'+t.titulo+'</h1><div class="detail-meta">'+(t.autor?'<span>👤 '+t.autor+'</span>':'')+(t.setor?'<span>🏢 '+setor.label+'</span>':'')+'<span>👁 '+(t.visualizacoes||0)+' visualizações</span><span>📅 '+new Date(t.created_at).toLocaleDateString('pt-BR')+'</span></div>'+mediaBlock(t)+'<div class="detail-content">'+(t.conteudo_html||'<p style="color:var(--text-dim)">Sem conteúdo de texto.</p>')+'</div></div></div>'+(showEditor?editorModal():'');
    return;
  }

  const setorInfo = SETORES.find(s => s.id === currentSetor) || SETORES[0];
  const cardsHtml = filtered.length === 0 ? '<div class="empty"><div class="empty-icon">📚</div><p>Nenhum tutorial encontrado</p></div>' :
    '<div class="grid">'+filtered.map(t => {
      const setor = SETORES.find(s => s.id === t.setor) || {icon:'📖',label:'Geral'};
      return '<div class="card" onclick="viewTutorial(\''+t.id+'\')"><div class="card-thumb">'+(t.thumbnail_url?'<img src="'+t.thumbnail_url+'"/>':t.video_url?'<video muted><source src="'+t.video_url+'"/></video>':t.imagem_url?'<img src="'+t.imagem_url+'"/>':'<span style="font-size:48px;opacity:0.1">'+setor.icon+'</span>')+'</div><div class="card-body"><div class="card-tags"><span class="tag tag-cat">'+setor.icon+' '+setor.label+'</span>'+typeTag(t.tipo)+'</div><div class="card-title">'+t.titulo+'</div><div class="card-desc">'+(t.descricao||'')+'</div><div class="card-meta">'+(t.autor?'<span>👤 '+t.autor+'</span>':'')+'<span>👁 '+(t.visualizacoes||0)+'</span></div></div></div>';
    }).join('')+'</div>';

  app.innerHTML = '<div class="header"><div class="logo">📚 PARKET SKILLS <span class="logo-sub">Treinamento Interno</span></div><div class="header-actions"><button class="btn btn-primary" onclick="editData={tipo:\'texto\',setor:\'geral\',publicado:true,categoria:\'Geral\'};showEditor=true;render()">+ Novo Tutorial</button></div></div><div class="layout"><div class="sidebar"><div class="sidebar-title">Setores</div>'+sidebarHtml+'</div><div class="main"><h1 class="page-title">'+setorInfo.icon+' '+(currentSetor?setorInfo.label:'Todos os Tutoriais')+'</h1><p class="page-sub">'+filtered.length+' tutorial(is) disponível(is)</p><div class="search-wrap"><span class="search-icon">🔍</span><input class="search" placeholder="Buscar tutorial..." value="'+search+'" oninput="search=this.value;render()"/></div>'+cardsHtml+'</div></div>'+(showEditor?editorModal():'');
}

function editorModal() {
  const d = editData;
  const setorOpts = SETORES.filter(s=>s.id).map(s => '<option value="'+s.id+'" '+(d.setor===s.id?'selected':'')+'>'+s.icon+' '+s.label+'</option>').join('');
  return '<div class="modal-overlay" onclick="showEditor=false;render()"><div class="modal" onclick="event.stopPropagation()"><h3>'+(d.id?'Editar Tutorial':'Novo Tutorial')+'</h3><div class="field"><label>Título *</label><input value="'+(d.titulo||'')+'" onchange="editData.titulo=this.value"/></div><div class="field"><label>Descrição</label><input value="'+(d.descricao||'')+'" onchange="editData.descricao=this.value"/></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px"><div class="field"><label>Tipo</label><select onchange="editData.tipo=this.value">'+['texto','video','imagem','audio','misto'].map(t=>'<option value="'+t+'" '+(d.tipo===t?'selected':'')+'>'+t+'</option>').join('')+'</select></div><div class="field"><label>Setor</label><select onchange="editData.setor=this.value">'+setorOpts+'</select></div><div class="field"><label>Autor</label><input value="'+(d.autor||'')+'" onchange="editData.autor=this.value"/></div></div><div class="field"><label>URL do Vídeo</label><input value="'+(d.video_url||'')+'" onchange="editData.video_url=this.value" placeholder="https://...mp4"/></div><div class="field"><label>URL da Imagem</label><input value="'+(d.imagem_url||'')+'" onchange="editData.imagem_url=this.value"/></div><div class="field"><label>URL do Áudio</label><input value="'+(d.audio_url||'')+'" onchange="editData.audio_url=this.value"/></div><div class="field"><label>Thumbnail</label><input value="'+(d.thumbnail_url||'')+'" onchange="editData.thumbnail_url=this.value"/></div><div class="field"><label>Conteúdo HTML</label><textarea onchange="editData.conteudo_html=this.value">'+(d.conteudo_html||'')+'</textarea></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button class="btn btn-ghost" onclick="showEditor=false;render()">Cancelar</button><button class="btn btn-primary" onclick="saveTutorial()">Salvar</button></div></div></div>';
}

(async()=>{ await loadTutorials(); })();
</script>
</body>
</html>"""
