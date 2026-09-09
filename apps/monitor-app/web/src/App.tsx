// =====================================================================
// MONITOR PARKET: pagina de status das plataformas (monitor.parket.works)
// Modelo visual: paginas de status corporativas (banner geral + apps
// agrupadas + barra por verificacao + incidentes), com identidade Navona.
// Dados: GET /api/status (payload unico), auto-refresh a cada 30s.
// =====================================================================

import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------
// Tipos do payload da API
// ---------------------------------------------------------------------
interface Dia {
  dia: string;            // YYYY-MM-DD
  total: number;
  ok_total: number;
  latencia_media: number | null;
}

interface Check {
  ts: string;             // ISO da verificacao
  ok: boolean;
  latencia_ms: number | null;
  erro: string | null;
}

interface AppStatus {
  id: number;
  slug: string;
  nome: string;
  url: string;
  grupo: string;
  grupo_ordem: number;
  ordem: number;
  interno: boolean;
  estado: 'ok' | 'down' | 'sem_dados';
  http_atual: number | null;
  erro_atual: string | null;
  latencia_atual: number | null;
  uptime_24h: number | null;
  latencia_media_24h: number | null;
  uptime_90d: number | null;
  dias: Dia[];
  checks: Check[];
}

interface Incidente {
  id: number;
  app_id: number;
  app_nome: string;
  slug: string;
  inicio: string;
  fim: string | null;
  titulo: string;
  detalhe: string | null;
}

interface Payload {
  gerado_em: string;
  geral: 'ok' | 'parcial' | 'critico';
  fora_do_ar: string[];
  apps: AppStatus[];
  incidentes: Incidente[];
}

// ---------------------------------------------------------------------
// Helpers de formatacao (pt-BR, sem emoji, sem travessao)
// ---------------------------------------------------------------------
const fmtPct = (v: number | null) =>
  v == null ? 'sem dados' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

