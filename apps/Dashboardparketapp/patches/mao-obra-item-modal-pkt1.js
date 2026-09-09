// mao-obra-item-modal-pkt1.js
// ─────────────────────────────────────────────────────────────
// Modal de adição de item de MÃO DE OBRA ao orçamento.
//
// Aparece quando o user escolhe um produto de categoria=mao_de_obra
// no simulador. Ao invés do fluxo normal de "metragem × preço",
// pede:
//   - Ambiente (texto livre)
//   - Material a REMOVER (cascata produto)
//   - Material a INSTALAR (cascata produto, se tipo inclui instalação)
//   - Metragem
//   - Preço/un editável (override do cadastro)
//
// E gera descrição formatada estilo:
//   "Sala Jantar
//    Remoção de 250m² de piso existente e instalação de
//    piso em réguas 15/3x190 Tauari Naturalle.
//    250 m² × R$ 150,00/m²"
//
// Expõe `window.__pkt_openMaoObraItemModal({produtoMdO, simulacaoId, onSaved, onClose})`.
// ─────────────────────────────────────────────────────────────
import { s as supabase } from "./index-DZtetJYP.js";

const ACC = "#D4A853";
const BG = "#0A0A0A";
const CARD_BG = "#111111";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#fff";
const TEXT_DIM = "rgba(255,255,255,0.5)";
const TEXT_MED = "rgba(255,255,255,0.7)";
const GREEN = "#10B981";
const RED = "#EF4444";

// Mapa: "Aplica em" do cadastro → categoria do banco (lowercase)
const APLICA_EM_TO_CATEGORIA = {
  "Piso": "piso",
  "Forro": "forro",
  "Painel": "painel",
  "Deck": "deck",
  "Marcenaria": "painel",   // marcenaria mapeia pra painel no catálogo
  "Porta": "porta",
  "Brise": "brise",
  "Sauna": "sauna",
  "Escada": "escada",
};

const _esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const _brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Monta descrição amigável do produto a partir de uma row do orcamento_tabela_precos
function _descProduto(p) {
  if (!p) return "—";
  const parts = [];
  const cat = (p.categoria || "").toLowerCase();
  parts.push(cat === "piso" ? "piso" : cat === "forro" ? "forro" : cat === "painel" ? "painel" :
             cat === "deck" ? "deck" : cat === "porta" ? "porta" : cat === "brise" ? "brise" :
             cat === "sauna" ? "sauna" : cat === "revestimento" ? "revestimento" :
             cat === "escada" ? "escada" : cat);
  const a = p.atributos_extras || {};
  if (a.subtipo) parts.push(`em ${String(a.subtipo).toLowerCase()}s`);
  else if (a.tipo) parts.push(String(a.tipo).toLowerCase());
  if (a.dimensao) parts.push(a.dimensao);
  if (p.especie_nome) parts.push(p.especie_nome);
  if (a.acabamento) parts.push(String(a.acabamento).toLowerCase());
  return parts.filter(Boolean).join(" ");
}

