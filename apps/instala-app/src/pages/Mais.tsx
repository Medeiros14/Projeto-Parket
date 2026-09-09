import { useNavigate } from "react-router-dom";
import { Trophy, AlertTriangle, Package, Wallet, ChevronRight, ListChecks, ClipboardCheck, Users, CalendarRange } from "lucide-react";
import { useTheme } from "../lib/theme-context";
import { Screen } from "../app/components/Screen";

const ITENS = [
  // Equipe saiu da bottom nav e mora aqui no menu (Will 08/09)
  { icon: Users,          titulo: "Equipe", desc: "Sua equipe e os ajudantes das obras", path: "equipe" },
  // Cronograma da Central dentro do app (Will 08/09): abre a mesma página do cliente num visor
  { icon: CalendarRange,  titulo: "Cronograma da obra", desc: "Etapas e datas da obra, o mesmo que o cliente acompanha", path: "cronograma" },
  { icon: ListChecks,     titulo: "Pendências", desc: "Contratos, fotos e dias em aberto: tudo num lugar só", path: "pendencias" },
  { icon: AlertTriangle,  titulo: "Ocorrências", desc: "Avise o fiscal e a gestão sobre um problema na obra", path: "ocorrencias" },
  { icon: Package,        titulo: "Solicitar material", desc: "Peça material que está faltando na obra", path: "material" },
  { icon: ClipboardCheck, titulo: "Conferência de material", desc: "Confira volume a volume o que chegou na obra", path: "conferencia" },
  { icon: Wallet,         titulo: "Pagamentos", desc: "Seu valor por m² e ganhos por obra", path: "pagamentos" },
  { icon: Trophy,         titulo: "Ranking", desc: "Sua posição entre as equipes", path: "ranking" },
];

export function Mais({ slug }: { slug: string }) {
  const { T } = useTheme();
  const nav = useNavigate();
  return (
    <Screen slug={slug} titulo="Menu" subtitulo="atalhos">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ITENS.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.path} onClick={() => nav(`/${slug}/${it.path}`)} style={{
              display: "flex", alignItems: "center", gap: 14, textAlign: "left",
              padding: "16px 16px", cursor: "pointer",
              background: T.cardBg, border: `1px solid ${T.border}`, color: T.textPrimary,
            }}>
              <span style={{
                width: 40, height: 40, flexShrink: 0, borderRadius: 999,
                background: T.statBg, border: `1px solid ${T.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={18} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, marginBottom: 2 }}>{it.titulo}</span>
                <span style={{ display: "block", fontSize: 10.5, color: T.textMuted, lineHeight: 1.4 }}>{it.desc}</span>
              </span>
              <ChevronRight size={16} style={{ color: T.textMuted, flexShrink: 0 }} />
            </button>
          );
        })}
      </div>
    </Screen>
  );
}
