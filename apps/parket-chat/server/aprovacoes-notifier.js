/**
 * Notifier de Aprovações Core → canal #financeiro (sector 9).
 *
 * A cada 60s consulta pendentes nas 7 tabelas origem, compara com
 * core.aprovacoes_notif_log pra não repetir, e posta no canal como o
 * bot user (id fixo). No primeiro boot só semeia o log — não floda o
 * canal com backlog histórico.
 *
 * Escopo: MVP, apenas chat. Escala depois pra WhatsApp/Push mudando
 * o `send` callback.
 */

const CORE_URL = process.env.CORE_URL || 'https://core.parket.works';
const BOT_USER_ID = '00000000-0000-0000-0000-000000aa0001';
const CHANNEL_ID  = Number(process.env.APROVACOES_CHANNEL_ID || 11); // #financeiro
const POLL_MS     = Number(process.env.APROVACOES_POLL_MS || 60_000);
const ICON = { receber: '💰', prestadores: '👷', compras: '🛒', fretes: '🚚',
               viagens: '✈️', rh: '💼', reembolsos: '🧾' };

// Cada query devolve: tipo, row_id, label, valor
const QUERIES = [
  // Contas a receber
  `SELECT 'receber' AS tipo, id::text AS row_id,
          COALESCE(descricao, numero, 'sem descrição') AS label,
          COALESCE(valor,0)::float AS valor
     FROM erp.contas_receber
    WHERE status IN ('ABERTO','PARCIAL')`,
  // Prestadores pagamentos
  `SELECT 'prestadores' AS tipo, id::text AS row_id,
          COALESCE(prestador_nome,'sem nome') || ' · ' || periodo AS label,
          COALESCE(valor,0)::float AS valor
     FROM public.prestadores_pagamentos
    WHERE status IN ('pendente','liberado')`,
  // Compras pedidos
  `SELECT 'compras' AS tipo, id::text AS row_id,
          numero AS label,
          COALESCE(total,0)::float AS valor
     FROM erp.pedidos_compra
    WHERE requer_aprovacao=true AND status='pendente'`,
  // Fretes
  `SELECT 'fretes' AS tipo, id::text AS row_id,
          COALESCE(transportadora, solicitante, 'frete') AS label,
          COALESCE(valor_orcado,0)::float AS valor
     FROM core.fretes_solicitacoes
    WHERE status='pendente'`,
  // Viagens
  `SELECT 'viagens' AS tipo, v.id::text AS row_id,
          COALESCE(f.nome,'?') || ' → ' || COALESCE(v.destino_cidade,'?') AS label,
          COALESCE(v.adiantamento,0)::float AS valor
     FROM core.viagens v LEFT JOIN core.funcionarios f ON f.id=v.funcionario_id
    WHERE v.status='planejada'`,
  // RH adiantamentos
  `SELECT 'rh' AS tipo, a.id::text AS row_id,
          COALESCE(col.nome,'?') || ' · ' || COALESCE(a.motivo,'adiantamento') AS label,
          COALESCE(a.valor,0)::float AS valor
     FROM rh.adiantamentos a
     LEFT JOIN rh.contratos c   ON c.id=a.contrato_id
     LEFT JOIN rh.colaboradores col ON col.id=c.colaborador_id
    WHERE a.status='pendente'`,
  // Reembolsos
  `SELECT 'reembolsos' AS tipo, r.id::text AS row_id,
          COALESCE(col.nome,'?') || ' · ' || r.categoria || ' · ' || SUBSTRING(r.descricao,1,60) AS label,
          COALESCE(r.valor,0)::float AS valor
     FROM rh.reembolsos r LEFT JOIN rh.colaboradores col ON col.id=r.colaborador_id
    WHERE r.status='pendente'`,
];

// ── Compras itens (Supabase Cloud — tabela compras_itens não existe no PG local) ──
const CLOUD_REST = process.env.PARKET_CLOUD_REST_URL || 'https://hbxpilrxmitvzebluoom.supabase.co/rest/v1';
const CLOUD_ANON = process.env.PARKET_CLOUD_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0';
const COMPRAS_CHANNEL_ID = Number(process.env.COMPRAS_CHANNEL_ID || 5); // #compras

async function fetchCloudComprasItens() {
  const url = `${CLOUD_REST}/compras_itens` +
    `?select=id,material,fornecedor_nome_snapshot,valor,status` +
    `&status=in.(aguardando_aprovacao,pago)&limit=1000`;
  const r = await fetch(url, { headers: { apikey: CLOUD_ANON, Authorization: `Bearer ${CLOUD_ANON}` } });
  if (!r.ok) throw new Error(`cloud compras_itens HTTP ${r.status}`);
  const itens = await r.json();
  return itens.map((it) => {
    const aguardando = it.status === 'aguardando_aprovacao';
    const forn = it.fornecedor_nome_snapshot ? ` · ${it.fornecedor_nome_snapshot}` : '';
    return {
      tipo: aguardando ? 'compras_item_aguardando' : 'compras_item_pago',
      row_id: it.id,
      canal: aguardando ? CHANNEL_ID : COMPRAS_CHANNEL_ID,
      text: aguardando
        ? `**Compra aguardando aprovação** — ${it.material}${forn} · ${fmtBRL(it.valor)}\nAprovar em ${CORE_URL}/aprovacoes`
        : `**Compra paga** — ${it.material}${forn} · ${fmtBRL(it.valor)}`,
    };
  });
}

