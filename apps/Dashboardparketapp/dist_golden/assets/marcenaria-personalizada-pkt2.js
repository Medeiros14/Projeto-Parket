/**
 * Marcenaria Personalizada — patch chunk Parket
 * Tela isolada de orçamento de marcenaria sob medida.
 * Usa React.createElement direto (universal, sem depender de jsx/jsxs).
 */
import { R as h } from "./index-DZtetJYP.js";

const SB_URL = "https://hbxpilrxmitvzebluoom.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";
const PRECO_DEFAULT = 5200;
const FER_CAT_ORDER = ["pivot","dobradica","corredica","kit_porta_correr","trilho","puxador","k_push","fecho","vedacao","pino","estrutura","guia","outros"];
const FER_CAT_LABELS = { pivot:"Pivôs", dobradica:"Dobradiças", corredica:"Corrediças", kit_porta_correr:"Kits de Porta de Correr", trilho:"Trilhos", puxador:"Puxadores", k_push:"K-Push (pulsadores)", fecho:"Fechos", vedacao:"Vedação / Acessórios", pino:"Pinos", estrutura:"Estrutura / Material", guia:"Guias", outros:"Outros" };
const MAD_CAT_ORDER = ["mdf","compensado","casquinha","outros"];
const MAD_CAT_LABELS = { mdf:"MDF", compensado:"Compensado", casquinha:"Casquinha", outros:"Outros" };
const c = h.createElement;

const ESPECIES = [
  "Carvalho Europeu", "Tauari", "Nogueira Walnut", "Freijó", "Cumaru",
  "Sucupira Negra", "Perobinha Mica", "Catuaba", "Loro Pardo",
  "Peroba do Campo", "Cabreuva Branca", "Cabreuva Dourada", "Imbuia", "Tauari Customizado", "Laca Colorida",
];

const ACABAMENTOS = [
  "Naturalle", "Mont Blanc", "Marrone", "Capuccino", "Baby Grey",
  "Grigio Nero", "Light Brown", "Milano", "Smoked", "Giz",
  "Snow", "Armani", "Nevado", "Italy Brown", "Batman",
  "Branco Diamante Essencial", "Branco TX",
];

const fmtBRL = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

