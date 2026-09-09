export const fmtBRL = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = typeof s === "string" ? new Date(s.length === 10 ? s + "T00:00:00" : s) : s;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
};

export const fmtCPF = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = s.replace(/\D/g, "");
  if (d.length !== 11) return s;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
};

export const fmtTel = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = s.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return s;
};

export const fmtCNPJ = (s: string | null | undefined) => s ?? "—";

export const initials = (nome: string | null | undefined) => {
  if (!nome) return "?";
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
