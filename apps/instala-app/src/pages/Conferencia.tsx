import { useEffect, useState, useCallback } from "react";
import { Camera, ClipboardCheck, RefreshCw } from "lucide-react";
import { sb } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme-context";
import { Screen } from "../app/components/Screen";
import { submitOrQueue, ServerError, GESTAO_API, type QueuedFile } from "../lib/offline";
import { DitadoBtn } from "../app/components/Ditado";
import { EnderecoAcoes } from "../app/components/EnderecoAcoes";

type Obra = { card_id: string; obra_code: string | null; cliente_nome: string };
type ObraInfo = { cliente: string | null; obra_code: string | null; endereco: string | null; numero_proposta: string | number | null };
type Conf = {
  id: string; card_id: string; volume: number; status: string;
  obs: string | null; item_nome: string | null; fiscal_nome: string | null; created_at: string;
};
type Vol = {
  status: "ok" | "avaria" | "falta"; foto: File | null; obs: string;
  item_id: string | null; item_nome: string | null; ambiente: string | null;
  tipo: "produto" | "insumo" | "volume";
};

const ST = [
  { v: "ok" as const,     l: "OK",     c: "#34D399" },
  { v: "avaria" as const, l: "AVARIA", c: "#FBBF24" },
  { v: "falta" as const,  l: "FALTA",  c: "#ef4444" },
];

function codeLimpo(code: string | null): string | null {
  const c = (code || "").trim();
  // obra_code às vezes vem sujo (UUID ou endereço inteiro) — só mostra se parece código real
  return /^[A-Z]{2,6}-?\d{2,}$/i.test(c) ? c : null;
}

function labelItem(it: any): string {
  const cat = String(it?.meta?.categoria_raiz || (it?.categoria ?? "").split("||")[0] || "").trim();
  const prod = String(it?.meta?.produto_header || (it?.descritivo ?? "").split("\n")[0] || "").trim();
  return [it?.ordem, cat, prod].filter(Boolean).join(" · ") || "Item";
}