const fmtData = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// Duracao legivel de um incidente (ex: "2h 14min")
function duracao(inicio: string, fim: string | null): string {
  const ms = (fim ? new Date(fim).getTime() : Date.now()) - new Date(inicio).getTime();
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h ${min % 60}min`;
}

// ---------------------------------------------------------------------
// Barra de verificacoes: 1 traco = 1 checagem (as ultimas 90, mais
// antiga na esquerda). Com intervalo de 10 min a barra cobre ~15 horas.
// Enquanto o historico nao enche, os slots da esquerda ficam cinza.
// ---------------------------------------------------------------------
function BarraChecks({ checks }: { checks: Check[] }) {
  const slots: (Check | null)[] = [
    ...Array(Math.max(0, 90 - checks.length)).fill(null),
    ...checks.slice(-90),
  ];
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {slots.map((c, i) => (
        <div
          key={i}
          title={
            c
              ? c.ok
                ? `${fmtData(c.ts)} · ok${c.latencia_ms != null ? ` · ${c.latencia_ms}ms` : ''}`
                : `${fmtData(c.ts)} · falha${c.erro ? ` · ${c.erro}` : ''}`
              : 'sem dados'
          }
          style={{
            width: 5,
            height: 26,
            borderRadius: 1,
            background: c ? (c.ok ? 'var(--ok)' : 'var(--down)') : 'var(--nodata)',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// Linha de uma aplicacao: bolinha + nome + latencia + uptime + barra
// ---------------------------------------------------------------------
function LinhaApp({ app }: { app: AppStatus }) {
  const cor = app.estado === 'ok' ? 'var(--ok)' : app.estado === 'down' ? 'var(--down)' : 'var(--nodata)';
  const rotulo = app.estado === 'ok' ? 'Operacional' : app.estado === 'down' ? 'Fora do ar' : 'Sem dados';
  return (
    <div
      style={{
        padding: '14px 18px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Bolinha de estado atual */}
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: cor, flexShrink: 0 }} />
        <span style={{ fontWeight: 400, fontSize: 14 }}>{app.nome}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{app.slug}.parket.works</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'baseline' }}>
          {app.latencia_media_24h != null && (
            <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{app.latencia_media_24h}ms</span>
          )}
          <span style={{ color: cor, fontSize: 12 }}>{rotulo}</span>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <BarraChecks checks={app.checks} />
        <span style={{ color: 'var(--text-secondary)', fontSize: 11, whiteSpace: 'nowrap' }}>
          {fmtPct(app.uptime_90d)} em 90 dias
        </span>
      </div>
      {/* Detalhe do erro quando fora do ar */}
      {app.estado === 'down' && app.erro_atual && (
        <div style={{ color: 'var(--down)', fontSize: 11 }}>{app.erro_atual}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Banner geral no topo (verde / amarelo / vermelho)
// ---------------------------------------------------------------------
function Banner({ payload }: { payload: Payload }) {
  const cfg = {
    ok: { cor: 'var(--ok)', texto: 'TODOS OS SISTEMAS OPERACIONAIS' },
    parcial: { cor: 'var(--warn)', texto: 'INDISPONIBILIDADE PARCIAL' },
    critico: { cor: 'var(--down)', texto: 'FALHA EM MULTIPLAS PLATAFORMAS' },
  }[payload.geral];
  return (
    <div
      style={{
        border: `1px solid ${cfg.cor}`,
        background: 'var(--card-bg)',
        borderRadius: 6,
        padding: '18px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div className="cinzel" style={{ color: cfg.cor, fontSize: 15, letterSpacing: '0.16em', fontWeight: 500 }}>
        {cfg.texto}
      </div>
      {payload.fora_do_ar.length > 0 && (
        <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
          Fora do ar: {payload.fora_do_ar.join(', ')}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Historico de incidentes
// ---------------------------------------------------------------------
function Incidentes({ lista }: { lista: Incidente[] }) {
  if (lista.length === 0) {
    return <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Nenhum incidente registrado.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {lista.map((i) => (
        <div
          key={i.id}
          style={{
            border: '1px solid var(--border)',
            background: 'var(--card-bg)',
            borderRadius: 6,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 400 }}>{i.titulo}</span>
            {!i.fim && (
              <span
                style={{
                  color: 'var(--down)',
                  border: '1px solid var(--down)',
                  borderRadius: 3,
                  fontSize: 9,
                  letterSpacing: '0.12em',
                  padding: '2px 6px',
                }}
              >
                EM ABERTO
              </span>
            )}
            <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: 11 }}>
              {fmtData(i.inicio)}
              {i.fim ? ` ate ${fmtData(i.fim)}` : ''} · {duracao(i.inicio, i.fim)}
            </span>
          </div>
          {i.detalhe && <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{i.detalhe}</div>}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// Pagina principal
// ---------------------------------------------------------------------
export default function App() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Busca inicial + auto-refresh a cada 30s
  useEffect(() => {
    let vivo = true;
    const buscar = () =>
      fetch('/api/status')
        .then((r) => r.json())
        .then((p) => vivo && (setPayload(p), setErro(null)))
        .catch(() => vivo && setErro('Falha ao carregar o status. Nova tentativa em 30s.'));
    buscar();
    const t = setInterval(buscar, 30_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  // Agrupa apps por grupo preservando a ordem vinda da API
  const grupos: { nome: string; apps: AppStatus[] }[] = [];
  if (payload) {
    for (const a of payload.apps) {
      const g = grupos.find((x) => x.nome === a.grupo);
      if (g) g.apps.push(a);
      else grupos.push({ nome: a.grupo, apps: [a] });
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 20px 80px' }}>
      {/* Cabecalho */}
      <header style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 className="cinzel" style={{ fontSize: 26, fontWeight: 400, letterSpacing: '0.12em' }}>
          Monitor Parket
        </h1>
        <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
          Disponibilidade das plataformas Parket, verificada a cada 10 minutos.
          {payload && <> Atualizado em {fmtData(payload.gerado_em)}.</>}
        </div>
      </header>

      {erro && <div style={{ color: 'var(--down)', marginBottom: 20, fontSize: 13 }}>{erro}</div>}
      {!payload && !erro && <div style={{ color: 'var(--text-secondary)' }}>Carregando...</div>}

      {payload && (
        <>
          <Banner payload={payload} />

          {/* Grupos de aplicacoes */}
          {grupos.map((g) => (
            <section key={g.nome} style={{ marginTop: 34 }}>
              <h2
                className="cinzel"
                style={{
                  fontSize: 13,
                  fontWeight: 400,
                  letterSpacing: '0.18em',
                  color: g.apps[0]?.interno ? 'var(--text-muted)' : 'var(--text-secondary)',
                  marginBottom: 10,
                }}
              >
                {g.nome}
              </h2>
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--card-bg)',
                  opacity: g.apps[0]?.interno ? 0.65 : 1,
                }}
              >
                {g.apps.map((a) => (
                  <LinhaApp key={a.id} app={a} />
                ))}
              </div>
            </section>
          ))}

          {/* Incidentes */}
          <section style={{ marginTop: 40 }}>
            <h2
              className="cinzel"
              style={{ fontSize: 13, fontWeight: 400, letterSpacing: '0.18em', color: 'var(--text-secondary)', marginBottom: 10 }}
            >
              Incidentes Recentes
            </h2>
            <Incidentes lista={payload.incidentes} />
          </section>
        </>
      )}

      <footer style={{ marginTop: 60, color: 'var(--text-muted)', fontSize: 10, letterSpacing: '0.14em' }}>
        PARKET · MONITOR DE PLATAFORMAS
      </footer>
    </div>
  );
}
