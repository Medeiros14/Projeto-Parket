/**
 * Parket Chat — backend único de mensagens entre setores.
 * Express (REST) + Socket.io (tempo real). Porta 3000.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const bcrypt = require('bcryptjs');

const repository = require('./repository');
const { db, stmt, ensureChannels } = require('./chatdb');
const { startAprovacoesNotifier } = require('./aprovacoes-notifier');
const { signToken, requireAuth, socketAuth } = require('./auth');
const teca = require('./teca');

const PORT = Number(process.env.PORT || 3000);
const MAX_MESSAGE_LENGTH = 4000;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: false } });

app.use(express.json({ limit: '1mb' }));

// CORS — o widget roda embutido nas plataformas dos setores (outras origens).
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Permite embutir via iframe nas plataformas *.parket.works
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://*.parket.works http://localhost:* http://127.0.0.1:*");
  next();
});

// app.js/chat.js mudam com cada deploy — força revalidação em toda página pra
// evitar que o browser sirva bundle velho. sw.js idem (update do PWA).
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res, filePath) => {
    if (/\/(app|chat|sw)\.js$|\/index\.html$/.test(filePath)) res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  },
}));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
// rotas de conversa do SPA (/canal/geral, /dm/fulano, /obra/12) — F5/deep-link
app.get(['/canal/:ref', '/dm/:ref', '/obra/:ref'], (_req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
);

// ---------------------------------------------------------------------------
// Regras de acesso — SEMPRE validadas no servidor (REST e Socket.io)
// ---------------------------------------------------------------------------

function canAccessChannel(user, channel) {
  // Will 24/07: todos os canais são abertos — qualquer setor pode ver/postar
  // em #comercial, #ia, #fiscal, etc. Antes só via canais globais + do próprio setor.
  if (!channel) return false;
  // Exceção: canal com restrict_role só é visível por quem tem a role exigida.
  if (channel.restrict_role && user?.role !== channel.restrict_role) return false;
  return true;
}
function canAccessDm(user, dm) {
  return !!dm && (dm.user_a === user.id || dm.user_b === user.id);
}
function isObraMember(user, threadId) {
  return (
    !!stmt.isMember.get(threadId, 'user', user.id) ||
    !!stmt.isMember.get(threadId, 'sector', user.sector_id)
  );
}

// ---------------------------------------------------------------------------
// Perfil do chat — nome de exibição e foto sobrepõem o cadastro da Parket
// ---------------------------------------------------------------------------

function applyProfile(u) {
  if (!u) return u;
  const p = stmt.profileGet.get(String(u.id));
  if (!p) return u;
  return { ...u, name: p.display_name || u.name, avatar_url: p.avatar_url || null };
}
async function getUsersMerged() {
  return (await repository.getUsers()).map(applyProfile);
}

// ---------------------------------------------------------------------------
// Menções — @Pessoa ou @Setor no texto
// ---------------------------------------------------------------------------

/**
 * Encontra menções no texto comparando com nomes reais de setores e usuários.
 * Retorna [{ type: 'sector'|'user', id, name }].
 */
async function parseMentions(content) {
  if (!content || !content.includes('@')) return [];
  const [sectors, users] = await Promise.all([repository.getSectors(), getUsersMerged()]);
  const candidates = [
    ...sectors.map((s) => ({ type: 'sector', id: s.id, name: s.name, keys: [s.name, s.slug] })),
    ...users.map((u) => ({ type: 'user', id: u.id, name: u.name, keys: [u.name] })),
  ];
  const lower = content.toLowerCase();
  // Em cada '@', casa o candidato de nome MAIS LONGO que termina em fronteira
  // de palavra. Substring pura marcava gente errada: "@Administrador" também
  // adicionava o usuário "admin" à obra (vazamento de acesso, 16/07).
  const isWord = (ch) => !!ch && /[\p{L}\p{N}]/u.test(ch);
  const found = new Map();
  for (let at = lower.indexOf('@'); at !== -1; at = lower.indexOf('@', at + 1)) {
    let best = null;
    for (const c of candidates) {
      for (const k of c.keys) {
        const key = String(k || '').toLowerCase();
        if (!key || !lower.startsWith(key, at + 1)) continue;
        if (isWord(lower[at + 1 + key.length])) continue; // corta no meio de palavra
        if (!best || key.length > best.len) best = { c, len: key.length };
      }
    }
    if (best) found.set(best.c.type + ':' + best.c.id, { type: best.c.type, id: best.c.id, name: best.c.name });
  }
  return [...found.values()];
}

// ---------------------------------------------------------------------------
// Não-lidas / menções por conversa
// ---------------------------------------------------------------------------

function unreadFor(user, convType, convId) {
  const read = stmt.readGet.get(user.id, convType, convId);
  const last = read ? read.last_read_msg_id : 0;
  const unread = stmt.unreadCount[convType].get(convId, last, user.id).c;
  const mentions = stmt.unreadMentions[convType].get(convId, last, user.id, user.id, user.sector_id).c;
  return { unread, mentions, last_read_msg_id: last };
}

function messageWithMentions(row) {
  const mentions = db
    .prepare('SELECT target_type AS type, target_id AS id FROM mentions WHERE message_id = ?')
    .all(row.id);
  return { ...row, mentions };
}

// Preview da mensagem citada (quote-reply estilo WhatsApp).
function replyPreview(row) {
  if (row.reply_to == null) return null;
  const q = stmt.messageById.get(row.reply_to);
  if (!q) return null;
  return {
    id: q.id,
    sender_id: q.sender_id,
    content: q.deleted ? '' : String(q.content || '').slice(0, 200),
    file_name: q.deleted ? null : q.file_name,
    file_type: q.deleted ? null : q.file_type,
    deleted: q.deleted ? 1 : 0,
  };
}

// Enriquecimento pro app full-page: reactions agregadas + resumo da thread.
function enrichMessage(row) {
  const base = messageWithMentions(row);
  const reactions = {};
  for (const r of stmt.reactionsFor.all(row.id)) {
    (reactions[r.emoji] = reactions[r.emoji] || []).push(r.user_id);
  }
  const t = stmt.replySummary.get(row.id);
  return {
    ...base,
    reactions,
    reply: replyPreview(row),
    pinned: stmt.pinGet.get(row.id) ? 1 : 0,
    reply_count: t ? Number(t.reply_count) || 0 : 0,
    last_reply_at: t ? t.last_reply_at : null,
    repliers: t && t.repliers ? String(t.repliers).split(',').slice(0, 5) : [],
  };
}

// Dado um row de messages, resolve { convType, convId, room } + checa acesso.
function convOfMessage(user, msg) {
  if (!msg) return null;
  if (msg.channel_id != null) {
    const ch = stmt.channelById.get(msg.channel_id);
    if (!canAccessChannel(user, ch)) return null;
    return { convType: 'channel', convId: msg.channel_id, room: `channel:${msg.channel_id}` };
  }
  if (msg.dm_id != null) {
    const dm = stmt.dmById.get(msg.dm_id);
    if (!canAccessDm(user, dm)) return null;
    return { convType: 'dm', convId: msg.dm_id, room: `dm:${msg.dm_id}` };
  }
  if (msg.obra_thread_id != null) {
    if (!isObraMember(user, msg.obra_thread_id)) return null;
    return { convType: 'obra', convId: msg.obra_thread_id, room: `obra:${msg.obra_thread_id}` };
  }
  return null;
}

async function obraThreadPayload(thread) {
  const obra = await repository.getObra(thread.obra_id);
  const members = stmt.membersOfThread.all(thread.id).map((m) => ({ type: m.member_type, id: m.member_id }));
  return {
    thread_id: thread.id,
    obra_id: thread.obra_id,
    nome: obra ? obra.nome : `Obra ${thread.obra_id}`,
    cliente: obra ? obra.cliente : '',
    description: thread.description || '',
    tags: JSON.parse(thread.tags || '[]'),
    members,
  };
}

/** Obras que o usuário pode ver na barra lateral (Will 03/09).
 *  Lista base = obras do gestão. Fiscal e instalador só veem as designadas a
 *  eles; todo o resto vê tudo. Devolve também o conjunto de nomes canônicos,
 *  porque a conversa da obra é deduplicada por nome (um card ≠ uma thread). */
async function obrasPermitidas(user) {
  try {
    // Esquenta o agrupamento antes de qualquer chaveObra() do fluxo da sidebar,
    // da busca e do abrir conversa: todos passam por aqui.
    await garantirGruposDeObra();
    const { restrito, obras } = await repository.getObrasVisiveis(user);
    return { restrito, obras: obras || [], chaves: new Set((obras || []).map((o) => chaveObra(o.nome))) };
  } catch (e) {
    // Falha de banco não pode esconder obra de ninguém: cai pro modo aberto.
    console.error('[obrasPermitidas]', e.message);
    return { restrito: false, obras: [], chaves: new Set() };
  }
}

// ---------------------------------------------------------------------------
// REST
// ---------------------------------------------------------------------------

// Login por e-mail/senha — SÓ para testes locais. Em produção o SSO da
// plataforma do setor emite o JWT (mesmo JWT_SECRET).
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email e password obrigatórios' });
  const user = await repository.getUserByEmail(email);
  const ok =
    user &&
    ((user.password_hash && bcrypt.compareSync(password, user.password_hash)) ||
      (user.password_plain && password === user.password_plain));
  if (!ok) return res.status(401).json({ error: 'credenciais inválidas' });
  const { password_hash, password_plain, ...safe } = user;
  res.json({ token: signToken(user), user: safe });
});

