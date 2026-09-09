/**
 * Parket Chat — widget embutível (React, bundle único via esbuild).
 *
 * Duas formas de embutir (ver README):
 *  1. <script src=".../app.js" data-parket-chat data-token="JWT" data-api="https://chat...">
 *     + opcional <div id="parket-chat"></div>
 *  2. <iframe src=".../widget.html#token=JWT">
 *
 * API global: window.ParketChat.init({ token, api, container, mode })
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

const AVATAR_COLORS = ['#60544d', '#968473', '#7a6c5d', '#4a5548', '#5d5464', '#8a6f4d', '#4f5d6b', '#6b4f4f', '#050505'];
const colorFor = (name) => AVATAR_COLORS[[...String(name)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
const initials = (name) =>
  String(name || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(today.getTime() - 86400000);
  const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return 'Hoje';
  if (same(d, yest)) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
const timeLabel = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// ---------------------------------------------------------------------------
// SSO — a plataforma do setor já está logada no Supabase da Parket; o widget
// reaproveita o access_token gravado no localStorage. As plataformas usam
// storageKeys diferentes (sb-*-auth-token, valoria-parket-sso,
// parket-homebroker-auth, compras-parket-sso...), então varremos TODAS as
// chaves e aceitamos qualquer sessão GoTrue válida (JWT com role/aud
// "authenticated" e não expirado). O token rotaciona — relido a cada uso.
// ---------------------------------------------------------------------------

function tokenPayload(t) {
  try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { return null; }
}

function isGoTrueToken(t) {
  if (typeof t !== 'string' || t.split('.').length !== 3) return false;
  const p = tokenPayload(t);
  if (!p) return false;
  if (p.aud !== 'authenticated' && p.role !== 'authenticated') return false;
  return !p.exp || p.exp * 1000 > Date.now();
}

// Tokens que o SERVIDOR já rejeitou (401). O formato GoTrue não garante que o
// token é da Parket — apps no mesmo domínio podem ter sessão de outro projeto
// Supabase (outro segredo). Rejeitou = descarta e tenta o próximo candidato.
const badTokens = new Set();
function markTokenBad(t) { if (t) badTokens.add(t); }

// Prioriza tokens emitidos pelo GoTrue da Parket (Cloud hbxpilrxmitvzebluoom).
function tokenPref(t) {
  const iss = String((tokenPayload(t) || {}).iss || '');
  if (iss.includes('hbxpilrxmitvzebluoom')) return 2;
  if (iss.includes('parket')) return 1;
  return 0;
}

function readSupabaseToken() {
  const found = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/\.\d+$/.test(k) && !k.endsWith('.0')) continue; // fatia não-inicial
      let raw = localStorage.getItem(k);
      if (!raw) continue;
      // Sessões grandes são fatiadas em <chave>.0, .1, ... — reagrupa.
      if (k.endsWith('.0')) {
        const prefix = k.slice(0, -2);
        for (let n = 1; localStorage.getItem(prefix + '.' + n) !== null; n++) raw += localStorage.getItem(prefix + '.' + n);
      }
      if (raw.startsWith('base64-')) {
        try { raw = atob(raw.slice(7)); } catch (e) { continue; }
      }
      if (raw[0] !== '{') continue;
      try {
        const j = JSON.parse(raw);
        const t = (j && j.access_token) || (j && j.currentSession && j.currentSession.access_token);
        if (isGoTrueToken(t) && !badTokens.has(t) && !found.includes(t)) found.push(t);
      } catch (e) { /* chave com outro formato */ }
    }
  } catch (e) { /* sem localStorage */ }
  found.sort((a, b) => tokenPref(b) - tokenPref(a));
  return found[0] || null;
}

// ---------------------------------------------------------------------------
// Camada de API
// ---------------------------------------------------------------------------

