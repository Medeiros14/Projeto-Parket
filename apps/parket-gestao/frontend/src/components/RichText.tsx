import React from "react";

/** Barra de formatação markdown-lite (B/I/S/code/link/listas/título).
 *  Envolve seleção ou insere marcador na posição do cursor no textarea. */
export function FormatBar({ textareaRef, value, onChange, t }: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string; onChange: (v: string) => void; t: any;
}) {
  const wrap = (left: string, right: string = left, ph = "texto") => {
    const el = textareaRef.current; if (!el) return;
    const s = el.selectionStart ?? value.length;
    const e = el.selectionEnd ?? value.length;
    const sel = value.slice(s, e) || ph;
    const nv = value.slice(0, s) + left + sel + right + value.slice(e);
    onChange(nv);
    requestAnimationFrame(() => {
      el.focus();
      const start = s + left.length;
      el.setSelectionRange(start, start + sel.length);
    });
  };
  const linhaPrefixo = (pref: string) => {
    const el = textareaRef.current; if (!el) return;
    const s = el.selectionStart ?? value.length;
    const e = el.selectionEnd ?? value.length;
    const inicio = value.lastIndexOf("\n", s - 1) + 1;
    const fim = value.indexOf("\n", e); const end = fim === -1 ? value.length : fim;
    const bloco = value.slice(inicio, end);
    const nb = bloco.split("\n").map(l => (l.startsWith(pref) ? l : pref + l)).join("\n");
    const nv = value.slice(0, inicio) + nb + value.slice(end);
    onChange(nv);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(inicio, inicio + nb.length);
    });
  };
  const link = () => {
    const url = window.prompt("URL:"); if (!url) return;
    wrap("[", `](${url})`, "texto do link");
  };
  const bt = (label: string, title: string, fn: () => void, style?: React.CSSProperties) => (
    <button type="button" title={title} onMouseDown={e => e.preventDefault()} onClick={fn}
      style={{
        background: t.card2 || "transparent", border: `1px solid ${t.border1}`,
        color: t.textSecondary, cursor: "pointer",
        padding: "3px 8px", fontSize: 11, minWidth: 26, ...style,
      }}>
      {label}
    </button>
  );
  return (
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
      {bt("B", "Negrito (**txt**)", () => wrap("**"), { fontWeight: 700 })}
      {bt("I", "Itálico (_txt_)", () => wrap("_"), { fontStyle: "italic" })}
      {bt("S", "Riscado (~~txt~~)", () => wrap("~~"), { textDecoration: "line-through" })}
      {bt("</>", "Código (`txt`)", () => wrap("`"), { fontFamily: "monospace", fontSize: 10 })}
      {bt("Link", "Link", link)}
      {bt("- Lista", "Lista", () => linhaPrefixo("- "))}
      {bt("1.", "Numerada", () => linhaPrefixo("1. "))}
      {bt("H", "Título (##)", () => linhaPrefixo("## "), { fontWeight: 700 })}
    </div>
  );
}

/** Renderer markdown-lite: **b**, _i_/*i*, ~~s~~, `code`, [txt](url),
 *  ![alt](url), URLs soltas viram link (imagem se .png/.jpg/etc).
 *  Suporta listas simples (- item / 1. item) e quebras de linha. */
