// =====================================================================
// MONITOR PARKET (monitor.parket.works)
// Processo unico com 3 papeis:
//   1. CHECKER: a cada 60s bate HTTPS em todas as apps ativas do
//      monitor.apps e grava resultado em monitor.checks (+rollup diario)
//   2. INCIDENTES: 3 falhas consecutivas abre incidente automatico;
//      2 sucessos consecutivos resolve (preenche fim)
//   3. API + STATIC: /api/status (payload completo da pagina) e serve
//      o frontend buildado em ../web/dist
// Banco: PG LOCAL (parket-pg-local) via rede parket-api_internal.
// =====================================================================

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------
// Conexao PG: senha via arquivo de secret do Swarm (PASSWORD_FILE) com
// fallback pra variavel direta (uso em dev local)
// ---------------------------------------------------------------------
function pgPassword() {
  const file = process.env.MONITOR_PG_PASSWORD_FILE;
  if (file && fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  return process.env.MONITOR_PG_PASSWORD || 'postgres';
}

const pool = new pg.Pool({
  host: process.env.MONITOR_PG_HOST || 'postgres',
  port: Number(process.env.MONITOR_PG_PORT || 5432),
  database: process.env.MONITOR_PG_DB || 'postgres',
  user: process.env.MONITOR_PG_USER || 'postgres',
  password: pgPassword(),
  max: 5,
});

// =====================================================================
// CHECKER
// =====================================================================

// Intervalo entre rodadas de checagem: 10 min (pedido do Will 25/08,
// pra nao sobrecarregar as apps). Sobrescrevivel via MONITOR_INTERVALO_MS.
const INTERVALO_MS = Number(process.env.MONITOR_INTERVALO_MS || 600_000);
const TIMEOUT_MS = Number(process.env.MONITOR_TIMEOUT_MS || 10_000);
const CONCORRENCIA = 8;            // checagens HTTP simultaneas
const FALHAS_ABRE_INCIDENTE = 3;   // falhas consecutivas pra abrir (3 x 10min = ~30min)
const OKS_RESOLVE_INCIDENTE = 2;   // sucessos consecutivos pra resolver

// Checa uma URL: qualquer resposta HTTP < 500 conta como "no ar"
// (401/403/redirect sao apps com login, o servidor respondeu).
// Timeout ou 5xx = fora do ar.
async function checarUrl(url) {
  const inicio = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'ParketMonitor/1.0 (+https://monitor.parket.works)' },
    });
    const latencia = Date.now() - inicio;
    return {
      ok: res.status < 500,
      http_status: res.status,
      latencia_ms: latencia,
      erro: res.status >= 500 ? `HTTP ${res.status}` : null,
    };
  } catch (e) {
    return {
      ok: false,
      http_status: null,
      latencia_ms: Date.now() - inicio,
      erro: e.name === 'AbortError' ? `timeout ${TIMEOUT_MS}ms` : String(e.cause?.code || e.message).slice(0, 200),
    };
  } finally {
    clearTimeout(timer);
  }
}

// Grava o resultado cru + incrementa o rollup diario (upsert)
async function gravarCheck(appId, r) {
  await pool.query(
    `INSERT INTO monitor.checks (app_id, ok, http_status, latencia_ms, erro)
     VALUES ($1, $2, $3, $4, $5)`,
    [appId, r.ok, r.http_status, r.latencia_ms, r.erro]
  );
  await pool.query(
    `INSERT INTO monitor.checks_diario (app_id, dia, total, ok_total, latencia_soma)
     VALUES ($1, CURRENT_DATE, 1, $2, $3)
     ON CONFLICT (app_id, dia) DO UPDATE SET
       total = monitor.checks_diario.total + 1,
       ok_total = monitor.checks_diario.ok_total + EXCLUDED.ok_total,
       latencia_soma = monitor.checks_diario.latencia_soma + EXCLUDED.latencia_soma`,
    [appId, r.ok ? 1 : 0, r.ok ? r.latencia_ms : 0]
  );
}

