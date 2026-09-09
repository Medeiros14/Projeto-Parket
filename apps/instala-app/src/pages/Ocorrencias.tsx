import { useEffect, useState, useCallback, useRef } from "react";
import { Camera, AlertTriangle, RefreshCw, Volume2 } from "lucide-react";
import { sb } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme-context";
import { Screen } from "../app/components/Screen";
import { AudioRec } from "../app/components/AudioRec";
import { CameraCapture } from "../app/components/CameraCapture";
import { submitOrQueue, ServerError, type QueuedFile } from "../lib/offline";

const TIPOS = [
  { v: "material",  l: "Material" },
  { v: "execucao",  l: "Execução" },
  { v: "cliente",   l: "Cliente" },
  { v: "seguranca", l: "Segurança" },
  { v: "outro",     l: "Outro" },
];

type Obra = { card_id: string; obra_code: string | null; cliente_nome: string };
type Ocorrencia = {
  id: string; card_id: string; tipo: string; descricao: string;
  status: string; created_at: string; foto_url: string | null; audio_url: string | null;
};

export function Ocorrencias({ slug }: { slug: string }) {
  const { prestador } = useAuth();
  const { T } = useTheme();
  const [obras, setObras] = useState<Obra[]>([]);
  const [lista, setLista] = useState<Ocorrencia[]>([]);
  const [cardId, setCardId] = useState("");
  const [tipo, setTipo] = useState("material");
  const [descricao, setDescricao] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  // cam: visor de câmera in-app (getUserMedia); o input file vira só fallback de galeria
  const [cam, setCam] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    if (!prestador) return;
    setLoading(true);
    const [vObras, vList] = await Promise.all([
      sb.from("vw_instala_minhas_obras")
        .select("card_id,obra_code,cliente_nome")
        .eq("prestador_id", prestador.id),
      sb.from("instala_ocorrencias")
        .select("id,card_id,tipo,descricao,status,created_at,foto_url,audio_url")
        .eq("prestador_id", prestador.id)
        .order("created_at", { ascending: false }).limit(30),
    ]);
    const seen = new Set<string>();
    const os: Obra[] = [];
    for (const o of (vObras.data as Obra[]) ?? []) {
      if (!seen.has(o.card_id)) { seen.add(o.card_id); os.push(o); }
    }
    setObras(os);
    setLista((vList.data as Ocorrencia[]) ?? []);
    setLoading(false);
  }, [prestador]);

  useEffect(() => { reload(); }, [reload]);

  async function enviar() {
    if (busy || !prestador) return;
    if (!cardId) { setErr("Escolha a obra"); return; }
    if (!descricao.trim()) { setErr("Descreva a ocorrência"); return; }
    setBusy(true); setErr(null); setOk(null);
    try {
      const client_key = crypto.randomUUID();
      const files: QueuedFile[] = [];
      if (foto) {
        const ext = foto.name.split(".").pop()?.toLowerCase() ?? "jpg";
        files.push({
          field: "foto_url", blob: foto, contentType: foto.type || "image/jpeg",
          bucketPath: `instala/ocorrencias/${cardId}/${client_key}.${ext}`,
        });
      }
      if (audio) {
        files.push({
          field: "audio_url", blob: audio, contentType: audio.type || "audio/webm",
          bucketPath: `instala/ocorrencias/${cardId}/${client_key}-audio.webm`,
        });
      }
      const res = await submitOrQueue({
        client_key, endpoint: "/api/instala/ocorrencias", files,
        label: "Ocorrência",
        body: {
          card_id: cardId, prestador_id: prestador.id, prestador_nome: prestador.nome,
          tipo, descricao: descricao.trim(), foto_url: null, audio_url: null,
        },
      });
      setDescricao(""); setFoto(null); setAudio(null);
      setOk(res === "queued"
        ? "Sem sinal agora: salvo no aparelho · enviando quando pegar sinal."
        : "Ocorrência registrada. Fiscal e gestão avisados.");
      if (fotoRef.current) fotoRef.current.value = "";
      if (res === "sent") reload();
    } catch (e: any) {
      setErr(e instanceof ServerError ? e.message : (e?.message ?? "Falha ao enviar a ocorrência"));
    } finally {
      setBusy(false);
    }
  }

  const nomeObra = (id: string) => {
    const o = obras.find((x) => x.card_id === id);
    return o ? `${o.obra_code ?? ""} ${o.cliente_nome}`.trim() : "-";
  };

  return (
    <Screen slug={slug} titulo="Ocorrências" subtitulo="fiscal e gestão são avisados" voltar={`/${slug}/mais`}
      action={<button onClick={reload} title="Atualizar" style={iconBtn(T)}><RefreshCw size={14} className={loading ? "spin" : ""} /></button>}>
      <div style={{ padding: "14px 16px", background: T.cardBg, border: `1px solid ${T.border}`, marginBottom: 20 }}>
        <select value={cardId} onChange={(e) => setCardId(e.target.value)} style={inp(T)}>
          <option value="">Qual obra?</option>
          {obras.map((o) => (
            <option key={o.card_id} value={o.card_id}>{`${o.obra_code ?? ""} ${o.cliente_nome}`.trim()}</option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
          {TIPOS.map((t) => (
            <button key={t.v} onClick={() => setTipo(t.v)} style={{
              padding: "7px 12px", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer",
              background: tipo === t.v ? T.textPrimary : "transparent",
              color: tipo === t.v ? T.bg : T.textSecondary,
              border: `1px solid ${tipo === t.v ? T.textPrimary : T.border}`,
            }}>{t.l.toUpperCase()}</button>
          ))}
        </div>
        <textarea
          value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4}
          placeholder="O que está acontecendo na obra?"
          style={{ ...inp(T), resize: "vertical", fontFamily: "inherit" }}
        />
        <div style={{ marginTop: 10 }}>
          <AudioRec
            onAudio={setAudio}
            onText={(t) => setDescricao((d) => (d ? d.trimEnd() + " " : "") + t)}
          />
        </div>
        {/* Abre o visor de câmera in-app (getUserMedia pede autorização na hora) */}
        <div onClick={() => setCam(true)} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "10px 12px", margin: "10px 0", cursor: "pointer",
          border: `1px dashed ${T.borderHover}`, color: foto ? "#34D399" : T.textSecondary,
          fontSize: 10, letterSpacing: "0.14em", fontWeight: 600,
        }}>
          <Camera size={13} /> {foto ? "FOTO ANEXADA ✓" : "ANEXAR FOTO (OPCIONAL)"}
        </div>
        {/* Input escondido: fallback de galeria acionado de dentro do visor da câmera */}
        <input ref={fotoRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
        {err && <div style={{ marginBottom: 8, fontSize: 11, color: "#ef4444" }}>{err}</div>}
        {ok && <div style={{ marginBottom: 8, fontSize: 11, color: "#34D399" }}>{ok}</div>}
        <button onClick={enviar} disabled={busy} style={{
          width: "100%", padding: "13px 16px", background: T.textPrimary, color: T.bg,
          border: "none", fontSize: 11, letterSpacing: "0.16em", fontWeight: 700,
          cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
        }}>
          {busy ? "ENVIANDO…" : "REGISTRAR OCORRÊNCIA"}
        </button>

        {/* Visor de câmera in-app: foto única anexada à ocorrência */}
        {cam && (
          <CameraCapture
            onFiles={(fs) => { setCam(false); if (fs[0]) setFoto(fs[0]); }}
            onFallback={() => { setCam(false); fotoRef.current?.click(); }}
            onClose={() => setCam(false)}
          />
        )}
      </div>

      <p style={{ fontSize: 9, letterSpacing: "0.18em", color: T.textMuted, marginBottom: 10 }}>SUAS OCORRÊNCIAS</p>
      {lista.length === 0 ? (
        <div style={{ padding: "30px 18px", textAlign: "center", color: T.textMuted, border: `1px dashed ${T.border}`, fontSize: 12 }}>
          Nenhuma ocorrência registrada.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lista.map((o) => (
            <div key={o.id} style={{ padding: "12px 14px", background: T.cardBg, border: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 10, letterSpacing: "0.1em", color: T.textMuted, textTransform: "uppercase" }}>
                  <AlertTriangle size={10} style={{ marginRight: 4 }} />{o.tipo} · {nomeObra(o.card_id)}
                </span>
                <span style={{
                  fontSize: 9, letterSpacing: "0.12em", fontWeight: 600, whiteSpace: "nowrap",
                  color: o.status === "resolvida" ? "#34D399" : "#FBBF24",
                }}>
                  {o.status === "resolvida" ? "RESOLVIDA" : "ABERTA"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: T.textPrimary, lineHeight: 1.5 }}>{o.descricao}</div>
              {o.audio_url && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <Volume2 size={12} style={{ color: T.textMuted, flexShrink: 0 }} />
                  <audio controls preload="none" src={o.audio_url} style={{ width: "100%", height: 32 }} />
                </div>
              )}
              <div style={{ fontSize: 9.5, color: T.textMuted, marginTop: 4 }}>
                {new Date(o.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          ))}
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
