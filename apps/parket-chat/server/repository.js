/**
 * REPOSITÓRIO — único ponto de acesso aos dados JÁ EXISTENTES da Parket
 * (usuários, setores, obras/clientes). O chat NÃO duplica esses dados.
 *
 * DOIS MODOS:
 *  - REAL: quando PARKET_DATABASE_URL está definida, lê do Postgres da Parket
 *    (user_profiles = usuários; kanban_cards = obras/clientes).
 *  - MOCK: sem a variável, usa dados de exemplo (desenvolvimento e testes E2E).
 *
 * IDs são SEMPRE strings (no banco real, usuários e obras são UUID).
 */

// ---------------------------------------------------------------------------
// SETORES — lista fixa das 9 plataformas. O setor de cada usuário é derivado
// das chaves de dept_permissions do user_profiles (mapeamento abaixo).
// TODO Parket: ajustar o mapeamento dept → setor se necessário.
// ---------------------------------------------------------------------------

// Nomes renomeados 24/07 (Will): Homebroker→Comercial, Valoria→Orçamento,
// Gestão→Obras, Instala→Instalador, Verifica→Fiscal, Core→Financeiro.
// IDs mantidos pra não quebrar canais/mensagens existentes no chatdb.
const SECTORS = [
  { id: '1', name: 'Comercial',  slug: 'comercial',  platform: 'homebroker.parket.works', depts: ['comercial', 'comercial-entrada', 'atendimento', 'marketing'] },
  { id: '2', name: 'Orçamento',  slug: 'orcamento',  platform: 'valor.parket.works',      depts: ['orcamento'] },
  { id: '3', name: 'Compras',    slug: 'compras',    platform: 'compras.parket.works',    depts: ['compras', 'logistica'] },
  { id: '4', name: 'Obras',      slug: 'obras',      platform: 'gestao.parket.works',     depts: ['obras', 'produtividade', 'operacional'] },
  { id: '5', name: 'Projetos',   slug: 'projetos',   platform: 'projetos.parket.works',   depts: ['projetos'] },
  { id: '6', name: 'Instalador', slug: 'instalador', platform: 'instala.parket.works',    depts: ['prestadores', 'producao'] },
  { id: '7', name: 'Fiscal',     slug: 'fiscal',     platform: 'verifica.parket.works',   depts: ['fiscal'] },
  { id: '8', name: 'Contrato',   slug: 'contrato',   platform: 'contrato.parket.works',   depts: ['rh'] },
  { id: '9', name: 'Financeiro', slug: 'financeiro', platform: 'core.parket.works',       depts: ['ia', 'sistemas', 'financeiro'] },
];

const DEPT_TO_SECTOR = {};
for (const s of SECTORS) for (const d of s.depts) DEPT_TO_SECTOR[d] = s.id;
const DEFAULT_SECTOR_ID = '9'; // Core (admins e quem não tem dept mapeado)

const WEIGHT = { manage: 3, edit: 2, view: 1 };

/** Deriva o setor a partir do dept_permissions do user_profiles. */
function sectorFromDeptPermissions(dp) {
  if (!dp || typeof dp !== 'object' || Array.isArray(dp)) return DEFAULT_SECTOR_ID;
  const score = {};
  for (const [key, val] of Object.entries(dp)) {
    const sectorId = DEPT_TO_SECTOR[key];
    if (!sectorId) continue;
    score[sectorId] = (score[sectorId] || 0) + (WEIGHT[val] || 1);
  }
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : DEFAULT_SECTOR_ID;
}

// ---------------------------------------------------------------------------
// MODO REAL — Postgres da Parket (parket-pg-local)
// ---------------------------------------------------------------------------

const REAL = !!process.env.PARKET_DATABASE_URL;
let pool = null;
if (REAL) {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: process.env.PARKET_DATABASE_URL, max: 5 });
}

function mapProfile(row) {
  return {
    id: String(row.id),
    name: row.full_name,
    email: row.email,
    role: row.role || null,
    sector_id: sectorFromDeptPermissions(row.dept_permissions),
  };
}

// Usuários reais: qualquer perfil ativo. NÃO filtrar por role — funcionários
// reais (incl. Will) têm role 'viewer'; barrar por role deixava o chat
// travado em "Carregando…" pra eles (16/07/2026).
const USERS_WHERE = 'ativo = true';