// Abre/resolve incidente conforme sequencia recente de checks no banco
// (estado no banco, nao em memoria: sobrevive a restart do servico)
async function gerirIncidente(app, r) {
  const { rows } = await pool.query(
    `SELECT ok FROM monitor.checks WHERE app_id = $1 ORDER BY ts DESC LIMIT $2`,
    [app.id, Math.max(FALHAS_ABRE_INCIDENTE, OKS_RESOLVE_INCIDENTE)]
  );
  const seq = rows.map((x) => x.ok);

  const { rows: abertos } = await pool.query(
    `SELECT id FROM monitor.incidentes WHERE app_id = $1 AND fim IS NULL ORDER BY inicio DESC LIMIT 1`,
    [app.id]
  );
  const aberto = abertos[0];

  const todasFalhas = seq.length >= FALHAS_ABRE_INCIDENTE &&
    seq.slice(0, FALHAS_ABRE_INCIDENTE).every((ok) => !ok);
  const todosOk = seq.length >= OKS_RESOLVE_INCIDENTE &&
    seq.slice(0, OKS_RESOLVE_INCIDENTE).every((ok) => ok);

  if (!aberto && todasFalhas) {
    await pool.query(
      `INSERT INTO monitor.incidentes (app_id, titulo, detalhe)
       VALUES ($1, $2, $3)`,
      [app.id, `${app.nome} indisponivel`, r.erro || 'falhas consecutivas no health check']
    );
    console.log(`[incidente] ABERTO: ${app.slug} (${r.erro || 'sem detalhe'})`);
  } else if (aberto && todosOk) {
    await pool.query(`UPDATE monitor.incidentes SET fim = now() WHERE id = $1`, [aberto.id]);
    console.log(`[incidente] RESOLVIDO: ${app.slug}`);
  }
}

// Uma rodada completa: todas as apps ativas, com limite de concorrencia
async function rodada() {
  const { rows: apps } = await pool.query(
    `SELECT id, slug, nome, url FROM monitor.apps WHERE ativo ORDER BY id`
  );
  const fila = [...apps];
  const workers = Array.from({ length: CONCORRENCIA }, async () => {
    while (fila.length) {
      const app = fila.shift();
      try {
        const r = await checarUrl(app.url);
        await gravarCheck(app.id, r);
        await gerirIncidente(app, r);
      } catch (e) {
        console.error(`[checker] erro em ${app.slug}:`, e.message);
      }
    }
  });
  await Promise.all(workers);
}

// Limpeza: checks crus com mais de 7 dias (rollup diario preserva o historico)
async function limparAntigos() {
  const { rowCount } = await pool.query(
    `DELETE FROM monitor.checks WHERE ts < now() - interval '7 days'`
  );
  if (rowCount) console.log(`[retencao] ${rowCount} checks antigos removidos`);
}

// =====================================================================
// API
// =====================================================================

const app = express();

