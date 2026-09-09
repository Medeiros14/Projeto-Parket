import { useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { X } from "lucide-react";
import { Item, editarItem } from "../lib/suprimentos";

type Props = { item: Item; usuario: string | null; onSaved: () => void; onClose: () => void };

export default function EditarItemModal({ item, usuario, onSaved, onClose }: Props) {
  const { t } = useTheme();
  const [form, setForm] = useState({
    descricao: item.descricao, marca: item.marca || "", serie: item.serie || "", valor: String(item.valor ?? 0),
  });
  const [salvando, setSalvando] = useState(false);

  const inp: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
    padding: "9px 11px", fontSize: 13, borderRadius: 0, outline: "none", width: "100%",
  };
  const lbl: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textSecondary, marginBottom: 4, display: "block" };

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.descricao.trim()) return;
    setSalvando(true);
    try {
      await editarItem(item.id, {
        descricao: form.descricao.trim(),
        marca: form.marca.trim() || null,
        serie: form.serie.trim() || null,
        valor: parseFloat(form.valor.replace(",", ".")) || 0,
      }, usuario);
      onSaved();
    } catch (err: any) {
      alert("Falha ao salvar: " + (err?.message || err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: t.modalOverlay, zIndex: 100, display: "grid", placeItems: "center" }}>
      <form onSubmit={salvar} style={{
        width: 400, background: t.modalBg, border: `1px solid ${t.borderStrong}`,
        padding: 24, display: "flex", flexDirection: "column", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Editar ferramenta</div>
          <button type="button" onClick={onClose} style={{ background: "transparent", border: "none", color: t.textMuted, cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>
        <div>
          <label style={lbl}>Descrição</label>
          <input value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} required style={inp} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl}>Marca</label>
            <input value={form.marca} onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>Nº de série</label>
            <input value={form.serie} onChange={(e) => setForm((f) => ({ ...f, serie: e.target.value }))} style={inp} />
          </div>
        </div>
        <div>
          <label style={lbl}>Valor estimado (R$)</label>
          <input value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} type="text" inputMode="decimal" style={inp} />
        </div>
        <button disabled={salvando} type="submit" style={{
          background: t.accent, color: t.bg, border: "none", padding: "10px 16px",
          fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: salvando ? 0.6 : 1,
        }}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </form>
    </div>
  );
}