app.get('/api/bootstrap', requireAuth, async (req, res) => {
  const me = applyProfile(req.user);
  const [sectors, users] = await Promise.all([repository.getSectors(), getUsersMerged()]);

  const channels = stmt.channelsForUser.all()
    .filter((ch) => canAccessChannel(me, ch))
    .map((ch) => ({
      ...ch,
      ...unreadFor(me, 'channel', ch.id),
    }));

  const dms = stmt.dmsForUser.all(me.id, me.id).map((dm) => ({
    ...dm,
    other_user_id: dm.user_a === me.id ? dm.user_b : dm.user_a,
    ...unreadFor(me, 'dm', dm.id),
  }));

  const { restrito, obras: permitidas, chaves } = await obrasPermitidas(me);

  // Conversas de obra já abertas. As tarefas inserem os setores 1-9 como
  // membros da thread, então pra fiscal/instalador filtramos pelas designadas.
  // Uma obra = uma linha na sidebar. Se sobrar mais de uma thread com o mesmo
  // nome canônico (duplicata antiga), mostra a que tem conteúdo: mensagens +
  // tarefas. Assim ninguém perde histórico por causa da dedup.
  const threads = stmt.threadsForMember.all(me.id, me.sector_id);
  const porObra = new Map();
  for (const t of threads) {
    const payload = { ...(await obraThreadPayload(t)), ...unreadFor(me, 'obra', t.id) };
    if (restrito && !chaves.has(chaveObra(payload.nome))) continue;
    const k = chaveObra(payload.nome);
    const atual = porObra.get(k);
    if (!atual || pesoThread(payload.thread_id) > pesoThread(atual.thread_id)) porObra.set(k, payload);
  }
  const obras_visiveis = [...porObra.values()];

  // Obras do gestão ainda sem conversa aberta: aparecem na sidebar e abrem a
  // thread no primeiro clique. O mesmo nome costuma existir em vários setores;
  // fica o card mais avançado no fluxo, que é onde a obra realmente vive.
  const jaAbertas = new Map(obras_visiveis.map((o) => [chaveObra(o.nome), null]));
  for (const o of permitidas) {
    const k = chaveObra(o.nome);
    if (!jaAbertas.has(k)) { jaAbertas.set(k, o); continue; }
    const atual = jaAbertas.get(k);
    if (atual && deptRank(o.dept) < deptRank(atual.dept)) jaAbertas.set(k, o);
  }
  const obras_sugeridas = [...jaAbertas.values()].filter(Boolean);

  const saved = stmt.savedIdsForUser.all(me.id).map((r) => r.message_id);
  res.json({ me, sectors, users, channels, dms, obras_visiveis, obras_sugeridas, saved, online: onlineUserIds() });
});

// Autocomplete de obras do "+" — mesma fonte e mesma dedup da sidebar.
// QUE FAZ: filtra as obras que o usuário pode ver (gestão + board projetos) pelo
// termo digitado e devolve UMA linha por obra, a do card mais avançado no fluxo.
// WHY: antes isto varria public.kanban_cards cru, em todos os setores, com LIMIT
// 20 e sem dedup: a mesma obra voltava 4 vezes (comercial, orçamento, projetos,
// financeiro) e obras com muitos cards irmãos nem cabiam no limite (Will 03/09).
app.get('/api/obras/buscar', requireAuth, async (req, res) => {
  const termo = String(req.query.q || '').trim().toLowerCase();
  const { obras } = await obrasPermitidas(req.user);
  const porNome = new Map();
  for (const o of obras) {
    if (termo && !`${o.nome || ''} ${o.cliente || ''}`.toLowerCase().includes(termo)) continue;
    const k = chaveObra(o.nome);
    const atual = porNome.get(k);
    if (!atual || deptRank(o.dept) < deptRank(atual.dept)) porNome.set(k, o);
  }
  // getObrasDaGestao já vem ordenado por updated_at desc, e o Map preserva a
  // ordem de inserção: as obras mexidas por último aparecem primeiro na lista.
  res.json([...porNome.values()].slice(0, 50));
});

