import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, FileSignature, CalendarX, Camera, MessageSquare, ChevronRight, CheckCircle2 } from "lucide-react";
import { sb } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme-context";
import { Screen } from "../app/components/Screen";
import { GESTAO_API } from "../lib/offline";

type Obra = { card_id: string; obra_code: string | null; cliente_nome: string };
type Pend = {
  key: string;
  icon: any;
  cor: string;
  titulo: string;
  desc: string;
  path: string; // rota destino
};

export function Pendencias({ slug }: { slug: string }) {
  const { prestador } = useAuth();
  const { T } = useTheme();
  const nav = useNavigate();
  const [pends, setPends] = useState<Pend[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!prestador) return;
    setLoading(true);
    const seteDias = new Date(Date.now() - 7 * 864e5).toISOString();
    const hoje0 = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

    const { data: vObras } = await sb.from("vw_instala_minhas_obras")
      .select("card_id,obra_code,cliente_nome")
      .eq("prestador_id", prestador.id);
    const seen = new Set<string>();
    const obras: Obra[] = [];
    for (const o of (vObras as Obra[]) ?? []) {
      if (!seen.has(o.card_id)) { seen.add(o.card_id); obras.push(o); }
    }
    const nomeObra = (id: string) => {
      const o = obras.find((x) => x.card_id === id);
      return o ? `${o.obra_code ?? ""} ${o.cliente_nome}`.trim() : "obra";
    };

    // vinculo canonico (Will 02/09): equipes_parket.prestador_id, nunca por nome
    const { data: eqs } = await sb.from("equipes_parket").select("id").eq("prestador_id", prestador.id);
    const eqIds = ((eqs as any[]) ?? []).map((e) => e.id);

    const [termos, checkinsAbertos, matResp, occResp, ...gestao] = await Promise.all([
      eqIds.length
        ? sb.from("prestador_termos").select("id,card_id,status,criado_em")
            .in("equipe_id", eqIds).eq("status", "pendente")
        : Promise.resolve({ data: [] } as any),
      sb.from("instala_checkins").select("id,card_id,created_at")
        .eq("prestador_id", prestador.id).is("closed_at", null).lt("created_at", hoje0)
        .order("created_at", { ascending: false }).limit(10),
      sb.from("instala_material_solicitacoes").select("id,card_id,status,atendida_em")
        .eq("prestador_id", prestador.id).in("status", ["atendida", "recusada"])
        .gte("atendida_em", seteDias),
      sb.from("instala_ocorrencias").select("id,card_id,status,resolvida_em")
        .eq("prestador_id", prestador.id).eq("status", "resolvida")
        .gte("resolvida_em", seteDias),
      ...obras.slice(0, 12).map((o) =>
        fetch(`${GESTAO_API}/api/fiscal/obra/${o.card_id}`)
          .then((r) => (r.ok ? r.json() : null)).catch(() => null)
          .then((j) => ({ card_id: o.card_id, itens: j?.itens ?? [] }))),
    ]);

    const lista: Pend[] = [];

    for (const t of ((termos as any).data as any[]) ?? []) {
      lista.push({
        key: `termo-${t.id}`, icon: FileSignature, cor: "#ef4444",
        titulo: "Contrato pendente de assinatura",
        desc: `${nomeObra(t.card_id)}: toque pra ler e assinar`,
        path: `/termo/${t.id}`,
      });
    }

    for (const c of ((checkinsAbertos as any).data as any[]) ?? []) {
      lista.push({
        key: `dia-${c.id}`, icon: CalendarX, cor: "#FBBF24",
        titulo: "Dia sem finalizar",
        desc: `${nomeObra(c.card_id)}: check-in de ${new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ficou aberto`,
        path: `/obra/${c.card_id}`,
      });
    }

    for (const g of gestao as { card_id: string; itens: any[] }[]) {
      const semFoto = (g.itens || []).filter((i: any) => {
        const qtd = Number(i?.meta?.obra?.qtd_instalada ?? 0);
        return (i.status === "entregue" || qtd > 0) && !Number(i.midias ?? 0);
      });
      if (semFoto.length > 0) {
        lista.push({
          key: `foto-${g.card_id}`, icon: Camera, cor: "#FBBF24",
          titulo: `${semFoto.length} ${semFoto.length === 1 ? "item feito sem foto" : "itens feitos sem foto"}`,
          desc: `${nomeObra(g.card_id)}: registre as fotos do que já foi instalado`,
          path: `/obra/${g.card_id}`,
        });
      }
    }

    const nMat = (((matResp as any).data as any[]) ?? []).length;
    if (nMat > 0) {
      lista.push({
        key: "resp-mat", icon: MessageSquare, cor: "#34D399",
        titulo: `${nMat} ${nMat === 1 ? "resposta" : "respostas"} de material`,
        desc: "A gestão respondeu suas solicitações. Veja o que foi atendido",
        path: `/${slug}/material`,
      });
    }
    const nOcc = (((occResp as any).data as any[]) ?? []).length;
    if (nOcc > 0) {
      lista.push({
        key: "resp-occ", icon: MessageSquare, cor: "#34D399",
        titulo: `${nOcc} ${nOcc === 1 ? "ocorrência resolvida" : "ocorrências resolvidas"}`,
        desc: "O fiscal resolveu ocorrências suas. Confira",
        path: `/${slug}/ocorrencias`,
      });
    }

    setPends(lista);
    setLoading(false);
  }, [prestador, slug]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <Screen slug={slug} titulo="Pendências" voltar={`/${slug}/mais`}
      subtitulo={loading ? "verificando…" : pends.length === 0 ? "tudo em dia" : `${pends.length} ${pends.length === 1 ? "pendência" : "pendências"}`}
      action={<button onClick={reload} title="Atualizar" style={iconBtn(T)}><RefreshCw size={14} className={loading ? "spin" : ""} /></button>}>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map((i) => <div key={i} style={{ height: 64, background: T.statBg, border: `1px solid ${T.border}` }} />)}
        </div>
      ) : pends.length === 0 ? (
        <div style={{ padding: "50px 18px", textAlign: "center", color: T.textMuted, border: `1px dashed ${T.border}` }}>
          <CheckCircle2 size={28} style={{ color: "#34D399", marginBottom: 10 }} />
          <div style={{ fontSize: 13, color: T.textPrimary, marginBottom: 4 }}>Tudo em dia</div>
          <div style={{ fontSize: 11 }}>Nenhum contrato, foto ou dia pendente.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pends.map((p) => {
            const Icon = p.icon;
            return (
              <button key={p.key} onClick={() => nav(p.path)} style={{
                display: "flex", alignItems: "center", gap: 14, textAlign: "left",
                padding: "14px 16px", cursor: "pointer",
                background: T.cardBg, border: `1px solid ${T.border}`, color: T.textPrimary,
              }}>
                <span style={{
                  width: 38, height: 38, flexShrink: 0, borderRadius: 999,
                  background: T.statBg, border: `1px solid ${T.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center", color: p.cor,
                }}>
                  <Icon size={16} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, marginBottom: 2 }}>{p.titulo}</span>
                  <span style={{ display: "block", fontSize: 10.5, color: T.textMuted, lineHeight: 1.4 }}>{p.desc}</span>
                </span>
                <ChevronRight size={16} style={{ color: T.textMuted, flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      )}
      <style>{`.spin { animation: r 1s linear infinite; } @keyframes r { to { transform: rotate(360deg); } }`}</style>
    </Screen>
  );
}

const iconBtn = (T: any): React.CSSProperties => ({
  background: T.statBg, border: `1px solid ${T.border}`,
  color: T.textSecondary, padding: 9, cursor: "pointer", borderRadius: 999,
  display: "flex", alignItems: "center",
});
