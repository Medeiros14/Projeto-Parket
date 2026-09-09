interface SectionHeaderProps {
  number: string;
  title: string;
  dark?: boolean;
}

export function SectionHeader({ number, title, dark = false }: SectionHeaderProps) {
  const color = dark ? "#D8D3C7" : "#050505";
  const dimColor = dark ? "rgba(216,211,199,0.35)" : "rgba(5,5,5,0.25)";

  return (
    <div style={{ marginBottom: 80 }}>
      <p
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 10,
          letterSpacing: "0.25em",
          color: dimColor,
          marginBottom: 16,
        }}
      >
        {number}
      </p>
      <h2
        style={{
          fontFamily: "'Cinzel', serif",
          color,
          letterSpacing: "0.12em",
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        {title}
      </h2>
      <div
        style={{
          width: 32,
          height: 1,
          backgroundColor: dark ? "rgba(216,211,199,0.3)" : "rgba(5,5,5,0.15)",
          marginTop: 24,
        }}
      />
    </div>
  );
}
