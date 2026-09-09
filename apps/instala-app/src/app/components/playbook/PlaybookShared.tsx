import type { ReactNode } from "react";

export function PBWrap({
  children,
  dark = false,
  id,
  accent = false,
}: {
  children: ReactNode;
  dark?: boolean;
  id?: string;
  accent?: boolean;
}) {
  let bg = dark ? "#050505" : "#F3F0E8";
  if (accent) bg = "#D8D3C7";
  return (
    <section id={id} style={{ backgroundColor: bg, padding: "100px 0" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 72px" }}>
        {children}
      </div>
    </section>
  );
}

export function PBHero({
  label,
  title,
  sub,
  onBack,
}: {
  label: string;
  title: string;
  sub: string;
  onBack?: () => void;
}) {
  return (
    <section style={{ backgroundColor: "#050505", minHeight: "60vh", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "120px 0 80px", position: "relative" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 72px", position: "relative", zIndex: 1 }}>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, letterSpacing: "0.28em", color: "#77736A", marginBottom: 24 }}>
          {label}
        </p>
        <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: 44, letterSpacing: "0.06em", color: "#D8D3C7", fontWeight: 400, lineHeight: 1.2, marginBottom: 0 }}>
          {title}
        </h1>
        <div style={{ width: 48, height: 1, backgroundColor: "rgba(216,211,199,0.2)", margin: "28px 0" }} />
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#77736A", fontWeight: 300, lineHeight: 1.8, maxWidth: 560 }}>
          {sub}
        </p>
      </div>
    </section>
  );
}

export function PBSectionHeader({ number, title, dark = false }: { number: string; title: string; dark?: boolean }) {
  const fg = dark ? "#D8D3C7" : "#050505";
  const dim = dark ? "rgba(216,211,199,0.25)" : "rgba(5,5,5,0.2)";
  return (
    <div style={{ marginBottom: 56 }}>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, letterSpacing: "0.3em", color: dim, marginBottom: 12 }}>
        {number}
      </p>
      <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: 13, letterSpacing: "0.14em", color: fg, fontWeight: 400, marginBottom: 0 }}>
        {title}
      </h2>
      <div style={{ width: 32, height: 1, backgroundColor: dim, marginTop: 20 }} />
    </div>
  );
}

export function PBLabel({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p style={{
      fontFamily: "'Cinzel', serif",
      fontSize: 9,
      letterSpacing: "0.22em",
      color: dark ? "rgba(216,211,199,0.45)" : "rgba(5,5,5,0.35)",
      marginBottom: 16,
    }}>
      {children}
    </p>
  );
}

export function PBBody({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p style={{
      fontFamily: "'Inter', sans-serif",
      fontSize: 14,
      color: dark ? "rgba(216,211,199,0.75)" : "#050505",
      lineHeight: 1.9,
      fontWeight: 300,
    }}>
      {children}
    </p>
  );
}

export function PBSmall({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p style={{
      fontFamily: "'Inter', sans-serif",
      fontSize: 12,
      color: dark ? "rgba(216,211,199,0.55)" : "#77736A",
      lineHeight: 1.8,
      fontWeight: 300,
    }}>
      {children}
    </p>
  );
}

export function PBDivider({ dark = false }: { dark?: boolean }) {
  return (
    <div style={{
      width: "100%",
      height: 1,
      backgroundColor: dark ? "rgba(216,211,199,0.08)" : "rgba(5,5,5,0.08)",
      margin: "56px 0",
    }} />
  );
}

export function PBTag({ children }: { children: ReactNode }) {
  return (
    <span style={{
      fontFamily: "'Inter', sans-serif",
      fontSize: 8,
      letterSpacing: "0.18em",
      color: "#77736A",
      border: "1px solid rgba(5,5,5,0.2)",
      padding: "4px 10px",
      display: "inline-block",
    }}>
      {children}
    </span>
  );
}

export function PBTagDark({ children }: { children: ReactNode }) {
  return (
    <span style={{
      fontFamily: "'Inter', sans-serif",
      fontSize: 8,
      letterSpacing: "0.18em",
      color: "#77736A",
      border: "1px solid rgba(216,211,199,0.15)",
      padding: "4px 10px",
      display: "inline-block",
    }}>
      {children}
    </span>
  );
}

export function PBCard({ title, children, dark = false }: { title: string; children: ReactNode; dark?: boolean }) {
  const bg = dark ? "rgba(216,211,199,0.04)" : "rgba(5,5,5,0.03)";
  const border = dark ? "rgba(216,211,199,0.1)" : "rgba(5,5,5,0.08)";
  const titleColor = dark ? "#D8D3C7" : "#050505";
  return (
    <div style={{ border: `1px solid ${border}`, padding: "32px", backgroundColor: bg }}>
      <p style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.14em", color: titleColor, marginBottom: 16 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

export function PBModuleNav({ onBack, title }: { onBack?: () => void; title: string }) {
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      padding: "0 48px",
      height: 64,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: "rgba(5,5,5,0.92)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid rgba(216,211,199,0.08)",
    }}>
      <button
        onClick={onBack}
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 9,
          letterSpacing: "0.2em",
          color: "#77736A",
          background: "none",
          border: "none",
          cursor: "pointer",
          transition: "color 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#D8D3C7")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#77736A")}
      >
        ← CENTRAL
      </button>
      <p style={{ fontFamily: "'Cinzel', serif", fontSize: 13, letterSpacing: "0.28em", color: "#D8D3C7" }}>
        NAVONA
      </p>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, letterSpacing: "0.16em", color: "#77736A" }}>
        {title}
      </p>
    </div>
  );
}