function makeApi(base, getToken) {
  const call = async (path, opts = {}) => {
    const res = await fetch(base + path, {
      ...opts,
      headers: {
        ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        Authorization: 'Bearer ' + getToken(),
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const e = new Error(err.error || 'erro ' + res.status);
      e.status = res.status;
      throw e;
    }
    return res.json();
  };
  return {
    bootstrap: () => call('/api/bootstrap'),
    buscarObras: (q) => call('/api/obras/buscar?q=' + encodeURIComponent(q)),
    abrirObra: (obraId) => call('/api/obras/' + obraId + '/abrir', { method: 'POST' }),
    messages: (type, id) => call('/api/messages?' + type + '=' + id),
    criarDm: (userId) => call('/api/dms', { method: 'POST', body: JSON.stringify({ userId }) }),
    marcarLido: (convType, convId, lastMsgId) =>
      call('/api/read', { method: 'POST', body: JSON.stringify({ convType, convId, lastMsgId }) }),
    upload: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return call('/api/upload', { method: 'POST', body: fd });
    },
  };
}

// ---------------------------------------------------------------------------
// Login de teste local (em produção o SSO da plataforma fornece o JWT)
// ---------------------------------------------------------------------------

function LoginView({ base, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(base + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'falha no login');
      const data = await res.json();
      onLogin(data.token);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <div className="pk-login">
      <div className="pk-login-title">Parket Chat</div>
      <div className="pk-login-sub">Login de teste local — em produção o acesso é automático (SSO)</div>
      <form onSubmit={submit}>
        <input data-testid="login-email" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input data-testid="login-password" type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="pk-login-error" data-testid="login-error">{error}</div>}
        <button type="submit" data-testid="login-submit">Entrar</button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conteúdo da mensagem — destaca @menções e renderiza anexos
// ---------------------------------------------------------------------------

function MessageContent({ msg, mentionNames, base }) {
  const parts = useMemo(() => {
    const content = msg.content || '';
    if (!content) return [];
    // Divide o texto nas menções conhecidas (nomes reais de setores/pessoas)
    const sorted = [...mentionNames].sort((a, b) => b.length - a.length);
    let segments = [{ text: content, mention: false }];
    for (const name of sorted) {
      const next = [];
      for (const seg of segments) {
        if (seg.mention) { next.push(seg); continue; }
        const token = '@' + name;
        let rest = seg.text;
        let idx;
        while ((idx = rest.toLowerCase().indexOf(token.toLowerCase())) !== -1) {
          if (idx > 0) next.push({ text: rest.slice(0, idx), mention: false });
          next.push({ text: rest.slice(idx, idx + token.length), mention: true });
          rest = rest.slice(idx + token.length);
        }
        if (rest) next.push({ text: rest, mention: false });
      }
      segments = next;
    }
    return segments;
  }, [msg.content, mentionNames]);

  const isImage = msg.file_type && msg.file_type.startsWith('image/');
  return (
    <div className="pk-msg-content">
      {parts.map((p, i) =>
        p.mention ? (
          <span key={i} className="pk-mention" data-testid="mention">{p.text}</span>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
      {msg.file_path && isImage && (
        <a href={base + msg.file_path} target="_blank" rel="noreferrer">
          <img className="pk-msg-image" src={base + msg.file_path} alt={msg.file_name || 'imagem'} />
        </a>
      )}
      {msg.file_path && !isImage && (
        <a className="pk-msg-file" href={base + msg.file_path} target="_blank" rel="noreferrer" download={msg.file_name || true}>
          📎 {msg.file_name || 'arquivo'}
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Painel principal do chat
// ---------------------------------------------------------------------------

function ChatPanel({ base, api, getToken, sso, onLogout, alwaysOpen }) {
  const [boot, setBoot] = useState(null);
  const [online, setOnline] = useState(new Set());
  const [active, setActive] = useState(null); // { type:'channel'|'dm'|'obra', id }
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [obraSearch, setObraSearch] = useState(null); // null=fechado, ''=aberto
  const [obraResults, setObraResults] = useState([]);
  const [dmPicker, setDmPicker] = useState(false);
  const [sidebarQuery, setSidebarQuery] = useState(''); // filtro geral: obras+canais+pessoas
  const socketRef = useRef(null);
  const activeRef = useRef(null);
  const bootRef = useRef(null);
  const listRef = useRef(null);
  const fileRef = useRef(null);
  const onLogoutRef = useRef(onLogout);
  activeRef.current = active;
  bootRef.current = boot;
  onLogoutRef.current = onLogout;

  const usersById = useMemo(() => new Map((boot?.users || []).map((u) => [u.id, u])), [boot]);
  const sectorsById = useMemo(() => new Map((boot?.sectors || []).map((s) => [s.id, s])), [boot]);
  const mentionNames = useMemo(
    () => [...(boot?.sectors || []).map((s) => s.name), ...(boot?.users || []).map((u) => u.name)],
    [boot]
  );

  const scrollDown = () => requestAnimationFrame(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  });

  // Atualiza contadores de uma conversa na sidebar
  const patchConv = useCallback((type, id, fn) => {
    setBoot((b) => {
      if (!b) return b;
      const key = type === 'channel' ? 'channels' : type === 'dm' ? 'dms' : 'obras_visiveis';
      const idKey = type === 'obra' ? 'thread_id' : 'id';
      return { ...b, [key]: b[key].map((c) => (c[idKey] === id ? fn(c) : c)) };
    });
  }, []);

  const markRead = useCallback((type, id, lastMsgId) => {
    if (!lastMsgId) return;
    api.marcarLido(type, id, lastMsgId).catch(() => {});
    patchConv(type, id, (c) => ({ ...c, unread: 0, mentions: 0 }));
  }, [api, patchConv]);

  // Boot + socket
  useEffect(() => {
    let disposed = false;
    let retryTimer = null;
    const doBoot = (attempt) => {
      api.bootstrap().then((data) => {
        if (disposed) return;
        setBoot(data);
        setOnline(new Set(data.online || []));
      }).catch((e) => {
        if (disposed) return;
        if (e.status === 401) {
          // Token rejeitado pelo servidor: pode ser de outro projeto Supabase
          // no mesmo domínio — descarta e deixa o próximo candidato assumir.
          markTokenBad(getToken());
          if (sso && attempt < 5) retryTimer = setTimeout(() => doBoot(attempt + 1), 1000 * (attempt + 1));
          else onLogoutRef.current();
        }
      });
    };
    doBoot(0);

    const socket = io(base, {
      auth: (cb) => cb({ token: getToken() }),
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('presence', ({ userId, online: isOn }) =>
      setOnline((prev) => {
        const next = new Set(prev);
        isOn ? next.add(userId) : next.delete(userId);
        return next;
      })
    );
    socket.on('presence:all', (ids) => setOnline(new Set(ids)));

    socket.on('message:new', (msg) => {
      const me = bootRef.current?.me;
      const act = activeRef.current;
      const isActive = act && act.type === msg.conv_type && act.id === msg.conv_id;
      if (isActive) {
        setMessages((ms) => [...ms, msg]);
        scrollDown();
        if (me && msg.sender_id !== me.id) markRead(msg.conv_type, msg.conv_id, msg.id);
      } else if (me && msg.sender_id !== me.id) {
        const mentioned = (msg.mentions || []).some(
          (m) => (m.type === 'user' && m.id === me.id) || (m.type === 'sector' && m.id === me.sector_id)
        );
        patchConv(msg.conv_type, msg.conv_id, (c) => ({
          ...c,
          unread: (c.unread || 0) + 1,
          mentions: (c.mentions || 0) + (mentioned ? 1 : 0),
        }));
      }
    });

    socket.on('obra:acesso', (payload) => {
      setBoot((b) => {
        if (!b) return b;
        const exists = b.obras_visiveis.some((o) => o.thread_id === payload.thread_id);
        return {
          ...b,
          obras_visiveis: exists
            ? b.obras_visiveis.map((o) => (o.thread_id === payload.thread_id ? { ...o, ...payload } : o))
            : [...b.obras_visiveis, { ...payload, unread: 0, mentions: 0 }],
        };
      });
    });

    socket.on('obra:membros', (payload) => {
      setBoot((b) =>
        b
          ? {
              ...b,
              obras_visiveis: b.obras_visiveis.map((o) =>
                o.thread_id === payload.thread_id ? { ...o, members: payload.members } : o
              ),
            }
          : b
      );
    });

    socket.on('dm:new', (dm) => {
      setBoot((b) => {
        if (!b || b.dms.some((d) => d.id === dm.id)) return b;
        return { ...b, dms: [...b.dms, { ...dm, unread: 0, mentions: 0 }] };
      });
      socket.emit('dm:join', dm.id);
    });

    socket.on('read:update', ({ convType, convId }) => patchConv(convType, convId, (c) => ({ ...c, unread: 0, mentions: 0 })));

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket.disconnect();
    };
  }, [api, base, getToken, sso, markRead, patchConv]);

  // Abrir conversa
  const openConv = useCallback(async (type, id) => {
    setActive({ type, id });
    setMessages([]);
    try {
      const msgs = await api.messages(type === 'channel' ? 'channel' : type === 'dm' ? 'dm' : 'obra', id);
      setMessages(msgs.map((m) => ({ ...m, conv_type: type, conv_id: id })));
      scrollDown();
      if (msgs.length) markRead(type, id, msgs[msgs.length - 1].id);
      else patchConv(type, id, (c) => ({ ...c, unread: 0, mentions: 0 }));
    } catch (e) {
      setMessages([{ id: 'err', system: true, content: 'Sem acesso a esta conversa.', created_at: new Date().toISOString() }]);
    }
  }, [api, markRead, patchConv]);

  // Enviar
  const send = async () => {
    const act = activeRef.current;
    if (!act) return;
    const content = input.trim();
    if (!content && !pendingFile) return;
    let file = null;
    if (pendingFile) {
      try {
        file = await api.upload(pendingFile);
      } catch (e) {
        alert('Falha no upload: ' + e.message);
        return;
      }
    }
    socketRef.current.emit('message:send', { convType: act.type, convId: act.id, content, file }, (res) => {
      if (res && res.error) alert(res.error);
    });
    setInput('');
    setPendingFile(null);
    setMentionQuery(null);
  };

  // Autocomplete de @
  const onInputChange = (e) => {
    const v = e.target.value;
    setInput(v);
    const caret = e.target.selectionStart;
    const upto = v.slice(0, caret);
    const at = upto.lastIndexOf('@');
    if (at !== -1 && (at === 0 || /\s/.test(upto[at - 1]))) {
      const q = upto.slice(at + 1);
      if (q.length <= 30 && !q.includes('\n')) {
        setMentionQuery({ at, q });
        return;
      }
    }
    setMentionQuery(null);
  };

  const mentionOptions = useMemo(() => {
    if (!boot || mentionQuery === null) return [];
    const q = mentionQuery.q.toLowerCase();
    const secs = boot.sectors
      .filter((s) => s.name.toLowerCase().includes(q))
      .map((s) => ({ type: 'sector', id: s.id, name: s.name, label: s.name + ' (setor)' }));
    const usrs = boot.users
      .filter((u) => u.id !== boot.me.id && u.name.toLowerCase().includes(q))
      .map((u) => ({ type: 'user', id: u.id, name: u.name, label: u.name }));
    return [...secs, ...usrs].slice(0, 8);
  }, [boot, mentionQuery]);

  const pickMention = (opt) => {
    const { at, q } = mentionQuery;
    const before = input.slice(0, at);
    const after = input.slice(at + 1 + q.length);
    setInput(before + '@' + opt.name + ' ' + after);
    setMentionQuery(null);
  };

  // Busca de obras (autocomplete de "Nova conversa de obra")
  useEffect(() => {
    if (obraSearch === null) return;
    let stale = false;
    api.buscarObras(obraSearch).then((r) => !stale && setObraResults(r)).catch(() => {});
    return () => { stale = true; };
  }, [obraSearch, api]);

  const abrirObra = async (obra) => {
    setObraSearch(null);
    try {
      const t = await api.abrirObra(obra.id);
      setBoot((b) => {
        if (!b || b.obras_visiveis.some((o) => o.thread_id === t.thread_id)) return b;
        return { ...b, obras_visiveis: [...b.obras_visiveis, { ...t, unread: 0, mentions: 0 }] };
      });
      openConv('obra', t.thread_id);
    } catch (e) {
      alert(e.message);
    }
  };

  const abrirDm = async (user) => {
    setDmPicker(false);
    try {
      const dm = await api.criarDm(user.id);
      setBoot((b) => {
        if (!b || b.dms.some((d) => d.id === dm.id)) return b;
        return { ...b, dms: [...b.dms, { ...dm, other_user_id: user.id, unread: 0, mentions: 0 }] };
      });
      socketRef.current.emit('dm:join', dm.id);
      openConv('dm', dm.id);
    } catch (e) {
      alert(e.message);
    }
  };

  if (!boot) return <div className="pk-loading">Carregando…</div>;

  const me = boot.me;
  const activeObra = active?.type === 'obra' ? boot.obras_visiveis.find((o) => o.thread_id === active.id) : null;
  const activeChannel = active?.type === 'channel' ? boot.channels.find((c) => c.id === active.id) : null;
  const activeDm = active?.type === 'dm' ? boot.dms.find((d) => d.id === active.id) : null;

  const title =
    activeObra ? `${activeObra.nome} — ${activeObra.cliente}`
    : activeChannel ? '#' + activeChannel.name
    : activeDm ? (usersById.get(activeDm.other_user_id)?.name || 'Conversa')
    : 'Selecione uma conversa';

  const Badge = ({ conv }) =>
    conv.unread > 0 ? (
      <span className={'pk-badge ' + (conv.mentions > 0 ? 'pk-badge-mention' : '')} data-testid="conv-badge">
        {conv.unread}
      </span>
    ) : null;

  // Agrupa mensagens por dia
  const grouped = [];
  let lastDay = '';
  for (const m of messages) {
    const day = dayLabel(m.created_at);
    if (day !== lastDay) {
      grouped.push({ separator: day, key: 'sep-' + day + m.id });
      lastDay = day;
    }
    grouped.push({ msg: m, key: 'm-' + m.id });
  }

  // No celular o nome da obra estoura o campo — placeholder curto.
  const mobilePh = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 720px)').matches;
  const composerPlaceholder =
    mobilePh ? 'Mensagem…'
    : activeChannel ? `Mensagem em #${activeChannel.name}`
    : activeDm ? `Mensagem para ${usersById.get(activeDm.other_user_id)?.name || 'usuário'}`
    : activeObra ? `Mensagem na obra ${activeObra.nome}`
    : 'Escreva uma mensagem…';

  const subtitle =
    activeChannel ? (activeChannel.sector_id
      ? `Canal do setor ${sectorsById.get(activeChannel.sector_id)?.name || ''}`
      : 'Canal aberto a todos os setores')
    : activeDm ? (sectorsById.get(usersById.get(activeDm.other_user_id)?.sector_id)?.name || '') +
      (online.has(activeDm.other_user_id) ? ' · online' : '')
    : null;

  return (
    <div className={'pk-panel' + (active ? ' pk-has-active' : '')} data-testid="chat-panel">
      <div className="pk-sidebar">
        <div className="pk-brand">
          <span className="pk-brand-dot" />
          Chat Parket
        </div>

        <div className="pk-sidebar-search">
          <input
            data-testid="sidebar-search"
            placeholder="Buscar obra, canal, pessoa…"
            value={sidebarQuery}
            onChange={(e) => setSidebarQuery(e.target.value)}
          />
          {sidebarQuery && (
            <button className="pk-sidebar-search-clear" title="Limpar" onClick={() => setSidebarQuery('')}>✕</button>
          )}
        </div>

        <div className="pk-sidebar-scroll">
        <div className="pk-section">
          <div className="pk-section-title">
            <span>Obras</span>
            <button className="pk-add" title="Buscar obra para conversar" data-testid="nova-obra" onClick={() => setObraSearch((s) => (s === null ? '' : null))}>+</button>
          </div>
          {obraSearch !== null && (
            <div className="pk-obra-search">
              <input
                autoFocus
                data-testid="obra-search-input"
                placeholder="Buscar obra ou cliente…"
                value={obraSearch}
                onChange={(e) => setObraSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setObraSearch(null)}
              />
              {obraSearch !== '' && (
                <div className="pk-obra-results">
                  {obraResults.map((o) => (
                    <div key={o.id} className="pk-obra-result" data-testid="obra-result" onClick={() => abrirObra(o)}>
                      <div className="pk-obra-nome">{o.nome}</div>
                      <div className="pk-obra-cliente">{o.cliente}</div>
                    </div>
                  ))}
                  {!obraResults.length && <div className="pk-obra-empty">Nenhuma obra encontrada</div>}
                </div>
              )}
            </div>
          )}
          {boot.obras_visiveis
            .filter((o) => !sidebarQuery || (o.nome || '').toLowerCase().includes(sidebarQuery.toLowerCase()) || (o.cliente || '').toLowerCase().includes(sidebarQuery.toLowerCase()))
            .map((o) => (
            <div
              key={o.thread_id}
              data-testid={'obra-item-' + o.obra_id}
              className={'pk-item ' + (active?.type === 'obra' && active.id === o.thread_id ? 'pk-active' : '')}
              onClick={() => openConv('obra', o.thread_id)}
            >
              <span className="pk-item-icon">🏗</span>
              <span className="pk-item-name">{o.nome}</span>
              <Badge conv={o} />
            </div>
          ))}
          {/* Sugestões (obras do fiscal com pendência) só aparecem ao tocar no + —
              lista enxuta por padrão, igual ao padrão da seção Pessoas (Will 20/07). */}
          {obraSearch === '' && (boot.obras_sugeridas || [])
            .filter((s) => !boot.obras_visiveis.some((o) => String(o.obra_id) === String(s.id)))
            .map((o) => (
              <div key={'sug-' + o.id} className="pk-item pk-sug" data-testid={'obra-sug-' + o.id} onClick={() => abrirObra(o)}>
                <span className="pk-item-icon">🏗</span>
                <span className="pk-item-name">
                  {o.nome}
                  <span className="pk-sug-meta">
                    {[
                      o.fiscal || null,
                      o.cliente || null,
                      o.proxima
                        ? 'próx. visita ' + new Date(o.proxima).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                        : o.pendentes
                          ? o.pendentes + (o.pendentes > 1 ? ' laudos pendentes' : ' laudo pendente')
                          : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </div>
            ))}
          {!boot.obras_visiveis.length && obraSearch === null && (
            <div className="pk-empty">Toque no + para ver as obras</div>
          )}
        </div>

        <div className="pk-section">
          <div className="pk-section-title"><span>Canais</span></div>
          {boot.channels
            .filter((c) => !sidebarQuery || (c.name || '').toLowerCase().includes(sidebarQuery.toLowerCase()))
            .map((c) => (
            <div
              key={c.id}
              data-testid={'channel-item-' + c.name}
              className={'pk-item ' + (active?.type === 'channel' && active.id === c.id ? 'pk-active' : '')}
              onClick={() => openConv('channel', c.id)}
            >
              <span className="pk-item-icon">#</span>
              <span className="pk-item-name">{c.name}</span>
              <Badge conv={c} />
            </div>
          ))}
        </div>

        <div className="pk-section">
          <div className="pk-section-title"><span>Pessoas</span></div>
          {/* Todos os usuários agrupados por setor, alfabético dentro. Bolinha
              verde=online, cinza=offline. Clicar inicia/abre DM (Will 24/07). */}
          {(() => {
            const dmByUser = new Map(boot.dms.map((d) => [d.other_user_id, d]));
            const q = sidebarQuery.trim().toLowerCase();
            const usersBySector = new Map();
            for (const u of boot.users) {
              if (u.id === me.id) continue;
              if (q) {
                const secName = (sectorsById.get(u.sector_id)?.name || '').toLowerCase();
                if (!(u.name || '').toLowerCase().includes(q) && !secName.includes(q)) continue;
              }
              const sid = u.sector_id || 'sem';
              if (!usersBySector.has(sid)) usersBySector.set(sid, []);
              usersBySector.get(sid).push(u);
            }
            const sectorOrder = [...usersBySector.keys()].sort((a, b) => {
              const na = sectorsById.get(a)?.name || 'Z';
              const nb = sectorsById.get(b)?.name || 'Z';
              return na.localeCompare(nb);
            });
            return sectorOrder.map((sid) => {
              const users = usersBySector.get(sid).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
              const sectorName = sectorsById.get(sid)?.name || 'Outros';
              return (
                <div key={sid} className="pk-people-group">
                  <div className="pk-people-group-title">{sectorName}</div>
                  {users.map((u) => {
                    const dm = dmByUser.get(u.id);
                    const isActive = dm && active?.type === 'dm' && active.id === dm.id;
                    const isOn = online.has(u.id);
                    return (
                      <div
                        key={u.id}
                        data-testid={'dm-item-' + u.id}
                        className={'pk-item ' + (isActive ? 'pk-active' : '')}
                        onClick={() => (dm ? openConv('dm', dm.id) : abrirDm(u))}
                      >
                        <span className="pk-mini-avatar" style={{ background: colorFor(u.name || '?') }}>
                          {initials(u.name)}
                          <span className={'pk-presence ' + (isOn ? 'pk-on' : '')} data-testid={'presence-' + u.id} />
                        </span>
                        <span className="pk-item-name">{u.name}</span>
                        {dm && <Badge conv={dm} />}
                      </div>
                    );
                  })}
                </div>
              );
            });
          })()}
        </div>
        </div>

        <div className="pk-me">
          <div className="pk-avatar" style={{ background: colorFor(me.name) }}>{initials(me.name)}</div>
          <div className="pk-me-info">
            <div className="pk-me-name">{me.name}</div>
          </div>
          {!alwaysOpen && <button className="pk-logout" onClick={onLogout} title="Sair">Sair</button>}
        </div>
      </div>

      <div className="pk-main">
        <div className="pk-main-header">
          <button className="pk-back" data-testid="chat-back" title="Voltar às conversas" onClick={() => setActive(null)}>←</button>
          <div className="pk-main-title" data-testid="conv-title">{title}</div>
          {subtitle && <div className="pk-members">{subtitle}</div>}
          {activeObra && (
            <div className="pk-members pk-member-chips" data-testid="obra-members">
              {activeObra.members.map((m, i) => (
                <span key={i} className="pk-chip">
                  {m.type === 'sector' ? '⬢ ' + (sectorsById.get(m.id)?.name || 'Setor') : usersById.get(m.id)?.name || 'Pessoa'}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="pk-messages" ref={listRef} data-testid="messages">
          {!active && (
            <div className="pk-blank">
              <div className="pk-blank-icon">💬</div>
              <div className="pk-blank-title">Nenhuma conversa aberta</div>
              <div className="pk-blank-sub">Escolha uma obra, canal ou pessoa na barra lateral para conversar.</div>
            </div>
          )}
          {grouped.map((g) =>
            g.separator ? (
              <div key={g.key} className="pk-day"><span>{g.separator}</span></div>
            ) : g.msg.system ? (
              <div key={g.key} className="pk-hint">{g.msg.content}</div>
            ) : (
              <div key={g.key} className="pk-msg" data-testid="message">
                <div className="pk-avatar" style={{ background: colorFor(usersById.get(g.msg.sender_id)?.name || '?') }}>
                  {initials(usersById.get(g.msg.sender_id)?.name)}
                </div>
                <div className="pk-msg-body">
                  <div className="pk-msg-meta">
                    <span className="pk-msg-author">{usersById.get(g.msg.sender_id)?.name || 'Usuário'}</span>
                    <span className="pk-msg-time">{timeLabel(g.msg.created_at)}</span>
                  </div>
                  <MessageContent msg={g.msg} mentionNames={mentionNames} base={base} />
                </div>
              </div>
            )
          )}
        </div>

        {active && (
          <div className="pk-composer">
            {mentionQuery !== null && mentionOptions.length > 0 && (
              <div className="pk-mention-menu" data-testid="mention-menu">
                {mentionOptions.map((o) => (
                  <div key={o.type + o.id} className="pk-mention-opt" data-testid={'mention-opt-' + o.type + '-' + o.id} onMouseDown={(e) => { e.preventDefault(); pickMention(o); }}>
                    {o.type === 'sector' ? '⬢ ' : ''}{o.label}
                  </div>
                ))}
              </div>
            )}
            {pendingFile && (
              <div className="pk-pending-file">
                📎 {pendingFile.name}
                <button onClick={() => setPendingFile(null)}>✕</button>
              </div>
            )}
            <div className="pk-composer-row">
              <button className="pk-attach" title="Anexar arquivo" onClick={() => fileRef.current?.click()}>📎</button>
              <input type="file" ref={fileRef} style={{ display: 'none' }} data-testid="file-input"
                onChange={(e) => { if (e.target.files[0]) setPendingFile(e.target.files[0]); e.target.value = ''; }} />
              <textarea
                data-testid="message-input"
                placeholder={composerPlaceholder}
                value={input}
                maxLength={4000}
                onChange={onInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) {
                    e.preventDefault();
                    send();
                  }
                  if (e.key === 'Enter' && mentionQuery !== null && mentionOptions.length) {
                    e.preventDefault();
                    pickMention(mentionOptions[0]);
                  }
                  if (e.key === 'Escape') setMentionQuery(null);
                }}
              />
              <button className="pk-send" data-testid="send-button" title="Enviar (Enter)" onClick={send}>➤</button>
            </div>
            <div className="pk-composer-hint">@ marca pessoa ou setor · Enter envia · Shift+Enter quebra linha</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget (botão flutuante + painel) e contador global de não-lidas
// ---------------------------------------------------------------------------

function Widget({ base, initialToken, mode, devLogin }) {
  // Ordem de resolução do token: explícito (data-token/init) > SSO Supabase da
  // plataforma > login de teste (sessionStorage). Relido a cada uso (refresh).
  const explicitRef = useRef(initialToken || null);
  const resolveToken = useCallback(
    () => explicitRef.current || readSupabaseToken() || sessionStorage.getItem('pk-chat-token'),
    []
  );
  const [authTick, setAuthTick] = useState(0);
  const token = resolveToken();
  const sso = !!(explicitRef.current || readSupabaseToken());
  const [open, setOpen] = useState(mode === 'iframe');
  const [totals, setTotals] = useState({ unread: 0, mentions: 0 });
  const api = useMemo(() => (token ? makeApi(base, resolveToken) : null), [base, !!token, authTick, resolveToken]);

  // Badge global mesmo com painel fechado: socket dedicado leve quando fechado
  // (simplificação: o painel fica montado sempre que há token; só é ocultado).
  const onTotals = useCallback(
    (t) => setTotals((prev) => (prev.unread === t.unread && prev.mentions === t.mentions ? prev : t)),
    []
  );

  const logout = useCallback(() => {
    sessionStorage.removeItem('pk-chat-token');
    setAuthTick((t) => t + 1);
  }, []);
  const login = useCallback((t) => {
    sessionStorage.setItem('pk-chat-token', t);
    setAuthTick((t2) => t2 + 1);
  }, []);

  // Sem sessão da plataforma ainda? Fica aguardando o SSO aparecer (ex.: a
  // plataforma termina o login depois do widget carregar). Nunca pede senha.
  useEffect(() => {
    if (token || devLogin) return;
    const iv = setInterval(() => { if (resolveToken()) setAuthTick((t) => t + 1); }, 2000);
    return () => clearInterval(iv);
  }, [token, devLogin, resolveToken]);

  const body = !token ? (
    devLogin ? <LoginView base={base} onLogin={login} /> : null
  ) : (
    <TotalsWatcher onTotals={onTotals}>
      <ChatPanel
        key={'auth-' + authTick}
        base={base}
        api={api}
        getToken={resolveToken}
        sso={sso}
        onLogout={logout}
        alwaysOpen={mode === 'iframe' || sso}
      />
    </TotalsWatcher>
  );

  // MOBILE: plataformas não-responsivas (ex.: Valoria) estouram o layout
  // viewport (~1180px) — right/bottom fixos jogavam o FAB pra fora da tela do
  // celular e o painel se perdia ao arrastar. Pregamos FAB e painel na
  // viewport VISUAL (o que o olho vê) via visualViewport; de quebra o painel
  // encolhe junto quando o teclado abre (composer sempre visível).
  const popRef = useRef(null);
  const fabRef = useRef(null);

  // DESKTOP: FAB fica no canto inferior-direito. Se algo abrir cobrindo essa
  // posição, desvia sozinho (só nesses 2 casos geométricos claros — sem
  // heurística "clicável" que catch-all catava divs errados):
  //   1. Painel grudado na direita (drawer/coluna Teca IA): FAB vai pra esquerda
  //   2. FAB/toast pequeno no canto: FAB sobe acima dele
  // Sem drag do usuário — fica no canto e desvia solo quando precisar.
  // Will 24/07: "quero que fique no canto, se abrir algo vai pro lado".
  useEffect(() => {
    if (mode === 'iframe') return;
    const fab = fabRef.current;
    if (!fab) return;
    const vw = () => (window.visualViewport?.width ?? window.innerWidth);
    const vh = () => (window.visualViewport?.height ?? window.innerHeight);
    const pop = () => popRef.current;
    // Limpa localStorage de tentativas draggable antigas (24/07 rollback)
    try { localStorage.removeItem('pk-fab-pos-v1'); } catch (e) {}
    fab.style.cursor = 'pointer';
    const compute = () => {
      // Tela de login/senha: esconde FAB (Will 24/07). Heurística: qualquer
      // input[type=password] visível na página = auth screen, não é hora de chat.
      const pwd = document.querySelector('input[type="password"]');
      if (pwd) {
        const r = pwd.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          fab.style.display = 'none';
          if (pop()) pop().style.display = 'none';
          return;
        }
      }
      fab.style.display = '';
      if (pop() && !pop().classList.contains('pk-open')) pop().style.display = '';
      // Antes fazia return em mobile — mas isso deixava FAB sobre bottom-nav
      // full-width (ex.: Instala HOJE/AGENDA/INICIAR/EQUIPE/RANKING).
      // Deixa o scan rodar sempre; o useEffect visualViewport usa --pk-fab-bottom.
      const base = 24;
      const W = vw(), H = vh();
      let right = base, bottom = base;
      const nodes = document.body.getElementsByTagName('*');
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        if (el === fab || fab.contains(el)) continue;
        if (pop() && (el === pop() || pop().contains(el))) continue;
        // Skip nosso container e descendentes (pk-root)
        if (el.classList && el.classList.contains('pk-root')) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
        // Filtro rápido antes de getBoundingClientRect (mais caro)
        if (el.offsetHeight < H * 0.5 && (cs.position !== 'fixed' || el.offsetWidth < 24 || el.offsetHeight < 24)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 24 || r.height < 24) continue;
        // Backdrop/root fullscreen — FAB fica atrás, ok
        if (r.width >= W - 4 && r.height >= H - 4) continue;
        // CASO 1: painel/coluna GRUDADO na borda direita, alto (Teca IA column,
        // drawer lateral). Aceita fixed OU grid/flex. Assinatura restrita:
        //   right ≤ 10px do viewport (colado mesmo)
        //   width entre 250 e 800 (nem estreito, nem quase-fullscreen)
        //   height ≥ 60% viewport
        // Left sidebar NÃO cai aqui (right ~= 208, longe de W-10).
        if (W - r.right <= 10 && r.width >= 250 && r.width <= 800 && r.height >= H * 0.6) {
          const need = W - r.left + 12;
          if (need > right && need < W * 0.6) right = need;
        }
        // CASO 2: elemento fixo colado no bottom (FAB pequeno canto inf-dir OU
        // bottom-nav/tabbar full-width tipo Instala). Sobe o FAB acima dele.
        else if (cs.position === 'fixed' && r.height < 200 && H - r.bottom < 60) {
          const need = H - r.top + 12;
          if (need > bottom && need < H * 0.4) bottom = need;
        }
      }
      const rightPx = right + 'px';
      const bottomPx = bottom + 'px';
      if (fab.style.getPropertyValue('--pk-fab-right') !== rightPx) fab.style.setProperty('--pk-fab-right', rightPx);
      if (fab.style.getPropertyValue('--pk-fab-bottom') !== bottomPx) fab.style.setProperty('--pk-fab-bottom', bottomPx);
      // Mobile: apply() só re-lê --pk-fab-bottom em vv/window resize. Sem isso,
      // FAB fica sobreposto ao elemento fixo detectado (ex.: Teca no expedicao).
      const vv2 = window.visualViewport;
      const popOpen = pop() && pop().classList.contains('pk-open');
      if (vv2 && vv2.width <= 720 && !popOpen) {
        const newTop = vv2.offsetTop + vv2.height - fab.offsetHeight - bottom + 'px';
        if (fab.style.top !== newTop) fab.style.top = newTop;
      }
    };
    compute();
    let t = null;
    const schedule = () => { if (t) return; t = setTimeout(() => { t = null; compute(); }, 150); };
    const obs = new MutationObserver(schedule);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    return () => {
      obs.disconnect();
      if (t) clearTimeout(t);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [mode, !!token]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || mode === 'iframe') return;
    const apply = () => {
      const fab = fabRef.current;
      const pop = popRef.current;
      const mobile = vv.width <= 720;
      if (fab) {
        if (!mobile) {
          fab.style.left = fab.style.top = fab.style.right = fab.style.bottom = '';
        } else {
          fab.style.right = fab.style.bottom = 'auto';
          if (open) {
            fab.style.left = vv.offsetLeft + vv.width - fab.offsetWidth - 10 + 'px';
            fab.style.top = vv.offsetTop + 10 + 'px';
          } else {
            const pad = parseFloat(getComputedStyle(fab).getPropertyValue('--pk-fab-bottom')) || 24;
            fab.style.left = vv.offsetLeft + vv.width - fab.offsetWidth - 16 + 'px';
            fab.style.top = vv.offsetTop + vv.height - fab.offsetHeight - pad + 'px';
          }
        }
      }
      if (pop) {
        if (mobile && open) {
          pop.style.left = vv.offsetLeft + 'px';
          pop.style.top = vv.offsetTop + 'px';
          pop.style.width = vv.width + 'px';
          pop.style.height = vv.height + 'px';
          pop.style.right = pop.style.bottom = 'auto';
        } else {
          pop.style.left = pop.style.top = pop.style.width = pop.style.height = pop.style.right = pop.style.bottom = '';
        }
      }
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
    };
  }, [open, !!token, mode]);

  // Chat aberto no celular = trava o scroll da página host (senão o usuário
  // arrasta a plataforma por baixo e "perde" o chat).
  useEffect(() => {
    if (!open || mode === 'iframe' || !window.visualViewport || window.visualViewport.width > 720) return;
    const de = document.documentElement;
    const prev = [de.style.overflow, document.body.style.overflow];
    de.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      de.style.overflow = prev[0];
      document.body.style.overflow = prev[1];
    };
  }, [open, mode]);

  if (mode === 'iframe') return <div className="pk-iframe-root">{body}</div>;
  if (!token && !devLogin) return null; // sem sessão: sem balão

  return (
    <>
      <div ref={popRef} className={'pk-popover ' + (open ? 'pk-open' : '')} data-testid="chat-popover">{body}</div>
      <button ref={fabRef} className="pk-fab" data-testid="chat-fab" onClick={() => setOpen((v) => !v)} title="Chat Parket">
        <span className="pk-fab-ico">{open ? '✕' : '💬'}</span>
        <span className="pk-fab-label">Chat</span>
        {!open && totals.unread > 0 && (
          <span className={'pk-fab-badge ' + (totals.mentions > 0 ? 'pk-badge-mention' : '')} data-testid="fab-badge">
            {totals.unread > 99 ? '99+' : totals.unread}
          </span>
        )}
      </button>
    </>
  );
}

/** Observa o estado do painel via contexto simples: recalcula totais lendo o boot do filho. */
function TotalsWatcher({ children, onTotals, base, token }) {
  // Os totais são derivados dos badges renderizados — abordagem simples e robusta:
  // um MutationObserver soma os badges do DOM do painel.
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const compute = () => {
      let unread = 0;
      let mentions = 0;
      ref.current.querySelectorAll('[data-testid="conv-badge"]').forEach((el) => {
        unread += Number(el.textContent) || 0;
        if (el.classList.contains('pk-badge-mention')) mentions += Number(el.textContent) || 0;
      });
      onTotals({ unread, mentions });
    };
    const obs = new MutationObserver(compute);
    obs.observe(ref.current, { childList: true, subtree: true, characterData: true });
    compute();
    return () => obs.disconnect();
  }, [onTotals]);
  return <div ref={ref} style={{ height: '100%' }}>{children}</div>;
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

/* Paleta Parket (mesma das plataformas): creme #F4F1EA, borda #D8D3C7,
   texto #050505, taupe #968473 / #60544D, fonte Inter. */
const CSS = `
.pk-root, .pk-root * { box-sizing: border-box;
  font-family: var(--pk-font, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif); }
/* BLINDAGEM: CSS global da plataforma hospedeira não pode vazar pro widget
   (ex.: verifica tem button{width:100%;padding:13px 18px;letter-spacing:.18em;
   text-transform:uppercase} que estourava o + e os botões). :where() mantém
   especificidade 0,0,1 — empata com o seletor global e vence por ordem, já que
   este <style> é appendado por último no head. As classes pk-* (0,1,0) seguem
   mandando no visual do widget. */
:where(.pk-root) button, :where(.pk-root) input, :where(.pk-root) textarea, :where(.pk-root) select {
  all: revert;
  box-sizing: border-box;
  font-family: var(--pk-font, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  letter-spacing: normal;
  text-transform: none;
}
.pk-popover, .pk-iframe-root, .pk-fab { letter-spacing: normal; }
/* TEMA: as cores/fonte seguem a PLATAFORMA hospedeira (Will 16/07) — applyHostTheme
   lê o computed style da página e preenche as vars --pk-*. Os defaults abaixo são
   a paleta Parket creme (usada nos testes/mock e como fallback). */
.pk-fab { position: fixed; right: var(--pk-fab-right, 24px); bottom: var(--pk-fab-bottom, 24px); height: 44px; width: auto; padding: 0 18px; border-radius: 10px; justify-content: center;
  background: var(--pk-strong, #050505); color: var(--pk-inv, #f4f1ea); border: 1px solid var(--pk-border, #d8d3c7);
  cursor: pointer; z-index: 999999;
  display: inline-flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 600;
  letter-spacing: 0.14em; text-transform: uppercase;
  font-family: var(--pk-font, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  box-shadow: 0 4px 16px rgba(5,5,5,.25); }
.pk-fab:hover { background: var(--pk-dim2, #60544d); }
.pk-fab-ico { font-size: 15px; line-height: 1; }
.pk-fab-badge { position: absolute; top: -4px; right: -4px; background: #b3261e; color: #fff; font-size: 11px;
  font-weight: 700; border-radius: 10px; padding: 2px 6px; min-width: 20px; }
.pk-fab-badge.pk-badge-mention { background: #a05c17; }
.pk-popover { position: fixed; right: var(--pk-fab-right, 24px); bottom: calc(var(--pk-fab-bottom, 24px) + 68px); width: min(840px, calc(100vw - 48px));
  height: min(620px, calc(100vh - 130px)); background: var(--pk-surface, #fff); border-radius: 14px; overflow: hidden;
  border: 1px solid var(--pk-border, #d8d3c7); box-shadow: 0 12px 48px rgba(5,5,5,.22); display: none; z-index: 999998; }
.pk-popover.pk-open { display: block; }
.pk-iframe-root { width: 100vw; height: 100vh; }
.pk-panel { display: flex; height: 100%; }
.pk-loading, .pk-hint { padding: 24px; color: var(--pk-dim, #8a8175); font-size: 14px; }
.pk-sidebar { width: 236px; background: var(--pk-side, #f4f1ea); color: var(--pk-dim2, #60544d); flex-shrink: 0;
  display: flex; flex-direction: column; border-right: 1px solid var(--pk-border, #d8d3c7); }
.pk-brand { padding: 14px 16px 10px; font-size: 13px; font-weight: 800; letter-spacing: .14em;
  text-transform: uppercase; color: var(--pk-text, #050505); display: flex; align-items: center; gap: 8px;
  border-bottom: 1px solid var(--pk-border-soft, #e3ded2); }
.pk-brand-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--pk-text, #050505); flex-shrink: 0; }
.pk-sidebar-scroll { flex: 1; overflow-y: auto; padding-bottom: 8px; }
.pk-sidebar-search { position: relative; padding: 8px 12px 4px; }
.pk-sidebar-search input { width: 100%; padding: 6px 26px 6px 10px; border: 1px solid var(--pk-border, #d8d3c7);
  border-radius: 6px; font-size: 12.5px; background: var(--pk-surface, #fff); color: var(--pk-text, #050505); outline: none; }
.pk-sidebar-search input:focus { border-color: var(--pk-dim, #968473); }
.pk-sidebar-search-clear { position: absolute; right: 16px; top: 50%; transform: translateY(-25%); background: none;
  border: none; color: var(--pk-dim, #968473); cursor: pointer; font-size: 11px; padding: 2px 4px; }
.pk-people-group { margin-top: 6px; }
.pk-people-group-title { padding: 4px 16px 2px; font-size: 10px; text-transform: uppercase; letter-spacing: .08em;
  color: var(--pk-dim, #968473); font-weight: 700; }
.pk-me { display: flex; gap: 8px; align-items: center; padding: 10px 12px; border-top: 1px solid var(--pk-border-soft, #e3ded2);
  background: var(--pk-hover, #efebe1); }
.pk-me-info { min-width: 0; flex: 1; }
.pk-me-name { color: var(--pk-text, #050505); font-weight: 700; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pk-me-sector { font-size: 11px; color: var(--pk-dim, #968473); }
.pk-section { padding: 10px 0 2px; }
.pk-section-title { padding: 4px 16px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .1em;
  display: flex; justify-content: space-between; align-items: center; color: var(--pk-dim, #968473); font-weight: 700; }
.pk-add { background: none; border: 1px solid var(--pk-border, #d8d3c7); color: var(--pk-dim2, #60544d); border-radius: 6px; cursor: pointer;
  width: 22px; height: 22px; line-height: 1; font-size: 14px; padding: 0;
  display: inline-flex; align-items: center; justify-content: center; }
.pk-add:hover { background: var(--pk-strong, #050505); color: var(--pk-inv, #f4f1ea); border-color: var(--pk-strong, #050505); }
.pk-item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; margin: 1px 8px; cursor: pointer;
  font-size: 13.5px; color: var(--pk-text, #050505); border-radius: 8px; }
.pk-item:hover { background: var(--pk-hover, #e8e3d7); }
.pk-item.pk-active { background: var(--pk-strong, #050505); color: var(--pk-inv, #f4f1ea); }
.pk-item.pk-active .pk-item-icon { opacity: .9; }
.pk-item-icon { opacity: .55; width: 16px; text-align: center; flex-shrink: 0; }
.pk-item-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pk-item.pk-sug { align-items: flex-start; }
.pk-item.pk-sug .pk-item-icon { margin-top: 2px; }
.pk-sug-meta { display: block; font-size: 10.5px; color: var(--pk-dim, #968473); font-weight: 400;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pk-item.pk-active .pk-sug-meta { color: var(--pk-inv, #f4f1ea); opacity: .7; }
.pk-empty { padding: 2px 16px 6px; font-size: 12px; color: var(--pk-dim, #968473); line-height: 1.4; }
.pk-badge { background: #b3261e; color: #fff; border-radius: 9px; font-size: 11px; font-weight: 700; padding: 1px 6px; }
.pk-badge.pk-badge-mention { background: #a05c17; }
.pk-mini-avatar { position: relative; width: 24px; height: 24px; border-radius: 7px; color: #f4f1ea;
  font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.pk-mini-avatar .pk-presence { position: absolute; right: -2px; bottom: -2px; }
.pk-presence { width: 9px; height: 9px; border-radius: 50%; background: var(--pk-faint, #c3beb4); border: 1.5px solid var(--pk-side, #f4f1ea); flex-shrink: 0; }
.pk-presence.pk-on { background: #2e8b57; }
.pk-logout { width: auto; background: none; border: 1px solid var(--pk-border, #d8d3c7); color: var(--pk-dim2, #60544d); font-size: 12px;
  border-radius: 6px; padding: 4px 8px; cursor: pointer; flex-shrink: 0; }
.pk-logout:hover { background: var(--pk-strong, #050505); color: var(--pk-inv, #f4f1ea); border-color: var(--pk-strong, #050505); }
.pk-obra-search { padding: 4px 8px; }
.pk-obra-search input { width: 100%; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--pk-border, #d8d3c7);
  background: var(--pk-surface, #fff); color: var(--pk-text, #050505); font-size: 13px; }
.pk-obra-results { background: var(--pk-surface, #fff); border: 1px solid var(--pk-border, #d8d3c7); margin: 4px 8px; border-radius: 8px;
  max-height: 180px; overflow-y: auto; }
.pk-obra-result { padding: 6px 8px; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 6px; }
.pk-obra-result:hover { background: var(--pk-strong, #050505); }
.pk-obra-result:hover .pk-obra-nome, .pk-obra-result:hover .pk-obra-cliente { color: var(--pk-inv, #f4f1ea); }
.pk-obra-nome { font-weight: 600; color: var(--pk-text, #050505); }
.pk-obra-cliente { font-size: 11px; color: var(--pk-dim, #968473); }
.pk-obra-empty { padding: 8px; font-size: 12px; color: var(--pk-dim, #968473); }
.pk-main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--pk-surface, #fff); }
.pk-main-header { padding: 12px 18px 10px; border-bottom: 1px solid var(--pk-border-soft, #e3ded2); background: var(--pk-soft, #fbfaf7); }
.pk-back { display: none; float: left; margin: -2px 10px 0 -6px; width: 32px; height: 32px; align-items: center; justify-content: center;
  background: none; border: 1px solid var(--pk-border, #d8d3c7); border-radius: 8px; color: var(--pk-text, #050505); font-size: 16px; cursor: pointer; }
.pk-main-title { font-weight: 800; font-size: 15px; color: var(--pk-text, #050505); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pk-members { font-size: 12px; color: var(--pk-dim, #968473); margin-top: 3px; }
.pk-member-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.pk-chip { background: var(--pk-side, #f4f1ea); border: 1px solid var(--pk-border, #d8d3c7); color: var(--pk-dim2, #60544d); border-radius: 999px;
  padding: 1px 8px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.pk-blank { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; gap: 6px; padding: 24px; }
.pk-blank-icon { font-size: 34px; opacity: .5; }
.pk-blank-title { font-weight: 700; font-size: 15px; color: var(--pk-text, #050505); }
.pk-blank-sub { font-size: 13px; color: var(--pk-dim, #968473); max-width: 300px; line-height: 1.45; }
.pk-messages { flex: 1; overflow-y: auto; padding: 8px 16px; }
.pk-day { display: flex; align-items: center; margin: 12px 0 6px; color: var(--pk-dim, #968473); font-size: 12px; }
.pk-day::before, .pk-day::after { content: ''; flex: 1; border-top: 1px solid var(--pk-hover, #eae5da); }
.pk-day span { padding: 0 10px; font-weight: 600; }
.pk-msg { display: flex; gap: 8px; padding: 4px 0; }
.pk-avatar { width: 32px; height: 32px; border-radius: 8px; color: #f4f1ea; font-size: 12px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.pk-msg-body { min-width: 0; }
.pk-msg-meta { display: flex; gap: 8px; align-items: baseline; }
.pk-msg-author { font-weight: 700; font-size: 14px; color: var(--pk-text, #050505); }
.pk-msg-time { font-size: 11px; color: var(--pk-dim, #968473); }
.pk-msg-content { font-size: 14px; color: var(--pk-text, #050505); white-space: pre-wrap; word-break: break-word; }
.pk-mention { background: var(--pk-hover, #eae5da); color: var(--pk-dim2, #60544d); border-radius: 4px; padding: 0 3px; font-weight: 600; }
.pk-msg-image { max-width: 280px; max-height: 200px; border-radius: 8px; display: block; margin-top: 4px; }
.pk-msg-file { display: inline-block; margin-top: 4px; color: var(--pk-dim2, #60544d); text-decoration: none; font-size: 13px;
  border: 1px solid var(--pk-border, #d8d3c7); border-radius: 6px; padding: 4px 8px; }
.pk-msg-file:hover { background: var(--pk-side, #f4f1ea); }
.pk-composer { border-top: 1px solid var(--pk-border-soft, #e3ded2); padding: 10px 14px 8px; position: relative; background: var(--pk-soft, #fbfaf7); }
.pk-composer-row { display: flex; gap: 8px; align-items: center; }
.pk-composer textarea { flex: 1; resize: none; height: 40px; padding: 10px 12px; border: 1px solid var(--pk-border, #d8d3c7);
  border-radius: 10px; font-size: 14px; font-family: inherit; color: var(--pk-text, #050505); background: var(--pk-surface, #fff); }
.pk-composer textarea::placeholder { color: var(--pk-faint, #aaa093); }
.pk-composer textarea:focus { outline: none; border-color: var(--pk-dim, #968473); }
.pk-composer-hint { font-size: 10.5px; color: var(--pk-faint, #b4aa9c); padding: 5px 2px 0; }
.pk-send { background: var(--pk-strong, #050505); color: var(--pk-inv, #f4f1ea); border: none; border-radius: 10px; width: 40px; height: 40px;
  font-size: 15px; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.pk-send:hover { background: var(--pk-dim2, #60544d); }
.pk-attach { background: none; border: 1px solid var(--pk-border, #d8d3c7); border-radius: 10px; width: 40px; height: 40px;
  cursor: pointer; flex-shrink: 0; font-size: 15px; color: var(--pk-text, #050505); }
.pk-attach:hover { background: var(--pk-side, #f4f1ea); }
.pk-pending-file { font-size: 12px; color: var(--pk-dim2, #60544d); padding-bottom: 4px; }
.pk-pending-file button { border: none; background: none; cursor: pointer; color: #b3261e; }
.pk-mention-menu { position: absolute; bottom: 100%; left: 12px; right: 12px; background: var(--pk-surface, #fff);
  border: 1px solid var(--pk-border, #d8d3c7); border-radius: 8px; box-shadow: 0 -4px 16px rgba(5,5,5,.12); max-height: 200px;
  overflow-y: auto; z-index: 10; }
.pk-mention-opt { padding: 7px 12px; font-size: 14px; cursor: pointer; color: var(--pk-text, #050505); }
.pk-mention-opt:hover { background: var(--pk-strong, #050505); color: var(--pk-inv, #f4f1ea); }
.pk-login { padding: 40px; max-width: 320px; margin: 0 auto; }
.pk-login-title { font-size: 22px; font-weight: 800; color: var(--pk-text, #050505); }
.pk-login-sub { font-size: 12px; color: var(--pk-dim, #968473); margin: 4px 0 16px; }
.pk-login input { display: block; width: 100%; margin-bottom: 8px; padding: 9px 10px; border: 1px solid var(--pk-border, #d8d3c7);
  border-radius: 6px; font-size: 14px; background: var(--pk-surface, #fff); color: var(--pk-text, #050505); }
.pk-login button { width: 100%; background: var(--pk-strong, #050505); color: var(--pk-inv, #f4f1ea); border: none; border-radius: 6px;
  padding: 10px; font-weight: 600; cursor: pointer; }
.pk-login-error { color: #b3261e; font-size: 13px; margin-bottom: 8px; }

/* MOBILE (Will 16/07): popover fullscreen + navegação em páginas —
   lista (sidebar) quando nada aberto, conversa (main) com botão Voltar. */
@media (max-width: 720px) {
  /* height duplicado de propósito: WebView/navegador antigo sem suporte a dvh
     descarta a segunda linha e fica com 100vh — sem isso o popover não abria
     fullscreen no APK. */
  .pk-popover.pk-open { left: 0; right: 0; top: 0; bottom: 0; width: 100vw; height: 100vh; height: 100dvh;
    border-radius: 0; border: none;
    padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
  .pk-sidebar { width: 100%; border-right: none; }
  .pk-main { display: none; }
  .pk-panel.pk-has-active .pk-sidebar { display: none; }
  .pk-panel.pk-has-active .pk-main { display: flex; }
  .pk-back { display: inline-flex; }
  /* com o chat fullscreen, o FAB vira um ✕ compacto no topo (senão cobre o composer) */
  .pk-popover.pk-open + .pk-fab { top: 10px; right: 10px; bottom: auto; width: 38px; height: 38px;
    padding: 0; border-radius: 50%; }
  .pk-popover.pk-open + .pk-fab .pk-fab-label { display: none; }
  .pk-brand { padding-right: 56px; }
  /* iOS dá zoom automático em input com fonte <16px — quebra o layout do chat */
  .pk-composer textarea, .pk-obra-search input, .pk-login input { font-size: 16px; }
  .pk-composer-hint { display: none; } /* dica de Enter não faz sentido no touch */
  .pk-composer textarea { height: 44px; }
  .pk-send, .pk-attach { width: 44px; height: 44px; }
  .pk-item { padding: 10px 16px; }
  .pk-msg-image { max-width: 100%; }
}
`;

// ---------------------------------------------------------------------------
// Tema da plataforma hospedeira — o widget se camufla no front onde está:
// lê cor de fundo, cor de texto e fonte computadas da página e deriva a
// paleta inteira (funciona com o dark/light da Valoria trocando em runtime).
// ---------------------------------------------------------------------------

function parseColor(s) {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/.exec(s || '');
  if (!m) return null;
  if (m[4] !== undefined && Number(m[4]) === 0) return null; // transparente
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}
const mixc = (a, b, t) => 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')';

function applyHostTheme(el) {
  try {
    const bodyCS = getComputedStyle(document.body);
    const bg =
      parseColor(bodyCS.backgroundColor) ||
      parseColor(getComputedStyle(document.documentElement).backgroundColor) || [244, 241, 234];
    const text = parseColor(bodyCS.color) || [5, 5, 5];
    const dark = (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) / 255 < 0.45;
    const WHITE = [255, 255, 255];
    const vars = {
      '--pk-font': bodyCS.fontFamily || '',
      '--pk-surface': dark ? mixc(bg, WHITE, 0.05) : mixc(bg, WHITE, 0.75),
      '--pk-side': dark ? mixc(bg, WHITE, 0.025) : 'rgb(' + bg.join(',') + ')',
      '--pk-soft': dark ? mixc(bg, WHITE, 0.04) : mixc(bg, WHITE, 0.55),
      '--pk-hover': mixc(bg, text, 0.1),
      '--pk-border': mixc(bg, text, 0.18),
      '--pk-border-soft': mixc(bg, text, 0.12),
      '--pk-text': 'rgb(' + text.join(',') + ')',
      '--pk-strong': 'rgb(' + text.join(',') + ')',
      '--pk-inv': 'rgb(' + bg.join(',') + ')',
      '--pk-dim': mixc(text, bg, 0.4),
      '--pk-dim2': mixc(text, bg, 0.25),
      '--pk-faint': mixc(text, bg, 0.55),
    };
    for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  } catch (e) {
    /* mantém os defaults do CSS (paleta Parket creme) */
  }
}

function watchHostTheme(el) {
  applyHostTheme(el);
  const rerun = () => applyHostTheme(el);
  const obs = new MutationObserver(rerun);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  if (document.body) obs.observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  window.addEventListener('load', rerun); // fontes/CSS da plataforma podem chegar depois
}

// ---------------------------------------------------------------------------
// Bootstrap do widget
// ---------------------------------------------------------------------------

function mount({ token, api: apiBase, container, mode, devLogin } = {}) {
  const base = (apiBase || (typeof document !== 'undefined' && document.currentScript?.src ? new URL(document.currentScript.src).origin : '') || window.location.origin).replace(/\/$/, '');
  let host = container ? (typeof container === 'string' ? document.querySelector(container) : container) : null;
  if (!host) {
    host = document.getElementById('parket-chat') || document.createElement('div');
    if (!host.parentNode) document.body.appendChild(host);
  }
  host.classList.add('pk-root');
  watchHostTheme(host);
  if (!document.getElementById('pk-chat-style')) {
    const style = document.createElement('style');
    style.id = 'pk-chat-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  createRoot(host).render(<Widget base={base} initialToken={token || null} mode={mode || 'widget'} devLogin={!!devLogin} />);
}

window.ParketChat = { init: mount };

// Auto-inicialização:
//  - <script src="app.js" data-parket-chat data-token="..." data-api="...">
//  - página widget.html (modo iframe): token vem do fragmento #token=...
const script = document.currentScript;
if (script && script.hasAttribute('data-parket-chat')) {
  const boot = () =>
    mount({
      token: script.getAttribute('data-token') || undefined,
      api: script.getAttribute('data-api') || undefined,
      devLogin: script.hasAttribute('data-dev-login'),
    });
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
} else if (window.__PARKET_CHAT_IFRAME__) {
  const params = new URLSearchParams(window.location.hash.slice(1));
  mount({ token: params.get('token') || undefined, mode: 'iframe' });
}
