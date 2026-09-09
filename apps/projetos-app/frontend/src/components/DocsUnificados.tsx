import { useEffect, useState } from "react";

/* Documentos unificados — o card é ÚNICO em todos os setores.
   Consome o agregador do gestão, que resolve o card do Trello → gestão →
   kanban → Valoria e junta mapa, contrato assinado, proposta e anexos de
   Valor / Projetos / Executivo / Gestão / Produção num lugar só. */

const API = "https://gestao.parket.works/api/docs-unificados";

type Doc = { name: string; url: string; mime?: string | null; origem?: string };
type Payload = {
  cliente?: string | null;
  mapa?: { print?: string | null; pdf?: Doc | null; draw_url?: string | null };
  contrato?: { id: string; titulo?: string | null; status?: string | null; assinado?: boolean; pdf_url?: string | null } | null;
  proposta?: { sim_id: string; numero?: string | number | null; url: string } | null;
  drive?: { folder_id: string; folder_url?: string | null } | null;
  grupos?: { origem: string; titulo: string; docs: Doc[] }[];
};

const ORIGEM_LABEL: Record<string, string> = {
  valor: "VALOR", projetos: "PROJETOS", executivo: "EXECUTIVO",
  gestao: "GESTÃO", producao: "PRODUÇÃO",
};

export default function DocsUnificados({ id, t }: { id: string; t: any }) {
  const [data, setData] = useState<Payload | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro(null);
    fetch(`${API}/${encodeURIComponent(id)}`)
      .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(j => { if (vivo) setData(j); })
      .catch(e => { if (vivo) setErro(String(e?.message || e)); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [id]);

  const rotulo: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
    color: t.textTertiary,
  };

  const quick: { label: string; url: string; emoji: string }[] = [];
  if (data?.proposta?.url)
    quick.push({ emoji: "📋", label: data.proposta.numero ? `Proposta ${data.proposta.numero}` : "Proposta", url: data.proposta.url });
  if (data?.mapa?.pdf?.url)
    quick.push({ emoji: "🗺", label: "Mapa da obra (PDF)", url: data.mapa.pdf.url });
  if (data?.mapa?.print && !data?.mapa?.pdf?.url)
    quick.push({ emoji: "🗺", label: "Mapa da obra (print)", url: data.mapa.print });
  if (data?.contrato?.pdf_url)
    quick.push({ emoji: "✍️", label: "Contrato assinado (PDF)", url: data.contrato.pdf_url });
  const driveUrl = data?.drive?.folder_url
    || (data?.drive?.folder_id ? `https://drive.google.com/drive/folders/${data.drive.folder_id}` : null);
  if (driveUrl) quick.push({ emoji: "📁", label: "Pasta no Drive", url: driveUrl });

  // O grupo "projetos" vem do próprio Trello deste app — os anexos já
  // aparecem na seção Anexos acima, então não duplica aqui.
  const grupos = (data?.grupos || []).filter(g => g.origem !== "projetos" && g.docs?.length);
  const totalDocs = grupos.reduce((n, g) => n + g.docs.length, 0) + quick.length;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ ...rotulo, marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
        <span>Documentos dos outros setores{totalDocs ? ` (${totalDocs})` : ""}</span>
        <button onClick={() => setAberto(v => !v)}
          style={{ background: "transparent", border: "none", color: t.accent, cursor: "pointer", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", padding: 0 }}>
          {aberto ? "recolher" : "ver"}
        </button>
      </div>
      {carregando && <div style={{ fontSize: 11, color: t.textTertiary }}>Buscando documentos do card nos setores…</div>}
      {erro && <div style={{ fontSize: 11, color: "#EF4444" }}>Não consegui buscar agora ({erro}).</div>}
      {!carregando && !erro && totalDocs === 0 && (
        <div style={{ fontSize: 11, color: t.textTertiary, border: `1px dashed ${t.border1}`, padding: "8px 10px" }}>
          Nenhum documento vinculado ainda — o que for anexado no Valor, Gestão ou Produção aparece aqui automaticamente.
        </div>
      )}
      {!carregando && !erro && aberto && totalDocs > 0 && (
        <div style={{ border: `1px solid ${t.border1}`, background: t.card1 }}>
          {quick.length > 0 && (
            <div style={{ padding: "8px 10px", display: "flex", flexWrap: "wrap", gap: 6, borderBottom: grupos.length ? `1px solid ${t.border1}` : "none" }}>
              {quick.map((q, i) => (
                <a key={i} href={q.url} target="_blank" rel="noreferrer" style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px",
                  background: `${t.accent}1f`, border: `1px solid ${t.accent}55`, color: t.accent,
                  fontSize: 11, fontWeight: 600, textDecoration: "none",
                }}>
                  {q.emoji} {q.label}
                </a>
              ))}
              {data?.contrato && !data.contrato.pdf_url && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", border: `1px solid ${t.border1}`, color: t.textSecondary, fontSize: 11 }}>
                  ✍️ Contrato: {data.contrato.assinado ? "assinado (PDF indisponível)" : (data.contrato.status || "em andamento")}
                </span>
              )}
            </div>
          )}
          {grupos.map(g => (
            <div key={g.origem} style={{ padding: "6px 10px", borderBottom: `1px solid ${t.border1}` }}>
              <div style={{ ...rotulo, fontSize: 8.5, color: t.accent, marginBottom: 4 }}>{g.titulo} · {g.docs.length}</div>
              {g.docs.map((d, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, padding: "4px 0" }}>
                  <span>📄</span>
                  <a href={d.url} target="_blank" rel="noreferrer"
                    style={{ color: t.accent, textDecoration: "none", wordBreak: "break-all", flex: 1 }}>
                    {d.name}
                  </a>
                  <span style={{ ...rotulo, fontSize: 8 }}>{ORIGEM_LABEL[d.origem || g.origem] || (d.origem || g.origem).toUpperCase()}</span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ padding: "5px 10px", fontSize: 9.5, color: t.textTertiary }}>
            Card único: anexos do Valor, Gestão, Produção e daqui aparecem em todos os setores.
          </div>
        </div>
      )}
    </div>
  );
}
