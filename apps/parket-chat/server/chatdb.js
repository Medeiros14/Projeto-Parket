/**
 * BANCO DO CHAT — somente as tabelas NOVAS do chat.
 * Usuários, setores e obras vêm do banco existente da Parket (ver repository.js).
 *
 * Aqui usamos SQLite para a v1 rodar sozinha.
 * // TODO Parket: se preferir, mova estas tabelas para o Postgres da empresa —
 * // basta trocar as queries deste módulo; o resto do código não conhece SQLite.
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(process.env.CHAT_DB_PATH || path.join(DATA_DIR, 'chat.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sector_id TEXT NULL,               -- NULL = canal geral (#geral, #avisos)
  restrict_role TEXT NULL,           -- NULL = aberto; senão só usuários com role igual (ex.: 'superadmin')
  UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS dms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a TEXT NOT NULL,
  user_b TEXT NOT NULL,
  UNIQUE(user_a, user_b)             -- par sempre ordenado (user_a < user_b)
);

CREATE TABLE IF NOT EXISTS obra_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id TEXT NOT NULL UNIQUE    -- referencia a obra no banco da Parket
);

CREATE TABLE IF NOT EXISTS obra_members (
  obra_thread_id INTEGER NOT NULL REFERENCES obra_threads(id),
  member_type TEXT NOT NULL CHECK (member_type IN ('sector','user')),
  member_id TEXT NOT NULL,
  PRIMARY KEY (obra_thread_id, member_type, member_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NULL REFERENCES channels(id),
  dm_id INTEGER NULL REFERENCES dms(id),
  obra_thread_id INTEGER NULL REFERENCES obra_threads(id),
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  file_path TEXT NULL,
  file_name TEXT NULL,
  file_type TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (
    (channel_id IS NOT NULL) + (dm_id IS NOT NULL) + (obra_thread_id IS NOT NULL) = 1
  )
);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, id);
CREATE INDEX IF NOT EXISTS idx_messages_dm ON messages(dm_id, id);
CREATE INDEX IF NOT EXISTS idx_messages_obra ON messages(obra_thread_id, id);

CREATE TABLE IF NOT EXISTS reads (
  user_id TEXT NOT NULL,
  conv_type TEXT NOT NULL CHECK (conv_type IN ('channel','dm','obra')),
  conv_id INTEGER NOT NULL,
  last_read_msg_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, conv_type, conv_id)
);

CREATE TABLE IF NOT EXISTS mentions (
  message_id INTEGER NOT NULL REFERENCES messages(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('sector','user')),
  target_id TEXT NOT NULL,
  PRIMARY KEY (message_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id INTEGER NOT NULL REFERENCES messages(id),
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subscription TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
`);

// --- Migração v2: threads em qualquer mensagem (parent_id) ------------------
const msgCols = db.prepare("PRAGMA table_info(messages)").all().map((c) => c.name);
if (!msgCols.includes('parent_id')) {
  db.exec('ALTER TABLE messages ADD COLUMN parent_id INTEGER NULL REFERENCES messages(id)');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id, id)');

// --- Migração v3: editar/excluir mensagem + mensagens fixadas ---------------
if (!msgCols.includes('edited_at')) {
  db.exec('ALTER TABLE messages ADD COLUMN edited_at TEXT NULL');
}
if (!msgCols.includes('deleted')) {
  db.exec('ALTER TABLE messages ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0');
}
db.exec(`
CREATE TABLE IF NOT EXISTS pinned_messages (
  message_id INTEGER PRIMARY KEY REFERENCES messages(id),
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`);

// --- Migração v4: perfil (nome/foto), mensagens agendadas, tarefas da obra --
db.exec(`
CREATE TABLE IF NOT EXISTS chat_profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NULL,
  avatar_url TEXT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS scheduled_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conv_type TEXT NOT NULL CHECK (conv_type IN ('channel','dm','obra')),
  conv_id INTEGER NOT NULL,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  file_path TEXT NULL, file_name TEXT NULL, file_type TEXT NULL,
  send_at TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_sched_due ON scheduled_messages(sent, send_at);

CREATE TABLE IF NOT EXISTS obra_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_thread_id INTEGER NOT NULL REFERENCES obra_threads(id),
  title TEXT NOT NULL,
  created_by TEXT NOT NULL,
  assignee_id TEXT NULL,
  due_date TEXT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  done_by TEXT NULL,
  done_at TEXT NULL,
  source_msg_id INTEGER NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_obra ON obra_tasks(obra_thread_id, done, id);
`);

// --- Migração v5: descrição da obra, pin com validade, mensagens salvas -----
const obraCols = db.prepare('PRAGMA table_info(obra_threads)').all().map((c) => c.name);
if (!obraCols.includes('description')) {
  db.exec('ALTER TABLE obra_threads ADD COLUMN description TEXT NULL');
}
const pinCols = db.prepare('PRAGMA table_info(pinned_messages)').all().map((c) => c.name);
if (!pinCols.includes('expires_at')) {
  db.exec('ALTER TABLE pinned_messages ADD COLUMN expires_at TEXT NULL');
}
db.exec(`
CREATE TABLE IF NOT EXISTS saved_messages (
  user_id TEXT NOT NULL,
  message_id INTEGER NOT NULL REFERENCES messages(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, message_id)
);
`);

// --- Migração v6: responder mensagem específica (quote-reply) ---------------
if (!msgCols.includes('reply_to')) {
  db.exec('ALTER TABLE messages ADD COLUMN reply_to INTEGER NULL REFERENCES messages(id)');
}

// --- Migração v6b: reorder das obra_tasks (drag-and-drop) -------------------
const taskCols = db.prepare('PRAGMA table_info(obra_tasks)').all().map((c) => c.name);
if (!taskCols.includes('ordem')) {
  db.exec('ALTER TABLE obra_tasks ADD COLUMN ordem INTEGER NOT NULL DEFAULT 0');
  // Backfill ordem seguindo id atual (menor id = menor ordem inicial)
  db.exec('UPDATE obra_tasks SET ordem = id WHERE ordem = 0');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_ordem ON obra_tasks(obra_thread_id, ordem)');

// --- Migração v7: tags de status da obra (JSON array de strings) ------------
if (!obraCols.includes('tags')) {
  db.exec("ALTER TABLE obra_threads ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'");
}

// --- Migração v8: canal restrito por role (ex.: squad-claude só superadmin) -
const chanCols = db.prepare('PRAGMA table_info(channels)').all().map((c) => c.name);
if (!chanCols.includes('restrict_role')) {
  db.exec('ALTER TABLE channels ADD COLUMN restrict_role TEXT NULL');
}

// --- Busca full-text (FTS5, external content) -------------------------------
db.exec(`
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content, content='messages', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER IF NOT EXISTS messages_fts_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;
CREATE TRIGGER IF NOT EXISTS messages_fts_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.id, old.content);
END;
CREATE TRIGGER IF NOT EXISTS messages_fts_au AFTER UPDATE OF content ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.id, old.content);
  INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;
`);
// Backfill do índice quando criado depois de já existirem mensagens.
const ftsCount = db.prepare('SELECT count(*) c FROM messages_fts').get().c;
const msgCount = db.prepare('SELECT count(*) c FROM messages').get().c;
if (ftsCount === 0 && msgCount > 0) {
  db.exec("INSERT INTO messages_fts(rowid, content) SELECT id, content FROM messages");
}

// --- Canais fixos -----------------------------------------------------------

/** Garante os canais gerais + 1 canal por setor. Idempotente + rename in-place:
 *  se o setor mudar de slug (ex.: homebroker→comercial), o canal existente é
 *  RENOMEADO em vez de duplicado. Mantém mensagens antigas. */