// Delete de usuário — só admin/superadmin. Remove nos 3 lugares:
//   1. auth.users Cloud (GoTrue admin API, service key)
//   2. public.user_profiles Cloud (REST admin, service key)
//   3. public.user_profiles parket-pg-local (chat usa este)
// Login para de funcionar imediatamente; chat next-bootstrap não retorna o user.
app.delete('/api/admin/users/:id', requireAuth, async (req, res) => {
  const targetId = String(req.params.id);
  const caller = req.user;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'server sem SUPABASE_URL/SUPABASE_SERVICE_KEY' });
  // Autoriza: caller precisa ser admin/superadmin (role no user_profiles Cloud).
  try {
    const roleResp = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${caller.id}&select=role`, {
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
    });
    const rows = await roleResp.json();
    const role = rows?.[0]?.role;
    if (!['superadmin', 'admin'].includes(role)) return res.status(403).json({ error: 'requer admin/superadmin' });
  } catch (e) {
    return res.status(500).json({ error: 'falha na verificação de permissão: ' + e.message });
  }
  if (targetId === String(caller.id)) return res.status(400).json({ error: 'não pode se auto-excluir' });
  const errors = [];
  // 1. Delete Cloud auth (GoTrue admin API)
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${targetId}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
    });
    if (!r.ok && r.status !== 404) errors.push(`cloud auth ${r.status}: ${await r.text()}`);
  } catch (e) { errors.push('cloud auth: ' + e.message); }
  // 2. Delete Cloud user_profiles
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${targetId}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, Prefer: 'return=minimal' },
    });
    if (!r.ok && r.status !== 404) errors.push(`cloud profile ${r.status}: ${await r.text()}`);
  } catch (e) { errors.push('cloud profile: ' + e.message); }
  // 3. Delete parket-pg-local user_profiles (chat)
  try {
    await repository.deleteProfileLocal?.(targetId);
  } catch (e) { errors.push('local profile: ' + e.message); }
  // Sucesso mesmo com erros parciais — front dá reload e usuário some da lista
  res.json({ ok: errors.length === 0, errors });
});

// Perfil: nome de exibição + foto (avatar_url vem do /api/upload).
app.post('/api/profile', requireAuth, async (req, res) => {
  const { display_name, avatar_url } = req.body || {};
  const name = String(display_name || '').trim().slice(0, 80) || null;
  const av = avatar_url == null || avatar_url === '' ? null : String(avatar_url);
  if (av && !av.startsWith('/uploads/')) return res.status(400).json({ error: 'avatar inválido' });
  stmt.profileUpsert.run(String(req.user.id), name, av);
  const original = await repository.getUser(String(req.user.id)).catch(() => null);
  const out = {
    user_id: String(req.user.id),
    name: name || (original ? original.name : req.user.name),
    avatar_url: av,
  };
  io.emit('profile:update', out);
  res.json(out);
});

// Cria/retorna a conversa da obra; quem abre já entra como membro.
app.post('/api/obras/:obraId/abrir', requireAuth, async (req, res) => {
  const obra = await repository.getObra(req.params.obraId);
  if (!obra) return res.status(404).json({ error: 'obra não encontrada' });

  // Só barra quem é restrito (fiscal/instalador) abrindo obra que não é dele.
  // Os demais setores entram em qualquer obra do gestão.
  const { restrito, chaves } = await obrasPermitidas(req.user);
  if (restrito && !chaves.has(chaveObra(obra.nome))) {
    return res.status(403).json({ error: 'sem acesso a esta obra, peça para ser marcado' });
  }

  // Guardrail: uma obra só. Cards irmãos (mesmo nome canônico em setores
  // diferentes) caem sempre na mesma conversa, em vez de criar duplicata.
  const thread = await obterOuCriarThreadDaObra(obra);
  stmt.memberInsert.run(thread.id, 'user', req.user.id);

  const payload = await obraThreadPayload(thread);
  // Sockets do usuário entram na room e a sidebar de outras abas atualiza.
  io.in(`user:${req.user.id}`).socketsJoin(`obra:${thread.id}`);
  io.to(`user:${req.user.id}`).emit('obra:acesso', payload);
  res.json(payload);
});

// Replies de uma thread — acesso herdado da conversa da mensagem raiz.
app.get('/api/thread/:msgId', requireAuth, async (req, res) => {
  const root = stmt.messageById.get(Number(req.params.msgId));
  const conv = convOfMessage(req.user, root);
  if (!conv) return res.status(403).json({ error: 'sem acesso a esta thread' });
  res.json({
    root: enrichMessage(root),
    replies: stmt.threadReplies.all(root.id).map(enrichMessage),
    ...conv,
  });
});

// Busca global — FTS5, filtrada pelo que o usuário pode ver.
app.get('/api/search', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  // Query FTS com prefixo no último termo; aspas neutralizam sintaxe especial.
  const ftsQuery = q
    .split(/\s+/)
    .filter(Boolean)
    .map((t, i, arr) => '"' + t.replace(/"/g, '') + '"' + (i === arr.length - 1 ? '*' : ''))
    .join(' ');
  let rows = [];
  try {
    rows = stmt.searchMessages.all(ftsQuery);
  } catch (e) {
    return res.json([]);
  }
  const me = req.user;
  const out = [];
  for (const m of rows) {
    const conv = convOfMessage(me, m);
    if (!conv) continue;
    out.push({ ...messageWithMentions(m), snippet: m.snippet, conv_type: conv.convType, conv_id: conv.convId });
    if (out.length >= 50) break;
  }
  res.json(out);
});

// Mensagens fixadas de uma conversa — mesmas regras de acesso de /api/messages.
app.get('/api/pins', requireAuth, async (req, res) => {
  const me = req.user;
  let rows;
  if (req.query.channel) {
    const ch = stmt.channelById.get(Number(req.query.channel));
    if (!canAccessChannel(me, ch)) return res.status(403).json({ error: 'sem acesso a este canal' });
    rows = stmt.pinsFor.channel.all(ch.id);
  } else if (req.query.dm) {
    const dm = stmt.dmById.get(Number(req.query.dm));
    if (!canAccessDm(me, dm)) return res.status(403).json({ error: 'sem acesso a esta conversa' });
    rows = stmt.pinsFor.dm.all(dm.id);
  } else if (req.query.obra) {
    const thread = stmt.obraThreadById.get(Number(req.query.obra));
    if (!thread || !isObraMember(me, thread.id)) return res.status(403).json({ error: 'sem acesso a esta obra' });
    rows = stmt.pinsFor.obra.all(thread.id);
  } else {
    return res.status(400).json({ error: 'informe channel, dm ou obra' });
  }
  res.json(rows.map(enrichMessage));
});

// Mensagens salvas (favoritas) — por usuário, qualquer conversa acessível.
app.post('/api/saved/:msgId/toggle', requireAuth, (req, res) => {
  const msg = stmt.messageById.get(Number(req.params.msgId));
  if (!msg || msg.deleted) return res.status(404).json({ error: 'mensagem não encontrada' });
  const conv = convOfMessage(req.user, msg);
  if (!conv) return res.status(403).json({ error: 'sem acesso a esta mensagem' });
  const uid = String(req.user.id);
  const has = stmt.savedGet.get(uid, msg.id);
  if (has) stmt.savedDelete.run(uid, msg.id);
  else stmt.savedInsert.run(uid, msg.id);
  res.json({ ok: true, saved: !has });
});

app.get('/api/saved', requireAuth, (req, res) => {
  const out = [];
  for (const m of stmt.savedMessagesForUser.all(String(req.user.id))) {
    const conv = convOfMessage(req.user, m);
    if (!conv) continue;
    out.push({ ...enrichMessage(m), conv_type: conv.convType, conv_id: conv.convId });
  }
  res.json(out);
});

// Descrição do grupo da obra — qualquer membro edita; sidebar de todos atualiza.
app.post('/api/obra/:threadId/descricao', requireAuth, async (req, res) => {
  const tid = Number(req.params.threadId);
  const thread = stmt.obraThreadById.get(tid);
  if (!thread || !isObraMember(req.user, tid)) return res.status(403).json({ error: 'sem acesso a esta obra' });
  const desc = String((req.body || {}).description || '').slice(0, 2000);
  stmt.obraSetDescription.run(desc || null, tid);
  const payload = await obraThreadPayload(stmt.obraThreadById.get(tid));
  io.to(`obra:${tid}`).emit('obra:acesso', payload);
  res.json(payload);
});

// Tags de status da obra — qualquer membro edita; sidebar/header de todos atualiza.
app.post('/api/obra/:threadId/tags', requireAuth, async (req, res) => {
  const tid = Number(req.params.threadId);
  const thread = stmt.obraThreadById.get(tid);
  if (!thread || !isObraMember(req.user, tid)) return res.status(403).json({ error: 'sem acesso a esta obra' });
  const raw = Array.isArray((req.body || {}).tags) ? req.body.tags : [];
  const tags = [...new Set(raw.map((t) => String(t || '').trim().toUpperCase().slice(0, 30)).filter(Boolean))].slice(0, 8);
  stmt.obraSetTags.run(JSON.stringify(tags), tid);
  const payload = await obraThreadPayload(stmt.obraThreadById.get(tid));
  io.to(`obra:${tid}`).emit('obra:acesso', payload);
  res.json(payload);
});

// Mídia da obra — mensagens com arquivo ou link, pro painel "Geral da obra".
app.get('/api/obra/:threadId/media', requireAuth, (req, res) => {
  const tid = Number(req.params.threadId);
  const thread = stmt.obraThreadById.get(tid);
  if (!thread || !isObraMember(req.user, tid)) return res.status(403).json({ error: 'sem acesso a esta obra' });
  res.json(stmt.obraMedia.all(tid).map((m) => ({
    id: m.id,
    sender_id: m.sender_id,
    content: m.content,
    file_path: m.file_path,
    file_name: m.file_name,
    file_type: m.file_type,
    created_at: m.created_at,
    parent_id: m.parent_id,
  })));
});

// Últimas 100 mensagens — 403 para quem não tem acesso / não é membro.
app.get('/api/messages', requireAuth, async (req, res) => {
  const me = req.user;
  let rows;
  if (req.query.channel) {
    const ch = stmt.channelById.get(Number(req.query.channel));
    if (!canAccessChannel(me, ch)) return res.status(403).json({ error: 'sem acesso a este canal' });
    rows = stmt.lastMessages.channel.all(ch.id);
  } else if (req.query.dm) {
    const dm = stmt.dmById.get(Number(req.query.dm));
    if (!canAccessDm(me, dm)) return res.status(403).json({ error: 'sem acesso a esta conversa' });
    rows = stmt.lastMessages.dm.all(dm.id);
  } else if (req.query.obra) {
    const thread = stmt.obraThreadById.get(Number(req.query.obra));
    if (!thread || !isObraMember(me, thread.id)) {
      return res.status(403).json({ error: 'sem acesso a esta obra' });
    }
    rows = stmt.lastMessages.obra.all(thread.id);
  } else {
    return res.status(400).json({ error: 'informe channel, dm ou obra' });
  }
  res.json(rows.reverse().map(enrichMessage));
});

// Teca — copiloto de IA: responde perguntas sobre a conversa ativa.
// Mesmas regras de acesso de /api/messages; contexto = últimas 100 mensagens.
app.post('/api/teca', requireAuth, async (req, res) => {
  const me = req.user;
  const { convType, convId, question } = req.body || {};
  const q = String(question || '').trim().slice(0, 2000);
  if (!q) return res.status(400).json({ error: 'pergunta vazia' });

  let rows, label;
  if (convType === 'channel') {
    const ch = stmt.channelById.get(Number(convId));
    if (!canAccessChannel(me, ch)) return res.status(403).json({ error: 'sem acesso a este canal' });
    rows = stmt.lastMessages.channel.all(ch.id);
    label = 'canal #' + ch.name;
  } else if (convType === 'dm') {
    const dm = stmt.dmById.get(Number(convId));
    if (!canAccessDm(me, dm)) return res.status(403).json({ error: 'sem acesso a esta conversa' });
    rows = stmt.lastMessages.dm.all(dm.id);
    label = 'conversa direta';
  } else if (convType === 'obra') {
    const thread = stmt.obraThreadById.get(Number(convId));
    if (!thread || !isObraMember(me, thread.id)) return res.status(403).json({ error: 'sem acesso a esta obra' });
    rows = stmt.lastMessages.obra.all(thread.id);
    label = 'obra ' + (thread.obra_nome || thread.obra_id);
  } else {
    return res.status(400).json({ error: 'convType inválido' });
  }

  const users = await getUsersMerged();
  const byId = new Map(users.map((u) => [String(u.id), u.name]));
  const ctx = rows
    .reverse()
    .filter((m) => !m.deleted && (m.content || m.file_name))
    .map((m) => {
      const who = byId.get(String(m.sender_id)) || 'Alguém';
      const when = String(m.created_at || '').slice(0, 16).replace('T', ' ');
      const body = m.content || ('[arquivo: ' + m.file_name + ']');
      return `[${when}] ${who}: ${body}`;
    })
    .join('\n');

  const system =
    'Você é a Teca, assistente de IA da Parket (empresa de pisos e marcenaria de alto padrão). ' +
    'Você está ajudando ' + (me.name || 'um usuário') + ' dentro do chat interno da empresa, na ' + label + '. ' +
    'Responda em português do Brasil, de forma direta e concisa. ' +
    'Baseie-se APENAS nas mensagens da conversa fornecidas; se a resposta não estiver nelas, diga que não há essa informação na conversa. ' +
    'Não invente fatos, valores ou prazos.';

  try {
    const answer = await teca.askClaude(
      system,
      'Mensagens da conversa (mais antigas primeiro):\n\n' + (ctx || '(conversa vazia)') + '\n\nPergunta de ' + (me.name || 'usuário') + ': ' + q,
      1024
    );
    res.json({ answer });
  } catch (e) {
    console.error('[teca]', e.message);
    res.status(502).json({ error: 'Teca indisponível no momento' });
  }
});

app.post('/api/dms', requireAuth, async (req, res) => {
  const other = await repository.getUser(String((req.body || {}).userId || ''));
  if (!other || other.id === req.user.id) return res.status(400).json({ error: 'usuário inválido' });

  const [a, b] = [req.user.id, other.id].sort(); // par ordenado (lexicográfico)
  let dm = stmt.dmByPair.get(a, b);
  if (!dm) {
    const r = stmt.dmInsert.run(a, b);
    dm = stmt.dmById.get(r.lastInsertRowid);
    for (const uid of [a, b]) {
      io.in(`user:${uid}`).socketsJoin(`dm:${dm.id}`);
      io.to(`user:${uid}`).emit('dm:new', { ...dm, other_user_id: uid === a ? b : a });
    }
  }
  res.json({ ...dm, other_user_id: other.id });
});

app.post('/api/read', requireAuth, async (req, res) => {
  const { convType, convId, lastMsgId } = req.body || {};
  if (!['channel', 'dm', 'obra'].includes(convType)) return res.status(400).json({ error: 'convType inválido' });
  const id = Number(convId);

  if (convType === 'channel' && !canAccessChannel(req.user, stmt.channelById.get(id)))
    return res.status(403).json({ error: 'sem acesso' });
  if (convType === 'dm' && !canAccessDm(req.user, stmt.dmById.get(id)))
    return res.status(403).json({ error: 'sem acesso' });
  if (convType === 'obra' && !isObraMember(req.user, id))
    return res.status(403).json({ error: 'sem acesso' });

  stmt.readUpsert.run(req.user.id, convType, id, Number(lastMsgId) || 0);
  io.to(`user:${req.user.id}`).emit('read:update', { convType, convId: id, lastMsgId: Number(lastMsgId) || 0 });
  res.json({ ok: true });
});

// Upload — imagens aparecem inline; demais tipos viram link de download.
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', 'uploads'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 10).replace(/[^.\w-]/g, '');
      cb(null, crypto.randomBytes(16).toString('hex') + ext);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});
app.post('/api/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(413).json({ error: 'arquivo acima de 15 MB' });
    if (!req.file) return res.status(400).json({ error: 'arquivo ausente' });
    res.json({
      file_path: '/uploads/' + req.file.filename,
      file_name: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
      file_type: req.file.mimetype,
    });
  });
});

// ---------------------------------------------------------------------------
// Web Push — notificações quando o destinatário está offline (PWA)
// ---------------------------------------------------------------------------

let webpush = null;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush = require('web-push');
    webpush.setVapidDetails('mailto:sistemas@parket.com.br', VAPID_PUBLIC, VAPID_PRIVATE);
    console.log('[parket-chat] web-push habilitado');
  } catch (e) {
    console.warn('[parket-chat] web-push indisponível:', e.message);
  }
}

app.get('/api/push/key', (req, res) => res.json({ key: VAPID_PUBLIC }));

app.post('/api/push/subscribe', requireAuth, (req, res) => {
  const sub = (req.body || {}).subscription;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'subscription inválida' });
  stmt.pushUpsert.run(String(sub.endpoint), req.user.id, JSON.stringify(sub));
  res.json({ ok: true });
});

app.post('/api/push/unsubscribe', requireAuth, (req, res) => {
  const endpoint = (req.body || {}).endpoint;
  if (endpoint) stmt.pushDelete.run(String(endpoint));
  res.json({ ok: true });
});

/** Envia push pros dispositivos de um usuário OFFLINE. Falha = remove sub morta. */
function pushToUser(userId, payload) {
  if (!webpush || onlineCounts.has(String(userId))) return;
  for (const row of stmt.pushForUser.all(String(userId))) {
    webpush
      .sendNotification(JSON.parse(row.subscription), JSON.stringify(payload), { TTL: 3600 })
      .catch((e) => {
        if (e.statusCode === 404 || e.statusCode === 410) stmt.pushDelete.run(row.endpoint);
      });
  }
}

/** Notifica destinatários relevantes de uma mensagem nova (DM / menções). */
async function notifyOffline(me, convType, convId, msg, mentions) {
  try {
    const text = (msg.content || '').slice(0, 120) || (msg.file_name ? '📎 ' + msg.file_name : 'Nova mensagem');
    const base = { body: `${me.name}: ${text}`, conv_type: convType, conv_id: convId, msg_id: msg.id };
    const targets = new Set();
    if (convType === 'dm') {
      const dm = stmt.dmById.get(convId);
      const other = dm.user_a === me.id ? dm.user_b : dm.user_a;
      targets.add(other);
      pushToUser(other, { title: 'Mensagem de ' + me.name, ...base });
    }
    for (const m of mentions || []) {
      if (m.type === 'user' && m.id !== me.id && !targets.has(m.id)) {
        targets.add(m.id);
        pushToUser(m.id, { title: me.name + ' mencionou você', ...base });
      } else if (m.type === 'sector') {
        for (const u of await repository.getUsersBySector(m.id)) {
          if (u.id === me.id || targets.has(u.id)) continue;
          targets.add(u.id);
          pushToUser(u.id, { title: me.name + ' mencionou @' + m.name, ...base });
        }
      }
    }
  } catch (e) {
    console.warn('[push] notifyOffline:', e.message);
  }
}

// ---------------------------------------------------------------------------
// Postagem de mensagem — compartilhada por socket, agendadas e tarefas
// ---------------------------------------------------------------------------

function canPostTo(user, convType, convId) {
  const id = Number(convId);
  if (convType === 'channel') return canAccessChannel(user, stmt.channelById.get(id));
  if (convType === 'dm') return canAccessDm(user, stmt.dmById.get(id));
  if (convType === 'obra') {
    const thread = stmt.obraThreadById.get(id);
    return !!thread && isObraMember(user, thread.id);
  }
  return false;
}

/** Valida acesso, insere, processa menções e faz broadcast. Retorna { error } ou { ok, message }. */
async function postMessage(me, payload) {
  const { convType, convId, content = '', file = null, parentId = null, replyToId = null } = payload || {};
  const text = String(content || '').slice(0, MAX_MESSAGE_LENGTH);
  if (!text.trim() && !file) return { error: 'mensagem vazia' };

  let room = null;
  const record = {
    channel_id: null,
    dm_id: null,
    obra_thread_id: null,
    parent_id: null,
    reply_to: null,
    sender_id: me.id,
    content: text,
    file_path: file && String(file.file_path || '').startsWith('/uploads/') ? file.file_path : null,
    file_name: file ? String(file.file_name || '').slice(0, 255) : null,
    file_type: file ? String(file.file_type || '').slice(0, 100) : null,
  };

  let thread = null;
  const id = Number(convId);
  if (convType === 'channel') {
    const ch = stmt.channelById.get(id);
    if (!canAccessChannel(me, ch)) return { error: 'sem acesso a este canal' };
    record.channel_id = ch.id;
    room = `channel:${ch.id}`;
  } else if (convType === 'dm') {
    const dm = stmt.dmById.get(id);
    if (!canAccessDm(me, dm)) return { error: 'sem acesso a esta conversa' };
    record.dm_id = dm.id;
    room = `dm:${dm.id}`;
  } else if (convType === 'obra') {
    thread = stmt.obraThreadById.get(id);
    if (!thread || !isObraMember(me, thread.id)) return { error: 'sem acesso a esta obra' };
    record.obra_thread_id = thread.id;
    room = `obra:${thread.id}`;
  } else {
    return { error: 'convType inválido' };
  }

  // Reply em thread: o pai precisa existir, ser raiz e estar na MESMA conversa.
  if (parentId != null) {
    const parent = stmt.messageById.get(Number(parentId));
    if (
      !parent ||
      parent.parent_id != null ||
      parent.channel_id !== record.channel_id ||
      parent.dm_id !== record.dm_id ||
      parent.obra_thread_id !== record.obra_thread_id
    ) {
      return { error: 'thread inválida' };
    }
    record.parent_id = parent.id;
  }

  // Quote-reply: a citada precisa existir, não estar deletada e ser da MESMA conversa.
  if (replyToId != null) {
    const quoted = stmt.messageById.get(Number(replyToId));
    if (
      !quoted ||
      quoted.deleted ||
      quoted.channel_id !== record.channel_id ||
      quoted.dm_id !== record.dm_id ||
      quoted.obra_thread_id !== record.obra_thread_id
    ) {
      return { error: 'mensagem citada inválida' };
    }
    record.reply_to = quoted.id;
  }

  const r = stmt.messageInsert.run(record);
  const msg = stmt.messageById.get(r.lastInsertRowid);

  // Menções: registra sempre; em OBRA, marcar concede acesso.
  const mentions = await parseMentions(text);
  for (const m of mentions) stmt.mentionInsert.run(msg.id, m.type, m.id);

  if (convType === 'obra') {
    let membersChanged = false;
    for (const m of mentions) {
      const already = stmt.isMember.get(thread.id, m.type, m.id);
      if (already) continue;
      stmt.memberInsert.run(thread.id, m.type, m.id);
      membersChanged = true;
      const targetRoom = m.type === 'sector' ? `sector:${m.id}` : `user:${m.id}`;
      // Sockets já conectados do alvo entram na room da obra…
      io.in(targetRoom).socketsJoin(`obra:${thread.id}`);
      // …e recebem o evento para atualizar a sidebar (o histórico completo
      // vem via GET /api/messages?obra=ID quando abrirem a conversa).
      io.to(targetRoom).emit('obra:acesso', await obraThreadPayload(thread));
    }
    if (membersChanged) {
      io.to(room).emit('obra:membros', await obraThreadPayload(thread));
    }
  }

  const out = {
    ...msg,
    mentions: mentions.map(({ type, id: mid }) => ({ type, id: mid })),
    reactions: {},
    reply: replyPreview(msg),
    reply_count: 0,
    conv_type: convType,
    conv_id: id,
  };
  io.to(room).emit('message:new', out);
  // Reply: room também recebe o resumo atualizado da thread do pai.
  if (record.parent_id) {
    const t = stmt.replySummary.get(record.parent_id);
    io.to(room).emit('thread:update', {
      parent_id: record.parent_id,
      conv_type: convType,
      conv_id: id,
      reply_count: Number(t.reply_count) || 0,
      last_reply_at: t.last_reply_at,
    });
  }
  notifyOffline(me, convType, id, msg, mentions);
  return { ok: true, message: out };
}

// ---------------------------------------------------------------------------
// Mensagens agendadas — "enviar depois"
// ---------------------------------------------------------------------------

app.post('/api/scheduled', requireAuth, async (req, res) => {
  const { convType, convId, content = '', file = null, sendAt } = req.body || {};
  const text = String(content || '').slice(0, MAX_MESSAGE_LENGTH);
  if (!text.trim() && !file) return res.status(400).json({ error: 'mensagem vazia' });
  if (!['channel', 'dm', 'obra'].includes(convType)) return res.status(400).json({ error: 'convType inválido' });
  if (!canPostTo(req.user, convType, convId)) return res.status(403).json({ error: 'sem acesso a esta conversa' });
  const when = new Date(sendAt || '');
  if (isNaN(when.getTime())) return res.status(400).json({ error: 'data inválida' });
  if (when.getTime() < Date.now() + 30 * 1000) return res.status(400).json({ error: 'agende para pelo menos 1 minuto no futuro' });
  const r = stmt.schedInsert.run({
    conv_type: convType,
    conv_id: Number(convId),
    sender_id: String(req.user.id),
    content: text,
    file_path: file && String(file.file_path || '').startsWith('/uploads/') ? file.file_path : null,
    file_name: file ? String(file.file_name || '').slice(0, 255) : null,
    file_type: file ? String(file.file_type || '').slice(0, 100) : null,
    send_at: when.toISOString(),
  });
  res.json(stmt.schedById.get(r.lastInsertRowid));
});

app.get('/api/scheduled', requireAuth, (req, res) => {
  res.json(stmt.schedForUser.all(String(req.user.id)));
});

app.delete('/api/scheduled/:id', requireAuth, (req, res) => {
  const r = stmt.schedDelete.run(Number(req.params.id), String(req.user.id));
  res.json({ ok: r.changes > 0 });
});

// A cada 20s despacha agendadas vencidas. Marca sent=1 ANTES de postar para
// nunca duplicar; se o post falhar (acesso revogado etc.) a mensagem é perdida
// e o autor é avisado via evento.
setInterval(async () => {
  let due = [];
  try {
    due = stmt.schedDue.all(new Date().toISOString());
  } catch (e) {
    return;
  }
  for (const row of due) {
    stmt.schedMarkSent.run(row.id);
    try {
      const sender = applyProfile(await repository.getUser(String(row.sender_id)));
      if (!sender) continue;
      const result = await postMessage(sender, {
        convType: row.conv_type,
        convId: row.conv_id,
        content: row.content,
        file: row.file_path ? { file_path: row.file_path, file_name: row.file_name, file_type: row.file_type } : null,
      });
      io.to(`user:${row.sender_id}`).emit('scheduled:sent', { id: row.id, error: result.error || null });
    } catch (e) {
      console.error('[scheduled]', row.id, e.message);
    }
  }
}, 20 * 1000);

// A cada 60s remove pins vencidos e avisa a room (badge some em tempo real).
setInterval(() => {
  try {
    for (const p of stmt.pinsExpired.all()) {
      stmt.pinDelete.run(p.message_id);
      const room =
        p.channel_id != null ? `channel:${p.channel_id}` :
        p.dm_id != null ? `dm:${p.dm_id}` : `obra:${p.obra_thread_id}`;
      const convType = p.channel_id != null ? 'channel' : p.dm_id != null ? 'dm' : 'obra';
      const convId = p.channel_id ?? p.dm_id ?? p.obra_thread_id;
      io.to(room).emit('pin:update', {
        message_id: p.message_id,
        parent_id: p.parent_id,
        conv_type: convType,
        conv_id: convId,
        pinned: false,
        user_id: null,
      });
    }
  } catch (e) {
    console.error('[pin sweep]', e.message);
  }
}, 60 * 1000);

// ---------------------------------------------------------------------------
// Tarefas da obra — checklist simples vinculado à conversa da obra
// ---------------------------------------------------------------------------

function taskListPayload(threadId) {
  return {
    thread_id: threadId,
    tasks: stmt.tasksForThread.all(threadId),
    open_count: stmt.taskCountOpen.get(threadId).c,
  };
}

app.get('/api/obra/:threadId/tarefas', requireAuth, (req, res) => {
  const tid = Number(req.params.threadId);
  const thread = stmt.obraThreadById.get(tid);
  if (!thread || !isObraMember(req.user, tid)) return res.status(403).json({ error: 'sem acesso a esta obra' });
  res.json(taskListPayload(tid));
});

app.post('/api/obra/:threadId/tarefas', requireAuth, async (req, res) => {
  const tid = Number(req.params.threadId);
  const thread = stmt.obraThreadById.get(tid);
  if (!thread || !isObraMember(req.user, tid)) return res.status(403).json({ error: 'sem acesso a esta obra' });
  const { title, assigneeId = null, dueDate = null, sourceMsgId = null } = req.body || {};
  const t = String(title || '').trim().slice(0, 300);
  if (!t) return res.status(400).json({ error: 'título obrigatório' });
  let due = null;
  if (dueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate))) return res.status(400).json({ error: 'data inválida' });
    due = String(dueDate);
  }
  let assigneeName = null;
  if (assigneeId != null && assigneeId !== '') {
    const u = applyProfile(await repository.getUser(String(assigneeId)).catch(() => null));
    if (!u) return res.status(400).json({ error: 'responsável inválido' });
    assigneeName = u.name;
  }
  const r = stmt.taskInsert.run({
    obra_thread_id: tid,
    title: t,
    created_by: String(req.user.id),
    assignee_id: assigneeId != null && assigneeId !== '' ? String(assigneeId) : null,
    due_date: due,
    source_msg_id: sourceMsgId != null ? Number(sourceMsgId) : null,
  });
  io.to(`obra:${tid}`).emit('tarefa:update', taskListPayload(tid));
  // Anúncio na conversa — @responsável concede acesso à obra e dispara push.
  const me = applyProfile(req.user);
  let announce = 'Tarefa criada: *' + t + '*';
  if (assigneeName) announce += ' — @' + assigneeName;
  if (due) announce += ' — prazo ' + due.slice(8, 10) + '/' + due.slice(5, 7);
  postMessage(me, { convType: 'obra', convId: tid, content: announce }).catch((e) =>
    console.error('[tarefa announce]', e.message)
  );
  res.json(stmt.taskById.get(r.lastInsertRowid));
});

app.post('/api/tarefas/:id/toggle', requireAuth, (req, res) => {
  const task = stmt.taskById.get(Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'tarefa não encontrada' });
  if (!isObraMember(req.user, task.obra_thread_id)) return res.status(403).json({ error: 'sem acesso a esta obra' });
  const done = task.done ? 0 : 1;
  stmt.taskSetDone.run(done, String(req.user.id), done, task.id);
  io.to(`obra:${task.obra_thread_id}`).emit('tarefa:update', taskListPayload(task.obra_thread_id));
  res.json(stmt.taskById.get(task.id));
});

app.delete('/api/tarefas/:id', requireAuth, (req, res) => {
  const task = stmt.taskById.get(Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'tarefa não encontrada' });
  if (!isObraMember(req.user, task.obra_thread_id)) return res.status(403).json({ error: 'sem acesso a esta obra' });
  stmt.taskDelete.run(task.id);
  io.to(`obra:${task.obra_thread_id}`).emit('tarefa:update', taskListPayload(task.obra_thread_id));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Endpoints internos — serviço-a-serviço via shared secret
// (parket-gestao chama pra publicar tarefas da reunião semanal como
//  obra_tasks no chat sem passar por JWT de usuário)
// ---------------------------------------------------------------------------

function loadInternalSecret() {
  if (process.env.CHAT_INTERNAL_SECRET) return process.env.CHAT_INTERNAL_SECRET;
  const f = process.env.CHAT_INTERNAL_SECRET_FILE;
  if (f && fs.existsSync(f)) {
    try { return fs.readFileSync(f, 'utf8').trim(); } catch { return ''; }
  }
  return '';
}
const INTERNAL_SECRET = loadInternalSecret();
const BOT_USER_ID = '00000000-0000-0000-0000-000000aa0001';

/** Palavras que cada setor escreve de um jeito e não identificam a obra:
 *  "SOLARIUS PARTICIPACOES - CASA BLUES" e "SOLARIUS PARTICIPACOES E CONSTRUCOES
 *  - BLUES" são a mesma obra. Tirando essas, sobra o que distingue de verdade. */
const PALAVRAS_IGNORADAS = new Set([
  'E', 'DE', 'DA', 'DO', 'DAS', 'DOS', 'LTDA', 'ME', 'EIRELI', 'SA',
  'CASA', 'AP', 'APTO', 'APARTAMENTO', 'SR', 'SRA', 'DR', 'DRA',
  'PARTICIPACOES', 'CONSTRUCOES', 'FAMILIA', 'FAMILY', 'RUA', 'AV', 'AVENIDA',
  'PROJETO', 'OBRA',
]);

/** Canonicaliza nome da obra pra deduplicar: uma conversa por OBRA.
 *  Chave = conjunto de palavras que identificam a obra, sem acento e ordenado,
 *  então "HOTEL GLÓRIA" = "HOTEL GLORIA" e "LETICIA SECCHI - BALLALAI" =
 *  "BALLALAI - LETICIA SECCHI".
 *  NÃO corta no " - ": o sufixo distingue obras diferentes do mesmo cliente
 *  ("FUNDAÇÃO BRADESCO - MG" ≠ "- SALVADOR", "ANDRE GURGEL - AP03" ≠ "- AP05").
 *  Conferido contra as 547 obras do gestão em 03/09: gera 529 chaves, juntando
 *  exatamente 18 duplicatas reais e sem engolir nenhuma obra distinta. */
function canonicalObraName(name) {
  const palavras = String(name || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((p) => p && !PALAVRAS_IGNORADAS.has(p));
  return [...new Set(palavras)].sort().join(' ');
}

/** Agrupa nomes de obra que são o mesmo cliente escrito de jeitos diferentes.
 *  QUE FAZ: recebe todos os nomes de obra e devolve Map<chave canônica, chave do
 *  grupo>. Duas chaves caem no mesmo grupo quando uma é subconjunto da outra, ou
 *  seja, um setor escreveu o nome curto e o outro escreveu o completo:
 *  "OBRA ELSOM" dentro de "ELSOM YAMAGUSHI YASSUDA", "BRUNO COLODETTI" dentro de
 *  "BRUNO COLODETTI E KATHERLINE TOREZANI".
 *  WHY: a chave canônica sozinha é o conjunto exato de palavras, então a mesma
 *  obra com grafia diferente virava duas linhas na lista (Will 03/09: "aparecer
 *  apenas uma obra so, nao precisa ter mais de uma").
 *  GUARDA: o subconjunto só funde quando existe UM único grupo que o contém. Se
 *  couber em vários, são obras distintas do mesmo cliente e cada uma fica na sua
 *  ("BRADESCO" cabe em MG, ES, SALVADOR e JABOATÃO; "AMARAL ANDRE GURGEL" cabe
 *  em AP03 e AP05; primeiro nome solto como "PAULO" cabe em 14). Repete até
 *  estabilizar, porque um grupo formado numa volta desambigua chaves na volta
 *  seguinte ("RENATA" só resolve depois que "LEAL RENATA" entrou no grupo).
 *  Conferido contra as 642 obras de 03/09: 534 chaves viram 482 grupos, com 48
 *  fusões, todas do mesmo cliente e nenhuma obra distinta engolida. */
function agruparNomesDeObra(nomes) {
  const chaves = [...new Set(nomes.map(canonicalObraName).filter(Boolean))];
  const tokens = new Map(chaves.map((k) => [k, new Set(k.split(' '))]));
  const pai = new Map(chaves.map((k) => [k, k]));
  const raiz = (k) => {
    while (pai.get(k) !== k) { pai.set(k, pai.get(pai.get(k))); k = pai.get(k); }
    return k;
  };
  const contido = (a, b) => a.size < b.size && [...a].every((t) => b.has(t));

  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const k of chaves) {
      const grupos = new Set(
        chaves.filter((o) => contido(tokens.get(k), tokens.get(o))).map(raiz)
      );
      grupos.delete(raiz(k));
      if (grupos.size !== 1) continue;
      const alvo = [...grupos][0];
      pai.set(raiz(k), alvo);
      mudou = true;
    }
  }
  return new Map(chaves.map((k) => [k, raiz(k)]));
}

// Agrupamento em cache: é O(n²) sobre ~530 chaves e seria refeito a cada tecla
// digitada no autocomplete do "+". Recalcula a cada 5 min, que é de sobra para
// obra nova aparecer na lista.
let grupoObraCache = { mapa: new Map(), expira: 0 };
async function garantirGruposDeObra() {
  if (Date.now() < grupoObraCache.expira) return;
  // Agrupa sempre sobre o catálogo inteiro, nunca sobre a fatia visível de um
  // usuário: senão a mesma obra teria chave diferente para cada pessoa.
  const obras = await repository.getObrasDaGestao().catch(() => []);
  if (!obras.length) return;
  grupoObraCache = {
    mapa: agruparNomesDeObra(obras.map((o) => o.nome)),
    expira: Date.now() + 5 * 60 * 1000,
  };
}

/** Chave de dedup de obra: o grupo, com fallback no nome canônico enquanto o
 *  cache não esquentou. Todo ponto que agrupa ou procura obra usa esta função. */
function chaveObra(nome) {
  const k = canonicalObraName(nome);
  return grupoObraCache.mapa.get(k) || k;
}

/** Quando o mesmo nome de obra existe em vários setores, a conversa abre no card
 *  mais avançado no fluxo — é onde a obra realmente vive. Menor = ganha. */
const DEPT_PRIORIDADE = ['operacional', 'producao', 'obras', 'projetos', 'orcamento', 'comercial'];
function deptRank(dept) {
  const i = DEPT_PRIORIDADE.indexOf(String(dept || '').toLowerCase());
  return i === -1 ? DEPT_PRIORIDADE.length : i;
}

/** Peso de uma thread = mensagens + tarefas. Usado só pra escolher qual sobra
 *  quando duas threads antigas apontam pra mesma obra: fica a que tem conteúdo. */
const stmtPesoThread = db.prepare(
  `SELECT (SELECT COUNT(*) FROM messages WHERE obra_thread_id = ?)
        + (SELECT COUNT(*) FROM obra_tasks WHERE obra_thread_id = ?) AS peso`
);
function pesoThread(threadId) {
  return stmtPesoThread.get(threadId, threadId).peso;
}

/** Retorna a obra_thread existente cujo card resolve pro mesmo nome canônico.
 *  Quando sobra mais de uma (duplicata antiga), devolve a de maior peso, que é
 *  exatamente a que a sidebar mostra. Sem esse critério, tarefa ou mensagem de
 *  um card irmão cairia na thread que a dedup esconde e o conteúdo sumiria.
 *  Retorna null se nenhuma thread bate com o nome. */
async function findExistingThreadByCanonicalName(cardName) {
  // Esquenta o agrupamento aqui também: as rotas internas (tarefa da reunião,
  // mensagem de bot) resolvem thread sem passar por obrasPermitidas.
  await garantirGruposDeObra();
  const key = chaveObra(cardName);
  if (!key) return null;
  let escolhida = null;
  for (const t of db.prepare('SELECT id, obra_id FROM obra_threads').all()) {
    const c = await repository.getObra(t.obra_id).catch(() => null);
    if (!c) continue;
    if (chaveObra(c.nome || c.title) !== key) continue;
    if (!escolhida || pesoThread(t.id) > pesoThread(escolhida.id)) escolhida = t;
  }
  return escolhida;
}

/** Thread da obra pra leitura: a canônica; cai no obra_id só quando o nome não
 *  gera chave (card sem título). Não cria nada. */
async function acharThreadDaObra(obra) {
  return (await findExistingThreadByCanonicalName(obra.nome)) || stmt.obraThreadByObra.get(obra.id) || null;
}

/** Mesma coisa, mas cria a thread quando a obra ainda não tem conversa. */
async function obterOuCriarThreadDaObra(obra) {
  const existente = await acharThreadDaObra(obra);
  if (existente) return existente;
  const r = stmt.obraThreadInsert.run(obra.id);
  return stmt.obraThreadById.get(r.lastInsertRowid);
}

function requireInternalSecret(req, res, next) {
  const s = req.headers['x-internal-secret'];
  if (!INTERNAL_SECRET || s !== INTERNAL_SECRET) {
    return res.status(401).json({ error: 'internal secret inválido' });
  }
  next();
}

// Cria (ou pega) obra_thread pelo card_id (kanban_cards.id) e insere task.
// Anuncia no chat como bot (000...aa0001). Idempotente por (card_id,title,due_date)
// no mesmo dia é responsabilidade do chamador (parket-gestao guarda chat_task_id).
app.post('/api/internal/obra/:cardId/tarefa', requireInternalSecret, async (req, res) => {
  try {
    const cardId = String(req.params.cardId);
    const obra = await repository.getObra(cardId);
    if (!obra) return res.status(404).json({ error: 'obra (card) não encontrada' });

    // Guardrail: reusa a conversa do mesmo cliente (nome canônico), nunca duplica.
    const thread = await obterOuCriarThreadDaObra(obra);
    const tid = thread.id;

    const { title, assignee_id = null, due_date = null, source_msg_id = null, created_by_user_id = null } =
      req.body || {};
    const t = String(title || '').trim().slice(0, 300);
    if (!t) return res.status(400).json({ error: 'título obrigatório' });

    let due = null;
    if (due_date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(due_date))) return res.status(400).json({ error: 'data inválida' });
      due = String(due_date);
    }

    let assigneeName = null;
    if (assignee_id) {
      const u = applyProfile(await repository.getUser(String(assignee_id)).catch(() => null));
      if (u) assigneeName = u.name;
    }

    // Bot ganha acesso à thread pra anunciar; assinatura fica como created_by=bot
    // (ou created_by_user_id se veio da UI de aprovação com contexto do humano)
    const createdBy = created_by_user_id ? String(created_by_user_id) : BOT_USER_ID;
    stmt.memberInsert.run(tid, 'user', BOT_USER_ID);
    // Toda tarefa de obra é visível pra Parket inteira: adiciona os 9 setores
    // como membros do thread (Will 27/08: "todo mundo precisa ver que tem
    // mensagem nos grupos dos projtos"). Idempotente via PK composta.
    for (const sid of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      stmt.memberInsert.run(tid, 'sector', sid);
    }

    // Anúncio no chat PRIMEIRO — captura msg_id pra virar source_msg_id da task
    // (thread da tarefa = replies desse msg via parent_id). Se falhar, cria task
    // sem source_msg_id — tarefa funciona, só não terá comentários linkados.
    let sourceMsgId = source_msg_id != null ? Number(source_msg_id) : null;
    if (sourceMsgId == null) {
      let announce = 'Tarefa: *' + t + '*';
      if (assigneeName) announce += ' — @' + assigneeName;
      if (due) announce += ' — prazo ' + due.slice(8, 10) + '/' + due.slice(5, 7);
      try {
        const bot = await repository.getUser(BOT_USER_ID);
        if (bot) {
          const result = await postMessage(bot, { convType: 'obra', convId: tid, content: announce });
          if (result && result.ok && result.message) sourceMsgId = result.message.id;
        }
      } catch (e) {
        console.warn('[internal tarefa announce]', e.message);
      }
    }

    const r = stmt.taskInsert.run({
      obra_thread_id: tid,
      title: t,
      created_by: createdBy,
      assignee_id: assignee_id ? String(assignee_id) : null,
      due_date: due,
      source_msg_id: sourceMsgId,
    });
    io.to(`obra:${tid}`).emit('tarefa:update', taskListPayload(tid));

    const task = stmt.taskById.get(r.lastInsertRowid);
    return res.json({ ...task, obra_thread_id: tid });
  } catch (e) {
    console.error('[internal tarefa]', e);
    return res.status(500).json({ error: e.message || 'falha ao criar tarefa' });
  }
});

// Mensagem avulsa do bot num canal fixo (name em vez de id — mais robusto
// pra outros serviços que só conhecem o slug do canal, tipo #alertas).
app.post('/api/internal/channel/:name/mensagem', requireInternalSecret, async (req, res) => {
  try {
    const name = String(req.params.name || '').trim().toLowerCase();
    const content = String(req.body?.content || '').trim().slice(0, 4000);
    if (!name) return res.status(400).json({ error: 'name obrigatório' });
    if (!content) return res.status(400).json({ error: 'content obrigatório' });
    const ch = stmt.channelByName.get(name);
    if (!ch) return res.status(404).json({ error: `canal #${name} não existe` });
    const bot = await repository.getUser(BOT_USER_ID);
    if (!bot) return res.status(500).json({ error: 'bot user ausente' });
    const result = await postMessage(bot, { convType: 'channel', convId: ch.id, content });
    if (!result || !result.ok) return res.status(500).json({ error: 'falha ao postar mensagem' });
    return res.json({ ok: true, channel_id: ch.id, message_id: result.message?.id ?? null });
  } catch (e) {
    console.error('[internal channel mensagem]', e);
    return res.status(500).json({ error: e.message || 'falha ao postar mensagem' });
  }
});