const real = {
  async getUser(id) {
    const r = await pool.query(
      `SELECT id, email, full_name, role, dept_permissions FROM public.user_profiles WHERE id = $1 AND ${USERS_WHERE}`,
      [String(id)]
    );
    return r.rows[0] ? mapProfile(r.rows[0]) : null;
  },
  async getUserByEmail(email) {
    const r = await pool.query(
      `SELECT id, email, full_name, role, dept_permissions FROM public.user_profiles
       WHERE lower(email) = lower($1) AND ${USERS_WHERE}`,
      [String(email)]
    );
    if (!r.rows[0]) return null;
    // Login manual (fallback quando a plataforma não injeta o token SSO):
    // valida contra a senha operacional em dept_permissions._senha
    const dp = r.rows[0].dept_permissions || {};
    return { ...mapProfile(r.rows[0]), password_plain: typeof dp === 'object' && dp._senha ? String(dp._senha) : null };
  },
  async getSectors() {
    return SECTORS.map(({ depts, ...s }) => s);
  },
  async getSector(id) {
    const s = SECTORS.find((x) => x.id === String(id));
    if (!s) return null;
    const { depts, ...rest } = s;
    return rest;
  },
  async getUsers() {
    const r = await pool.query(
      `SELECT id, email, full_name, role, dept_permissions FROM public.user_profiles WHERE ${USERS_WHERE} ORDER BY full_name`
    );
    return r.rows.map(mapProfile);
  },
  async getUsersBySector(sectorId) {
    return (await real.getUsers()).filter((u) => u.sector_id === String(sectorId));
  },
  async deleteProfileLocal(id) {
    // Remove do pg-local (chat lê daqui). Cloud deletion feito no endpoint.
    await pool.query('DELETE FROM public.user_profiles WHERE id = $1', [String(id)]);
  },
  async getObra(id) {
    const r = await pool.query(
      `SELECT id, title, COALESCE(NULLIF(obra, ''), subtitle, '') AS cliente FROM public.kanban_cards WHERE id = $1`,
      [String(id)]
    );
    return r.rows[0] ? { id: String(r.rows[0].id), nome: r.rows[0].title, cliente: r.rows[0].cliente || '' } : null;
  },
  // Obras do fiscal (Verifica): cards com agenda/laudo dele + cards onde ele é
  // fiscal responsável (kanban_cards.details.fiscais). Mesma regra do app
  // verifica.parket.works. Ordena: próxima visita primeiro, depois laudos
  // pendentes, depois atividade recente.
  // Admin/superadmin ou dept_permissions.obras (mesma regra do modo admin do
  // Verifica): vê as obras de TODOS os fiscais, com o nome do fiscal em cada.
  // Usuário sem vínculo fiscal e sem acesso obras → [].
  async getObrasDoFiscal(userId, limit) {
    const fr = await pool.query(
      `SELECT id FROM public.fiscal_equipe WHERE user_id = $1 AND ativo = true`,
      [String(userId)]
    );
    let fiscalIds = fr.rows.map((x) => String(x.id));
    if (!fiscalIds.length) {
      const pr = await pool.query(
        `SELECT role, dept_permissions FROM public.user_profiles WHERE id = $1 AND ativo = true`,
        [String(userId)]
      );
      const p = pr.rows[0];
      const dp = p && p.dept_permissions;
      const isAdmin =
        p && (p.role === 'admin' || p.role === 'superadmin' || (dp && typeof dp === 'object' && !Array.isArray(dp) && dp.obras != null));
      if (!isAdmin) return [];
      const allf = await pool.query(`SELECT id FROM public.fiscal_equipe WHERE ativo = true`);
      fiscalIds = allf.rows.map((x) => String(x.id));
      if (!fiscalIds.length) return [];
    }
    const r = await pool.query(
      `WITH f AS (
         SELECT unnest($1::uuid[]) AS id
       ),
       ag AS (
         SELECT a.card_id,
                min(a.data_inicio) FILTER (WHERE a.data_inicio >= now() - interval '12 hours') AS proxima,
                max(a.data_inicio) AS ultima
         FROM public.fiscal_agenda a JOIN f ON a.fiscal_id = f.id
         WHERE a.card_id IS NOT NULL AND a.status <> 'cancelado'
         GROUP BY a.card_id
       ),
       ld AS (
         SELECT l.card_id,
                count(*) FILTER (WHERE l.status IN ('pendente', 'em_andamento')) AS pendentes,
                max(l.updated_at) AS upd
         FROM public.fiscal_laudos l JOIN f ON l.fiscal_id = f.id
         WHERE l.card_id IS NOT NULL
         GROUP BY l.card_id
       ),
       resp AS (
         SELECT c.id AS card_id FROM public.kanban_cards c
         WHERE EXISTS (
           SELECT 1 FROM f
           WHERE c.details -> 'fiscais' @> jsonb_build_array(jsonb_build_object('id', f.id::text))
         )
       ),
       ids AS (
         SELECT card_id FROM ag UNION SELECT card_id FROM ld UNION SELECT card_id FROM resp
       ),
       nomes AS (
         SELECT x.card_id, string_agg(DISTINCT trim(fe.nome), ', ') AS fiscais
         FROM (
           SELECT a2.card_id, a2.fiscal_id FROM public.fiscal_agenda a2 JOIN f ON a2.fiscal_id = f.id WHERE a2.card_id IS NOT NULL
           UNION
           SELECT l2.card_id, l2.fiscal_id FROM public.fiscal_laudos l2 JOIN f ON l2.fiscal_id = f.id WHERE l2.card_id IS NOT NULL
         ) x JOIN public.fiscal_equipe fe ON fe.id = x.fiscal_id
         GROUP BY x.card_id
       )
       SELECT c.id, c.title, COALESCE(NULLIF(c.obra, ''), c.subtitle, '') AS cliente,
              ag.proxima, COALESCE(ld.pendentes, 0) AS pendentes, nomes.fiscais
       FROM ids
       JOIN public.kanban_cards c ON c.id = ids.card_id
       LEFT JOIN ag ON ag.card_id = ids.card_id
       LEFT JOIN ld ON ld.card_id = ids.card_id
       LEFT JOIN nomes ON nomes.card_id = ids.card_id
       WHERE c.dept_id NOT LIKE '%\\_archived'
       ORDER BY (ag.proxima IS NULL), ag.proxima ASC,
                (COALESCE(ld.pendentes, 0) = 0),
                GREATEST(COALESCE(ag.ultima, 'epoch'), COALESCE(ld.upd, 'epoch')) DESC
       LIMIT ${Number(limit) > 0 ? Number(limit) : fiscalIds.length > 1 ? 20 : 12}`,
      [fiscalIds]
    );
    const multi = fiscalIds.length > 1;
    return r.rows.map((row) => ({
      id: String(row.id),
      nome: row.title,
      // alguns cards têm o próprio UUID como subtitle — não é nome de cliente
      cliente: row.cliente && row.cliente !== String(row.id) ? row.cliente : '',
      proxima: row.proxima ? new Date(row.proxima).toISOString() : null,
      pendentes: Number(row.pendentes) || 0,
      fiscal: multi ? row.fiscais || '' : '',
    }));
  },
  // Obras da GESTÃO + do board PROJETOS — fonte única da lista de obras do chat.
  // Cada projeto do gestão aponta pro card do sistema (card_id), que é o mesmo
  // id usado em obra_threads.obra_id. O UNION já colapsa o card que tem mais de
  // um projeto (aditivos), porque todas as colunas saem de kanban_cards.
  // O segundo braço traz os cards do board Projetos que ainda não viraram linha
  // em gestao.projetos: são obras reais que o setor já toca e que sem isso não
  // apareceriam em lugar nenhum do chat (5 casos em 03/09, ex. BRUNO COLODETTI).
  async getObrasDaGestao() {
    const r = await pool.query(
      `SELECT c.id, c.title, c.dept_id,
              COALESCE(NULLIF(c.obra, ''), c.subtitle, '') AS cliente, c.updated_at
       FROM gestao.projetos p
       JOIN public.kanban_cards c ON c.id = p.card_id
       WHERE c.dept_id NOT LIKE '%\\_archived'
       UNION
       SELECT c.id, c.title, c.dept_id,
              COALESCE(NULLIF(c.obra, ''), c.subtitle, '') AS cliente, c.updated_at
       FROM public.kanban_cards c
       WHERE c.dept_id = 'projetos'
         AND NOT EXISTS (SELECT 1 FROM gestao.projetos g WHERE g.card_id = c.id)`
    );
    return r.rows
      .map((row) => ({
        id: String(row.id),
        nome: row.title,
        dept: row.dept_id || '',
        cliente: row.cliente && row.cliente !== String(row.id) ? row.cliente : '',
        _upd: row.updated_at ? new Date(row.updated_at).getTime() : 0,
      }))
      .sort((a, b) => b._upd - a._upd)
      .map(({ _upd, ...o }) => o);
  },
  // Obras do instalador (Instala): o usuário do chat é ligado a um prestador
  // por auth_user_id ou pelo e-mail. As obras dele vêm do vínculo explícito
  // (prestador_card) e dos prestadores marcados no card (details.prestadores).
  async getObrasDoPrestador(userId, email) {
    const pr = await pool.query(
      `SELECT id FROM public.prestadores
       WHERE ativo IS NOT false
         AND (auth_user_id = $1 OR ($2 <> '' AND lower(email) = lower($2)))`,
      [String(userId), String(email || '')]
    );
    const ids = pr.rows.map((x) => String(x.id));
    if (!ids.length) return null; // null = não é prestador (≠ prestador sem obra)
    const r = await pool.query(
      `WITH p AS (SELECT unnest($1::uuid[]) AS id),
       ids AS (
         SELECT pc.card_id FROM public.prestador_card pc JOIN p ON pc.prestador_id = p.id
         WHERE pc.card_id IS NOT NULL
         UNION
         SELECT c.id FROM public.kanban_cards c
         WHERE EXISTS (
           SELECT 1 FROM p
           WHERE c.details -> 'prestadores' @> jsonb_build_array(jsonb_build_object('id', p.id::text))
         )
       )
       SELECT c.id, c.title, COALESCE(NULLIF(c.obra, ''), c.subtitle, '') AS cliente
       FROM ids JOIN public.kanban_cards c ON c.id = ids.card_id
       WHERE c.dept_id NOT LIKE '%\\_archived'
       ORDER BY c.updated_at DESC`,
      [ids]
    );
    return r.rows.map((row) => ({
      id: String(row.id),
      nome: row.title,
      cliente: row.cliente && row.cliente !== String(row.id) ? row.cliente : '',
    }));
  },
  // Quais obras este usuário pode ver no chat (Will 03/09):
  //  - fiscal (fiscal_equipe) e instalador (prestadores): SÓ as designadas a ele
  //  - todo o resto: TODAS as obras do gestão
  // restrito=true significa que a lista é fechada: o que não está nela some da
  // barra lateral e não pode ser aberto.
  async getObrasVisiveis(user) {
    const uid = String(user && user.id);
    const fr = await pool.query(`SELECT 1 FROM public.fiscal_equipe WHERE user_id = $1 AND ativo = true LIMIT 1`, [uid]);
    if (fr.rows.length) return { restrito: true, obras: await real.getObrasDoFiscal(uid, 200) };
    const doPrestador = await real.getObrasDoPrestador(uid, user && user.email);
    if (doPrestador) return { restrito: true, obras: doPrestador };
    return { restrito: false, obras: await real.getObrasDaGestao() };
  },
};

