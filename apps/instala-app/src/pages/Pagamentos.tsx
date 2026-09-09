import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Wallet } from "lucide-react";
import { sb } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme-context";
import { Screen } from "../app/components/Screen";

type Obra = { card_id: string; obra_code: string | null; cliente_nome: string };
type Servico = {
  servico_id: string; obra_id: string; descricao: string; unidade: string;
  contrato_qtd: number; valor_unitario: number | null; qtd_instalada: number; pct_concluido: number;
};
type Pagamento = {
  id: string; servico_id: string; periodo: string; qtd: number; valor: number; status: string;
  data_pagamento: string | null; created_at: string;
};

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function Pagamentos({ slug }: { slug: string }) {
  const { prestador } = useAuth();
  const { T } = useTheme();
  const [obras, setObras] = useState<Obra[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [pags, setPags] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!prestador) return;
    setLoading(true);
    // Dinheiro so das obras atribuidas a ele. Fiscal enxerga toda obra pra fazer
    // registro (vinculo 'aberto'), mas nao ganha por elas.
    const { data: vObras } = await sb.from("vw_instala_minhas_obras")
      .select("card_id,obra_code,cliente_nome")
      .eq("prestador_id", prestador.id)
      .eq("vinculo", "atribuido");
    const seen = new Set<string>();
    const os: Obra[] = [];
    for (const o of (vObras as Obra[]) ?? []) {
      if (!seen.has(o.card_id)) { seen.add(o.card_id); os.push(o); }
    }
    const codes = os.map((o) => o.obra_code).filter(Boolean) as string[];
    const [vServ, vPags] = await Promise.all([
      codes.length
        ? sb.from("vw_instala_obra_itens")
            .select("servico_id,obra_id,descricao,unidade,contrato_qtd,valor_unitario,qtd_instalada,pct_concluido")
            .in("obra_id", codes)
        : Promise.resolve({ data: [] } as any),
      sb.from("prestadores_pagamentos")
        .select("id,servico_id,periodo,qtd,valor,status,data_pagamento,created_at")
        .eq("prestador_id", prestador.id)
        .order("created_at", { ascending: false }),
    ]);
    setObras(os);
    setServicos((vServ.data as Servico[]) ?? []);
    setPags((vPags.data as Pagamento[]) ?? []);
    setLoading(false);
  }, [prestador]);

  useEffect(() => { reload(); }, [reload]);

  const ganhoServico = (s: Servico) => (Number(s.valor_unitario) > 0 ? Number(s.qtd_instalada) * Number(s.valor_unitario) : null);

  const totalGanho = servicos.reduce((acc, s) => acc + (ganhoServico(s) ?? 0), 0);
  const totalLiberado = pags.filter((p) => p.status === "liberado").reduce((a, p) => a + Number(p.valor || 0), 0);
  const totalPago = pags.filter((p) => p.status === "pago").reduce((a, p) => a + Number(p.valor || 0), 0);

  return (
    <Screen slug={slug} titulo="Pagamentos" subtitulo="seus ganhos por obra" voltar={`/${slug}/mais`}
      action={<button onClick={reload} title="Atualizar" style={iconBtn(T)}><RefreshCw size={14} className={loading ? "spin" : ""} /></button>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
        {[
          { l: "INSTALADO", v: totalGanho, c: T.textPrimary },
          { l: "LIBERADO", v: totalLiberado, c: "#FBBF24" },
          { l: "PAGO", v: totalPago, c: "#34D399" },
        ].map((b) => (
          <div key={b.l} style={{ padding: "12px 10px", background: T.cardBg, border: `1px solid ${T.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 8.5, letterSpacing: "0.16em", color: T.textMuted, marginBottom: 4 }}>{b.l}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: b.c }}>{fmtBRL(b.v)}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map((i) => <div key={i} style={{ height: 90, background: T.statBg, border: `1px solid ${T.border}` }} />)}
        </div>
      ) : obras.length === 0 ? (
        <div style={{ padding: "40px 18px", textAlign: "center", color: T.textMuted, border: `1px dashed ${T.border}`, fontSize: 12 }}>
          Nenhuma obra vinculada a você.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {obras.map((o) => {
            const servs = servicos.filter((s) => s.obra_id === o.obra_code);
            const ganhoObra = servs.reduce((a, s) => a + (ganhoServico(s) ?? 0), 0);
            return (
              <div key={o.card_id} style={{ background: T.cardBg, border: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 9, letterSpacing: "0.18em", color: T.textMuted }}>{o.obra_code ?? "-"}</div>
                    <div style={{ fontSize: 13, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.cliente_nome}</div>
                  </div>
                  <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <div style={{ fontSize: 8.5, letterSpacing: "0.14em", color: T.textMuted }}>GANHO</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{fmtBRL(ganhoObra)}</div>
                  </div>
                </div>
                {servs.length === 0 ? (
                  <div style={{ padding: "12px 14px", fontSize: 11, color: T.textMuted }}>Serviços ainda não cadastrados pra essa obra.</div>
                ) : (
                  servs.map((s) => {
                    const ganho = ganhoServico(s);
                    return (
                      <div key={s.servico_id} style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 11.5, color: T.textPrimary, marginBottom: 3, lineHeight: 1.4 }}>{s.descricao}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10.5, color: T.textSecondary }}>
                          <span>
                            {Number(s.qtd_instalada).toFixed(2)} / {Number(s.contrato_qtd).toFixed(2)} {s.unidade || "m²"}
                            {Number(s.valor_unitario) > 0 && <> · {fmtBRL(Number(s.valor_unitario))}/{s.unidade || "m²"}</>}
                          </span>
                          <span style={{ fontWeight: 600, color: ganho === null ? T.textMuted : T.textPrimary }}>
                            {ganho === null ? "valor a definir" : fmtBRL(ganho)}
                          </span>
                        </div>
                        <div style={{ marginTop: 6, height: 2, background: T.statBg, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${s.pct_concluido}%`, background: s.pct_concluido >= 100 ? "#34D399" : T.textPrimary }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && pags.length > 0 && (
        <>
          <p style={{ fontSize: 9, letterSpacing: "0.18em", color: T.textMuted, margin: "24px 0 10px" }}>EXTRATO DO PAGO</p>
          <div style={{ background: T.cardBg, border: `1px solid ${T.border}` }}>
            {pags.map((p) => {
              const s = servicos.find((x) => x.servico_id === p.servico_id);
              const obra = obras.find((o) => o.obra_code === s?.obra_id);
              const data = p.data_pagamento ?? p.created_at;
              const unit = s && Number(s.valor_unitario) > 0 ? Number(s.valor_unitario)
                : Number(p.qtd) > 0 ? Number(p.valor) / Number(p.qtd) : null;
              const stC = p.status === "pago" ? "#34D399" : p.status === "liberado" ? "#FBBF24" : T.textMuted;
              return (
                <div key={p.id} style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, letterSpacing: "0.08em", color: T.textMuted }}>
                      {new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                      {" · "}{obra ? `${obra.obra_code ?? ""} ${obra.cliente_nome}`.trim() : (s?.obra_id ?? "-")}
                    </span>
                    <span style={{ fontSize: 9, letterSpacing: "0.12em", fontWeight: 700, color: stC, whiteSpace: "nowrap" }}>
                      {p.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.textPrimary, lineHeight: 1.4, marginBottom: 3 }}>
                    {s?.descricao ?? "Serviço"}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10.5, color: T.textSecondary }}>
                    <span>
                      {Number(p.qtd).toFixed(2)} {s?.unidade || "m²"}
                      {unit !== null && <> × {fmtBRL(unit)}</>}
                    </span>
                    <span style={{ fontWeight: 600, color: T.textPrimary }}>{fmtBRL(Number(p.valor || 0))}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div style={{ marginTop: 24, padding: "14px 16px", border: `1px dashed ${T.border}`, fontSize: 10, letterSpacing: "0.08em", color: T.textMuted, display: "flex", gap: 10, alignItems: "flex-start", lineHeight: 1.6 }}>
        <Wallet size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          GANHO = quanto você instalou × valor por {`m²`} do serviço. O pagamento é <b>liberado</b> quando o serviço chega a 100% e validado pela Produtividade antes de virar <b>pago</b>.
        </div>
      </div>
      <style>{`.spin { animation: r 1s linear infinite; } @keyframes r { to { transform: rotate(360deg); } }`}</style>
    </Screen>
  );
}

const iconBtn = (T: any): React.CSSProperties => ({
  background: T.statBg, border: `1px solid ${T.border}`,
  color: T.textSecondary, padding: 9, cursor: "pointer", borderRadius: 999,
  display: "flex", alignItems: "center",
});