// Mensagem avulsa do bot no chat da obra por card_id (kanban_cards.id).
// Usado pelo InstaParket (post novo / comentário do cliente) e afins.
app.post('/api/internal/obra/:cardId/mensagem', requireInternalSecret, async (req, res) => {
  try {
    const cardId = String(req.params.cardId);
    const obra = await repository.getObra(cardId);
    if (!obra) return res.status(404).json({ error: 'obra (card) não encontrada' });

    const content = String(req.body?.content || '').trim().slice(0, 4000);
    if (!content) return res.status(400).json({ error: 'content obrigatório' });

    const thread = await obterOuCriarThreadDaObra(obra);
    stmt.memberInsert.run(thread.id, 'user', BOT_USER_ID);

    const bot = await repository.getUser(BOT_USER_ID);
    if (!bot) return res.status(500).json({ error: 'bot user ausente' });
    const result = await postMessage(bot, { convType: 'obra', convId: thread.id, content });
    if (!result || !result.ok) return res.status(500).json({ error: 'falha ao postar mensagem' });
    return res.json({ ok: true, obra_thread_id: thread.id, message_id: result.message?.id ?? null });
  } catch (e) {
    console.error('[internal mensagem]', e);
    return res.status(500).json({ error: e.message || 'falha ao postar mensagem' });
  }
});