async function filterNotSent(pool, rows) {
  if (!rows.length) return [];
  const r = await pool.query(
    `SELECT tipo, row_id FROM core.aprovacoes_notif_log
      WHERE tipo = ANY($1) AND row_id = ANY($2)`,
    [[...new Set(rows.map((x) => x.tipo))], rows.map((x) => x.row_id)]
  );
  const sent = new Set(r.rows.map((x) => `${x.tipo}:${x.row_id}`));
  return rows.filter((x) => !sent.has(`${x.tipo}:${x.row_id}`));
}

async function tickComprasItens(pool, postMessage, repository) {
  let novos = [];
  try {
    novos = await filterNotSent(pool, await fetchCloudComprasItens());
  } catch (e) {
    console.warn('[aprovacoes-notif] compras_itens:', e.message);
    return;
  }
  if (!novos.length) return;

  let bot;
  try { bot = await repository.getUser(BOT_USER_ID); } catch (_) { bot = null; }
  if (!bot) return;

  for (const n of novos) {
    try {
      const res = await postMessage(bot, { convType: 'channel', convId: n.canal, content: n.text });
      if (res && res.error) { console.warn('[aprovacoes-notif] compras post err:', res.error); continue; }
      await markSent(pool, n.tipo, n.row_id, n.text);
    } catch (e) {
      console.warn('[aprovacoes-notif] compras post exception:', e.message);
    }
  }
}

async function seedComprasItens(pool) {
  const rows = await fetchCloudComprasItens();
  let n = 0;
  for (const x of rows) {
    const r = await pool.query(
      `INSERT INTO core.aprovacoes_notif_log (tipo, row_id, message)
       VALUES ($1,$2,'[seed inicial]') ON CONFLICT (tipo,row_id) DO NOTHING`,
      [x.tipo, x.row_id]
    );
    n += r.rowCount || 0;
  }
  return n;
}

function fmtBRL(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function messageFor(row) {
  const icon = ICON[row.tipo] || '•';
  return `${icon} **Aprovação ${row.tipo}** — ${row.label} · ${fmtBRL(row.valor)}\nAprovar em ${CORE_URL}/aprovacoes`;
}

async function fetchNew(pool) {
  // Une as 7 queries, LEFT JOIN no log → devolve só as não-notificadas.
  const union = QUERIES.map((q) => `(${q})`).join(' UNION ALL ');
  const sql = `
    WITH pendentes AS (${union})
    SELECT p.tipo, p.row_id, p.label, p.valor
      FROM pendentes p
 LEFT JOIN core.aprovacoes_notif_log l ON l.tipo=p.tipo AND l.row_id=p.row_id
     WHERE l.row_id IS NULL
     ORDER BY p.tipo`;
  const r = await pool.query(sql);
  return r.rows;
}

async function markSent(pool, tipo, rowId, message) {
  await pool.query(
    `INSERT INTO core.aprovacoes_notif_log (tipo, row_id, message)
     VALUES ($1,$2,$3) ON CONFLICT (tipo,row_id) DO NOTHING`,
    [tipo, rowId, message.slice(0, 500)]
  );
}

async function seed(pool) {
  // Marca TUDO que já está pendente como notificado, sem postar. Rodado 1x
  // no boot pra evitar flood do histórico. Rodadas seguintes só pegam novos.
  const union = QUERIES.map((q) => `(${q})`).join(' UNION ALL ');
  const sql = `
    INSERT INTO core.aprovacoes_notif_log (tipo, row_id, message)
    SELECT tipo, row_id, '[seed inicial]' FROM (${union}) x
    ON CONFLICT DO NOTHING`;
  const r = await pool.query(sql);
  return r.rowCount || 0;
}

async function tick(pool, postMessage, repository) {
  let rows = [];
  try { rows = await fetchNew(pool); } catch (e) {
    console.warn('[aprovacoes-notif] fetchNew:', e.message);
    return;
  }
  if (!rows.length) return;

  let bot;
  try { bot = await repository.getUser(BOT_USER_ID); } catch (_) { bot = null; }
  if (!bot) {
    console.warn('[aprovacoes-notif] bot user não encontrado — pulando');
    return;
  }

  for (const r of rows) {
    const text = messageFor(r);
    try {
      const res = await postMessage(bot, { convType: 'channel', convId: CHANNEL_ID, content: text });
      if (res && res.error) {
        console.warn('[aprovacoes-notif] post err:', res.error);
        continue;
      }
      await markSent(pool, r.tipo, r.row_id, text);
    } catch (e) {
      console.warn('[aprovacoes-notif] post exception:', e.message);
    }
  }
}

function startAprovacoesNotifier({ pool, postMessage, repository }) {
  if (!pool) { console.warn('[aprovacoes-notif] sem pool — desabilitado'); return; }
  (async () => {
    try {
      const seeded = await seed(pool);
      console.log(`[aprovacoes-notif] seed inicial: ${seeded} pendente(s) marcados sem postar`);
    } catch (e) {
      console.warn('[aprovacoes-notif] seed:', e.message);
    }
    try {
      const seeded = await seedComprasItens(pool);
      console.log(`[aprovacoes-notif] seed compras_itens: ${seeded} marcados sem postar`);
    } catch (e) {
      console.warn('[aprovacoes-notif] seed compras_itens:', e.message);
    }
  })();
  setInterval(() => tick(pool, postMessage, repository).catch(() => {}), POLL_MS);
  setInterval(() => tickComprasItens(pool, postMessage, repository).catch(() => {}), POLL_MS);
  console.log(`[aprovacoes-notif] ligado — poll ${POLL_MS}ms, canal ${CHANNEL_ID}`);
}

module.exports = { startAprovacoesNotifier, fetchNew, seed, messageFor };
