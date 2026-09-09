/**
 * SolicitarAmostraModal — vendedor solicita amostra/mostruário pra um cliente.
 * Aprovação fica com Douglas (vide isAprovador). Fluxo de status na página /amostras.
 */
import { useState } from "react";
import { X, Loader2, Package, AlertCircle, CheckCircle2, MapPin } from "lucide-react";
import { amostrasApi, AMOSTRA_PRODUTOS, type KanbanCard } from "../../lib/api";
import type { AppUser } from "../../lib/auth";

type Props = {
  card: KanbanCard & { details?: any };
  appUser: AppUser;
  onClose: () => void;
  onCreated?: () => void;
};

export function SolicitarAmostraModal({ card, appUser, onClose, onCreated }: Props) {
  const det = card.details || {};
  const enderecoCard = [det.endereco_obra, det.endereco, det.cidade].filter(Boolean).join(" — ");

  const [produto, setProduto] = useState<string>("Piso");
  const [acabamento, setAcabamento] = useState("");
  const [corReferencia, setCorReferencia] = useState("");
  const [quantidade, setQuantidade] = useState<number>(1);
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  const [endereco, setEndereco] = useState(enderecoCard || "");
  const [cep, setCep] = useState(det.cep || "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!motivo.trim()) { setError("Descreva pra que serve a amostra."); return; }
    if (quantidade < 1) { setError("Quantidade tem que ser ≥ 1."); return; }
    setSaving(true); setError(null);
    try {
      await amostrasApi.criar({
        card_id: card.id,
        solicitado_por: appUser.id,
        solicitado_por_nome: appUser.nome || appUser.username,
        produto,
        acabamento: acabamento.trim() || null,
        cor_referencia: corReferencia.trim() || null,
        quantidade_pecas: quantidade,
        motivo: motivo.trim(),
        obs: obs.trim() || null,
        endereco_entrega: endereco.trim() || null,
        cep: cep.trim() || null,
      });
      setSuccess(true);
      setTimeout(() => { onCreated?.(); onClose(); }, 1100);
    } catch (err: any) {
      setError(err?.message || "Falha ao criar solicitação");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-hb-bg border border-hb-border w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3 border-b border-hb-border flex items-center justify-between bg-hb-panel">
          <div className="flex items-center gap-2">
            <Package size={14} className="text-hb-accent" />
            <div>
              <div className="text-sm font-bold text-hb-text">Solicitar Amostra</div>
              <div className="text-[10px] text-hb-textDim mt-0.5">
                {card.title || card.id.slice(0, 8)} · aprovação por Douglas
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-hb-textDim hover:text-hb-text"><X size={16} /></button>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Produto + quantidade */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] uppercase tracking-[0.16em] text-hb-textDim mb-1.5">Produto *</label>
              <select
                value={produto}
                onChange={(e) => setProduto(e.target.value)}
                className="w-full bg-hb-inputBg border border-hb-border px-2.5 py-1.5 text-xs text-hb-text"
              >
                {AMOSTRA_PRODUTOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.16em] text-hb-textDim mb-1.5">Quantidade *</label>
              <input type="number" min={1} value={quantidade}
                onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-hb-inputBg border border-hb-border px-2.5 py-1.5 text-xs text-hb-text tabular" />
            </div>
          </div>

          {/* Acabamento + cor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.16em] text-hb-textDim mb-1.5">Acabamento</label>
              <input type="text" value={acabamento} onChange={(e) => setAcabamento(e.target.value)}
                placeholder="Ex: Lâmina, Pintura, Natural"
                className="w-full bg-hb-inputBg border border-hb-border px-2.5 py-1.5 text-xs text-hb-text" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.16em] text-hb-textDim mb-1.5">Cor / referência</label>
              <input type="text" value={corReferencia} onChange={(e) => setCorReferencia(e.target.value)}
                placeholder="Ex: Carvalho Smoked, RAL 9010"
                className="w-full bg-hb-inputBg border border-hb-border px-2.5 py-1.5 text-xs text-hb-text" />
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.16em] text-hb-textDim mb-1.5">Pra que serve *</label>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
              placeholder="Ex: Cliente quer comparar com piso atual antes de fechar proposta. Reunião 02/jul."
              className="w-full bg-hb-inputBg border border-hb-border px-2.5 py-1.5 text-xs text-hb-text resize-y" />
          </div>

          {/* Observações */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.16em] text-hb-textDim mb-1.5">Observações</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
              placeholder="Opcional — instrução pra separação, horário de entrega, contato no local…"
              className="w-full bg-hb-inputBg border border-hb-border px-2.5 py-1.5 text-xs text-hb-text resize-y" />
          </div>

          {/* Endereço */}
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-[0.16em] text-hb-textDim mb-1.5 flex items-center gap-1">
                <MapPin size={9} /> Endereço de entrega
              </label>
              <input type="text" value={endereco} onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, bairro, cidade"
                className="w-full bg-hb-inputBg border border-hb-border px-2.5 py-1.5 text-xs text-hb-text" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.16em] text-hb-textDim mb-1.5">CEP</label>
              <input type="text" value={cep} onChange={(e) => setCep(e.target.value)} maxLength={9}
                placeholder="00000-000"
                className="w-full bg-hb-inputBg border border-hb-border px-2.5 py-1.5 text-xs text-hb-text tabular" />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-hb-red bg-hb-red/10 border border-hb-red/30 px-3 py-2">
              <AlertCircle size={12} /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-xs text-hb-green bg-hb-green/10 border border-hb-green/30 px-3 py-2">
              <CheckCircle2 size={12} /> Solicitação enviada — Douglas vai aprovar.
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-hb-border flex items-center justify-end gap-2 bg-hb-panel">
          <button onClick={onClose} type="button"
            className="text-[11px] px-3 py-1.5 text-hb-textDim hover:text-hb-text">Cancelar</button>
          <button onClick={submit as any} disabled={saving || success}
            className="text-[11px] px-4 py-1.5 bg-hb-accent text-hb-bg font-semibold uppercase tracking-[0.14em] hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Package size={11} />}
            {saving ? "Enviando…" : "Solicitar"}
          </button>
        </div>
      </div>
    </div>
  );
}
