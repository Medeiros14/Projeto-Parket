import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users, UserPlus, Sun, Clock, AlertCircle, ChevronRight,
  GraduationCap, Receipt, FileText, Megaphone, Eye, EyeOff,
  CheckCircle2, Phone, Send, Bell, Cake, CalendarDays,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useFetch, api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const ActionCard = ({ to, icon: Icon, count, label, urgent = false }: any) => (
  <Link to={to}>
    <Card className="p-5 hover:bg-secondary/50 transition cursor-pointer group">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${urgent ? "bg-amber-500/15 text-amber-400" : "bg-primary/10 text-primary"}`}>
            <Icon size={18} />
          </div>
          <div>
            <div className="text-2xl font-bold leading-none">{count ?? "—"}</div>
            <div className="text-xs text-muted-foreground mt-1">{label}</div>
          </div>
        </div>
        <ChevronRight size={16} className="text-muted-foreground group-hover:text-foreground transition" />
      </div>
    </Card>
  </Link>
);

type ProxEvento = { date: string; kind: "aniv" | "aviso"; label: string; cor: string; sub: string; daysAway: number };

const TIPO_COR_DASH: Record<string, string> = {
  aviso: "#3B82F6", feriado: "#EF4444", reuniao: "#A855F7", evento: "#10B981",
};
const TIPO_LABEL_DASH: Record<string, string> = {
  aviso: "Aviso", feriado: "Feriado", reuniao: "Reunião", evento: "Evento",
};

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function mmdd(s: string) { return s.slice(5, 10); }

export function DashboardPage() {
  const colabs = useFetch(() => api.colaboradores(), []);
  const adms = useFetch(() => api.admissoes(), []);
  const ferias = useFetch(() => api.feriasSolicitacoes(), []);
  const contratos = useFetch(() => api.contratos(), []);

  // Próximos 7 dias (avisos + aniversariantes)
  const [proximos, setProximos] = useState<ProxEvento[]>([]);
  useEffect(() => {
    let alive = true;
    const t0 = new Date();
    const today = ymd(t0.getFullYear(), t0.getMonth(), t0.getDate());
    const end = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + 7);
    const endKey = ymd(end.getFullYear(), end.getMonth(), end.getDate());

    Promise.all([
      supabase.from("avisos").select("*").gte("data_inicio", today).lte("data_inicio", endKey),
      supabase.from("colaboradores").select("id,nome,data_nascimento").not("data_nascimento", "is", null),
    ]).then(([rAv, rCol]) => {
      if (!alive) return;
      const out: ProxEvento[] = [];
      for (const a of (rAv.data || []) as any[]) {
        const days = Math.round((new Date(a.data_inicio + "T00:00").getTime() - new Date(today + "T00:00").getTime()) / 86400000);
        out.push({
          date: a.data_inicio, kind: "aviso", label: a.titulo,
          cor: a.cor || TIPO_COR_DASH[a.tipo] || "#3B82F6",
          sub: TIPO_LABEL_DASH[a.tipo] || "Aviso", daysAway: days,
        });
      }
      // Index aniversariantes por MM-DD
      const anivByMD: Record<string, any[]> = {};
      for (const c of (rCol.data || []) as any[]) {
        (anivByMD[mmdd(c.data_nascimento)] ||= []).push(c);
      }
      for (let i = 0; i <= 7; i++) {
        const d = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + i);
        const key = ymd(d.getFullYear(), d.getMonth(), d.getDate());
        for (const p of (anivByMD[mmdd(key)] || [])) {
          out.push({ date: key, kind: "aniv", label: p.nome, cor: "#EC4899", sub: "Aniversário", daysAway: i });
        }
      }
      out.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
      setProximos(out);
    });
    return () => { alive = false; };
  }, []);

  const stats = (() => {
    const cs = colabs.data || [];
    const as = adms.data || [];
    const fs = ferias.data || [];
    const ks = contratos.data || [];
    return {
      ativos: ks.filter((c) => c.status === "ativo").length,
      admPendentes: as.filter((a) => ["formulario_em_preenchimento", "aguardando_assinatura", "aguardando_aprovacao_rh"].includes(a.etapa)).length,
      feriasPendentes: fs.filter((f) => f.status === "pendente").length,
      dadosIncompletos: cs.filter((c) => c.status_dados === "incompleto").length,
      totalColabs: cs.length,
      semCpf: cs.filter((c) => !c.cpf).length,
    };
  })();

  const dadosCompletos = stats.totalColabs > 0
    ? Math.round(((stats.totalColabs - stats.dadosIncompletos) / stats.totalColabs) * 100)
    : 0;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bom dia 👋</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aqui está o resumo do que precisa da sua atenção hoje.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ActionCard
          to="/admissoes"
          icon={UserPlus}
          count={stats.admPendentes}
          label="admissões pendentes"
          urgent={stats.admPendentes > 0}
        />
        <ActionCard
          to="/ferias"
          icon={Sun}
          count={stats.feriasPendentes}
          label="férias para aprovar"
          urgent={stats.feriasPendentes > 0}
        />
        <ActionCard
          to="/colaboradores"
          icon={Users}
          count={stats.ativos}
          label="colaboradores ativos"
        />
        <ActionCard
          to="/colaboradores?filter=incompletos"
          icon={AlertCircle}
          count={stats.dadosIncompletos}
          label="dados pendentes pra eSocial"
          urgent={stats.dadosIncompletos > 0}
        />
      </div>

      {/* Próximos 7 dias */}
      {proximos.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-amber-500" />
              <div className="text-sm font-semibold">Próximos 7 dias</div>
              <span className="text-xs text-muted-foreground">
                · {proximos.length} {proximos.length === 1 ? "evento" : "eventos"}
              </span>
            </div>
            <Link to="/calendario" className="text-xs text-primary hover:underline">
              Ver calendário →
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {proximos.map((p, i) => (
              <div
                key={`${p.kind}-${p.date}-${i}`}
                className="shrink-0 border rounded-lg px-3 py-2 min-w-[200px] flex flex-col gap-1"
                style={{ borderLeftWidth: 3, borderLeftColor: p.cor }}
              >
                <div className="flex items-center gap-2">
                  <span className={[
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                    p.daysAway === 0 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
                    p.daysAway === 1 ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" :
                    "bg-muted text-muted-foreground",
                  ].join(" ")}>
                    {p.daysAway === 0 ? "Hoje" : p.daysAway === 1 ? "Amanhã" : `Em ${p.daysAway} dias`}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{p.sub}</span>
                </div>
                <div className="text-sm font-medium truncate flex items-center gap-1.5">
                  {p.kind === "aniv" && <Cake size={12} className="text-pink-500 shrink-0" />}
                  {p.kind === "aviso" && <CalendarDays size={12} className="shrink-0" style={{ color: p.cor }} />}
                  <span className="truncate">{p.label}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold">Saúde da base</div>
              <div className="text-xs text-muted-foreground">% de colaboradores com cadastro completo</div>
            </div>
            <Badge variant={dadosCompletos >= 80 ? "success" : "warning"}>
              {dadosCompletos}%
            </Badge>
          </div>
          <div className="space-y-3">
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${dadosCompletos >= 80 ? "bg-green-500" : dadosCompletos >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${dadosCompletos}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2 text-center">
              <Stat label="Total" value={stats.totalColabs} />
              <Stat label="Sem CPF" value={stats.semCpf} highlight={stats.semCpf > 0} />
              <Stat label="Incompletos" value={stats.dadosIncompletos} highlight={stats.dadosIncompletos > 0} />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold mb-3">Atalhos</div>
          <div className="space-y-2">
            <QuickLink to="/admissoes/novo" icon={UserPlus}>Iniciar admissão</QuickLink>
            <QuickLink to="/ponto" icon={Clock}>Bater ponto / espelho</QuickLink>
            <QuickLink to="/holerites" icon={Receipt}>Distribuir holerites</QuickLink>
            <QuickLink to="/treinamentos" icon={GraduationCap}>Treinamentos</QuickLink>
            <QuickLink to="/documentos" icon={FileText}>Documentos da empresa</QuickLink>
            <QuickLink to="/murais" icon={Megaphone}>Murais e comunicados</QuickLink>
          </div>
        </Card>
      </div>

      {/* ─── Seção Murais ─── */}
      <MuraisSection />
    </div>
  );
}


// ───────────────────────────────────────────────────────────────
// MuraisSection — resumo dos murais + último broadcast + pendentes
// Atualiza sozinho a cada 30s.
// ───────────────────────────────────────────────────────────────

interface MuralResumo {
  slug: string;
  titulo: string;
  total_enviados: number;
  nao_abriram: number;
  abriram: number;
  assinaram: number;
}

function MuraisSection() {
  const [murais, setMurais] = useState<MuralResumo[]>([]);
  const [pendentesCount, setPendentesCount] = useState(0);
  const [pendentes, setPendentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    // 1) lista de murais ativos
    const { data: ms } = await supabase
      .from("murais")
      .select("slug, titulo, ativo")
      .eq("ativo", true)
      .order("updated_at", { ascending: false });

    // 2) pra cada mural, busca status no agente.parket.works
    const resumos: MuralResumo[] = await Promise.all(
      ((ms as any[]) || []).slice(0, 5).map(async (m) => {
        try {
          const r = await fetch(`https://agente.parket.works/api/rh-whatsapp/mural-status/${m.slug}`);
          if (!r.ok) throw new Error();
          const data = await r.json();
          return {
            slug: m.slug, titulo: m.titulo,
            total_enviados: data.total_enviados || 0,
            nao_abriram: (data.nao_abriram || []).length,
            abriram: (data.abriram_nao_assinaram || []).length,
            assinaram: (data.assinaram || []).length,
          };
        } catch {
          return { slug: m.slug, titulo: m.titulo, total_enviados: 0, nao_abriram: 0, abriram: 0, assinaram: 0 };
        }
      }),
    );
    setMurais(resumos);

    // 3) pendentes WhatsApp (sem celular)
    const { data: pend, count } = await supabase
      .from("mural_pendencias")
      .select("id, mural_slug, colaborador_id, created_at, colaboradores(nome)", { count: "exact" })
      .eq("resolvido", false)
      .order("created_at", { ascending: false })
      .limit(5);
    setPendentes(pend || []);
    setPendentesCount(count || 0);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  if (loading) return null;
  if (murais.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone size={18} className="text-primary" />
          <h2 className="text-base font-bold">Murais & Comunicados</h2>
        </div>
        <Link to="/murais" className="text-xs text-primary hover:underline flex items-center gap-1">
          Ver todos <ChevronRight size={12} />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cards dos murais (até 2) com resumo */}
        <div className="lg:col-span-2 space-y-3">
          {murais.slice(0, 2).map((m) => {
            const total = m.total_enviados;
            const taxaAssinatura = total > 0 ? Math.round((m.assinaram / total) * 100) : 0;
            return (
              <Card key={m.slug} className="p-4 hover:bg-secondary/30 transition">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/murais/${m.slug}`} className="text-sm font-semibold hover:underline truncate block">
                      {m.titulo}
                    </Link>
                    <div className="text-[10px] text-muted-foreground mt-0.5">/{m.slug}</div>
                  </div>
                  <Badge variant={taxaAssinatura >= 80 ? "success" : taxaAssinatura >= 50 ? "warning" : "outline"} className="text-[10px] shrink-0">
                    {taxaAssinatura}% assinado
                  </Badge>
                </div>

                {total > 0 ? (
                  <>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-2 flex">
                      <div className="bg-green-500" style={{ width: `${(m.assinaram / total) * 100}%` }} />
                      <div className="bg-yellow-500" style={{ width: `${(m.abriram / total) * 100}%` }} />
                      <div className="bg-red-500" style={{ width: `${(m.nao_abriram / total) * 100}%` }} />
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <MiniStat label="Total" value={total} />
                      <MiniStat label="Não abriram" value={m.nao_abriram} colorClass="text-red-400" />
                      <MiniStat label="Abriram" value={m.abriram} colorClass="text-yellow-400" />
                      <MiniStat label="Assinaram" value={m.assinaram} colorClass="text-green-400" />
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground py-2 text-center">
                    Nenhum envio registrado · <Link to="/documentos" className="text-primary hover:underline">disparar agora</Link>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Card de pendentes WhatsApp */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-yellow-400" />
              <div className="text-sm font-semibold">Pendentes WhatsApp</div>
            </div>
            {pendentesCount > 0 && (
              <Badge variant="warning" className="text-[10px]">{pendentesCount}</Badge>
            )}
          </div>

          {pendentesCount === 0 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
              <CheckCircle2 size={14} className="text-green-400" />
              Sem pendências
            </div>
          ) : (
            <>
              <div className="text-[10px] text-muted-foreground mb-2">
                Colaboradores sem celular pra receber Mural
              </div>
              <div className="space-y-1.5">
                {pendentes.map((p: any) => (
                  <Link
                    key={p.id}
                    to={`/colaboradores/${p.colaborador_id}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-secondary/50 transition"
                  >
                    <Phone size={10} className="text-yellow-400 shrink-0" />
                    <span className="flex-1 truncate">
                      {(p.colaboradores || {}).nome || "—"}
                    </span>
                    <ChevronRight size={12} className="text-muted-foreground" />
                  </Link>
                ))}
              </div>
              <Link
                to="/documentos"
                className="text-xs text-primary hover:underline flex items-center gap-1 mt-3"
              >
                Ver todas <ChevronRight size={11} />
              </Link>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

const MiniStat = ({ label, value, colorClass }: { label: string; value: number; colorClass?: string }) => (
  <div>
    <div className={`text-base font-bold ${colorClass || ""}`}>{value}</div>
    <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
  </div>
);

const Stat = ({ label, value, highlight }: any) => (
  <div className="space-y-1">
    <div className={`text-xl font-bold ${highlight ? "text-amber-400" : ""}`}>{value}</div>
    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
  </div>
);

const QuickLink = ({ to, icon: Icon, children }: any) => (
  <Link to={to} className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-secondary text-sm transition">
    <Icon size={14} className="text-primary" />
    <span className="flex-1">{children}</span>
    <ChevronRight size={14} className="text-muted-foreground" />
  </Link>
);