// Lista últimas N mensagens do chat da obra por card_id — leitura interna.
// Usado pela Análise IA das crises pra dar contexto do que rolou no grupo.
app.get('/api/internal/obra/:cardId/mensagens', requireInternalSecret, async (req, res) => {
  try {
    const cardId = String(req.params.cardId);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 80));
    const obra = await repository.getObra(cardId);
    if (!obra) return res.json({ obra_thread_id: null, messages: [] });
    const thread = await acharThreadDaObra(obra);
    if (!thread) return res.json({ obra_thread_id: null, messages: [] });
    const rows = db.prepare(
      `SELECT id, content, created_at, sender_id
         FROM messages
        WHERE obra_thread_id = ? AND deleted = 0 AND parent_id IS NULL
        ORDER BY id DESC LIMIT ?`
    ).all(thread.id, limit);
    // Nomes vêm de getUsersMerged (auth.users + user_profiles), não de tabela local.
    const users = await getUsersMerged().catch(() => []);
    const byId = new Map((users || []).map((u) => [String(u.id), u.name]));
    const enriched = rows.map((r) => ({ ...r, sender_name: byId.get(String(r.sender_id)) || null }));
    // devolve em ordem cronológica (asc) — mais fácil pra IA processar
    return res.json({ obra_thread_id: thread.id, messages: enriched.reverse() });
  } catch (e) {
    console.error('[internal mensagens]', e);
    return res.status(500).json({ error: e.message });
  }
});