export function RichText({ texto, t, onZoom }: { texto: string; t: any; onZoom?: (url: string) => void }) {
  const inline = (s: string): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    const re = /!\[([^\]]*)\]\((\S+?)\)|\[([^\]]+)\]\((\S+?)\)|`([^`]+)`|\*\*([^*]+)\*\*|~~([^~]+)~~|(?:\b)_([^_]+)_(?:\b)|(?:^|\s)\*([^*\s][^*]*)\*(?=\s|$)|(https?:\/\/\S+)/g;
    let last = 0, m: RegExpExecArray | null, k = 0;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push(s.slice(last, m.index));
      if (m[1] !== undefined && m[2]) {
        out.push(
          <img key={k++} src={m[2]} alt={m[1]} loading="lazy"
            onClick={() => onZoom && onZoom(m![2])}
            style={{
              maxWidth: "100%", maxHeight: 220, display: "block", margin: "6px 0",
              border: `1px solid ${t.border1}`, cursor: onZoom ? "zoom-in" : "default",
            }} />
        );
      } else if (m[3] && m[4]) {
        out.push(<a key={k++} href={m[4]} target="_blank" rel="noreferrer" style={{ color: t.accent }}>{m[3]}</a>);
      } else if (m[5]) {
        out.push(<code key={k++} style={{
          fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: "0.9em",
          background: t.border1, padding: "1px 5px", borderRadius: 2,
        }}>{m[5]}</code>);
      } else if (m[6]) {
        out.push(<b key={k++}>{m[6]}</b>);
      } else if (m[7]) {
        out.push(<span key={k++} style={{ textDecoration: "line-through" }}>{m[7]}</span>);
      } else if (m[8]) {
        out.push(<i key={k++}>{m[8]}</i>);
      } else if (m[9]) {
        out.push(<i key={k++}>{m[9]}</i>);
      } else if (m[10]) {
        const url = m[10];
        const isImg = /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic)(\?|$)/i.test(url);
        if (isImg) {
          out.push(
            <img key={k++} src={url} alt="" loading="lazy"
              onClick={() => onZoom && onZoom(url)}
              style={{
                maxWidth: "100%", maxHeight: 220, display: "block", margin: "6px 0",
                border: `1px solid ${t.border1}`, cursor: onZoom ? "zoom-in" : "default",
              }} />
          );
        } else {
          out.push(<a key={k++} href={url} target="_blank" rel="noreferrer" style={{ color: t.accent }}>{url}</a>);
        }
      }
      last = re.lastIndex;
    }
    if (last < s.length) out.push(s.slice(last));
    return out;
  };
  const linhas = texto.split("\n");
  const blocos: React.ReactNode[] = [];
  let listaAtual: string[] | null = null;
  let ordAtual = false;
  const flushLista = () => {
    if (!listaAtual) return;
    const items = listaAtual;
    blocos.push(
      ordAtual
        ? <ol key={blocos.length} style={{ margin: "4px 0", paddingLeft: 22 }}>
            {items.map((li, j) => <li key={j}>{inline(li)}</li>)}
          </ol>
        : <ul key={blocos.length} style={{ margin: "4px 0", paddingLeft: 22 }}>
            {items.map((li, j) => <li key={j}>{inline(li)}</li>)}
          </ul>
    );
    listaAtual = null;
  };
  linhas.forEach((linha, i) => {
    const li = linha.match(/^\s*[-*]\s+(.+)$/);
    const ol = linha.match(/^\s*\d+\.\s+(.+)$/);
    const h = linha.match(/^(#{1,3})\s+(.+)$/);
    if (li) {
      if (listaAtual && ordAtual) flushLista();
      listaAtual = listaAtual || []; ordAtual = false;
      listaAtual.push(li[1]);
    } else if (ol) {
      if (listaAtual && !ordAtual) flushLista();
      listaAtual = listaAtual || []; ordAtual = true;
      listaAtual.push(ol[1]);
    } else {
      flushLista();
      if (h) {
        const Tag = (["h3", "h4", "h5"] as const)[h[1].length - 1];
        blocos.push(
          <Tag key={i} style={{
            margin: "8px 0 4px", fontSize: h[1].length === 1 ? 14 : h[1].length === 2 ? 13 : 12,
            fontWeight: 700, color: t.textPrimary,
          }}>
            {inline(h[2])}
          </Tag>
        );
      } else if (linha.trim() === "") {
        blocos.push(<div key={i} style={{ height: 4 }} />);
      } else {
        blocos.push(<div key={i} style={{ minHeight: "1em" }}>{inline(linha)}</div>);
      }
    }
  });
  flushLista();
  return <div style={{ fontSize: 12, color: t.textPrimary, lineHeight: 1.55, wordBreak: "break-word" }}>{blocos}</div>;
}
