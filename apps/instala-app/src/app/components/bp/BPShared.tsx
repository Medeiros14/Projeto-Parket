import type { ReactNode } from "react";

export function BPSectionHeader({
  number,
  title,
  subtitle,
  dark = false,
}: {
  number: string;
  title: string;
  subtitle?: string;
  dark?: boolean;
}) {
  const fg = dark ? "#D8D3C7" : "#050505";
  const dim = dark ? "rgba(216,211,199,0.3)" : "rgba(5,5,5,0.2)";
  return (
    <div style={{ marginBottom: 72 }}>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, letterSpacing: "0.3em", color: dim, marginBottom: 16 }}>
        {number}
      </p>
      <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: 14, letterSpacing: "0.14em", color: fg, fontWeight: 500, marginBottom: subtitle ? 12 : 0 }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: dark ? "#77736A" : "#77736A", fontWeight: 300, marginTop: 8 }}>
          {subtitle}
        </p>
      )}
      <div style={{ width: 32, height: 1, backgroundColor: dim, marginTop: 24 }} />
    </div>
  );
}

export function BPWrap({ children, dark = false, id }: { children: ReactNode; dark?: boolean; id?: string }) {
  return (
    <section
      id={id}
      style={{ backgroundColor: dark ? "#050505" : "#F3F0E8", padding: "120px 0" }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 80px" }}>
        {children}
      </div>
    </section>
  );
}

export function BPDivider({ dark = false }: { dark?: boolean }) {
  return (
    <div style={{
      width: "100%", height: 1,
      backgroundColor: dark ? "rgba(216,211,199,0.08)" : "rgba(5,5,5,0.08)",
      margin: "56px 0",
    }} />
  );
}

export function BPLabel({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p style={{
      fontFamily: "'Cinzel', serif",
      fontSize: 9,
      letterSpacing: "0.22em",
      color: dark ? "rgba(216,211,199,0.45)" : "rgba(5,5,5,0.35)",
      marginBottom: 20,
    }}>
      {children}
    </p>
  );
}

export function BPBody({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
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

export function BPSmall({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p style={{
      fontFamily: "'Inter', sans-serif",
      fontSize: 12,
      color: "#77736A",
      lineHeight: 1.8,
      fontWeight: 300,
    }}>
      {children}
    </p>
  );
}
