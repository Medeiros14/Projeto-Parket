import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { T, fonts, useIsMobile } from "../theme";
import { api } from "../api";
import { marked } from "marked";
import DOMPurify from "dompurify";

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sem-titulo";
}

/** Preprocessa markdown: [[X]] → link pra /notas/x
 *  Suporta [[X|texto]] pra label diferente do target. */
function preprocessWikilinks(md: string, existingSlugs: Set<string>): string {
  return md.replace(/\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g, (_, target: string, label?: string) => {
    const slug = slugify(target);
    const shown = (label || target).trim();
    const exists = existingSlugs.has(slug);
    const cls = exists ? "wl-exists" : "wl-stub";
    return `<a href="/notas/${slug}" class="${cls}" data-slug="${slug}">${shown}</a>`;
  });
}

export default function Notas() {
  const nav = useNavigate();
  const isMobile = useIsMobile();
  const [list, setList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [backlinks, setBacklinks] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ slug: "", titulo: "", conteudo_md: "", tags: "" });
  const [mobileShowList, setMobileShowList] = useState(true); // no mobile: alterna lista/detalhe

  const existingSlugs = new Set(list.map((n: any) => n.slug));

  async function refresh() {
    setList(await api.notas());
  }

  useEffect(() => { refresh(); }, []);

  async function open(slug: string) {
    const n = await api.nota(slug);
    setSelected(n); setEditing(false);
    setMobileShowList(false);
    api.backlinks(slug).then((r) => setBacklinks(r.backlinks || [])).catch(() => setBacklinks([]));
  }

  function startNew() {
    setSelected(null);
    setDraft({ slug: "", titulo: "", conteudo_md: "# Nova nota\n\nUse [[wikilinks]] pra conectar com outras notas ou entidades do banco.\n\n", tags: "" });
    setEditing(true);
    setMobileShowList(false);
  }

  function startEdit() {
    if (!selected) return;
    setDraft({
      slug: selected.slug, titulo: selected.titulo,
      conteudo_md: selected.conteudo_md,
      tags: (selected.tags || []).join(", "),
    });
    setEditing(true);
  }

  async function save() {
    const payload = {
      slug: draft.slug || slugify(draft.titulo) || `nota-${Date.now()}`,
      titulo: draft.titulo || "Sem título",
      conteudo_md: draft.conteudo_md,
      tags: draft.tags.split(",").map((s) => s.trim()).filter(Boolean),
    };
    const n = await api.saveNota(payload.slug, payload);
    setSelected(n); setEditing(false);
    api.backlinks(n.slug).then((r) => setBacklinks(r.backlinks || [])).catch(() => setBacklinks([]));
    refresh();
  }

  // Handler pra intercepta cliques em links wikilink (renderizados como <a href="/notas/x">)
  function onContentClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.tagName === "A" && target.getAttribute("href")?.startsWith("/notas/")) {
      e.preventDefault();
      const slug = target.getAttribute("data-slug") || target.getAttribute("href")!.replace("/notas/", "");
      if (existingSlugs.has(slug)) {
        open(slug);
      } else {
        // stub: pergunta se quer criar
        if (confirm(`Nota "${slug}" ainda não existe. Criar agora?`)) {
          setSelected(null);
          setDraft({ slug, titulo: slug.replace(/-/g, " "), conteudo_md: `# ${slug.replace(/-/g, " ")}\n\n`, tags: "" });
          setEditing(true);
        }
      }
    }
  }

  const previewHtml = selected
    ? DOMPurify.sanitize(
        marked.parse(preprocessWikilinks(selected.conteudo_md || "", existingSlugs)) as string,
        { ADD_ATTR: ["class", "data-slug"] },
      )
    : "";

  const showList  = !isMobile || mobileShowList;
  const showMain  = !isMobile || !mobileShowList;
  const showRight = !isMobile;  // no mobile, backlinks vira accordion no fim do detalhe

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "260px 1fr 260px",
      height: "100%",
    }}>
      {/* SIDEBAR ESQUERDA — Lista */}
      {showList && (
      <aside style={{
        borderRight: isMobile ? "none" : `1px solid ${T.border}`,
        background: T.sidebarBg,
        overflowY: "auto", display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "24px 20px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 14, letterSpacing: "0.22em", color: T.textPrimary }}>
            NOTAS
          </div>
          <div style={{ fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.20em", color: T.textMuted, textTransform: "uppercase", marginTop: 4 }}>
            second brain
          </div>
          <button onClick={startNew} style={{
            marginTop: 16, width: "100%", padding: 10,
            background: T.textPrimary, color: T.bg, border: "none", cursor: "pointer",
            fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
          }}>+ Nova nota</button>
        </div>
        <div style={{ padding: 12 }}>
          {list.map((n) => (
            <button key={n.id} onClick={() => open(n.slug)} style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "10px 12px", marginBottom: 2,
              background: selected?.id === n.id ? T.cardHover : "transparent",
              border: `1px solid ${selected?.id === n.id ? T.borderHover : "transparent"}`,
              color: T.textPrimary, cursor: "pointer",
              fontFamily: fonts.inter, fontSize: 11, letterSpacing: "0.04em",
            }}>
              <div style={{ color: T.textPrimary }}>{n.titulo}</div>
              <div style={{ color: T.textMuted, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 2 }}>
                {(n.tags || []).join(" · ") || "sem tags"}
              </div>
            </button>
          ))}
          {list.length === 0 && (
            <div style={{ padding: 12, color: T.textMuted, fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.14em" }}>
              Nenhuma nota ainda.
            </div>
          )}
        </div>
      </aside>
      )}

      {/* CENTRO */}
      {showMain && (
      <main style={{ overflowY: "auto", padding: isMobile ? "20px 20px 40px" : "32px 48px" }}>
        {isMobile && (
          <button
            onClick={() => { setMobileShowList(true); setEditing(false); }}
            style={{
              marginBottom: 16, padding: "8px 12px",
              background: "transparent", border: `1px solid ${T.border}`,
              color: T.textSecondary, cursor: "pointer",
              fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >← notas</button>
        )}
        {!selected && !editing && (
          <div style={{ color: T.textMuted, fontFamily: fonts.inter, fontSize: 12, marginTop: 40 }}>
            Selecione uma nota ou crie uma nova. Use <code>[[wikilinks]]</code> pra conectar notas — elas aparecem como arestas no núcleo 3D.
          </div>
        )}

        {editing && (
          <div style={{ maxWidth: 780 }}>
            <input
              placeholder="TÍTULO"
              value={draft.titulo}
              onChange={(e) => setDraft({ ...draft, titulo: e.target.value })}
              style={{
                width: "100%", padding: "12px 14px", background: T.inputBg,
                border: `1px solid ${T.border}`, color: T.textPrimary,
                fontFamily: fonts.cinzel, fontSize: 18, letterSpacing: "0.10em",
                marginBottom: 12, outline: "none",
              }}
            />
            <input
              placeholder="slug-da-nota (auto se vazio)"
              value={draft.slug}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              style={{
                width: "100%", padding: "10px 14px", background: T.inputBg,
                border: `1px solid ${T.border}`, color: T.textSecondary,
                fontFamily: fonts.inter, fontSize: 11, marginBottom: 12, outline: "none",
              }}
            />
            <input
              placeholder="tags, separadas, por, vírgula"
              value={draft.tags}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
              style={{
                width: "100%", padding: "10px 14px", background: T.inputBg,
                border: `1px solid ${T.border}`, color: T.textSecondary,
                fontFamily: fonts.inter, fontSize: 11, marginBottom: 12, outline: "none",
              }}
            />
            <textarea
              value={draft.conteudo_md}
              onChange={(e) => setDraft({ ...draft, conteudo_md: e.target.value })}
              rows={20}
              placeholder="Conteúdo em markdown. Use [[nome-da-nota]] pra wikilinks."
              style={{
                width: "100%", padding: 14, background: T.inputBg,
                border: `1px solid ${T.border}`, color: T.textPrimary,
                fontFamily: "monospace", fontSize: 13, lineHeight: 1.6,
                marginBottom: 12, outline: "none", resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={save} style={{
                padding: "12px 24px", background: T.textPrimary, color: T.bg,
                border: "none", cursor: "pointer",
                fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
              }}>Salvar</button>
              <button onClick={() => setEditing(false)} style={{
                padding: "12px 24px", background: "transparent",
                border: `1px solid ${T.border}`, color: T.textSecondary, cursor: "pointer",
                fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
              }}>Cancelar</button>
            </div>
          </div>
        )}

        {selected && !editing && (
          <div style={{ maxWidth: 780 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0, marginBottom: 24 }}>
              <div>
                <div style={{ fontFamily: fonts.cinzel, fontSize: 24, letterSpacing: "0.10em", color: T.textPrimary }}>
                  {selected.titulo.toUpperCase()}
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                  {(selected.tags || []).map((t: string) => (
                    <span key={t} style={{
                      background: T.statBg, border: `1px solid ${T.border}`,
                      color: T.textSecondary, padding: "2px 6px",
                      fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.10em",
                    }}>#{t}</span>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Link to={`/?focus=${encodeURIComponent("note:" + selected.slug)}`} style={{
                  padding: "10px 20px", background: "transparent",
                  border: `1px solid ${T.border}`, color: T.textSecondary, cursor: "pointer",
                  fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
                  textDecoration: "none",
                }} title="Ver no núcleo 3D">◆ Núcleo</Link>
                <button onClick={startEdit} style={{
                  padding: "10px 20px", background: "transparent",
                  border: `1px solid ${T.border}`, color: T.textSecondary, cursor: "pointer",
                  fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
                }}>Editar</button>
              </div>
            </div>
            <div
              onClick={onContentClick}
              style={{
                fontFamily: fonts.inter, fontSize: 13, color: T.textPrimary, lineHeight: 1.8,
                letterSpacing: "0.02em",
              }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />

            {/* Backlinks inline no mobile */}
            {isMobile && (
              <div style={{ marginTop: 32, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
                <div style={{ fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.22em", color: T.textPrimary, marginBottom: 12 }}>
                  BACKLINKS ({backlinks.length})
                </div>
                {backlinks.length === 0 && (
                  <div style={{ color: T.textMuted, fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.10em" }}>
                    (nenhum ainda)
                  </div>
                )}
                {backlinks.map((b: any) => (
                  <button
                    key={b.id}
                    onClick={() => open(b.id.replace(/^note:/, ""))}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "10px 12px", marginBottom: 2,
                      background: T.statBg, border: `1px solid ${T.border}`,
                      color: T.textPrimary, cursor: "pointer",
                      fontFamily: fonts.inter, fontSize: 11,
                    }}
                  >← {b.title}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      )}

      {/* SIDEBAR DIREITA — Backlinks (desktop) */}
      {showRight && (
      <aside style={{
        borderLeft: `1px solid ${T.border}`, background: T.sidebarBg,
        overflowY: "auto", padding: 20,
      }}>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.22em", color: T.textPrimary, marginBottom: 4 }}>
          BACKLINKS
        </div>
        <div style={{ fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.20em", color: T.textMuted, textTransform: "uppercase", marginBottom: 20 }}>
          quem aponta pra essa nota
        </div>
        {selected && backlinks.length === 0 && (
          <div style={{ color: T.textMuted, fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.10em" }}>
            (nenhum ainda)
          </div>
        )}
        {selected && backlinks.map((b: any) => (
          <button
            key={b.id}
            onClick={() => open(b.id.replace(/^note:/, ""))}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "10px 12px", marginBottom: 2,
              background: T.statBg, border: `1px solid ${T.border}`,
              color: T.textPrimary, cursor: "pointer",
              fontFamily: fonts.inter, fontSize: 11,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.borderHover)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.border)}
          >
            ← {b.title}
          </button>
        ))}
        {!selected && (
          <div style={{ color: T.textMuted, fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.10em" }}>
            Abra uma nota pra ver quem aponta pra ela.
          </div>
        )}
      </aside>
      )}

      {/* Estilos globais dos wikilinks — walnut é fixo nos dois temas */}
      <style>{`
        .wl-exists { color: #8B6F47; text-decoration: none; border-bottom: 1px solid rgba(139,111,71,0.35); padding-bottom: 1px; cursor: pointer; }
        .wl-exists:hover { background: rgba(139,111,71,0.14); }
        .wl-stub   { color: var(--textMuted); text-decoration: none; border-bottom: 1px dashed var(--textMuted); padding-bottom: 1px; cursor: pointer; font-style: italic; }
        .wl-stub:hover { color: var(--textSecondary); border-bottom-color: var(--textSecondary); }
      `}</style>
    </div>
  );
}
