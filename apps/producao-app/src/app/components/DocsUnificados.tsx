/** Documentos unificados — o card é ÚNICO em todos os setores.
 *  Consome o agregador do gestão (docs-unificados), que resolve OP → card →
 *  Valoria → Trello e junta mapa, contrato assinado, proposta e anexos de
 *  Valor / Projetos / Executivo / Gestão / Produção num lugar só. */
import { useEffect, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import {
  Paperclip, ExternalLink, FileText, Map, PenLine, FolderOpen,
  ChevronDown, ChevronRight,
} from "lucide-react";

const API = "https://gestao.parket.works/api/docs-unificados";

type Doc = { name: string; url: string; mime?: string | null; uploaded_at?: string | null; origem?: string };
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

export default function DocsUnificados({ id }: { id: string }) {
  const { t } = useTheme();
  const [data, setData] = useState<Payload | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro(null);
    fetch(`${API}/${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => { if (vivo) setData(j); })
      .catch((e) => { if (vivo) setErro(String(e?.message || e)); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [id]);

  const quick: { label: string; sub?: string; url: string; icon: JSX.Element }[] = [];
  if (data?.proposta?.url)
    quick.push({
      label: data.proposta.numero ? `Proposta ${data.proposta.numero}` : "Proposta",
      sub: "orçamento aprovado", url: data.proposta.url, icon: <FileText size={13} />,
    });
  if (data?.mapa?.pdf?.url)
    quick.push({ label: "Mapa da obra (PDF)", url: data.mapa.pdf.url, icon: <Map size={13} /> });
  if (data?.mapa?.print && !data?.mapa?.pdf?.url)
    quick.push({ label: "Mapa da obra (print)", url: data.mapa.print, icon: <Map size={13} /> });
  if (data?.contrato?.pdf_url)
    quick.push({ label: "Contrato assinado (PDF)", url: data.contrato.pdf_url, icon: <PenLine size={13} /> });
  const driveUrl = data?.drive?.folder_url
    || (data?.drive?.folder_id ? `https://drive.google.com/drive/folders/${data.drive.folder_id}` : null);
  if (driveUrl)
    quick.push({ label: "Pasta no Drive", url: driveUrl, icon: <FolderOpen size={13} /> });

  const grupos = (data?.grupos || []).filter((g) => g.docs?.length);
  const totalDocs = grupos.reduce((n, g) => n + g.docs.length, 0) + quick.length;
  const vazio = !carregando && !erro && totalDocs === 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <label style={{
          display: "block", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.08em", color: t.textSecondary, marginBottom: 0,
        }}>
          Documentos — todos os setores{data?.cliente ? ` · ${data.cliente}` : ""}
        </label>
        <button type="button" onClick={() => setAberto((v) => !v)} style={{
          background: "transparent", color: t.textSecondary, border: `1px solid ${t.border}`,
          padding: "5px 10px", fontSize: 10.5, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 4,
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          {aberto ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {aberto ? "Recolher" : carregando ? "Ver" : `Ver ${totalDocs} documento(s)`}
        </button>
      </div>

      <div style={{ border: `1px solid ${t.border}` }}>
        {carregando && (
          <div style={{ padding: "10px 12px", fontSize: 11.5, color: t.textMuted }}>
            Buscando documentos do card nos setores…
          </div>
        )}
        {erro && (
          <div style={{ padding: "10px 12px", fontSize: 11.5, color: t.warning }}>
            Não consegui buscar os documentos agora ({erro}). Tenta de novo abrindo a OP outra vez.
          </div>
        )}
        {vazio && (
          <div style={{ padding: "10px 12px", fontSize: 11.5, color: t.textMuted }}>
            Nenhum documento vinculado ainda — o que for anexado no Valor, Projetos ou Gestão aparece aqui automaticamente.
          </div>
        )}
        {!carregando && !erro && !aberto && totalDocs > 0 && (
          <div style={{ padding: "10px 12px", fontSize: 11.5, color: t.textSecondary }}>
            {totalDocs} documento(s) do card — clique em Ver pra expandir.
          </div>
        )}
        {!carregando && !erro && aberto && (
          <>
            {quick.length > 0 && (
              <div style={{ padding: "10px 12px", display: "flex", flexWrap: "wrap", gap: 8, borderBottom: grupos.length ? `1px solid ${t.border}` : "none" }}>
                {quick.map((q, i) => (
                  <a key={i} href={q.url} target="_blank" rel="noreferrer" style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
                    border: `1px solid ${t.accent}`, color: t.accent, fontSize: 11.5,
                    fontWeight: 700, textDecoration: "none",
                  }}>
                    {q.icon}
                    <span>{q.label}</span>
                    {q.sub && <span style={{ fontWeight: 400, color: t.textMuted, fontSize: 10 }}>· {q.sub}</span>}
                    <ExternalLink size={11} style={{ color: t.textMuted }} />
                  </a>
                ))}
                {data?.contrato && !data.contrato.pdf_url && (
                  <span style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
                    border: `1px solid ${t.border}`, color: t.textSecondary, fontSize: 11.5,
                  }}>
                    <PenLine size={13} />
                    Contrato: {data.contrato.assinado ? "assinado (PDF indisponível)" : (data.contrato.status || "em andamento")}
                  </span>
                )}
              </div>
            )}
            {grupos.map((g) => (
              <div key={g.origem} style={{ padding: "8px 12px", borderBottom: `1px solid ${t.border}` }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", color: t.accent, marginBottom: 5, textTransform: "uppercase" }}>
                  {g.titulo} · {g.docs.length}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {g.docs.map((d, i) => (
                    <a key={i} href={d.url} target="_blank" rel="noreferrer" style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                      border: `1px solid ${t.border}`, color: t.textPrimary, fontSize: 11.5,
                      textDecoration: "none", background: t.inputBg,
                    }}>
                      <Paperclip size={12} style={{ color: t.accent, flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{d.name}</span>
                      <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em", color: t.textMuted, flexShrink: 0 }}>
                        {ORIGEM_LABEL[d.origem || g.origem] || (d.origem || g.origem).toUpperCase()}
                      </span>
                      <ExternalLink size={12} style={{ color: t.textMuted, flexShrink: 0 }} />
                    </a>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ padding: "6px 12px", fontSize: 10, color: t.textMuted }}>
              Card único: anexos feitos no Valor, Projetos (inclusive Trello), Gestão e aqui na Produção aparecem em todos os setores.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
