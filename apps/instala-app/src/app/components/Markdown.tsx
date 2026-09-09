import React from "react";

function inline(text: string, T: any): React.ReactNode[] {
  // **negrito** — só o que as fichas usam
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i} style={{ color: T.textPrimary, fontWeight: 700 }}>{p.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{p}</React.Fragment>
  );
}

/** Renderer mínimo de markdown pras fichas técnicas (##, listas -, 1., **negrito**). */
export function Markdown({ text, T }: { text: string; T: any }) {
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={key++} style={{ margin: "6px 0 10px", paddingLeft: 20, display: "grid", gap: 5 }}>
        {list.items.map((it, i) => <li key={i} style={{ lineHeight: 1.6 }}>{inline(it, T)}</li>)}
      </Tag>
    );
    list = null;
  };

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3})\s+(.*)/);
    const ul = line.match(/^[-*]\s+(.*)/);
    const ol = line.match(/^\d+[.)]\s+(.*)/);
    if (h) {
      flushList();
      blocks.push(
        <p key={key++} style={{
          fontSize: 9.5, letterSpacing: "0.2em", fontWeight: 700, color: T.textPrimary,
          margin: "14px 0 6px", textTransform: "uppercase",
        }}>{h[2]}</p>
      );
    } else if (ul) {
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push(ul[1]);
    } else if (ol) {
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
      list.items.push(ol[1]);
    } else if (!line.trim()) {
      flushList();
    } else {
      flushList();
      blocks.push(<p key={key++} style={{ margin: "0 0 8px", lineHeight: 1.65 }}>{inline(line, T)}</p>);
    }
  }
  flushList();
  return <div style={{ fontSize: 12, color: T.textSecondary }}>{blocks}</div>;
}