export function Conferencia({ slug }: { slug: string }) {
  const { prestador } = useAuth();
  const { T } = useTheme();
  const [obras, setObras] = useState<Obra[]>([]);
  const [lista, setLista] = useState<Conf[]>([]);
  const [cardId, setCardId] = useState("");
  const [busca, setBusca] = useState("");
  const [qtd, setQtd] = useState("");
  const [vols, setVols] = useState<Vol[]>([]);
  const [obraInfo, setObraInfo] = useState<ObraInfo | null>(null);
  const [modoItens, setModoItens] = useState(false);
  const [loadingItens, setLoadingItens] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!prestador) return;
    setLoading(true);
    const [vObras, vList] = await Promise.all([
      sb.from("vw_instala_minhas_obras")
        .select("card_id,obra_code,cliente_nome")
        .eq("prestador_id", prestador.id),
      sb.from("instala_conferencias")
        .select("id,card_id,volume,status,obs,item_nome,fiscal_nome,created_at")
        .eq("prestador_id", prestador.id)
        .order("created_at", { ascending: false }).limit(40),
    ]);
    const seen = new Set<string>();
    const os: Obra[] = [];
    for (const o of (vObras.data as Obra[]) ?? []) {
      if (!seen.has(o.card_id)) { seen.add(o.card_id); os.push(o); }
    }
    setObras(os);
    setLista((vList.data as Conf[]) ?? []);
    setLoading(false);
  }, [prestador]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    setVols([]); setQtd(""); setModoItens(false); setObraInfo(null); setErr(null); setOk(null);
    if (!cardId) return;
    let vivo = true;
    setLoadingItens(true);
    fetch(`${GESTAO_API}/api/instala/conferencia-lista/${cardId}`)
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j) => {
        if (!vivo) return;
        if (j?.obra) setObraInfo(j.obra as ObraInfo);
        const its = (j?.itens ?? []).filter((it: any) => !String(it?.meta?.categoria_raiz || it?.categoria || "").toUpperCase().includes("INSUMO"));
        const rows: Vol[] = its.map((it: any) => ({
          status: "ok" as const, foto: null, obs: "",
          item_id: String(it.id), item_nome: labelItem(it),
          ambiente: it.ambiente ? String(it.ambiente) : null,
          tipo: "produto" as const,
        }));
        for (const ins of j?.insumos ?? []) {
          rows.push({
            status: "ok", foto: null, obs: "",
            item_id: `insumo:${ins.codigo ?? ins.descricao}`,
            item_nome: `${ins.descricao} · ${ins.qtd} ${(ins.und || "UND").toUpperCase()}`,
            ambiente: null, tipo: "insumo",
          });
        }
        if (rows.length > 0) { setModoItens(true); setVols(rows); }
        setLoadingItens(false);
      });
    return () => { vivo = false; };
  }, [cardId]);

  function aplicarQtd(v: string) {
    setQtd(v);
    const n = Math.max(0, Math.min(60, parseInt(v || "0", 10) || 0));
    setVols((old) => Array.from({ length: n }, (_, i) =>
      old[i] ?? { status: "ok", foto: null, obs: "", item_id: null, item_nome: null, ambiente: null, tipo: "volume" }));
  }

  function setVol(i: number, patch: Partial<Vol>) {
    setVols((old) => old.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  }

  async function enviar() {
    if (busy || !prestador) return;
    if (!cardId) { setErr("Escolha a obra"); return; }
    if (vols.length === 0) { setErr(modoItens ? "Nenhum item pra conferir" : "Informe quantos volumes chegaram"); return; }
    const semFoto = vols.findIndex((v) => v.status !== "ok" && !v.foto);
    if (semFoto >= 0) {
      setErr(`${vols[semFoto].item_nome ?? `Volume ${semFoto + 1}`}: foto é obrigatória pra avaria/falta`);
      return;
    }
    setBusy(true); setErr(null); setOk(null);
    try {
      const client_key = crypto.randomUUID();
      const files: QueuedFile[] = [];
      vols.forEach((v, i) => {
        if (v.foto) {
          const ext = v.foto.name.split(".").pop()?.toLowerCase() ?? "jpg";
          files.push({
            field: `volumes.${i}.foto_url`, blob: v.foto,
            contentType: v.foto.type || "image/jpeg",
            bucketPath: `instala/conferencia/${cardId}/${client_key}-v${i + 1}.${ext}`,
          });
        }
      });
      const res = await submitOrQueue({
        client_key, endpoint: "/api/instala/conferencia", files,
        label: "Conferência de material",
        body: {
          card_id: cardId, prestador_id: prestador.id, prestador_nome: prestador.nome,
          volumes: vols.map((v, i) => ({
            volume: i + 1, status: v.status, foto_url: null, obs: v.obs.trim() || null,
            item_id: v.item_id, item_nome: v.item_nome,
          })),
        },
      });
      const problemas = vols.filter((v) => v.status !== "ok").length;
      setCardId(""); setQtd(""); setVols([]); setModoItens(false);
      setOk(res === "queued"
        ? "Sem sinal agora: salvo no aparelho · enviando quando pegar sinal."
        : problemas > 0
          ? `Conferência registrada. ${problemas} ${problemas === 1 ? "item com problema virou" : "itens com problema viraram"} ocorrência automática.`
          : "Conferência registrada. Tudo OK.");
      if (res === "sent") reload();
    } catch (e: any) {
      setErr(e instanceof ServerError ? e.message : (e?.message ?? "Falha ao enviar a conferência"));
    } finally {
      setBusy(false);
    }
  }

  const nomeObra = (id: string) => {
    const o = obras.find((x) => x.card_id === id);
    return o ? [codeLimpo(o.obra_code), o.cliente_nome].filter(Boolean).join(" · ") : "-";
  };

  const obrasFiltradas = busca.trim()
    ? obras.filter((o) => `${o.cliente_nome} ${o.obra_code ?? ""}`.toLowerCase().includes(busca.trim().toLowerCase()))
    : obras;

  return (
    <Screen slug={slug} titulo="Conferência de material" subtitulo="confira item a item o que chegou" voltar={`/${slug}/mais`}
      action={<button onClick={reload} title="Atualizar" style={iconBtn(T)}><RefreshCw size={14} className={loading ? "spin" : ""} /></button>}>
      <div style={{ padding: "14px 16px", background: T.cardBg, border: `1px solid ${T.border}`, marginBottom: 20 }}>
        {!cardId ? (
          <>
            <p style={{ fontSize: 9, letterSpacing: "0.18em", color: T.textMuted, marginBottom: 10 }}>QUAL OBRA?</p>
            {obras.length === 0 && !loading && (
              <div style={{ fontSize: 11, color: T.textMuted }}>Nenhuma obra vinculada a você.</div>
            )}
            {obras.length > 3 && (
              <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder="🔎 Buscar obra pelo nome…"
                style={{ ...inp(T), marginBottom: 10 }} />
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {obrasFiltradas.map((o) => (
                <button key={o.card_id} onClick={() => { setCardId(o.card_id); setBusca(""); }}
                  style={{
                    textAlign: "left", padding: "14px", cursor: "pointer", background: "transparent",
                    border: `1px solid ${T.border}`, color: T.textPrimary, width: "100%", boxSizing: "border-box",
                  }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.35, wordBreak: "break-word" }}>{o.cliente_nome}</div>
                  {codeLimpo(o.obra_code) && (
                    <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3, letterSpacing: "0.08em" }}>
                      {codeLimpo(o.obra_code)}
                    </div>
                  )}
                </button>
              ))}
              {obras.length > 0 && obrasFiltradas.length === 0 && (
                <div style={{ fontSize: 11, color: T.textMuted, padding: "10px 2px" }}>Nenhuma obra com esse nome.</div>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 9, letterSpacing: "0.18em", color: T.textMuted, marginBottom: 4 }}>OBRA</p>
              <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.35 }}>{nomeObra(cardId)}</div>
            </div>
            <button onClick={() => setCardId("")}
              style={{
                flexShrink: 0, padding: "8px 12px", cursor: "pointer", background: "transparent",
                border: `1px dashed ${T.border}`, color: T.textSecondary, fontSize: 10, letterSpacing: "0.12em",
              }}>
              TROCAR
            </button>
          </div>
        )}

        {loadingItens && (
          <div style={{ marginTop: 12, padding: "12px", fontSize: 11, color: T.textMuted, textAlign: "center" }}>
            Buscando a lista de material da obra…
          </div>
        )}

        {cardId && !loadingItens && !modoItens && (
          <>
            <div style={{ marginTop: 10, fontSize: 10.5, color: T.textMuted, lineHeight: 1.5 }}>
              Essa obra ainda não tem lista de material no gestão. Confira por volume.
            </div>
            <input
              type="number" inputMode="numeric" min={1} max={60}
              value={qtd} onChange={(e) => aplicarQtd(e.target.value)}
              placeholder="Quantos volumes chegaram?"
              style={{ ...inp(T), marginTop: 8 }}
            />
          </>
        )}

        {modoItens && obraInfo && (
          <div style={{ marginTop: 12, padding: "12px 14px", background: T.statBg, border: `2px solid ${T.textPrimary}` }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.textPrimary, lineHeight: 1.35 }}>
              {[obraInfo.obra_code, obraInfo.cliente].filter(Boolean).join(" · ") || "Obra"}
            </div>
            {obraInfo.endereco && <div style={{ fontSize: 10.5, color: T.textSecondary, marginTop: 4, lineHeight: 1.4 }}>{obraInfo.endereco}</div>}
            {/* Ações Maps/WhatsApp/Copiar do endereço da obra */}
            {obraInfo.endereco && <EnderecoAcoes endereco={obraInfo.endereco} T={T} />}
            {obraInfo.numero_proposta != null && <div style={{ fontSize: 9.5, letterSpacing: "0.1em", color: T.textMuted, marginTop: 4 }}>PROPOSTA {obraInfo.numero_proposta}</div>}
          </div>
        )}

        {vols.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {vols.map((v, i) => {
              const nTipo = vols.filter((x) => x.tipo === v.tipo).length;
              const secao = (i === 0 || vols[i - 1].tipo !== v.tipo)
                ? (v.tipo === "produto" ? `MATERIAL DA OBRA (${nTipo})`
                  : v.tipo === "insumo" ? `INSUMOS QUE VÃO PRA OBRA (${nTipo})` : null)
                : null;
              return (
              <div key={v.item_id ?? i}>
              {secao && (
                <div style={{ fontSize: 9.5, letterSpacing: "0.16em", fontWeight: 700, color: T.textMuted, margin: "8px 0 8px 2px" }}>
                  {secao}
                </div>
              )}
              <div style={{ padding: "10px 12px", background: T.statBg, border: `1px solid ${T.border}` }}>
                {v.item_nome ? (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11.5, color: T.textPrimary, lineHeight: 1.4 }}>{v.item_nome}</div>
                    {v.ambiente && <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{v.ambiente}</div>}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: T.textPrimary }}>VOL {i + 1}</div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {ST.map((s) => (
                    <button key={s.v} onClick={() => setVol(i, { status: s.v })} style={{
                      flex: 1, padding: "7px 4px", fontSize: 9.5, letterSpacing: "0.08em", fontWeight: 600, cursor: "pointer",
                      background: v.status === s.v ? s.c : "transparent",
                      color: v.status === s.v ? "#0a0a0a" : T.textSecondary,
                      border: `1px solid ${v.status === s.v ? s.c : T.border}`,
                    }}>{s.l}</button>
                  ))}
                </div>
                {v.status !== "ok" && (
                  <div style={{ marginTop: 8 }}>
                    <label style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      padding: "9px 12px", cursor: "pointer",
                      border: `1px dashed ${v.foto ? "#34D399" : "#ef4444"}`,
                      color: v.foto ? "#34D399" : "#ef4444",
                      fontSize: 10, letterSpacing: "0.12em", fontWeight: 600,
                    }}>
                      <Camera size={13} /> {v.foto ? "FOTO ANEXADA ✓" : "FOTO OBRIGATÓRIA"}
                      <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                        onChange={(e) => setVol(i, { foto: e.target.files?.[0] ?? null })} />
                    </label>
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <input
                        value={v.obs} onChange={(e) => setVol(i, { obs: e.target.value })}
                        placeholder="O que aconteceu com esse material?"
                        style={inp(T)}
                      />
                      <DitadoBtn onText={(t) => setVols((old) => old.map((x, j) => (j === i ? { ...x, obs: (x.obs ? x.obs + " " : "") + t } : x)))} />
                    </div>
                  </div>
                )}
              </div>
              </div>
            );})}
          </div>
        )}

        {err && <div style={{ margin: "10px 0 0", fontSize: 11, color: "#ef4444" }}>{err}</div>}
        {ok && <div style={{ margin: "10px 0 0", fontSize: 11, color: "#34D399" }}>{ok}</div>}
        {vols.length > 0 && (
          <button onClick={enviar} disabled={busy} style={{
            width: "100%", marginTop: 12, padding: "13px 16px", background: T.textPrimary, color: T.bg,
            border: "none", fontSize: 11, letterSpacing: "0.16em", fontWeight: 700,
            cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
          }}>
            {busy ? "ENVIANDO…" : "REGISTRAR CONFERÊNCIA"}
          </button>
        )}
      </div>

      <p style={{ fontSize: 9, letterSpacing: "0.18em", color: T.textMuted, marginBottom: 10 }}>ÚLTIMAS CONFERÊNCIAS</p>
      {lista.length === 0 ? (
        <div style={{ padding: "30px 18px", textAlign: "center", color: T.textMuted, border: `1px dashed ${T.border}`, fontSize: 12 }}>
          Nenhuma conferência registrada.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {lista.map((c) => {
            const st = ST.find((s) => s.v === c.status) ?? ST[0];
            return (
              <div key={c.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", background: T.cardBg, border: `1px solid ${T.border}`,
              }}>
                <ClipboardCheck size={13} style={{ color: st.c, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.item_nome ?? `VOL ${c.volume}`} · {nomeObra(c.card_id)}{c.obs ? ` · ${c.obs}` : ""}
                </span>
                <span style={{ fontSize: 9, letterSpacing: "0.1em", fontWeight: 700, color: st.c }}>{st.l}</span>
                <span style={{ fontSize: 9, color: T.textMuted, whiteSpace: "nowrap" }}>
                  {new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <style>{`.spin { animation: r 1s linear infinite; } @keyframes r { to { transform: rotate(360deg); } }`}</style>
    </Screen>
  );
}

const inp = (T: any): React.CSSProperties => ({
  width: "100%", boxSizing: "border-box", padding: "11px 12px",
  background: T.inputBg, border: `1px solid ${T.border}`,
  color: T.textPrimary, fontSize: 12, outline: "none",
});

const iconBtn = (T: any): React.CSSProperties => ({
  background: T.statBg, border: `1px solid ${T.border}`,
  color: T.textSecondary, padding: 9, cursor: "pointer", borderRadius: 999,
  display: "flex", alignItems: "center",
});