// Lista tarefas da obra por card_id (kanban_cards.id) — leitura interna.
// Devolve [] se ainda não existe obra_thread (obra sem chat).
// Guardrail: se não achou thread por card_id direto, tenta pelo nome canônico
// da obra (fallback pra cards duplicados que resolvem pra mesmo cliente).
app.get('/api/internal/obra/:cardId/tarefas', requireInternalSecret, async (req, res) => {
  try {
    const cardId = String(req.params.cardId);
    const obra = await repository.getObra(cardId);
    if (!obra) return res.json({ obra_thread_id: null, tasks: [], open_count: 0 });
    const thread = await acharThreadDaObra(obra);
    if (!thread) return res.json({ obra_thread_id: null, tasks: [], open_count: 0 });
    const payload = taskListPayload(thread.id);
    res.json({ obra_thread_id: thread.id, ...payload });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Toggle done por task id — usado pelo card do gestão pra marcar como feita
app.post('/api/internal/tarefa/:id/toggle', requireInternalSecret, (req, res) => {
  try {
    const task = stmt.taskById.get(Number(req.params.id));
    if (!task) return res.status(404).json({ error: 'tarefa não encontrada' });
    const done = task.done ? 0 : 1;
    const doneBy = req.body?.done_by_user_id ? String(req.body.done_by_user_id) : BOT_USER_ID;
    stmt.taskSetDone.run(done, doneBy, done, task.id);
    io.to(`obra:${task.obra_thread_id}`).emit('tarefa:update', taskListPayload(task.obra_thread_id));
    res.json(stmt.taskById.get(task.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Edita tarefa (título, responsável, prazo). Só os campos presentes no body são
// alterados. Se assignee_id vier null (explícito), remove atribuição.
app.patch('/api/internal/tarefa/:id', requireInternalSecret, async (req, res) => {
  try {
    const task = stmt.taskById.get(Number(req.params.id));
    if (!task) return res.status(404).json({ error: 'tarefa não encontrada' });
    const body = req.body || {};
    let due = null;
    let dueSet = 0;
    if ('due_date' in body) {
      dueSet = 1;
      if (body.due_date == null || body.due_date === '') due = null;
      else if (/^\d{4}-\d{2}-\d{2}$/.test(String(body.due_date))) due = String(body.due_date);
      else return res.status(400).json({ error: 'data inválida' });
    }
    let assigneeSet = 0;
    let assignee = null;
    if ('assignee_id' in body) {
      assigneeSet = 1;
      assignee = body.assignee_id ? String(body.assignee_id) : null;
      if (assignee) {
        const u = await repository.getUser(assignee).catch(() => null);
        if (!u) return res.status(400).json({ error: 'responsável inválido' });
      }
    }
    let titleClean = null;
    if ('title' in body) {
      titleClean = String(body.title || '').trim().slice(0, 300);
      if (!titleClean) return res.status(400).json({ error: 'título vazio' });
    }
    stmt.taskPatch.run({
      id: task.id,
      title: titleClean,
      assignee_id: assignee,
      assignee_id_set: assigneeSet,
      due_date: due,
      due_date_set: dueSet,
    });
    io.to(`obra:${task.obra_thread_id}`).emit('tarefa:update', taskListPayload(task.obra_thread_id));
    res.json(stmt.taskById.get(task.id));
  } catch (e) {
    console.error('[internal tarefa patch]', e);
    res.status(500).json({ error: e.message });
  }
});

// Deleta tarefa. Não apaga o msg-fonte da conversa nem os comentários — só
// desvincula (usuário ainda vê a mensagem "Tarefa: X" no histórico do chat).
app.delete('/api/internal/tarefa/:id', requireInternalSecret, (req, res) => {
  try {
    const task = stmt.taskById.get(Number(req.params.id));
    if (!task) return res.status(404).json({ error: 'tarefa não encontrada' });
    stmt.taskDelete.run(task.id);
    io.to(`obra:${task.obra_thread_id}`).emit('tarefa:update', taskListPayload(task.obra_thread_id));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Reordena tarefas do bloco (drag-and-drop). Body: {ordered_ids: [id1, id2, ...]}.
// Cada id recebe posição = index. IDs não listados mantêm sua ordem.
app.post('/api/internal/tarefas/reorder', requireInternalSecret, (req, res) => {
  try {
    const ids = req.body?.ordered_ids;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ordered_ids vazio' });
    let tid = null;
    const tx = db.transaction((rows) => {
      rows.forEach((id, idx) => {
        const t = stmt.taskById.get(Number(id));
        if (t) {
          tid = t.obra_thread_id;
          stmt.taskSetOrdem.run(idx, t.id);
        }
      });
    });
    tx(ids);
    if (tid != null) io.to(`obra:${tid}`).emit('tarefa:update', taskListPayload(tid));
    res.json({ ok: true, count: ids.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Comentários de tarefa = replies (parent_id = source_msg_id) no chat da obra.
app.get('/api/internal/tarefa/:id/comments', requireInternalSecret, (req, res) => {
  try {
    const task = stmt.taskById.get(Number(req.params.id));
    if (!task) return res.status(404).json({ error: 'tarefa não encontrada' });
    if (!task.source_msg_id) return res.json({ comments: [], source_msg_id: null });
    const replies = stmt.threadReplies.all(task.source_msg_id);
    res.json({
      source_msg_id: task.source_msg_id,
      comments: replies.map((m) => ({
        id: m.id, sender_id: m.sender_id, content: m.content,
        created_at: m.created_at, edited_at: m.edited_at, deleted: !!m.deleted,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Adiciona comentário na tarefa (posta como reply da mensagem-fonte).
// Se a tarefa não tem source_msg_id (criada antes da migração), posta uma
// mensagem raiz "💬 Comentários: <título>" na obra e a fixa como fonte.
app.post('/api/internal/tarefa/:id/comment', requireInternalSecret, async (req, res) => {
  try {
    const task = stmt.taskById.get(Number(req.params.id));
    if (!task) return res.status(404).json({ error: 'tarefa não encontrada' });
    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ error: 'comentário vazio' });
    const senderId = req.body?.sender_user_id ? String(req.body.sender_user_id) : BOT_USER_ID;

    let sourceMsgId = task.source_msg_id;
    let user = await repository.getUser(senderId).catch(() => null);
    if (!user) user = await repository.getUser(BOT_USER_ID).catch(() => null);
    if (!user) return res.status(500).json({ error: 'usuário do comentário indisponível' });

    if (!sourceMsgId) {
      // Cria uma âncora "💬 Comentários da tarefa: <título>" e passa a usá-la
      const bot = (await repository.getUser(BOT_USER_ID).catch(() => null)) || user;
      const anchor = await postMessage(bot, {
        convType: 'obra', convId: task.obra_thread_id,
        content: '💬 Comentários da tarefa: *' + task.title + '*',
      });
      if (!anchor?.ok) return res.status(500).json({ error: 'não foi possível criar âncora' });
      sourceMsgId = anchor.message.id;
      stmt.taskSetSourceMsg.run(sourceMsgId, task.id);
    }

    // Garante que o autor é membro da obra pra passar no isObraMember de postMessage
    stmt.memberInsert.run(task.obra_thread_id, 'user', String(user.id));

    const result = await postMessage(user, {
      convType: 'obra', convId: task.obra_thread_id, content, parentId: sourceMsgId,
    });
    if (!result?.ok) return res.status(400).json({ error: result?.error || 'falha ao comentar' });
    res.json({ id: result.message.id, source_msg_id: sourceMsgId });
  } catch (e) {
    console.error('[internal tarefa comment]', e);
    res.status(500).json({ error: e.message });
  }
});

// Lista de usuários pra autocomplete de responsável (nome + email + setor).
// Filtra bot e desativados; ordenado por nome. Cache curto do lado do gestão.
app.get('/api/internal/users', requireInternalSecret, async (req, res) => {
  try {
    const users = await repository.getUsers();
    const q = String(req.query.q || '').trim().toLowerCase();
    let out = (users || []).filter((u) => u.id !== BOT_USER_ID && u.name);
    if (q) out = out.filter((u) =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
    // Aplica perfil (nome custom / foto do chat_profiles)
    out = out.map((u) => applyProfile(u));
    res.json(out.slice(0, 50).map((u) => ({
      id: u.id, name: u.name, email: u.email, avatar_url: u.avatar_url || null,
      sector_id: u.sector_id || null,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Health mínimo pro parket-gestao pingar antes de usar
app.get('/api/internal/health', requireInternalSecret, (req, res) => {
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Socket.io — tempo real
// ---------------------------------------------------------------------------

const onlineCounts = new Map(); // userId -> nº de sockets conectados
function onlineUserIds() {
  return [...onlineCounts.keys()];
}

io.use(socketAuth);

io.on('connection', (socket) => {
  const me = applyProfile(socket.data.user);

  // Rooms base
  socket.join(`user:${me.id}`);
  socket.join(`sector:${me.sector_id}`);
  for (const ch of stmt.channelsForUser.all()) {
    if (canAccessChannel(me, ch)) socket.join(`channel:${ch.id}`);
  }
  for (const dm of stmt.dmsForUser.all(me.id, me.id)) socket.join(`dm:${dm.id}`);
  for (const t of stmt.threadsForMember.all(me.id, me.sector_id)) socket.join(`obra:${t.id}`);

  // Presença
  const count = (onlineCounts.get(me.id) || 0) + 1;
  onlineCounts.set(me.id, count);
  if (count === 1) io.emit('presence', { userId: me.id, online: true });
  socket.emit('presence:all', onlineUserIds());

  socket.on('presence:all', (cb) => {
    if (typeof cb === 'function') cb(onlineUserIds());
    else socket.emit('presence:all', onlineUserIds());
  });

  socket.on('dm:join', (dmId) => {
    const dm = stmt.dmById.get(Number(dmId));
    if (canAccessDm(me, dm)) socket.join(`dm:${dm.id}`);
  });

  socket.on('message:send', async (payload, cb) => {
    const ack = typeof cb === 'function' ? cb : () => {};
    try {
      ack(await postMessage(me, payload));
    } catch (e) {
      console.error('[message:send]', e);
      ack({ error: 'erro interno' });
    }
  });

  socket.on('message:edit', async (payload, cb) => {
    const ack = typeof cb === 'function' ? cb : () => {};
    try {
      const { messageId, content } = payload || {};
      const msg = stmt.messageById.get(Number(messageId));
      if (!msg || msg.deleted) return ack({ error: 'mensagem não encontrada' });
      if (String(msg.sender_id) !== String(me.id)) return ack({ error: 'só o autor pode editar' });
      const conv = convOfMessage(me, msg);
      if (!conv) return ack({ error: 'sem acesso' });
      const text = String(content || '').slice(0, MAX_MESSAGE_LENGTH);
      if (!text.trim() && !msg.file_path) return ack({ error: 'mensagem vazia' });
      stmt.messageEdit.run(text, msg.id);
      stmt.mentionsDelete.run(msg.id);
      const mentions = await parseMentions(text);
      for (const m of mentions) stmt.mentionInsert.run(msg.id, m.type, m.id);
      const out = { ...enrichMessage(stmt.messageById.get(msg.id)), conv_type: conv.convType, conv_id: conv.convId };
      io.to(conv.room).emit('message:update', out);
      ack({ ok: true, message: out });
    } catch (e) {
      console.error('[message:edit]', e);
      ack({ error: 'erro interno' });
    }
  });

  socket.on('message:delete', (payload, cb) => {
    const ack = typeof cb === 'function' ? cb : () => {};
    try {
      const msg = stmt.messageById.get(Number((payload || {}).messageId));
      if (!msg || msg.deleted) return ack({ error: 'mensagem não encontrada' });
      if (String(msg.sender_id) !== String(me.id)) return ack({ error: 'só o autor pode excluir' });
      const conv = convOfMessage(me, msg);
      if (!conv) return ack({ error: 'sem acesso' });
      stmt.messageSoftDelete.run(msg.id);
      stmt.mentionsDelete.run(msg.id);
      stmt.pinDelete.run(msg.id);
      stmt.savedDeleteForMessage.run(msg.id);
      const out = { ...enrichMessage(stmt.messageById.get(msg.id)), conv_type: conv.convType, conv_id: conv.convId };
      io.to(conv.room).emit('message:update', out);
      ack({ ok: true });
    } catch (e) {
      console.error('[message:delete]', e);
      ack({ error: 'erro interno' });
    }
  });

  socket.on('pin:toggle', (payload, cb) => {
    const ack = typeof cb === 'function' ? cb : () => {};
    try {
      const msg = stmt.messageById.get(Number((payload || {}).messageId));
      if (!msg || msg.deleted) return ack({ error: 'mensagem não encontrada' });
      const conv = convOfMessage(me, msg);
      if (!conv) return ack({ error: 'sem acesso' });
      const has = stmt.pinGet.get(msg.id);
      if (has) {
        stmt.pinDelete.run(msg.id);
      } else {
        // hours: null/0 = fixado pra sempre; senão expira após N horas (máx 1 ano)
        const hours = Number((payload || {}).hours) || 0;
        const expiresAt = hours > 0 ? new Date(Date.now() + Math.min(hours, 8760) * 3600e3).toISOString() : null;
        stmt.pinInsert.run(msg.id, me.id, expiresAt);
      }
      io.to(conv.room).emit('pin:update', {
        message_id: msg.id,
        parent_id: msg.parent_id,
        conv_type: conv.convType,
        conv_id: conv.convId,
        pinned: !has,
        user_id: me.id,
      });
      ack({ ok: true, pinned: !has });
    } catch (e) {
      console.error('[pin:toggle]', e);
      ack({ error: 'erro interno' });
    }
  });

  // "Fulano está digitando…" — só repassa pra room; sem persistência.
  socket.on('typing', (payload) => {
    const { convType, convId } = payload || {};
    if (!['channel', 'dm', 'obra'].includes(convType)) return;
    const room = `${convType}:${Number(convId)}`;
    if (!socket.rooms.has(room)) return;
    socket.to(room).emit('typing', { userId: me.id, convType, convId: Number(convId) });
  });

  socket.on('reaction:toggle', (payload, cb) => {
    const ack = typeof cb === 'function' ? cb : () => {};
    try {
      const { messageId, emoji } = payload || {};
      const em = String(emoji || '').slice(0, 16);
      if (!em) return ack({ error: 'emoji inválido' });
      const msg = stmt.messageById.get(Number(messageId));
      const conv = convOfMessage(me, msg);
      if (!conv) return ack({ error: 'sem acesso' });
      const has = stmt.reactionGet.get(msg.id, me.id, em);
      if (has) stmt.reactionDelete.run(msg.id, me.id, em);
      else stmt.reactionInsert.run(msg.id, me.id, em);
      io.to(conv.room).emit('reaction:update', {
        message_id: msg.id,
        parent_id: msg.parent_id,
        conv_type: conv.convType,
        conv_id: conv.convId,
        emoji: em,
        user_id: me.id,
        added: !has,
      });
      ack({ ok: true, added: !has });
    } catch (e) {
      console.error('[reaction:toggle]', e);
      ack({ error: 'erro interno' });
    }
  });

  socket.on('disconnect', () => {
    const c = (onlineCounts.get(me.id) || 1) - 1;
    if (c <= 0) {
      onlineCounts.delete(me.id);
      io.emit('presence', { userId: me.id, online: false });
    } else {
      onlineCounts.set(me.id, c);
    }
  });
});

// ---------------------------------------------------------------------------

(async () => {
  ensureChannels(await repository.getSectors());
  server.listen(PORT, () => console.log(`[parket-chat] rodando em http://localhost:${PORT}`));
  // Notifier de aprovações do Core (posta no #financeiro quando algo entra na fila).
  if (repository.REAL && repository.pool) {
    startAprovacoesNotifier({ pool: repository.pool, postMessage, repository });
  }
})();