async function loadProdutosByCategoria(categoria) {
  if (!categoria) return [];
  try {
    const { data, error } = await supabase
      .from("orcamento_tabela_precos")
      .select("id,categoria,especie_id,especie_nome,cores,atributos_extras,preco,dimensao_label")
      .eq("categoria", categoria)
      .eq("ativo", true)
      .order("especie_nome", { ascending: true })
      .limit(500);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

function _inputStyle() {
  return `width:100%;padding:8px 11px;background:${BG};border:1px solid ${BORDER};border-radius:6px;color:${TEXT};font-size:0.75rem;outline:none;box-sizing:border-box;`;
}

function _selectStyle() { return _inputStyle(); }

async function openMaoObraItemModal(opts) {
  const { produtoMdO, simulacaoId, onSaved, onClose } = opts || {};
  if (!produtoMdO || !simulacaoId) {
    alert("Dados inválidos pra abrir o item de Mão de Obra.");
    return;
  }
  const a = produtoMdO.atributos_extras || {};
  const tipoMdO = a.tipo || "Remoção + Instalação";
  const aplicaEm = a.aplica_em || "Piso";
  const unidade = a.unidade || "m²";
  const precoBase = Number(produtoMdO.preco) || 0;

  // Determina se inclui remoção / instalação
  const t = tipoMdO.toLowerCase();
  const incluiRemocao = t.includes("remoção") || t.includes("remocao") || t.includes("manutenção") || t.includes("reparo");
  const incluiInstalacao = t.includes("instalação") || t.includes("instalacao");

  // Categoria do catálogo correspondente ao "Aplica em"
  const catProduto = APLICA_EM_TO_CATEGORIA[aplicaEm] || aplicaEm.toLowerCase();

  // Limpa instância anterior
  const old = document.getElementById("__pkt_mo_item");
  if (old) old.remove();

  const html = `
<div id="__pkt_mo_item" style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:24px;">
  <div style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:14px;width:min(820px,100%);max-height:90vh;overflow-y:auto;padding:24px;color:${TEXT};font-family:system-ui,sans-serif;">

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
      <div>
        <h3 style="font-size:1rem;font-weight:700;margin:0;color:${ACC};">Mão de Obra — ${_esc(tipoMdO)}</h3>
        <p style="font-size:0.65rem;color:${TEXT_DIM};margin:3px 0 0;">Aplica em: <b>${_esc(aplicaEm)}</b> · ${_esc(produtoMdO.especie_nome || "Genérico")}</p>
      </div>
      <button id="__pkt_mo_close" style="background:none;border:none;color:${TEXT_DIM};cursor:pointer;font-size:1.2rem;">✕</button>
    </div>

    <div style="display:flex;flex-direction:column;gap:14px;">

      <div>
        <label style="font-size:0.55rem;color:${TEXT_DIM};text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">Ambiente *</label>
        <input id="__pkt_mo_amb" placeholder="ex: Sala Jantar" style="${_inputStyle()}" />
      </div>

      ${incluiRemocao ? `
      <div>
        <label style="font-size:0.55rem;color:${TEXT_DIM};text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">Material a remover</label>
        <select id="__pkt_mo_rem" style="${_selectStyle()}">
          <option value="">— ${_esc(aplicaEm.toLowerCase())} existente (genérico)</option>
        </select>
      </div>` : ""}

      ${incluiInstalacao ? `
      <div>
        <label style="font-size:0.55rem;color:${TEXT_DIM};text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">Material a instalar *</label>
        <select id="__pkt_mo_inst" style="${_selectStyle()}">
          <option value="">— Selecione</option>
        </select>
      </div>` : ""}

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">
        <div>
          <label style="font-size:0.55rem;color:${TEXT_DIM};text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">Metragem (${_esc(unidade)}) *</label>
          <input id="__pkt_mo_metr" type="number" min="0" step="0.01" placeholder="0" style="${_inputStyle()}" />
        </div>
        <div>
          <label style="font-size:0.55rem;color:${TEXT_DIM};text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">Preço / ${_esc(unidade)} (editável)</label>
          <input id="__pkt_mo_preco" type="number" min="0" step="0.01" value="${precoBase}" style="${_inputStyle()}" />
        </div>
        <div>
          <label style="font-size:0.55rem;color:${TEXT_DIM};text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">Total</label>
          <input id="__pkt_mo_total" disabled placeholder="R$ 0,00" style="${_inputStyle()};opacity:0.7;" />
        </div>
      </div>

      <div>
        <label style="font-size:0.55rem;color:${TEXT_DIM};text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">Prévia da descrição (será impressa no PDF)</label>
        <textarea id="__pkt_mo_preview" disabled rows="4" style="${_inputStyle()};resize:vertical;opacity:0.8;font-family:Georgia,serif;line-height:1.5;"></textarea>
      </div>

      <div id="__pkt_mo_err" style="display:none;padding:10px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:6px;font-size:0.65rem;color:${RED};"></div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
        <button id="__pkt_mo_cancel" style="padding:9px 16px;border:1px solid ${BORDER};background:transparent;color:${TEXT_DIM};border-radius:6px;cursor:pointer;font-size:0.7rem;">Cancelar</button>
        <button id="__pkt_mo_save" style="padding:9px 18px;border:none;background:${GREEN};color:#fff;border-radius:6px;cursor:pointer;font-size:0.7rem;font-weight:700;">Adicionar ao orçamento</button>
      </div>
    </div>
  </div>
</div>`;

  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  document.body.appendChild(wrap.firstElementChild);

  const root = document.getElementById("__pkt_mo_item");
  const $ = (id) => root.querySelector("#" + id);
  const close = () => { root.remove(); onClose && onClose(); };
  $("__pkt_mo_close").onclick = close;
  $("__pkt_mo_cancel").onclick = close;
  root.onclick = (e) => { if (e.target === root) close(); };

  // Popula selects de remover/instalar com produtos do catálogo
  const produtos = await loadProdutosByCategoria(catProduto);
  let produtosByCor = {};  // id → produto

  function preencheSelect(selectEl) {
    if (!selectEl) return;
    for (const p of produtos) {
      const cores = (Array.isArray(p.cores) && p.cores.length > 0) ? p.cores : [null];
      for (const cor of cores) {
        const id = `${p.id}::${cor || ""}`;
        produtosByCor[id] = { ...p, _cor: cor };
        const desc = _descProduto(p) + (cor ? ` ${cor}` : "");
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = desc;
        selectEl.appendChild(opt);
      }
    }
  }
  if (incluiRemocao) preencheSelect($("__pkt_mo_rem"));
  if (incluiInstalacao) preencheSelect($("__pkt_mo_inst"));

  // Render da prévia + total
  function getMatChosen(id) {
    if (!id) return null;
    const sel = produtosByCor[id];
    return sel ? sel : null;
  }

  function refresh() {
    const amb = ($("__pkt_mo_amb").value || "").trim();
    const metragem = parseFloat($("__pkt_mo_metr").value || "0") || 0;
    const preco = parseFloat($("__pkt_mo_preco").value || "0") || 0;
    const total = metragem * preco;
    $("__pkt_mo_total").value = _brl(total);

    const remEl = incluiRemocao ? $("__pkt_mo_rem") : null;
    const instEl = incluiInstalacao ? $("__pkt_mo_inst") : null;
    const remProd = remEl ? getMatChosen(remEl.value) : null;
    const instProd = instEl ? getMatChosen(instEl.value) : null;

    const aplicaEmLower = aplicaEm.toLowerCase();
    const partes = [];
    if (incluiRemocao) {
      const remDesc = remProd
        ? _descProduto(remProd) + (remProd._cor ? ` ${remProd._cor}` : "")
        : `${aplicaEmLower} existente`;
      partes.push(`remoção de ${metragem.toLocaleString("pt-BR")}${unidade.startsWith("m²") ? "m²" : unidade} de ${remDesc}`);
    }
    if (incluiInstalacao) {
      const instDesc = instProd
        ? _descProduto(instProd) + (instProd._cor ? ` ${instProd._cor}` : "")
        : `${aplicaEmLower}`;
      partes.push(`instalação de ${instDesc}`);
    }
    const acao = partes.join(" e ");
    const preview = `${amb || "[Ambiente]"}\n${acao || "(escolha tipo)"}.\n${metragem.toLocaleString("pt-BR")} ${unidade.split(" ")[0]} × ${_brl(preco)}/${unidade.split(" ")[0]}`;
    $("__pkt_mo_preview").value = preview;
  }

  $("__pkt_mo_amb").oninput = refresh;
  $("__pkt_mo_metr").oninput = refresh;
  $("__pkt_mo_preco").oninput = refresh;
  if (incluiRemocao) $("__pkt_mo_rem").onchange = refresh;
  if (incluiInstalacao) $("__pkt_mo_inst").onchange = refresh;
  refresh();

  // ── Salvar ──
  $("__pkt_mo_save").onclick = async () => {
    const err = $("__pkt_mo_err");
    err.style.display = "none";
    err.textContent = "";

    const amb = ($("__pkt_mo_amb").value || "").trim();
    const metragem = parseFloat($("__pkt_mo_metr").value || "0") || 0;
    const preco = parseFloat($("__pkt_mo_preco").value || "0") || 0;
    const remEl = incluiRemocao ? $("__pkt_mo_rem") : null;
    const instEl = incluiInstalacao ? $("__pkt_mo_inst") : null;
    const remProd = remEl ? getMatChosen(remEl.value) : null;
    const instProd = instEl ? getMatChosen(instEl.value) : null;

    if (!amb) { err.textContent = "Informe o ambiente."; err.style.display = "block"; return; }
    if (!(metragem > 0)) { err.textContent = "Metragem deve ser > 0."; err.style.display = "block"; return; }
    if (!(preco > 0)) { err.textContent = "Preço deve ser > 0."; err.style.display = "block"; return; }
    if (incluiInstalacao && !instProd) { err.textContent = "Selecione o material a instalar."; err.style.display = "block"; return; }

    // Monta descritivo final (que vai pro PDF)
    const aplicaEmLower = aplicaEm.toLowerCase();
    const partes = [];
    if (incluiRemocao) {
      const remDesc = remProd
        ? _descProduto(remProd) + (remProd._cor ? ` ${remProd._cor}` : "")
        : `${aplicaEmLower} existente`;
      partes.push(`Remoção de ${metragem.toLocaleString("pt-BR")}${unidade.startsWith("m²") ? "m²" : unidade} de ${remDesc}`);
    }
    if (incluiInstalacao) {
      const instDesc = instProd
        ? _descProduto(instProd) + (instProd._cor ? ` ${instProd._cor}` : "")
        : aplicaEmLower;
      partes.push(`instalação de ${instDesc}`);
    }
    const acao = partes.join(" e ").replace(/^./, c => c.toUpperCase()).replace(" Instalação ", " instalação ");
    const valor = metragem * preco;
    const descritivo = `${amb}\n${acao}.\n${metragem.toLocaleString("pt-BR")} ${unidade.split(" ")[0]} × ${_brl(preco)}/${unidade.split(" ")[0]}`;
    const categoria = `MÃO DE OBRA||${tipoMdO.toUpperCase()}||${aplicaEm.toUpperCase()}`;

    try {
      $("__pkt_mo_save").disabled = true;
      $("__pkt_mo_save").textContent = "Salvando…";
      // Calcula próximo ordem
      const { data: itens } = await supabase.from("simulacao_itens")
        .select("ordem").eq("simulacao_id", simulacaoId);
      const proxOrdem = (itens && itens.length > 0)
        ? Math.max(...itens.map(i => i.ordem || 0)) + 1 : 1;

      const { data, error } = await supabase.from("simulacao_itens").insert({
        simulacao_id: simulacaoId,
        categoria,
        descritivo,
        valor,
        ordem: proxOrdem,
        cor: instProd?._cor || remProd?._cor || null,
        meta: {
          kind: "mao_de_obra",
          produto_mdo_id: produtoMdO.id,
          tipo: tipoMdO,
          aplica_em: aplicaEm,
          unidade,
          ambiente: amb,
          metragem,
          preco_unit: preco,
          material_remover: remProd ? {
            id: remProd.id, especie_nome: remProd.especie_nome,
            categoria: remProd.categoria, cor: remProd._cor,
            atributos: remProd.atributos_extras,
          } : null,
          material_instalar: instProd ? {
            id: instProd.id, especie_nome: instProd.especie_nome,
            categoria: instProd.categoria, cor: instProd._cor,
            atributos: instProd.atributos_extras,
          } : null,
        },
      }).select().single();

      if (error) throw new Error(error.message);
      onSaved && onSaved(data);
      close();
    } catch (e) {
      err.textContent = "Falha ao salvar: " + (e?.message || e);
      err.style.display = "block";
      $("__pkt_mo_save").disabled = false;
      $("__pkt_mo_save").textContent = "Adicionar ao orçamento";
    }
  };
}

if (typeof window !== "undefined") {
  window.__pkt_openMaoObraItemModal = openMaoObraItemModal;
}
export { openMaoObraItemModal };
export default openMaoObraItemModal;