// Payload unico com tudo que a pagina precisa: estado atual por app,
// uptime 24h/90d, barra diaria de 90 dias e incidentes recentes
app.get('/api/status', async (_req, res) => {
  try {
    const [apps, atuais, diarios, recentes, incidentes] = await Promise.all([
      pool.query(
        `SELECT id, slug, nome, url, grupo, grupo_ordem, ordem, interno
         FROM monitor.apps WHERE ativo ORDER BY grupo_ordem, ordem`
      ),
      // Ultimo check + uptime/latencia das ultimas 24h por app
      pool.query(
        `SELECT c.app_id,
                (array_agg(c.ok ORDER BY c.ts DESC))[1]          AS ok_atual,
                (array_agg(c.http_status ORDER BY c.ts DESC))[1] AS http_atual,
                (array_agg(c.erro ORDER BY c.ts DESC))[1]        AS erro_atual,
                (array_agg(c.latencia_ms ORDER BY c.ts DESC))[1] AS latencia_atual,
                round(100.0 * count(*) FILTER (WHERE c.ok) / count(*), 2) AS uptime_24h,
                round(avg(c.latencia_ms) FILTER (WHERE c.ok))    AS latencia_media_24h
         FROM monitor.checks c
         WHERE c.ts > now() - interval '24 hours'
         GROUP BY c.app_id`
      ),
      // Barra de 90 dias (rollup)
      pool.query(
        `SELECT app_id, dia, total, ok_total,
                CASE WHEN ok_total > 0 THEN (latencia_soma / ok_total)::int ELSE NULL END AS latencia_media
         FROM monitor.checks_diario
         WHERE dia > CURRENT_DATE - 90
         ORDER BY dia`
      ),
      // Barra por verificacao: ultimas 90 checagens cruas de cada app
      // (com intervalo de 10 min cobre ~15h; retencao dos crus e 7 dias)
      pool.query(
        `SELECT app_id, ts, ok, latencia_ms, erro
         FROM (
           SELECT c.app_id, c.ts, c.ok, c.latencia_ms, c.erro,
                  row_number() OVER (PARTITION BY c.app_id ORDER BY c.ts DESC) AS rn
           FROM monitor.checks c
         ) x
         WHERE rn <= 90
         ORDER BY app_id, ts`
      ),
      pool.query(
        `SELECT i.id, i.app_id, a.nome AS app_nome, a.slug, i.inicio, i.fim, i.titulo, i.detalhe
         FROM monitor.incidentes i JOIN monitor.apps a ON a.id = i.app_id
         ORDER BY i.inicio DESC LIMIT 30`
      ),
    ]);

    const porApp = new Map(atuais.rows.map((r) => [r.app_id, r]));
    const checksPorApp = new Map();
    for (const c of recentes.rows) {
      if (!checksPorApp.has(c.app_id)) checksPorApp.set(c.app_id, []);
      checksPorApp.get(c.app_id).push({
        ts: c.ts,
        ok: c.ok,
        latencia_ms: c.latencia_ms,
        erro: c.erro,
      });
    }
    const diasPorApp = new Map();
    for (const d of diarios.rows) {
      if (!diasPorApp.has(d.app_id)) diasPorApp.set(d.app_id, []);
      diasPorApp.get(d.app_id).push({
        dia: d.dia,
        total: d.total,
        ok_total: d.ok_total,
        latencia_media: d.latencia_media,
      });
    }

    const lista = apps.rows.map((a) => {
      const atual = porApp.get(a.id);
      const dias = diasPorApp.get(a.id) || [];
      const tot = dias.reduce((s, d) => s + d.total, 0);
      const okTot = dias.reduce((s, d) => s + d.ok_total, 0);
      return {
        ...a,
        estado: atual ? (atual.ok_atual ? 'ok' : 'down') : 'sem_dados',
        http_atual: atual?.http_atual ?? null,
        erro_atual: atual?.erro_atual ?? null,
        latencia_atual: atual?.latencia_atual ?? null,
        uptime_24h: atual ? Number(atual.uptime_24h) : null,
        latencia_media_24h: atual?.latencia_media_24h != null ? Number(atual.latencia_media_24h) : null,
        uptime_90d: tot ? Number(((100 * okTot) / tot).toFixed(2)) : null,
        dias,
        checks: checksPorApp.get(a.id) || [],
      };
    });

    // Estado geral: pior estado entre as apps nao-internas
    const visiveis = lista.filter((a) => !a.interno);
    const fora = visiveis.filter((a) => a.estado === 'down');
    const geral = fora.length === 0 ? 'ok' : fora.length <= 2 ? 'parcial' : 'critico';

    res.json({
      gerado_em: new Date().toISOString(),
      geral,
      fora_do_ar: fora.map((a) => a.nome),
      apps: lista,
      incidentes: incidentes.rows,
    });
  } catch (e) {
    console.error('[api] /api/status:', e);
    res.status(500).json({ erro: 'falha ao montar status' });
  }
});

// Health do proprio monitor (usado pelo Swarm/Traefik, nao entra nas metricas)
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Frontend buildado (Vite) + fallback SPA
const dist = path.join(__dirname, '..', 'web', 'dist');
app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

// =====================================================================
// BOOT
// =====================================================================

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`[monitor] API na porta ${PORT}`));

// Primeira rodada imediata, depois a cada INTERVALO_MS; limpeza 1x/hora
rodada().catch((e) => console.error('[checker] rodada inicial:', e.message));
setInterval(() => rodada().catch((e) => console.error('[checker]', e.message)), INTERVALO_MS);
setInterval(() => limparAntigos().catch((e) => console.error('[retencao]', e.message)), 3600_000);