// ---------------------------------------------------------------------------
// MODO MOCK — desenvolvimento e testes E2E (sem PARKET_DATABASE_URL)
// Senha de todos: "parket123"
// ---------------------------------------------------------------------------

const TEST_PASSWORD_HASH = '$2a$10$jLnP7eBBo/W5MOAVQEFCWOKS.kIxmNsUZ5LdS7BI1pPK5PeSJ6UGK';

const USERS = [
  { id: '1',  name: 'Ana Souza',      email: 'ana@parket.com.br',      sector_id: '1' },
  { id: '2',  name: 'Bruno Lima',     email: 'bruno@parket.com.br',    sector_id: '1' },
  { id: '3',  name: 'Carla Mendes',   email: 'carla@parket.com.br',    sector_id: '2' },
  { id: '4',  name: 'Diego Ferreira', email: 'diego@parket.com.br',    sector_id: '2' },
  { id: '5',  name: 'Elisa Ramos',    email: 'elisa@parket.com.br',    sector_id: '3' },
  { id: '6',  name: 'Fábio Nunes',    email: 'fabio@parket.com.br',    sector_id: '4' },
  { id: '7',  name: 'Gabriela Costa', email: 'gabriela@parket.com.br', sector_id: '5' },
  { id: '8',  name: 'Hugo Martins',   email: 'hugo@parket.com.br',     sector_id: '6' },
  { id: '9',  name: 'Isabela Rocha',  email: 'isabela@parket.com.br',  sector_id: '7' },
  { id: '10', name: 'João Pereira',   email: 'joao@parket.com.br',     sector_id: '8' },
  { id: '11', name: 'Will',           email: 'will@parket.com.br',     sector_id: '9' },
  // Homônimos-prefixo de "Elisa Ramos" — cobrem o bug de menção por substring
  // ("@Administrador" adicionava o usuário "admin" à obra, 16/07).
  { id: '12', name: 'Elisa',          email: 'elisa.h@parket.com.br',  sector_id: '4' },
  { id: '13', name: 'Eli',            email: 'eli@parket.com.br',      sector_id: '4' },
];