async function sbGet(path) {
  const r = await fetch(SB_URL + "/rest/v1/" + path, {
    headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY },
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

async function sbInsert(table, body) {
  const r = await fetch(SB_URL + "/rest/v1/" + table, {
    method: "POST",
    headers: {
      apikey: SB_KEY, Authorization: "Bearer " + SB_KEY,
      "Content-Type": "application/json", Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 200));
  return r.json();
}

const S = {
  page: { padding: 24, color: "#fff", maxWidth: 880, margin: "0 auto" },
  h1: { fontSize: 22, fontWeight: 700, marginBottom: 6 },
  sub: { fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 24 },
  label: { fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 6, display: "block" },
  field: {
    width: "100%", background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 13,
    outline: "none", boxSizing: "border-box",
  },
  textarea: {
    width: "100%", background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "12px", color: "#fff", fontSize: 13,
    outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5,
  },
  card: {
    background: "#161616", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: 20, marginBottom: 16,
  },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  totalBox: {
    background: "#1a2a1a", border: "1px solid #2d5a2d",
    borderRadius: 10, padding: 18, textAlign: "center",
  },
  totalNum: { fontSize: 28, fontWeight: 700, color: "#22c55e" },
  btnPrim: {
    padding: "10px 20px", borderRadius: 8, border: "none",
    background: "#22c55e", color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  ferTag: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "6px 10px", borderRadius: 16, fontSize: 11, marginRight: 6, marginBottom: 6,
    background: "rgba(184,170,154,0.15)", color: "#B8AA9A",
    border: "1px solid rgba(184,170,154,0.3)", cursor: "pointer",
  },
  ferTagSel: {
    background: "rgba(34,197,94,0.2)", color: "#22c55e",
    border: "1px solid rgba(34,197,94,0.4)",
  },
};

function MarcenariaPersonalizadaTab() {
  const [descricao, setDescricao] = h.useState("");
  const [especieInt, setEspecieInt] = h.useState("");
  const [acabInt, setAcabInt] = h.useState("");
  const [especieExt, setEspecieExt] = h.useState("");
  const [acabExt, setAcabExt] = h.useState("");
  const [metragem, setMetragem] = h.useState("");
  const [medidas, setMedidas] = h.useState("");
  const [ambiente, setAmbiente] = h.useState("");
  const [precoStr, setPrecoStr] = h.useState(String(PRECO_DEFAULT));
  const [ferragens, setFerragens] = h.useState([]);
  // Map<id, qtd> — qtd 0 = não selecionado
  const [ferragensQtd, setFerragensQtd] = h.useState(() => ({}));
  const [loadingFer, setLoadingFer] = h.useState(true);
  // Madeiras (MDF/Compensado) — Map<id, qtd>
  const [madeiras, setMadeiras] = h.useState([]);
  const [madeirasQtd, setMadeirasQtd] = h.useState(() => ({}));
  const [showAddFer, setShowAddFer] = h.useState(false);
  const [novaFerNome, setNovaFerNome] = h.useState("");
  const [novaFerForn, setNovaFerForn] = h.useState("");
  const [saving, setSaving] = h.useState(false);
  const [msg, setMsg] = h.useState(null);
  const [simulacoes, setSimulacoes] = h.useState([]);
  const [simulacaoId, setSimulacaoId] = h.useState("");

  h.useEffect(() => {
    sbGet("marcenaria_ferragens?select=*&ativo=eq.true&order=ordem.asc")
      .then((rows) => setFerragens(rows || []))
      .catch((e) => setMsg({ kind: "err", text: "Erro ferragens: " + e.message }))
      .finally(() => setLoadingFer(false));
    sbGet("marcenaria_madeiras?select=*&ativo=eq.true&order=ordem.asc")
      .then((rows) => setMadeiras(rows || []))
      .catch(() => {});
    sbGet("simulacao_projetos?select=id,numero,cliente,vendedor,status&order=created_at.desc&limit=50")
      .then((rows) => setSimulacoes((rows || []).filter((r) => r.status !== "encerrado")))
      .catch(() => {});
  }, []);

  const m2 = parseFloat(String(metragem).replace(",", ".")) || 0;
  const preco = parseFloat(String(precoStr).replace(",", ".")) || 0;
  const total = m2 * preco;

  const setFerQtd = (id, qtd) => {
    setFerragensQtd((prev) => ({ ...prev, [id]: qtd }));
  };
  const setMadQtd = (id, qtd) => {
    setMadeirasQtd((prev) => ({ ...prev, [id]: qtd }));
  };
  // Helper: render lista agrupada por categoria
  const groupedRows = (items, qtdMap, catOrder, catLabels, rowFn) => {
    if (!items || items.length === 0) return null;
    const groups = {};
    for (const it of items) { const cat = it.categoria || "outros"; (groups[cat] = groups[cat] || []).push(it); }
    const cats = catOrder.filter((cat) => groups[cat]).concat(Object.keys(groups).filter((cat) => !catOrder.includes(cat)));
    return cats.map((cat) =>
      c("div", { key: cat, style: { marginBottom: 10 } },
        c("div", {
          style: {
            fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)",
            textTransform: "uppercase", letterSpacing: "0.06em",
            padding: "6px 4px 4px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 4,
          },
        }, catLabels[cat] || cat),
        c("div", null, ...groups[cat].map(rowFn))
      )
    );
  };

  const adicionarNovaFerragem = async () => {
    const nome = novaFerNome.trim();
    if (!nome) return;
    try {
      const ordem = (ferragens.reduce((m, f) => Math.max(m, f.ordem || 0), 0) || 0) + 1;
      const inserted = await sbInsert("marcenaria_ferragens", {
        nome, fornecedor: novaFerForn.trim() || null, categoria: "outros", ordem, ativo: true,
      });
      const novo = inserted && inserted[0];
      if (novo) {
        setFerragens((prev) => [...prev, novo]);
        setFerQtd(novo.id, 1);
      }
      setNovaFerNome(""); setNovaFerForn(""); setShowAddFer(false);
    } catch (err) {
      setMsg({ kind: "err", text: "Erro ao adicionar ferragem: " + err.message });
    }
  };

  const buildDescFinal = () => {
    const p = ["Marcenaria Personalizada"];
    if (descricao.trim()) p.push("— " + descricao.trim());
    if (especieExt) p.push("/ " + especieExt);
    if (acabExt) p.push(acabExt);
    return p.join(" ");
  };

  const salvar = async () => {
    setMsg(null);
    if (!descricao.trim()) return setMsg({ kind: "err", text: "Preencha a descrição." });
    if (m2 <= 0) return setMsg({ kind: "err", text: "Metragem deve ser maior que zero." });
    if (preco <= 0) return setMsg({ kind: "err", text: "Preço por m² deve ser maior que zero." });
    if (!simulacaoId) return setMsg({ kind: "err", text: "Selecione uma simulação." });
    setSaving(true);
    try {
      // Ferragens com qtd > 0
      const ferList = Object.entries(ferragensQtd)
        .filter(([_id, qtd]) => Number(qtd) > 0)
        .map(([id, qtd]) => {
          const f = ferragens.find((x) => x.id === id);
          return f ? { id: f.id, nome: f.nome, categoria: f.categoria, qtd: Number(qtd) } : null;
        }).filter(Boolean);
      // Madeiras (MDF/Compensado) com qtd > 0 — referência, não impacta preço
      const madList = Object.entries(madeirasQtd)
        .filter(([_id, qtd]) => Number(qtd) > 0)
        .map(([id, qtd]) => {
          const m = madeiras.find((x) => x.id === id);
          return m ? { id: m.id, nome: m.nome, unidade: m.unidade, qtd: Number(qtd) } : null;
        }).filter(Boolean);
      const exist = await sbGet(
        "simulacao_itens?select=ordem&simulacao_id=eq." + simulacaoId + "&order=ordem.desc&limit=1",
      ).catch(() => []);
      const nextOrdem = ((exist && exist[0] && Number(exist[0].ordem)) || 0) + 1;
      // Categoria: "MARCENARIA||<ESPÉCIE EXT> <ACAB EXT>"
      const subCat = [especieExt, acabExt].filter(Boolean).join(" ").toUpperCase().trim();
      const categoria = ["MARCENARIA", subCat || "PERSONALIZADA"].join("||");
      const m2Txt = m2.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const acabIntTxt = (especieInt || acabInt)
        ? "acabamento interno: lamina " + [especieInt, acabInt].filter(Boolean).join(" ").toLowerCase() + "."
        : "";
      const acabExtTxt = (especieExt || acabExt)
        ? "acabamento externo: lamina " + [especieExt, acabExt].filter(Boolean).join(" ").toLowerCase() + "."
        : "";
      const acabFmt = [acabIntTxt, acabExtTxt].filter(Boolean).join("\n");
      const ferTxt = ferList.length > 0
        ? "(inclui " + ferList.map(f => `${f.qtd} ${f.nome}`).join(" + ") + ") "
        : "";
      const medidasTxt = medidas.trim() ? "Medidas (LXHXP) " + medidas.trim() + " - " : "";
      const linhaFinal = ferTxt + medidasTxt + "Metragem total " + m2Txt + "m²";
      const descritivo = [
        ambiente.trim(),
        descricao.trim(),
        acabFmt,
        linhaFinal,
      ].filter(Boolean).join("\n");

      // Item principal
      await sbInsert("simulacao_itens", {
        simulacao_id: simulacaoId,
        categoria, descritivo, valor: total, ordem: nextOrdem, desconto_perc: 0,
        meta: {
          tipo: "marcenaria_personalizada", descricao_livre: descricao.trim(),
          ambiente: ambiente.trim(), medidas: medidas.trim(),
          especie: especieExt, acabamento: acabExt, especieInt, acabInt, especieExt, acabExt, metragem_m2: m2, preco_por_m2: preco,
          ferragens: ferList, madeiras: madList,
        },
      });

      // Item de OBSERVAÇÃO: aparece na linha "OBSERVAÇÃO" do PDF com:
      //   - quantidade do móvel personalizado + acabamento + metragem total
      //   - lista das madeiras (MDF/compensado) usadas
      // Não repete o ambiente (já está no item principal)
      const obsLines = [];
      const acabNome = [especieExt, acabExt].filter(Boolean).join(" ") || "Personalizada";
      obsLines.push(`01 móvel personalizado — Lamina ${acabNome} — Metragem total ${m2Txt}m²`);
      if (madList.length > 0) {
        obsLines.push("Madeiras: " + madList.map(m => `${m.qtd}${m.unidade || "m²"} ${m.nome}`).join(" + "));
      }
      const existObs = await sbGet(
        "simulacao_itens?select=id,descritivo&simulacao_id=eq." + simulacaoId + "&categoria=eq.OBS&limit=1",
      ).catch(() => []);
      if (existObs && existObs[0]) {
        const newObsDesc = (existObs[0].descritivo || "").trim() + "\n" + obsLines.join("\n");
        await fetch(SB_URL + "/rest/v1/simulacao_itens?id=eq." + existObs[0].id, {
          method: "PATCH",
          headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ descritivo: newObsDesc }),
        });
      } else {
        await sbInsert("simulacao_itens", {
          simulacao_id: simulacaoId,
          categoria: "OBS",
          descritivo: obsLines.join("\n"),
          valor: 0,
          ordem: nextOrdem + 1,
          desconto_perc: 0,
        });
      }

      setMsg({ kind: "ok", text: "✓ Item adicionado à simulação." });
      setDescricao(""); setEspecieInt(""); setAcabInt(""); setEspecieExt(""); setAcabExt("");
      setMetragem(""); setMedidas(""); setAmbiente("");
      setFerragensQtd({}); setMadeirasQtd({});
    } catch (err) {
      setMsg({ kind: "err", text: "Erro ao salvar: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  // ─── UI (React.createElement) ───
  const fieldGroup = (label, child) =>
    c("div", { key: label }, c("label", { style: S.label }, label), child);

  const msgBox = msg ? c("div", {
    key: "msg",
    style: {
      padding: "10px 14px", borderRadius: 8, fontSize: 12, marginBottom: 12,
      background: msg.kind === "err" ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
      color: msg.kind === "err" ? "#ef4444" : "#22c55e",
      border: "1px solid " + (msg.kind === "err" ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"),
    },
  }, msg.text) : null;

  const simSelect = c("div", { key: "sim", style: S.card },
    c("label", { style: S.label }, "Simulação onde adicionar o item *"),
    c("select", {
      value: simulacaoId,
      onChange: (e) => setSimulacaoId(e.target.value),
      style: S.field,
    },
      c("option", { value: "", key: "_" }, "Selecione…"),
      ...simulacoes.map((s) => c("option", { key: s.id, value: s.id },
        "#" + (s.numero || "?") + " · " + (s.cliente || "Sem cliente")
        + (s.vendedor ? " (" + s.vendedor + ")" : ""),
      )),
    ),
    simulacoes.length === 0 && c("div", {
      key: "h",
      style: { fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 6 },
    }, "Crie uma simulação na aba 'Simulação' antes."),
  );

  const ambBlock = c("div", { key: "amb", style: S.card },
    c("label", { style: S.label }, "Ambiente / Vista (ex: \"Copa - vista 01 e 03\")"),
    c("input", {
      value: ambiente, onChange: (e) => setAmbiente(e.target.value),
      placeholder: "Ex: Cozinha - vista 03",
      style: S.field,
    }),
  );

  const descBlock = c("div", { key: "d", style: S.card },
    c("label", { style: S.label }, "Descrição do item personalizado *"),
    c("textarea", {
      rows: 5, value: descricao,
      onChange: (e) => setDescricao(e.target.value),
      placeholder: "Ex: 01 - Gabinete em \"L\" com 07 portas de abrir, 04 prateleiras (puxador cava).\n01 - Armário torre quente com 02 gavetas, 02 nichos com mascara…",
      style: S.textarea,
    }),
  );

  const medidasBlock = c("div", { key: "med", style: S.card },
    c("label", { style: S.label }, "Medidas (LxHxP) — formato: 4,88 x 2,60 x 0,58"),
    c("input", {
      value: medidas, onChange: (e) => setMedidas(e.target.value),
      placeholder: "Ex: 4,88 x 2,60 x 0,58",
      style: S.field,
    }),
  );

  const _selOpts = (lst) => [c("option", { value: "", key: "_" }, "—"), ...lst.map((s) => c("option", { key: s, value: s }, s))];
  const _sectionTitle = (txt) => c("div", { style: { fontSize: 12, fontWeight: 700, color: "#B8AA9A", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 } }, txt);
  const acabBlock = c("div", { key: "a" },
    c("div", { style: S.card },
      _sectionTitle("Acabamento Interno"),
      c("div", { style: S.row2 },
        fieldGroup("Espécie da madeira", c("select", {
          value: especieInt, onChange: (e) => setEspecieInt(e.target.value), style: S.field,
        }, ..._selOpts(ESPECIES))),
        fieldGroup("Acabamento / cor", c("select", {
          value: acabInt, onChange: (e) => setAcabInt(e.target.value), style: S.field,
        }, ..._selOpts(ACABAMENTOS))),
      ),
    ),
    c("div", { style: S.card },
      _sectionTitle("Acabamento Externo"),
      c("div", { style: S.row2 },
        fieldGroup("Espécie da madeira", c("select", {
          value: especieExt, onChange: (e) => setEspecieExt(e.target.value), style: S.field,
        }, ..._selOpts(ESPECIES))),
        fieldGroup("Acabamento / cor", c("select", {
          value: acabExt, onChange: (e) => setAcabExt(e.target.value), style: S.field,
        }, ..._selOpts(ACABAMENTOS))),
      ),
    ),
  );

  const calcBlock = c("div", { key: "c", style: S.card },
    c("div", { style: S.row2 },
      fieldGroup("Metragem (m²) *", c("input", {
        type: "number", step: 0.5, min: 0, value: metragem,
        onChange: (e) => setMetragem(e.target.value),
        placeholder: "Ex: 12,5", style: S.field,
      })),
      fieldGroup("Preço por m² (R$) *",
        c(h.Fragment, null,
          c("input", {
            type: "number", step: 50, min: 0, value: precoStr,
            onChange: (e) => setPrecoStr(e.target.value),
            placeholder: String(PRECO_DEFAULT), style: S.field,
          }),
          c("div", { style: { fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4 } },
            "Default R$ 5.200/m². Editável."),
        ),
      ),
    ),
    total > 0 && c("div", { style: { ...S.totalBox, marginTop: 16 } },
      c("div", { style: { fontSize: 11, color: "rgba(255,255,255,0.5)" } }, "Total estimado"),
      c("div", { style: S.totalNum }, fmtBRL(total)),
      c("div", { style: { fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 } },
        fmtBRL(preco) + "/m² × " + m2.toLocaleString("pt-BR") + " m²"),
    ),
  );

  // Linha de ferragem com input de quantidade
  const ferRow = (f) => {
    const qtd = ferragensQtd[f.id] || 0;
    const sel = qtd > 0;
    return c("div", {
      key: f.id,
      style: {
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 10px", marginBottom: 4, borderRadius: 6,
        background: sel ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)",
        border: "1px solid " + (sel ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"),
      },
    },
      c("input", {
        type: "number", min: 0, step: 1, value: qtd || "",
        onChange: (e) => setFerQtd(f.id, parseInt(e.target.value || "0", 10)),
        placeholder: "0",
        style: {
          width: 56, background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 6, padding: "5px 8px", color: "#fff", fontSize: 13, textAlign: "center",
        },
      }),
      c("span", { style: { flex: 1, fontSize: 12, color: sel ? "#fff" : "rgba(255,255,255,0.7)" } },
        f.nome + (f.fornecedor ? " · " + f.fornecedor : "")),
    );
  };

  const totalFer = Object.values(ferragensQtd).reduce((s, q) => s + (Number(q) > 0 ? 1 : 0), 0);

  const ferBlock = c("div", { key: "f", style: S.card },
    c("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } },
      c("label", { style: { ...S.label, marginBottom: 0 } }, "Ferragens (referência — não impacta preço) — preencha a quantidade"),
      c("button", {
        type: "button",
        onClick: () => setShowAddFer((v) => !v),
        style: {
          padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)",
          background: "transparent", color: "#22c55e", fontSize: 11, cursor: "pointer", fontWeight: 600,
        },
      }, showAddFer ? "✕ Cancelar" : "+ Nova ferragem"),
    ),
    showAddFer && c("div", {
      style: {
        display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12,
        padding: 12, background: "rgba(34,197,94,0.05)", borderRadius: 8, border: "1px solid rgba(34,197,94,0.2)", boxSizing: "border-box", overflow: "hidden",
      },
    },
      c("input", {
        value: novaFerNome, onChange: (e) => setNovaFerNome(e.target.value),
        placeholder: "Nome da ferragem nova", style: { ...S.field, flex: "1 1 100%", boxSizing: "border-box", minWidth: 0 },
      }),
      c("input", {
        value: novaFerForn, onChange: (e) => setNovaFerForn(e.target.value),
        placeholder: "Fornecedor (opcional)", style: { ...S.field, flex: "1 1 120px", boxSizing: "border-box", minWidth: 0 },
      }),
      c("button", {
        type: "button", onClick: adicionarNovaFerragem,
        disabled: !novaFerNome.trim(),
        style: { ...S.btnPrim, opacity: !novaFerNome.trim() ? 0.5 : 1, padding: "10px 14px", fontSize: 12, flex: "1 1 100%", boxSizing: "border-box", marginTop: 4 },
      }, "Salvar"),
    ),
    loadingFer
      ? c("div", { style: { fontSize: 12, color: "rgba(255,255,255,0.5)" } }, "Carregando…")
      : c("div", { style: { maxHeight: 340, overflowY: "auto" } },
          ...(groupedRows(ferragens, ferragensQtd, FER_CAT_ORDER, FER_CAT_LABELS, ferRow) || [])),
    totalFer > 0 && c("div", {
      style: { fontSize: 11, color: "#22c55e", marginTop: 8 },
    }, totalFer + " ferragem" + (totalFer > 1 ? "s" : "") + " selecionada" + (totalFer > 1 ? "s" : "")),
  );

  // Bloco de Madeiras (MDF / Compensado / Casquinha) — referência, não impacta preço
  const madRow = (m) => {
    const qtd = madeirasQtd[m.id] || 0;
    const sel = Number(qtd) > 0;
    return c("div", {
      key: m.id,
      style: {
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 10px", marginBottom: 4, borderRadius: 6,
        background: sel ? "rgba(184,170,154,0.12)" : "rgba(255,255,255,0.03)",
        border: "1px solid " + (sel ? "rgba(184,170,154,0.4)" : "rgba(255,255,255,0.08)"),
      },
    },
      c("input", {
        type: "number", min: 0, step: 0.5, value: qtd || "",
        onChange: (e) => setMadQtd(m.id, parseFloat(String(e.target.value || "0").replace(",", ".")) || 0),
        placeholder: "0",
        style: {
          width: 70, background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 6, padding: "5px 8px", color: "#fff", fontSize: 13, textAlign: "center",
        },
      }),
      c("span", { style: { color: "rgba(255,255,255,0.5)", fontSize: 11 } }, m.unidade || "M²"),
      c("span", { style: { flex: 1, fontSize: 12, color: sel ? "#fff" : "rgba(255,255,255,0.7)" } }, m.nome),
    );
  };
  const totalMad = Object.values(madeirasQtd).reduce((s, q) => s + (Number(q) > 0 ? 1 : 0), 0);
  const madBlock = c("div", { key: "mad", style: S.card },
    c("label", { style: S.label }, "MDF / Compensado (referência — não impacta preço) — preencha a metragem"),
    madeiras.length === 0
      ? c("div", { style: { fontSize: 12, color: "rgba(255,255,255,0.5)" } }, "Carregando lista de materiais…")
      : c("div", { style: { maxHeight: 380, overflowY: "auto" } },
          ...(groupedRows(madeiras, madeirasQtd, MAD_CAT_ORDER, MAD_CAT_LABELS, madRow) || [])),
    totalMad > 0 && c("div", {
      style: { fontSize: 11, color: "#B8AA9A", marginTop: 8 },
    }, totalMad + " material" + (totalMad > 1 ? "is" : "") + " selecionado" + (totalMad > 1 ? "s" : "")),
  );

  const btn = c("div", {
    key: "btn",
    style: { display: "flex", gap: 10, justifyContent: "flex-end" },
  },
    c("button", {
      onClick: salvar,
      disabled: saving || total <= 0 || !descricao.trim() || !simulacaoId,
      style: { ...S.btnPrim, opacity: (saving || total <= 0 || !descricao.trim() || !simulacaoId) ? 0.5 : 1 },
    }, saving ? "Salvando…" : "Adicionar à Simulação"),
  );

  return c("div", { style: S.page },
    c("h1", { style: S.h1 }, "Marcenaria Personalizada"),
    c("p", { style: S.sub }, "Item personalizado fora da grade — descrição livre + acabamento + metragem × preço por m²."),
    msgBox, simSelect, ambBlock, descBlock, acabBlock, medidasBlock, calcBlock, ferBlock, madBlock, btn,
  );
}

export { MarcenariaPersonalizadaTab as M };
