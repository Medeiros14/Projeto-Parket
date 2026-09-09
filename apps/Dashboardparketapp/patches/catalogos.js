// Catálogos overlay — intercepta o modal "Novo Produto" e oferece 4 modos de cadastro:
// 1. Produto único (delegado pro modal original do app)
// 2. Dimensão pra várias espécies (bulk)
// 3. Cor/Acabamento pra vários produtos
// 4. Modificador de preço
(function(){
  if (window.__pktCatalogosLoaded) return;
  window.__pktCatalogosLoaded = true;

  const SUPABASE_URL = "https://hbxpilrxmitvzebluoom.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

  function getAuth(){
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.includes("supabase") && k.endsWith("-auth-token")) {
          const v = JSON.parse(localStorage.getItem(k));
          if (v && v.access_token) return v.access_token;
        }
      }
    } catch(e){}
    return SUPABASE_KEY;
  }

  async function sb(method, path, body) {
    const token = getAuth();
    const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      method,
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`HTTP ${r.status}: ${t.slice(0,300)}`);
    }
    return r.json();
  }

  function css(s){ const x=document.createElement("style"); x.textContent=s; document.head.appendChild(x); }
  css(`
    .pkt-cat-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 9999;
      display: flex; align-items: center; justify-content: center; }
    .pkt-cat-modal { background: #1a1a1a; border: 1px solid #333; border-radius: 12px;
      width: 92vw; max-width: 760px; max-height: 92vh; overflow: hidden;
      display: flex; flex-direction: column; color: #fff; }
    .pkt-cat-header { display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px; border-bottom: 1px solid #333; }
    .pkt-cat-title { font-size: 15px; font-weight: 700; color: #c89c5c; }
    .pkt-cat-close { background: none; border: none; color: #999; font-size: 22px;
      cursor: pointer; padding: 0 8px; line-height: 1; }
    .pkt-cat-modes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
      padding: 12px 18px; border-bottom: 1px solid #2a2a2a; background: #141414; }
    .pkt-cat-mode { background: #1f1f1f; border: 1px solid #2a2a2a; color: #bbb;
      padding: 10px 8px; border-radius: 6px; cursor: pointer; font-size: 12px;
      font-weight: 600; text-align: center; transition: all 0.15s; }
    .pkt-cat-mode:hover { border-color: #c89c5c; }
    .pkt-cat-mode.active { background: linear-gradient(135deg, #c89c5c, #a07832);
      border-color: #c89c5c; color: #fff; }
    .pkt-cat-hint { padding: 10px 18px; background: #1a1a10; color: #c89c5c;
      font-size: 11.5px; line-height: 1.5; border-bottom: 1px solid #2a2a2a; }
    .pkt-cat-body { padding: 16px 18px; overflow-y: auto; flex: 1; }
    .pkt-cat-form { display: grid; gap: 10px; }
    .pkt-cat-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .pkt-cat-field label { display: block; font-size: 10.5px; color: #888;
      margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .pkt-cat-field input, .pkt-cat-field select, .pkt-cat-field textarea {
      width: 100%; background: #0d0d0d; border: 1px solid #333; border-radius: 6px;
      padding: 8px 10px; color: #fff; font-size: 13px; box-sizing: border-box; font-family: inherit; }
    .pkt-cat-field select[multiple] { min-height: 140px; }
    .pkt-cat-submit { background: linear-gradient(135deg, #c89c5c, #a07832); color: #fff;
      border: none; border-radius: 6px; padding: 10px 16px; font-size: 13px;
      font-weight: 600; cursor: pointer; margin-top: 4px; }
    .pkt-cat-submit:disabled { opacity: 0.5; cursor: not-allowed; }
    .pkt-cat-msg { margin-top: 10px; padding: 8px 10px; border-radius: 4px; font-size: 12px; }
    .pkt-cat-msg.ok { background: #1a3a1a; color: #4ade80; }
    .pkt-cat-msg.err { background: #3a1a1a; color: #ef4444; }
    .pkt-cat-list { margin-top: 14px; border-top: 1px solid #2a2a2a; padding-top: 12px; }
    .pkt-cat-list h4 { margin: 0 0 8px; font-size: 12px; color: #c89c5c; text-transform: uppercase; letter-spacing: 0.5px; }
    .pkt-cat-item { display: flex; justify-content: space-between; align-items: center;
      padding: 6px 10px; border: 1px solid #2a2a2a; border-radius: 4px; margin-bottom: 4px; font-size: 12px; }
    .pkt-cat-item button { background: #602020; color: #fff; border: none;
      border-radius: 4px; padding: 3px 8px; font-size: 11px; cursor: pointer; }
  `);

  // Cache & state
  let modal = null;
  let activeMode = "produto";
  let products = [];
  let pendingOpts = null;

  async function loadProducts(force){
    if (products.length && !force) return products;
    products = await sb("GET", "/orcamento_tabela_precos?select=id,categoria,subtipo,origem,especie_id,especie_nome,dimensao_id,dimensao_label,cores,ativo,preco&ativo=eq.true&order=categoria,especie_nome");
    return products;
  }

  function slug(s){
    return (s||"").toString().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g,"")
      .replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
  }

  function setMsg(txt, type){
    if (!modal) return;
    const m = modal.querySelector(".pkt-cat-msg");
    if (!m) return;
    m.textContent = txt || "";
    m.className = "pkt-cat-msg " + (type || "");
    if (txt && type === "ok") setTimeout(() => {
      if (modal) { m.textContent=""; m.className="pkt-cat-msg"; }
    }, 4500);
  }

  // ─────────────────────────────────────────────────────────────
  // MODE: Produto único
  // ─────────────────────────────────────────────────────────────
  function renderProduto(body){
    body.innerHTML = `
      <div class="pkt-cat-hint">
        <b>Cadastra 1 produto único.</b> Uma combinação (Categoria + Subtipo + Origem + Espécie + Dimensão) → 1 preço.
        <br>📋 <b>Antes de cadastrar:</b> busque na tabela se essa combinação já existe. Se sim, edite a linha existente em vez de criar nova.
      </div>
      <form class="pkt-cat-form">
        <div class="pkt-cat-row">
          <div class="pkt-cat-field"><label>Categoria *</label>
            <select name="categoria" required>
              <option value="">Selecione</option>
              <option value="piso">Piso</option><option value="painel">Painel</option>
              <option value="forro">Forro</option><option value="deck">Deck</option><option value="marcenaria">Marcenaria</option>
              <option value="porta">Porta</option><option value="marcenaria">Marcenaria</option><option value="revestimento">Revestimento</option>
            </select></div>
          <div class="pkt-cat-field"><label>Subtipo</label>
            <select name="subtipo">
              <option value="">—</option>
              <option value="regua">Régua</option><option value="reguas">Réguas (painel)</option>
              <option value="macico">Maciço</option><option value="lamina">Lâmina</option>
              <option value="laca">Laca</option><option value="ripado">Ripado</option>
              <option value="toblerone">Toblerone</option><option value="muxarabi">Muxarabi</option>
              <option value="assoalho">Assoalho</option>
            </select></div>
        </div>
        <div class="pkt-cat-row">
          <div class="pkt-cat-field"><label>Origem</label>
            <select name="origem">
              <option value="">—</option>
              <option value="nacional">Nacional</option><option value="importado">Importado</option>
            </select></div>
          <div class="pkt-cat-field"><label>Dimensão</label>
            <input name="dimensao_label" placeholder="ex: Régua 15/3 × 100mm × 1000-3000mm">
          </div>
        </div>
        <div class="pkt-cat-field">
          <label>Espécie da madeira * <small style="color:#666;text-transform:none">(escolha existente ou digite nova)</small></label>
          <input name="especie_nome" list="pkt-esp-list" required placeholder="ex: Tauari, Carvalho Europeu, Cumaru…">
          <datalist id="pkt-esp-list"></datalist>
        </div>
        <div class="pkt-cat-row">
          <div class="pkt-cat-field"><label>Preço * (R$/m²)</label>
            <input name="preco" type="number" step="0.01" required placeholder="0"></div>
          <div class="pkt-cat-field"><label>Ordem (sort)</label>
            <input name="ordem" type="number" value="0"></div>
        </div>
        <div class="pkt-cat-field"><label>Cores / Acabamentos (vírgula separado)</label>
          <textarea name="cores" rows="2" placeholder="Naturalle, Mont Blanc, Marrone, Grigio Nero…"></textarea></div>
        <button type="submit" class="pkt-cat-submit">Cadastrar Produto</button>
        <div class="pkt-cat-msg"></div>
      </form>
    `;
    const form = body.querySelector("form");
    // Populate datalist with existing species
    loadProducts().then(() => {
      const dl = body.querySelector("#pkt-esp-list");
      const seen = new Set();
      for (const p of products) {
        if (p.especie_nome && !seen.has(p.especie_nome)) {
          seen.add(p.especie_nome);
          const o = document.createElement("option");
          o.value = p.especie_nome;
          dl.appendChild(o);
        }
      }
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button");
      btn.disabled = true;
      try {
        const fd = new FormData(form);
        const cat = fd.get("categoria");
        const sub = fd.get("subtipo") || null;
        const ori = fd.get("origem") || null;
        const dimL = (fd.get("dimensao_label") || "").trim();
        const espN = (fd.get("especie_nome") || "").trim();
        const preco = parseFloat(fd.get("preco"));
        const ordem = parseInt(fd.get("ordem") || "0", 10);
        const coresStr = (fd.get("cores") || "").trim();
        if (!cat || !espN || isNaN(preco)) throw new Error("Preencha categoria, espécie e preço");

        // Try to reuse existing especie_id by name
        await loadProducts();
        const existing = products.find(p => p.especie_nome && p.especie_nome.toLowerCase() === espN.toLowerCase() && p.especie_id);
        const espId = existing ? existing.especie_id : slug(espN);
        const dimId = dimL ? slug(dimL) : "default";
        const cores = coresStr ? coresStr.split(",").map(s => s.trim()).filter(Boolean) : null;

        // Dup check
        const dup = products.find(p =>
          p.categoria === cat && p.subtipo === sub && p.origem === ori &&
          p.especie_id === espId && (p.dimensao_id === dimId || p.dimensao_label === dimL));
        if (dup) {
          if (!confirm(`Já existe produto com essa combinação (${dup.especie_nome} · ${dup.dimensao_label||"—"} · R$${dup.preco}).\n\nDeseja criar mesmo assim?`)) {
            btn.disabled = false; return;
          }
        }
        const row = {
          categoria: cat, subtipo: sub, origem: ori,
          especie_id: espId, especie_nome: espN,
          dimensao_id: dimId, dimensao_label: dimL || "—",
          preco, ordem, ativo: true,
          tem_cores: !!(cores && cores.length),
          cores: cores,
          atributos_extras: {origem: ori, subtipo: sub, dimensao: dimL || null, _via: "catalogos"}
        };
        await sb("POST", "/orcamento_tabela_precos", row);
        products = [];
        setMsg(`✓ Produto cadastrado — disponível no simulador em segundos`, "ok");
        form.reset();
      } catch(err){ setMsg("Erro: " + err.message, "err"); }
      finally { btn.disabled = false; }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // MODE: Dimensão (bulk pra várias espécies)
  // ─────────────────────────────────────────────────────────────
  function renderDimensao(body){
    body.innerHTML = `
      <div class="pkt-cat-hint">
        <b>Cria a mesma dimensão pra várias espécies de uma vez.</b><br>
        Ex: dimensão "Régua 15/3 × 220 × 1000-3000mm" pra Tauari + Cumaru + Catuaba + Loro Pardo a R$1.180.
        Resultado: 4 linhas novas no banco (1 por espécie).
      </div>
      <form class="pkt-cat-form">
        <div class="pkt-cat-row">
          <div class="pkt-cat-field"><label>Categoria *</label>
            <select name="categoria" required>
              <option value="">Selecione</option>
              <option value="piso">Piso</option><option value="painel">Painel</option>
              <option value="forro">Forro</option><option value="deck">Deck</option><option value="marcenaria">Marcenaria</option>
            </select></div>
          <div class="pkt-cat-field"><label>Origem</label>
            <select name="origem">
              <option value="nacional">Nacional</option><option value="importado">Importado</option>
            </select></div>
        </div>
        <div class="pkt-cat-row">
          <div class="pkt-cat-field"><label>Subtipo *</label>
            <select name="subtipo" required>
              <option value="regua">Régua</option><option value="reguas">Réguas (painel)</option>
              <option value="macico">Maciço</option><option value="lamina">Lâmina</option>
              <option value="ripado">Ripado</option><option value="toblerone">Toblerone</option>
            </select></div>
          <div class="pkt-cat-field"><label>Preço * (R$/m²)</label>
            <input name="preco" type="number" step="0.01" required placeholder="ex: 1180"></div>
        </div>
        <div class="pkt-cat-field"><label>Label da Dimensão *</label>
          <input name="label" required placeholder="ex: Régua 15/3 × 220mm × 1000-3000mm"></div>
        <div class="pkt-cat-field"><label>Espécies (Ctrl/Cmd p/ múltiplas) *</label>
          <select name="especies" multiple required></select>
          <small style="color:#666">Selecione 1 ou mais — vai criar 1 linha por espécie</small></div>
        <button type="submit" class="pkt-cat-submit">Adicionar Dimensão</button>
        <div class="pkt-cat-msg"></div>
      </form>
    `;
    const form = body.querySelector("form");
    const cat = form.categoria, sub = form.subtipo, ori = form.origem;
    const espSel = form.especies;
    async function refresh(){
      if (!cat.value) return;
      await loadProducts();
      const seen = new Map();
      for (const p of products) {
        if (p.categoria !== cat.value) continue;
        if (sub.value && p.subtipo !== sub.value) continue;
        if (ori.value && p.origem && p.origem !== ori.value) continue;
        if (p.especie_id && !seen.has(p.especie_id)) seen.set(p.especie_id, p.especie_nome);
      }
      espSel.innerHTML = "";
      for (const [id, nome] of seen.entries()) {
        const o = document.createElement("option");
        o.value = id; o.textContent = nome; espSel.appendChild(o);
      }
      form.querySelector("small").textContent = `${seen.size} espécie(s) disponível(is) pra ${cat.value}/${sub.value || "todos"}/${ori.value || "todas origens"}`;
    }
    cat.addEventListener("change", refresh); sub.addEventListener("change", refresh); ori.addEventListener("change", refresh);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button");
      btn.disabled = true;
      try {
        const fd = new FormData(form);
        const especies = Array.from(espSel.selectedOptions).map(o => ({id:o.value, nome:o.textContent}));
        if (!especies.length) throw new Error("Selecione pelo menos 1 espécie");
        const label = fd.get("label").trim();
        const preco = parseFloat(fd.get("preco"));
        const dimId = slug(label);
        const rows = especies.map(esp => ({
          categoria: cat.value, origem: ori.value, subtipo: sub.value,
          especie_id: esp.id, especie_nome: esp.nome,
          dimensao_id: dimId, dimensao_label: label,
          preco, ativo: true, ordem: 999,
          tem_cores: false, cores: null,
          atributos_extras: {origem: ori.value, subtipo: sub.value, dimensao: label, _via: "catalogos_bulk"}
        }));
        await sb("POST", "/orcamento_tabela_precos", rows);
        products = [];
        setMsg(`✓ ${rows.length} produto(s) criado(s) — disponíveis no simulador em segundos`, "ok");
        form.reset();
        espSel.innerHTML = "";
      } catch(err){ setMsg("Erro: " + err.message, "err"); }
      finally { btn.disabled = false; }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // MODE: Cor / Acabamento
  // ─────────────────────────────────────────────────────────────
  async function renderCor(body){
    body.innerHTML = `
      <div class="pkt-cat-hint">
        <b>Adiciona uma cor/acabamento à lista de cores de vários produtos.</b><br>
        Ex: cor "Espresso" disponível em todos os pisos nacionais.<br>
        Cor não muda preço — se precisar de cor com preço diferente, use a aba "Modificador".
      </div>
      <form class="pkt-cat-form">
        <div class="pkt-cat-field"><label>Nome da cor/acabamento *</label>
          <input name="nome" required placeholder="ex: Espresso, Cinza Cimento"></div>
        <div class="pkt-cat-field"><label>Aplicar a quais produtos * (Ctrl/Cmd p/ múltiplos)</label>
          <select name="produtos" multiple required size="14"></select>
          <small style="color:#666">Carregando…</small></div>
        <button type="submit" class="pkt-cat-submit">Adicionar a produtos</button>
        <div class="pkt-cat-msg"></div>
      </form>
    `;
    const form = body.querySelector("form");
    const sel = form.produtos;
    await loadProducts();
    const prods = products.filter(p => p.cores && Array.isArray(p.cores));
    for (const p of prods) {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = `${p.categoria}/${p.subtipo||"?"} · ${p.especie_nome} · ${p.dimensao_label || "—"}`;
      sel.appendChild(o);
    }
    form.querySelector("small").textContent = `${prods.length} produto(s) com cores disponíveis`;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button");
      btn.disabled = true;
      try {
        const nome = form.nome.value.trim();
        const ids = Array.from(sel.selectedOptions).map(o => o.value);
        if (!nome) throw new Error("Informe o nome");
        if (!ids.length) throw new Error("Selecione produtos");
        let updated = 0, skipped = 0;
        for (const id of ids) {
          const p = prods.find(x => x.id === id);
          if (!p) continue;
          const cores = Array.isArray(p.cores) ? [...p.cores] : [];
          if (cores.some(c => c.toLowerCase() === nome.toLowerCase())) { skipped++; continue; }
          cores.push(nome);
          await sb("PATCH", `/orcamento_tabela_precos?id=eq.${id}`, {cores, tem_cores: true, updated_at: new Date().toISOString()});
          updated++;
        }
        products = [];
        setMsg(`✓ Cor "${nome}" adicionada a ${updated} produto(s)${skipped?` (${skipped} já tinham)`:""}`, "ok");
        form.reset();
      } catch(err){ setMsg("Erro: " + err.message, "err"); }
      finally { btn.disabled = false; }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // MODE: Modificador
  // ─────────────────────────────────────────────────────────────
  async function renderModificador(body){
    body.innerHTML = `
      <div class="pkt-cat-hint">
        <b>Aplica um ajuste de preço quando uma cor/dimensão específica é escolhida.</b><br>
        Ex: cor "Customizado" no Carvalho Europeu = +R$ 250 por m².<br>
        ⚠️ Hoje o cadastro funciona, mas o simulador ainda não consome — em breve.
      </div>
      <form class="pkt-cat-form">
        <div class="pkt-cat-row">
          <div class="pkt-cat-field"><label>Tipo *</label>
            <select name="tipo" required>
              <option value="cor">Cor</option><option value="acabamento">Acabamento</option><option value="dimensao">Dimensão</option>
            </select></div>
          <div class="pkt-cat-field"><label>Nome *</label>
            <input name="nome" required placeholder="ex: Premium, Customizado"></div>
        </div>
        <div class="pkt-cat-row">
          <div class="pkt-cat-field"><label>Escopo: Categoria</label>
            <select name="escopo_categoria"><option value="">Todas</option>
              <option value="piso">Piso</option><option value="painel">Painel</option>
              <option value="forro">Forro</option><option value="deck">Deck</option><option value="marcenaria">Marcenaria</option>
              <option value="porta">Porta</option></select></div>
          <div class="pkt-cat-field"><label>Escopo: Subtipo</label>
            <input name="escopo_subtipo" placeholder="ex: regua, lamina (vazio = todos)"></div>
        </div>
        <div class="pkt-cat-row">
          <div class="pkt-cat-field"><label>Tipo do valor *</label>
            <select name="modifier_tipo" required>
              <option value="absoluto">Absoluto (R$)</option>
              <option value="percentual">Percentual (%)</option>
            </select></div>
          <div class="pkt-cat-field"><label>Valor *</label>
            <input name="valor" type="number" step="0.01" required placeholder="ex: 250 ou 5"></div>
        </div>
        <button type="submit" class="pkt-cat-submit">Adicionar Modificador</button>
        <div class="pkt-cat-msg"></div>
      </form>
      <div class="pkt-cat-list"><h4>Modificadores ativos</h4><div class="pkt-cat-mod-list">Carregando…</div></div>
    `;
    const form = body.querySelector("form");
    const list = body.querySelector(".pkt-cat-mod-list");
    async function refresh(){
      try {
        const mods = await sb("GET", "/orcamento_modificadores?ativo=eq.true&order=tipo,nome");
        list.innerHTML = mods.length ? "" : "<i style='color:#666'>Nenhum cadastrado.</i>";
        for (const m of mods) {
          const scope = [m.escopo_categoria, m.escopo_subtipo].filter(Boolean).join("/") || "global";
          const valLbl = m.modifier_tipo === "percentual" ? `${m.valor}%` : `R$ ${m.valor}`;
          const item = document.createElement("div");
          item.className = "pkt-cat-item";
          item.innerHTML = `<span><b>${m.tipo}</b> "${m.nome}" → <code>${valLbl}</code> · escopo: ${scope}</span><button>Remover</button>`;
          item.querySelector("button").addEventListener("click", async () => {
            if (!confirm(`Remover "${m.nome}"?`)) return;
            await sb("PATCH", `/orcamento_modificadores?id=eq.${m.id}`, {ativo:false});
            refresh();
          });
          list.appendChild(item);
        }
      } catch(e) { list.innerHTML = "Erro: " + e.message; }
    }
    refresh();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button");
      btn.disabled = true;
      try {
        const fd = new FormData(form);
        const payload = {
          tipo: fd.get("tipo"), nome: fd.get("nome").trim(),
          escopo_categoria: fd.get("escopo_categoria") || null,
          escopo_subtipo: fd.get("escopo_subtipo").trim() || null,
          modifier_tipo: fd.get("modifier_tipo"),
          valor: parseFloat(fd.get("valor"))
        };
        await sb("POST", "/orcamento_modificadores", payload);
        setMsg(`✓ Modificador "${payload.nome}" cadastrado`, "ok");
        form.reset();
        refresh();
      } catch(err){ setMsg("Erro: " + err.message, "err"); }
      finally { btn.disabled = false; }
    });
  }

  function renderMode(){
    const body = modal.querySelector(".pkt-cat-body");
    body.innerHTML = "";
    if (activeMode === "produto") renderProduto(body);
    else if (activeMode === "dimensao") renderDimensao(body);
    else if (activeMode === "cor") renderCor(body);
    else if (activeMode === "modificador") renderModificador(body);
    modal.querySelectorAll(".pkt-cat-mode").forEach(b => {
      b.classList.toggle("active", b.dataset.mode === activeMode);
    });
  }

  function openModal(opts){
    if (modal) return;
    pendingOpts = opts || {};
    activeMode = "produto";
    modal = document.createElement("div");
    modal.className = "pkt-cat-overlay";
    modal.innerHTML = `
      <div class="pkt-cat-modal">
        <div class="pkt-cat-header">
          <div class="pkt-cat-title">+ Novo Produto / Catálogo</div>
          <button class="pkt-cat-close" title="Fechar">×</button>
        </div>
        <div class="pkt-cat-modes">
          <button class="pkt-cat-mode active" data-mode="produto">📦<br>Produto único</button>
          <button class="pkt-cat-mode" data-mode="dimensao">📏<br>Dimensão (bulk)</button>
          <button class="pkt-cat-mode" data-mode="cor">🎨<br>Cor / Acabamento</button>
          <button class="pkt-cat-mode" data-mode="modificador">⚙️<br>Modificador</button>
        </div>
        <div class="pkt-cat-body"></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector(".pkt-cat-close").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    modal.querySelectorAll(".pkt-cat-mode").forEach(b => {
      b.addEventListener("click", () => {
        activeMode = b.dataset.mode;
        renderMode();
      });
    });
    renderMode();
  }
  function closeModal(){
    if (modal) { modal.remove(); modal = null; }
    if (pendingOpts && pendingOpts.onClose) try { pendingOpts.onClose(); } catch(e){}
    pendingOpts = null;
  }

  // Intercept the app's product cadastro modal opener
  function installIntercept(){
    const orig = window.__pkt_openCadastroProduto;
    window.__pkt_openCadastroProduto = function(opts){
      openModal(opts);
    };
    if (orig && typeof orig === "function") {
      window.__pkt_openCadastroProduto_original = orig;
    }
  }
  // Install now and re-install if app overwrites later
  installIntercept();
  setInterval(() => {
    if (window.__pkt_openCadastroProduto !== openModalIntercept) installIntercept();
  }, 1500);
  function openModalIntercept(opts){ openModal(opts); }
  // Re-bind reference to allow comparison above
  window.__pkt_openCadastroProduto = openModalIntercept;

  console.log("[pkt-catalogos] loaded — Novo Produto intercepted, 4 modos disponíveis");
})();