const OBRAS = [
  { id: '101', nome: 'Residência Alameda Jaú 512',      cliente: 'Mariana e Bruno' },
  { id: '102', nome: 'Apartamento Vila Nova Conceição', cliente: 'Fernanda Albuquerque' },
  { id: '103', nome: 'Casa Alto de Pinheiros',          cliente: 'Ricardo Salles' },
  { id: '104', nome: 'Cobertura Itaim Bibi',            cliente: 'Paulo e Renata Gomes' },
  { id: '105', nome: 'Escritório Faria Lima 4440',      cliente: 'Vertex Capital' },
  { id: '106', nome: 'Loja Oscar Freire',               cliente: 'Maison Décor' },
  { id: '107', nome: 'Residência Granja Viana',         cliente: 'Família Tanaka' },
  { id: '108', nome: 'Studio Pinheiros',                cliente: 'Camila Duarte' },
];

const mock = {
  async getUser(id) {
    return USERS.find((u) => u.id === String(id)) || null;
  },
  async getUserByEmail(email) {
    const u = USERS.find((x) => x.email.toLowerCase() === String(email).toLowerCase());
    return u ? { ...u, password_hash: TEST_PASSWORD_HASH } : null;
  },
  async getSectors() {
    return SECTORS.map(({ depts, ...s }) => s);
  },
  async getSector(id) {
    const s = SECTORS.find((x) => x.id === String(id));
    if (!s) return null;
    const { depts, ...rest } = s;
    return rest;
  },
  async getUsers() {
    return USERS.map(({ id, name, email, sector_id }) => ({ id, name, email, sector_id }));
  },
  async getUsersBySector(sectorId) {
    return USERS.filter((u) => u.sector_id === String(sectorId));
  },
  async getObra(id) {
    return OBRAS.find((o) => o.id === String(id)) || null;
  },
  async getObrasDoFiscal(userId) {
    const u = USERS.find((x) => x.id === String(userId));
    if (!u || u.sector_id !== '7') return [];
    return [
      { ...OBRAS[0], proxima: new Date(Date.now() + 864e5).toISOString(), pendentes: 1 },
      { ...OBRAS[1], proxima: null, pendentes: 0 },
    ];
  },
  // No mock não existe gestao.projetos: a lista de obras é a própria OBRAS.
  async getObrasDaGestao() {
    return OBRAS.slice();
  },
  async getObrasDoPrestador(userId) {
    const u = USERS.find((x) => x.id === String(userId));
    if (!u || u.sector_id !== '6') return null;
    return [OBRAS[2], OBRAS[3]];
  },
  // Mesma regra do modo real: setor Fiscal e Instalador são restritos.
  async getObrasVisiveis(user) {
    const uid = String(user && user.id);
    const u = USERS.find((x) => x.id === uid);
    if (u && u.sector_id === '7') return { restrito: true, obras: await mock.getObrasDoFiscal(uid) };
    const doPrestador = await mock.getObrasDoPrestador(uid);
    if (doPrestador) return { restrito: true, obras: doPrestador };
    return { restrito: false, obras: await mock.getObrasDaGestao() };
  },
};

module.exports = REAL ? { ...real, REAL, pool } : { ...mock, REAL, pool: null };
if (REAL) console.log('[parket-chat] repositório em MODO REAL (Postgres da Parket)');
else console.log('[parket-chat] repositório em MODO MOCK (defina PARKET_DATABASE_URL para produção)');