function ensureChannels(sectors) {
  const ins = db.prepare('INSERT OR IGNORE INTO channels (name, sector_id) VALUES (?, ?)');
  const upd = db.prepare('UPDATE channels SET name = ? WHERE sector_id = ?');
  ins.run('geral', null);
  ins.run('avisos', null);
  // Canal global de alertas — quem abre crise no gestor faz eco aqui pra
  // toda a operação enxergar no mesmo lugar (fora da conversa da obra).
  ins.run('alertas', null);
  for (const s of sectors) {
    upd.run(s.slug, s.id);   // renomeia existente se slug mudou
    ins.run(s.slug, s.id);   // cria se ainda não existia
  }
}

// --- Statements -------------------------------------------------------------

const stmt = {
  // Will 24/07: retorna TODOS os canais (globais + de todos os setores). Filtro
  // por sector_id antigo isolava setores; agora é aberto. Param mantido pra
  // compat mas ignorado.
  channelsForUser: db.prepare('SELECT * FROM channels ORDER BY sector_id IS NULL DESC, name'),
  channelById: db.prepare('SELECT * FROM channels WHERE id = ?'),
  channelByName: db.prepare('SELECT * FROM channels WHERE name = ? LIMIT 1'),

  dmByPair: db.prepare('SELECT * FROM dms WHERE user_a = ? AND user_b = ?'),
  dmById: db.prepare('SELECT * FROM dms WHERE id = ?'),
  dmsForUser: db.prepare('SELECT * FROM dms WHERE user_a = ? OR user_b = ?'),
  dmInsert: db.prepare('INSERT INTO dms (user_a, user_b) VALUES (?, ?)'),

  obraThreadByObra: db.prepare('SELECT * FROM obra_threads WHERE obra_id = ?'),
  obraThreadById: db.prepare('SELECT * FROM obra_threads WHERE id = ?'),
  obraThreadInsert: db.prepare('INSERT INTO obra_threads (obra_id) VALUES (?)'),

  memberInsert: db.prepare(
    'INSERT OR IGNORE INTO obra_members (obra_thread_id, member_type, member_id) VALUES (?, ?, ?)'
  ),
  membersOfThread: db.prepare('SELECT * FROM obra_members WHERE obra_thread_id = ?'),
  isMember: db.prepare(
    'SELECT 1 FROM obra_members WHERE obra_thread_id = ? AND member_type = ? AND member_id = ?'
  ),
  threadsForMember: db.prepare(
    `SELECT DISTINCT t.* FROM obra_threads t
     JOIN obra_members m ON m.obra_thread_id = t.id
     WHERE (m.member_type = 'user' AND m.member_id = ?)
        OR (m.member_type = 'sector' AND m.member_id = ?)`
  ),

  messageInsert: db.prepare(
    `INSERT INTO messages (channel_id, dm_id, obra_thread_id, parent_id, reply_to, sender_id, content, file_path, file_name, file_type)
     VALUES (@channel_id, @dm_id, @obra_thread_id, @parent_id, @reply_to, @sender_id, @content, @file_path, @file_name, @file_type)`
  ),
  messageById: db.prepare('SELECT * FROM messages WHERE id = ?'),
  // Painel principal: só mensagens raiz (replies vivem no painel de thread).
  lastMessages: {
    channel: db.prepare('SELECT * FROM messages WHERE channel_id = ? AND parent_id IS NULL ORDER BY id DESC LIMIT 100'),
    dm: db.prepare('SELECT * FROM messages WHERE dm_id = ? AND parent_id IS NULL ORDER BY id DESC LIMIT 100'),
    obra: db.prepare('SELECT * FROM messages WHERE obra_thread_id = ? AND parent_id IS NULL ORDER BY id DESC LIMIT 100'),
  },
  threadReplies: db.prepare('SELECT * FROM messages WHERE parent_id = ? ORDER BY id ASC LIMIT 300'),
  replySummary: db.prepare(
    `SELECT COUNT(*) AS reply_count, MAX(created_at) AS last_reply_at,
            GROUP_CONCAT(DISTINCT sender_id) AS repliers
     FROM messages WHERE parent_id = ?`
  ),

  messageEdit: db.prepare(
    "UPDATE messages SET content = ?, edited_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?"
  ),
  messageSoftDelete: db.prepare(
    "UPDATE messages SET content = '', file_path = NULL, file_name = NULL, file_type = NULL, edited_at = NULL, deleted = 1 WHERE id = ?"
  ),
  mentionsDelete: db.prepare('DELETE FROM mentions WHERE message_id = ?'),

  pinGet: db.prepare(
    `SELECT 1 FROM pinned_messages WHERE message_id = ?
     AND (expires_at IS NULL OR expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now'))`
  ),
  pinInsert: db.prepare(
    `INSERT INTO pinned_messages (message_id, user_id, expires_at) VALUES (?, ?, ?)
     ON CONFLICT(message_id) DO UPDATE SET user_id = excluded.user_id, expires_at = excluded.expires_at,
       created_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
  ),
  pinDelete: db.prepare('DELETE FROM pinned_messages WHERE message_id = ?'),
  pinsExpired: db.prepare(
    `SELECT p.message_id, m.channel_id, m.dm_id, m.obra_thread_id, m.parent_id
     FROM pinned_messages p JOIN messages m ON m.id = p.message_id
     WHERE p.expires_at IS NOT NULL AND p.expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now')`
  ),
  pinsFor: {
    channel: db.prepare(
      `SELECT m.* FROM pinned_messages p JOIN messages m ON m.id = p.message_id
       WHERE m.channel_id = ? AND (p.expires_at IS NULL OR p.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ORDER BY p.created_at DESC`
    ),
    dm: db.prepare(
      `SELECT m.* FROM pinned_messages p JOIN messages m ON m.id = p.message_id
       WHERE m.dm_id = ? AND (p.expires_at IS NULL OR p.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ORDER BY p.created_at DESC`
    ),
    obra: db.prepare(
      `SELECT m.* FROM pinned_messages p JOIN messages m ON m.id = p.message_id
       WHERE m.obra_thread_id = ? AND (p.expires_at IS NULL OR p.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ORDER BY p.created_at DESC`
    ),
  },

  obraSetDescription: db.prepare('UPDATE obra_threads SET description = ? WHERE id = ?'),
  obraSetTags: db.prepare('UPDATE obra_threads SET tags = ? WHERE id = ?'),
  obraMedia: db.prepare(
    `SELECT * FROM messages WHERE obra_thread_id = ? AND deleted = 0
     AND (file_path IS NOT NULL OR content LIKE '%http%')
     ORDER BY id DESC LIMIT 500`
  ),

  savedGet: db.prepare('SELECT 1 FROM saved_messages WHERE user_id = ? AND message_id = ?'),
  savedInsert: db.prepare('INSERT OR IGNORE INTO saved_messages (user_id, message_id) VALUES (?, ?)'),
  savedDelete: db.prepare('DELETE FROM saved_messages WHERE user_id = ? AND message_id = ?'),
  savedIdsForUser: db.prepare('SELECT message_id FROM saved_messages WHERE user_id = ?'),
  savedMessagesForUser: db.prepare(
    `SELECT m.*, s.created_at AS saved_at FROM saved_messages s JOIN messages m ON m.id = s.message_id
     WHERE s.user_id = ? AND m.deleted = 0 ORDER BY s.created_at DESC LIMIT 200`
  ),
  savedDeleteForMessage: db.prepare('DELETE FROM saved_messages WHERE message_id = ?'),

  profileGet: db.prepare('SELECT * FROM chat_profiles WHERE user_id = ?'),
  profileUpsert: db.prepare(
    `INSERT INTO chat_profiles (user_id, display_name, avatar_url) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET display_name = excluded.display_name,
       avatar_url = excluded.avatar_url, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
  ),

  schedInsert: db.prepare(
    `INSERT INTO scheduled_messages (conv_type, conv_id, sender_id, content, file_path, file_name, file_type, send_at)
     VALUES (@conv_type, @conv_id, @sender_id, @content, @file_path, @file_name, @file_type, @send_at)`
  ),
  schedById: db.prepare('SELECT * FROM scheduled_messages WHERE id = ?'),
  schedForUser: db.prepare('SELECT * FROM scheduled_messages WHERE sender_id = ? AND sent = 0 ORDER BY send_at'),
  schedDue: db.prepare('SELECT * FROM scheduled_messages WHERE sent = 0 AND send_at <= ? ORDER BY send_at LIMIT 20'),
  schedMarkSent: db.prepare('UPDATE scheduled_messages SET sent = 1 WHERE id = ?'),
  schedDelete: db.prepare('DELETE FROM scheduled_messages WHERE id = ? AND sender_id = ? AND sent = 0'),

  taskInsert: db.prepare(
    `INSERT INTO obra_tasks (obra_thread_id, title, created_by, assignee_id, due_date, source_msg_id, ordem)
     VALUES (@obra_thread_id, @title, @created_by, @assignee_id, @due_date, @source_msg_id,
             COALESCE((SELECT MAX(ordem) + 1 FROM obra_tasks WHERE obra_thread_id = @obra_thread_id), 0))`
  ),
  taskById: db.prepare('SELECT * FROM obra_tasks WHERE id = ?'),
  tasksForThread: db.prepare(
    `SELECT * FROM obra_tasks WHERE obra_thread_id = ?
     ORDER BY done ASC, ordem ASC, id ASC`
  ),
  taskSetDone: db.prepare(
    `UPDATE obra_tasks SET done = ?, done_by = ?, done_at = CASE WHEN ? = 1 THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE NULL END WHERE id = ?`
  ),
  taskPatch: db.prepare(
    `UPDATE obra_tasks
       SET title       = COALESCE(@title, title),
           assignee_id = CASE WHEN @assignee_id_set = 1 THEN @assignee_id ELSE assignee_id END,
           due_date    = CASE WHEN @due_date_set = 1    THEN @due_date    ELSE due_date    END
     WHERE id = @id`
  ),
  taskSetSourceMsg: db.prepare('UPDATE obra_tasks SET source_msg_id = ? WHERE id = ?'),
  taskSetOrdem: db.prepare('UPDATE obra_tasks SET ordem = ? WHERE id = ?'),
  taskDelete: db.prepare('DELETE FROM obra_tasks WHERE id = ?'),
  taskCountOpen: db.prepare('SELECT COUNT(*) c FROM obra_tasks WHERE obra_thread_id = ? AND done = 0'),

  reactionsFor: db.prepare('SELECT emoji, user_id FROM message_reactions WHERE message_id = ? ORDER BY created_at'),
  reactionGet: db.prepare('SELECT 1 FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?'),
  reactionInsert: db.prepare('INSERT OR IGNORE INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)'),
  reactionDelete: db.prepare('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?'),

  searchMessages: db.prepare(
    `SELECT m.*, snippet(messages_fts, 0, '', '', '…', 12) AS snippet
     FROM messages_fts f JOIN messages m ON m.id = f.rowid
     WHERE messages_fts MATCH ?
     ORDER BY m.id DESC LIMIT 200`
  ),

  pushUpsert: db.prepare(
    `INSERT INTO push_subscriptions (endpoint, user_id, subscription) VALUES (?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, subscription = excluded.subscription`
  ),
  pushDelete: db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?'),
  pushForUser: db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?'),

  readUpsert: db.prepare(
    `INSERT INTO reads (user_id, conv_type, conv_id, last_read_msg_id) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, conv_type, conv_id)
     DO UPDATE SET last_read_msg_id = MAX(last_read_msg_id, excluded.last_read_msg_id)`
  ),
  readGet: db.prepare(
    'SELECT last_read_msg_id FROM reads WHERE user_id = ? AND conv_type = ? AND conv_id = ?'
  ),

  unreadCount: {
    channel: db.prepare('SELECT COUNT(*) c FROM messages WHERE channel_id = ? AND id > ? AND sender_id != ?'),
    dm: db.prepare('SELECT COUNT(*) c FROM messages WHERE dm_id = ? AND id > ? AND sender_id != ?'),
    obra: db.prepare('SELECT COUNT(*) c FROM messages WHERE obra_thread_id = ? AND id > ? AND sender_id != ?'),
  },

  mentionInsert: db.prepare(
    'INSERT OR IGNORE INTO mentions (message_id, target_type, target_id) VALUES (?, ?, ?)'
  ),
  unreadMentions: {
    channel: db.prepare(
      `SELECT COUNT(*) c FROM mentions mn JOIN messages m ON m.id = mn.message_id
       WHERE m.channel_id = ? AND m.id > ? AND m.sender_id != ?
         AND ((mn.target_type='user' AND mn.target_id = ?) OR (mn.target_type='sector' AND mn.target_id = ?))`
    ),
    dm: db.prepare(
      `SELECT COUNT(*) c FROM mentions mn JOIN messages m ON m.id = mn.message_id
       WHERE m.dm_id = ? AND m.id > ? AND m.sender_id != ?
         AND ((mn.target_type='user' AND mn.target_id = ?) OR (mn.target_type='sector' AND mn.target_id = ?))`
    ),
    obra: db.prepare(
      `SELECT COUNT(*) c FROM mentions mn JOIN messages m ON m.id = mn.message_id
       WHERE m.obra_thread_id = ? AND m.id > ? AND m.sender_id != ?
         AND ((mn.target_type='user' AND mn.target_id = ?) OR (mn.target_type='sector' AND mn.target_id = ?))`
    ),
  },
};

module.exports = { db, stmt, ensureChannels };
