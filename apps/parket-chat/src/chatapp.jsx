/**
 * Parket Chat — app full-page (chat.parket.works), estilo Slack.
 * Reusa o MESMO backend do widget (server/index.js): REST + Socket.io.
 * Bundle: esbuild src/chatapp.jsx → public/chat.js (carregado por public/index.html).
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';

const TOKEN_KEY = 'parket_chat_token';
const REFRESH_KEY = 'parket_chat_refresh';
// Mesma credencial das demais plataformas Parket (Space/Valoria): GoTrue do Cloud.
const GOTRUE_URL = 'https://hbxpilrxmitvzebluoom.supabase.co/auth/v1';
const GOTRUE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0';
const EMOJIS = ['👍', '✅', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '👀', '🎉', '💪'];
const THEME_KEY = 'parket_chat_theme';

// ---------------------------------------------------------------------------
// Ícones (SVG stroke, herdam currentColor — sem emoji na UI)
// ---------------------------------------------------------------------------

const Svg = ({ size = 16, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const IcoSearch = (p) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Svg>;
const IcoBell = (p) => <Svg {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></Svg>;
const IcoClip = (p) => <Svg {...p}><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></Svg>;
const IcoThread = (p) => <Svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Svg>;
const IcoSmile = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01" /><path d="M15 9h.01" /></Svg>;
const IcoReply = (p) => <Svg {...p}><polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" /></Svg>;

// Tags de status da obra — cor determinística por texto (paleta terrosa da identidade)
const TAG_PRESETS = ['EM ANDAMENTO', 'MEDIÇÃO', 'AGUARDANDO MATERIAL', 'ATRASADA', 'FINALIZANDO', 'CONCLUÍDA'];
const TAG_COLORS = ['#968473', '#7d8a6f', '#6f7d8a', '#a08154', '#8a6f7d', '#b0713f'];
const tagColor = (t) => {
  const s = String(t).toUpperCase();
  if (s.includes('ATRAS') || s.includes('PROBLEMA') || s.includes('PARADA')) return '#b05a4f';
  if (s.includes('CONCLU') || s.includes('FINALIZ') || s.includes('ENTREGUE')) return '#7d8a6f';
  return TAG_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % TAG_COLORS.length];
};
const TagChip = ({ tag, small, onRemove }) => (
  <span className={'ck-tag' + (small ? ' sm' : '')} style={{ borderColor: tagColor(tag), color: tagColor(tag) }}>
    {tag}
    {onRemove && <button title="Remover tag" onClick={onRemove}><IcoX size={11} /></button>}
  </span>
);
const IcoX = (p) => <Svg {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Svg>;
const IcoMenu = (p) => <Svg {...p}><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></Svg>;
const IcoPlus = (p) => <Svg {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>;
const IcoHome = (p) => <Svg {...p}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></Svg>;
const IcoSun = (p) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></Svg>;
const IcoMoon = (p) => <Svg {...p}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></Svg>;
const IcoVol = (p) => <Svg {...p}><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></Svg>;
const IcoVolX = (p) => <Svg {...p}><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="m22 9-6 6" /><path d="m16 9 6 6" /></Svg>;

// Som de mensagem nova ("knock") — gerado via WebAudio, sem asset.
let audioCtx = null;
let lastKnockAt = 0;
function playKnock() {
  if (localStorage.getItem('parket_chat_sound') === 'off') return;
  const now = Date.now();
  if (now - lastKnockAt < 1500) return;
  lastKnockAt = now;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    for (const [freq, dt] of [[660, 0], [880, 0.09]]) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + dt);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + dt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.18);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0 + dt);
      osc.stop(t0 + dt + 0.2);
    }
  } catch (e) {}
}
const IcoPencil = (p) => <Svg {...p}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></Svg>;
const IcoTrash = (p) => <Svg {...p}><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></Svg>;
const IcoMapPin = (p) => <Svg {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></Svg>;
const IcoPin = (p) =><Svg {...p}><path d="M12 17v5" /><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z" /></Svg>;
const IcoClock = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></Svg>;
const IcoCheckSq = (p) => <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m8.5 12 2.5 2.5 5-5.5" /></Svg>;
const IcoCamera = (p) => <Svg {...p}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" /><circle cx="12" cy="13" r="3" /></Svg>;
const IcoAt = (p) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" /></Svg>;
const IcoLink = (p) => <Svg {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></Svg>;
const IcoMic = (p) => <Svg {...p}><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><path d="M12 18v4" /></Svg>;
const IcoCheck = (p) => <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>;
const IcoSpark = (p) => <Svg {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" /></Svg>;
const IcoStar = ({ size = 16, on }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
  </svg>
);
const IcoInfo = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 16v-5" /><path d="M12 8h.01" /></Svg>;
const IcoChevL = (p) => <Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>;
const IcoFilm = (p) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16" /><path d="M17 4v16" /><path d="M3 9h4" /><path d="M3 15h4" /><path d="M17 9h4" /><path d="M17 15h4" /></Svg>;
const IcoDoc = (p) => <Svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></Svg>;
const IcoImage = (p) => <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-4.5-4.5L6 21" /></Svg>;

// ---------------------------------------------------------------------------
// URLs por conversa: /canal/<slug> · /dm/<slug-do-nome|id> · /obra/<thread_id>
// ---------------------------------------------------------------------------
const slugify = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function convPath(type, id, boot) {
  if (type === 'channel') {
    const ch = (boot?.channels || []).find((c) => c.id === id);
    return '/canal/' + (ch ? slugify(ch.name) : id);
  }
  if (type === 'dm') {
    const dm = (boot?.dms || []).find((d) => d.id === id);
    const u = dm && (boot?.users || []).find((x) => String(x.id) === String(dm.other_user_id));
    return '/dm/' + (u ? slugify(u.name) : id);
  }
  return '/obra/' + id;
}

function parseConvPath(pathname, boot) {
  const m = /^\/(canal|dm|obra)\/([^/]+)\/?$/.exec(pathname);
  if (!m) return null;
  const [, kind, refRaw] = m;
  const ref = decodeURIComponent(refRaw);
  if (kind === 'canal') {
    const ch = (boot?.channels || []).find((c) => slugify(c.name) === ref || String(c.id) === ref);
    return ch ? { type: 'channel', id: ch.id } : null;
  }
  if (kind === 'obra') {
    // Aceita thread_id (padrão da URL) ou card_id (obra.obra_id, usado por
    // links externos como o gestor de crises: /obra/<kanban_cards.id>).
    const list = boot?.obras_visiveis || [];
    const o = list.find((x) => String(x.thread_id) === ref)
      || list.find((x) => String(x.obra_id) === ref);
    return o ? { type: 'obra', id: o.thread_id } : null;
  }
  const dm = (boot?.dms || []).find((d) => String(d.id) === ref);
  if (dm) return { type: 'dm', id: dm.id };
  const u = (boot?.users || []).find((x) => slugify(x.name) === ref);
  if (u && String(u.id) !== String(boot?.me?.id)) {
    const d = (boot?.dms || []).find((x) => String(x.other_user_id) === String(u.id));
    // DM ainda não aberta: devolve o userId pra criar sob demanda
    return d ? { type: 'dm', id: d.id } : { type: 'dm', id: null, userId: u.id };
  }
  return null;
}

async function gotrueLogin(email, password) {
  const res = await fetch(GOTRUE_URL + '/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: GOTRUE_ANON },
    body: JSON.stringify({ email, password }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error_description || d.msg || 'credenciais inválidas');
  return d;
}

async function gotrueRefresh() {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) return null;
  try {
    const res = await fetch(GOTRUE_URL + '/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: GOTRUE_ANON },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.access_token) throw new Error('refresh inválido');
    localStorage.setItem(TOKEN_KEY, d.access_token);
    if (d.refresh_token) localStorage.setItem(REFRESH_KEY, d.refresh_token);
    return d.access_token;
  } catch (e) {
    localStorage.removeItem(REFRESH_KEY);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Utilitários (mesmos padrões do widget)
// ---------------------------------------------------------------------------

const AVATAR_COLORS = ['#60544d', '#968473', '#7a6c5d', '#4a5548', '#5d5464', '#8a6f4d', '#4f5d6b', '#6b4f4f', '#3f5147'];
const colorFor = (name) => AVATAR_COLORS[[...String(name)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
const initials = (name) =>
  String(name || '?').split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

// Avatar: foto do perfil quando existe, senão iniciais coloridas.
function Avatar({ user, name, className = 'ck-ava' }) {
  const nm = name || (user && user.name) || '?';
  if (user && user.avatar_url) {
    return <img className={className + ' ck-avaimg'} src={user.avatar_url} alt={nm} />;
  }
  return <span className={className} style={{ background: colorFor(nm) }}>{initials(nm)}</span>;
}

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
function tokenAlive(t) {
  const p = t && tokenPayload(t);
  return !!p && (!p.exp || p.exp * 1000 > Date.now() + 30000);
}

// SSO: aproveita sessão GoTrue gravada por outra plataforma no MESMO domínio.
// No chat.parket.works normalmente não há — o fallback é o login e-mail/senha.
function readSupabaseToken(badTokens) {
  const found = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k === TOKEN_KEY) continue;
      if (/\.\d+$/.test(k) && !k.endsWith('.0')) continue;
      let raw = localStorage.getItem(k);
      if (!raw) continue;
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
      } catch (e) { /* outro formato */ }
    }
  } catch (e) { /* sem localStorage */ }
  return found[0] || null;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

function makeApi(getToken, onAuthFail) {
  const call = async (path, opts = {}) => {
    const res = await fetch(path, {
      ...opts,
      headers: {
        ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        Authorization: 'Bearer ' + getToken(),
        ...(opts.headers || {}),
      },
    });
    if (res.status === 401 && onAuthFail) onAuthFail();
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
    thread: (msgId) => call('/api/thread/' + msgId),
    pins: (type, id) => call('/api/pins?' + type + '=' + id),
    search: (q) => call('/api/search?q=' + encodeURIComponent(q)),
    criarDm: (userId) => call('/api/dms', { method: 'POST', body: JSON.stringify({ userId }) }),
    marcarLido: (convType, convId, lastMsgId) =>
      call('/api/read', { method: 'POST', body: JSON.stringify({ convType, convId, lastMsgId }) }),
    upload: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return call('/api/upload', { method: 'POST', body: fd });
    },
    pushKey: () => call('/api/push/key'),
    pushSubscribe: (subscription) => call('/api/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription }) }),
    saveProfile: (display_name, avatar_url) =>
      call('/api/profile', { method: 'POST', body: JSON.stringify({ display_name, avatar_url }) }),
    scheduledList: () => call('/api/scheduled'),
    scheduleMessage: (payload) => call('/api/scheduled', { method: 'POST', body: JSON.stringify(payload) }),
    cancelScheduled: (id) => call('/api/scheduled/' + id, { method: 'DELETE' }),
    tarefas: (threadId) => call('/api/obra/' + threadId + '/tarefas'),
    criarTarefa: (threadId, body) => call('/api/obra/' + threadId + '/tarefas', { method: 'POST', body: JSON.stringify(body) }),
    toggleTarefa: (id) => call('/api/tarefas/' + id + '/toggle', { method: 'POST' }),
    delTarefa: (id) => call('/api/tarefas/' + id, { method: 'DELETE' }),
    teca: (convType, convId, question) =>
      call('/api/teca', { method: 'POST', body: JSON.stringify({ convType, convId, question }) }),
    saveToggle: (msgId) => call('/api/saved/' + msgId + '/toggle', { method: 'POST' }),
    savedList: () => call('/api/saved'),
    obraMedia: (threadId) => call('/api/obra/' + threadId + '/media'),
    obraDesc: (threadId, description) =>
      call('/api/obra/' + threadId + '/descricao', { method: 'POST', body: JSON.stringify({ description }) }),
    obraTags: (threadId, tags) =>
      call('/api/obra/' + threadId + '/tags', { method: 'POST', body: JSON.stringify({ tags }) }),
  };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

function LoginView({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const d = await gotrueLogin(email, password);
      onLogin(d.access_token, d.refresh_token);
    } catch (err) {
      // fallback: login local do chat (mock/testes)
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || err.message);
        onLogin((await res.json()).token);
      } catch (err2) {
        setError(err2.message || 'falha no login');
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="ck-login">
      <form className="ck-login-card" onSubmit={submit}>
        <div className="ck-login-title">PARKET</div>
        <div className="ck-login-sub">CHAT · CONVERSAS INTERNAS</div>
        <label>
          E-mail Parket
          <input type="email" value={email} autoFocus autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Senha
          <input type="password" value={password} autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="ck-login-error">{error}</div>}
        <button type="submit" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
        <div className="ck-login-note">SSO via Parket — use sua credencial do Space.</div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conteúdo da mensagem — menções, links e anexos
// ---------------------------------------------------------------------------

const URL_RE = /(https?:\/\/[^\s<>"')\]]+)/g;

// Aplica um regex (1 grupo de captura) só nos segmentos ainda 'text'.
function applyRe(segments, re, kind) {
  const out = [];
  for (const seg of segments) {
    if (seg.kind !== 'text') { out.push(seg); continue; }
    let last = 0;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(seg.text)) !== null) {
      if (m.index > last) out.push({ kind: 'text', text: seg.text.slice(last, m.index) });
      out.push({ kind, text: m[1] !== undefined ? m[1] : m[0] });
      last = m.index + m[0].length;
    }
    if (last < seg.text.length) out.push({ kind: 'text', text: seg.text.slice(last) });
  }
  return out;
}

// Formatação estilo Slack: `código`, links, @menções, *negrito*, _itálico_, ~riscado~.
function renderText(content, mentionNames) {
  if (!content) return [];
  let segments = [{ text: content, kind: 'text' }];
  segments = applyRe(segments, /`([^`\n]+)`/g, 'code');
  segments = applyRe(segments, URL_RE, 'link');

  const sorted = [...mentionNames].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    const token = '@' + name;
    const next = [];
    for (const seg of segments) {
      if (seg.kind !== 'text') { next.push(seg); continue; }
      let rest = seg.text;
      let idx;
      while ((idx = rest.toLowerCase().indexOf(token.toLowerCase())) !== -1) {
        if (idx > 0) next.push({ text: rest.slice(0, idx), kind: 'text' });
        next.push({ text: rest.slice(idx, idx + token.length), kind: 'mention' });
        rest = rest.slice(idx + token.length);
      }
      if (rest) next.push({ text: rest, kind: 'text' });
    }
    segments = next;
  }

  segments = applyRe(segments, /(?<![\w*])\*(\S(?:[^*\n]*\S)?)\*(?![\w*])/g, 'bold');
  segments = applyRe(segments, /(?<![\w_])_(\S(?:[^_\n]*\S)?)_(?![\w_])/g, 'italic');
  segments = applyRe(segments, /(?<![\w~])~(\S(?:[^~\n]*\S)?)~(?![\w~])/g, 'strike');
  return segments;
}

function InlineText({ text, mentionNames }) {
  const parts = useMemo(() => renderText(text || '', mentionNames), [text, mentionNames]);
  return parts.map((p, i) =>
    p.kind === 'mention' ? <span key={i} className="ck-mention">{p.text}</span>
    : p.kind === 'link' ? <a key={i} href={p.text} target="_blank" rel="noreferrer">{p.text}</a>
    : p.kind === 'code' ? <code key={i}>{p.text}</code>
    : p.kind === 'bold' ? <b key={i}>{p.text}</b>
    : p.kind === 'italic' ? <i key={i}>{p.text}</i>
    : p.kind === 'strike' ? <del key={i}>{p.text}</del>
    : <span key={i}>{p.text}</span>
  );
}

const fmtAudioSecs = (s) => {
  s = Math.max(0, Math.round(s || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

function AudioPlayer({ src }) {
  const audRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [dur, setDur] = useState(0);
  const [pos, setPos] = useState(0);
  const onMeta = (e) => {
    const a = e.target;
    // webm do MediaRecorder chega sem duração (Infinity) — força o cálculo via seek
    if (a.duration === Infinity) {
      const fix = () => {
        a.removeEventListener('timeupdate', fix);
        if (isFinite(a.duration)) setDur(a.duration);
        a.currentTime = 0;
      };
      a.addEventListener('timeupdate', fix);
      a.currentTime = 1e7;
    } else if (isFinite(a.duration)) setDur(a.duration);
  };
  const toggle = () => {
    const a = audRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };
  const seek = (e) => {
    const a = audRef.current;
    if (!a || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) * dur;
  };
  return (
    <div className="ck-audio">
      <audio
        ref={audRef} src={src} preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => setPos(0)}
        onLoadedMetadata={onMeta} onDurationChange={onMeta}
        onTimeUpdate={(e) => setPos(e.target.currentTime)}
      />
      <button className="ck-audio-btn" title={playing ? 'Pausar' : 'Reproduzir'} onClick={toggle}>
        {playing
          ? <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="5" height="16" /><rect x="14" y="4" width="5" height="16" /></svg>
          : <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l14 8-14 8z" /></svg>}
      </button>
      <div className="ck-audio-track" onClick={seek}>
        <div className="ck-audio-fill" style={{ width: (dur ? Math.min(pos / dur, 1) * 100 : 0) + '%' }} />
      </div>
      <span className="ck-audio-time">{fmtAudioSecs(playing || pos > 0 ? pos : dur)}</span>
    </div>
  );
}

function MessageContent({ msg, mentionNames }) {
  // ```blocos``` separados antes da formatação inline
  const blocks = useMemo(() => {
    const parts = String(msg.content || '').split('```');
    return parts.map((p, i) => ({
      kind: i % 2 === 1 ? 'pre' : 'txt',
      text: i % 2 === 1 ? p.replace(/^\n/, '').replace(/\n$/, '') : p,
    })).filter((b) => b.text !== '');
  }, [msg.content]);
  const isImage = msg.file_type && msg.file_type.startsWith('image/');
  const isAudio = msg.file_type && msg.file_type.startsWith('audio/');
  if (msg.deleted) return <div className="ck-msg-text ck-deleted">Mensagem excluída</div>;
  return (
    <div className="ck-msg-text">
      {blocks.map((b, i) =>
        b.kind === 'pre'
          ? <pre key={i} className="ck-pre">{b.text}</pre>
          : <InlineText key={i} text={b.text} mentionNames={mentionNames} />
      )}
      {msg.edited_at && <span className="ck-edited">(editado)</span>}
      {msg.file_path && isImage && (
        <a href={msg.file_path} target="_blank" rel="noreferrer">
          <img className="ck-msg-img" src={msg.file_path} alt={msg.file_name || 'imagem'} />
        </a>
      )}
      {msg.file_path && isAudio && <AudioPlayer src={msg.file_path} />}
      {msg.file_path && !isImage && !isAudio && (
        <a className="ck-msg-file" href={msg.file_path} target="_blank" rel="noreferrer" download={msg.file_name || true}>
          <IcoClip size={14} /> {msg.file_name || 'arquivo'}
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mensagem (usada no painel principal e na thread)
// ---------------------------------------------------------------------------

const PIN_DURATIONS = [
  { label: '24 horas', hours: 24 },
  { label: '7 dias', hours: 168 },
  { label: '30 dias', hours: 720 },
  { label: 'Pra sempre', hours: 0 },
];

// ---------------------------------------------------------------------------
// @menção: autocomplete compartilhado pelo Composer e pela edição de mensagem
// ---------------------------------------------------------------------------

/** Lista de quem pode ser marcado: setores primeiro, depois as pessoas. */
function mentionTargetsFrom(boot) {
  if (!boot) return [];
  const secName = new Map((boot.sectors || []).map((s) => [String(s.id), s.name]));
  return [
    ...(boot.sectors || []).map((s) => ({ key: 's' + s.id, name: s.name, sub: 'Setor · notifica todo o setor' })),
    ...(boot.users || []).map((u) => ({
      key: 'u' + u.id, name: u.name,
      sub: secName.get(String(u.sector_id)) || u.email,
      avatar_url: u.avatar_url,
    })),
  ];
}

/** Controla o autocomplete de @menção de um textarea qualquer.
 *  Quem usa passa o valor e o setter do texto, mais o ref do textarea.
 *  onKey devolve true quando a tecla foi consumida pela lista (setas, Enter,
 *  Tab, Esc), pra quem chama não enviar nem salvar a mensagem nesse caso. */
function useMention(targets, value, setValue, taRef) {
  const [mention, setMention] = useState(null); // { query, sel, at }

  const candidates = useMemo(() => {
    if (mention === null) return [];
    const q = mention.query.toLowerCase();
    return (targets || []).filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [mention, targets]);

  // Tem "@algo" logo antes do cursor? Abre a lista filtrando por esse "algo".
  const detect = (val, caret) => {
    const upto = val.slice(0, caret);
    const at = upto.lastIndexOf('@');
    if (at === -1) return setMention(null);
    const q = upto.slice(at + 1);
    if (/[\n]/.test(q) || q.length > 30) return setMention(null);
    setMention({ query: q, sel: 0, at });
  };

  // Troca o "@parcial" pelo nome inteiro e joga o cursor pro fim da menção.
  const insert = (c) => {
    const el = taRef.current;
    const caret = el ? el.selectionStart : value.length;
    const upto = value.slice(0, caret);
    const at = upto.lastIndexOf('@');
    if (at === -1) return setMention(null);
    setValue(value.slice(0, at) + '@' + c.name + ' ' + value.slice(caret));
    setMention(null);
    requestAnimationFrame(() => {
      if (el) { el.focus(); el.selectionStart = el.selectionEnd = at + c.name.length + 2; }
    });
  };

  const onKey = (e) => {
    if (!mention || !candidates.length) return false;
    if (e.key === 'ArrowDown') { e.preventDefault(); setMention((m) => ({ ...m, sel: (m.sel + 1) % candidates.length })); return true; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setMention((m) => ({ ...m, sel: (m.sel - 1 + candidates.length) % candidates.length })); return true; }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insert(candidates[mention.sel]); return true; }
    if (e.key === 'Escape') { setMention(null); return true; }
    return false;
  };

  // Botão "@": insere o arroba no cursor e já abre a lista.
  const atClick = () => {
    const el = taRef.current;
    const caret = el ? el.selectionStart : value.length;
    const needSpace = caret > 0 && !/\s/.test(value[caret - 1]);
    const next = value.slice(0, caret) + (needSpace ? ' @' : '@') + value.slice(caret);
    const newCaret = caret + (needSpace ? 2 : 1);
    setValue(next);
    detect(next, newCaret);
    requestAnimationFrame(() => {
      if (el) { el.focus(); el.selectionStart = el.selectionEnd = newCaret; }
    });
  };

  return { mention, candidates, detect, insert, onKey, atClick, close: () => setMention(null) };
}

/** Lista flutuante de menção: mesma marcação no composer e na edição. */
function MentionPop({ mention, candidates, onPick, className }) {
  if (!mention || !candidates.length) return null;
  return (
    <div className={'ck-mentionpop' + (className ? ' ' + className : '')}>
      {candidates.map((c, i) => (
        <button
          key={c.key}
          className={i === mention.sel ? 'sel' : ''}
          onMouseDown={(e) => { e.preventDefault(); onPick(c); }}
        >
          <Avatar user={c} name={c.name} />
          <span>{c.name}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-dim)' }}>{c.sub}</span>
        </button>
      ))}
    </div>
  );
}

function Message({ msg, prev, me, usersById, mentionNames, mentionTargets, onReact, onOpenThread, onEdit, onDelete, onPin, onSave, savedIds, onTask, onCopyLink, onReply, onQuote, inThread }) {
  const [picker, setPicker] = useState(false);
  const [pinPick, setPinPick] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const editRef = useRef(null);
  // @menção também na edição: mesma lista e mesmas teclas do composer (Will 03/09)
  const mem = useMention(mentionTargets, draft, setDraft, editRef);
  const saved = savedIds ? savedIds.has(msg.id) : false;
  const sender = usersById.get(msg.sender_id);
  const name = sender ? sender.name : 'Usuário';
  const mine = String(msg.sender_id) === String(me.id);
  const cont =
    prev &&
    prev.sender_id === msg.sender_id &&
    new Date(msg.created_at) - new Date(prev.created_at) < 5 * 60 * 1000 &&
    dayLabel(prev.created_at) === dayLabel(msg.created_at);
  const reactions = msg.reactions || {};
  const reactionKeys = Object.keys(reactions);

  const startEdit = () => { setDraft(msg.content || ''); setEditing(true); setPicker(false); };
  const saveEdit = () => {
    const t = draft.trim();
    setEditing(false);
    mem.close();
    if (t && t !== msg.content) onEdit(msg, t);
  };

  return (
    <div className={'ck-msg' + (cont ? ' cont' : '')} id={!inThread ? 'm' + msg.id : undefined}>
      {cont ? <div className="ck-ava2" /> : <Avatar user={sender} name={name} className="ck-ava2" />}
      <div className="ck-msg-body">
        {!cont && (
          <div className="ck-msg-top">
            <span className="ck-msg-author">{name}</span>
            <span className="ck-msg-time">{timeLabel(msg.created_at)}</span>
          </div>
        )}
        {!!msg.pinned && !msg.deleted && (
          <div className="ck-pinnedtag"><IcoPin size={11} /> Fixada</div>
        )}
        {msg.reply && !msg.deleted && (
          <button className="ck-msg-quote" onClick={() => onQuote && onQuote(msg.reply)}>
            <span className="ck-quote-author">{(usersById.get(msg.reply.sender_id) || { name: 'Usuário' }).name}</span>
            <span className="ck-quote-text">
              {msg.reply.deleted ? 'Mensagem excluída' : (msg.reply.content || msg.reply.file_name || 'Anexo')}
            </span>
          </button>
        )}
        {editing ? (
          <div className="ck-editwrap">
            <MentionPop mention={mem.mention} candidates={mem.candidates} onPick={mem.insert} className="ck-mentionpop-edit" />
            <textarea
              ref={editRef}
              autoFocus value={draft} rows={2}
              onChange={(e) => { setDraft(e.target.value); mem.detect(e.target.value, e.target.selectionStart); }}
              onKeyDown={(e) => {
                // a lista de menção come as teclas de navegação antes de salvar
                if (mem.onKey(e)) return;
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                if (e.key === 'Escape') setEditing(false);
              }}
            />
            <div className="ck-editactions">
              <button className="ck-editsave" onClick={saveEdit}>Salvar</button>
              <button className="ck-editat" title="Mencionar pessoa ou setor" onClick={mem.atClick}><IcoAt size={13} /></button>
              <button onClick={() => setEditing(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <MessageContent msg={msg} mentionNames={mentionNames} />
        )}
        {reactionKeys.length > 0 && !msg.deleted && (
          <div className="ck-reacts">
            {reactionKeys.map((em) => (
              <button
                key={em}
                className={'ck-react' + (reactions[em].map(String).includes(String(me.id)) ? ' mine' : '')}
                title={reactions[em].map((uid) => (usersById.get(uid) || { name: '?' }).name).join(', ')}
                onClick={() => onReact(msg, em)}
              >
                {em} <b>{reactions[em].length}</b>
              </button>
            ))}
          </div>
        )}
        {!inThread && msg.reply_count > 0 && (
          <button className="ck-threadlink" onClick={() => onOpenThread(msg)}>
            <IcoThread size={14} /> {msg.reply_count} {msg.reply_count === 1 ? 'resposta' : 'respostas'}
            {msg.last_reply_at && <span style={{ color: 'var(--ink-dim)', fontWeight: 400 }}>· {timeLabel(msg.last_reply_at)}</span>}
          </button>
        )}
      </div>
      {!msg.deleted && !editing && (
        <div className="ck-hoveracts">
          {onReply && !inThread && <button title="Responder" onClick={() => onReply(msg)}><IcoReply /></button>}
          <button title="Reagir" onClick={() => { setPicker((v) => !v); setPinPick(false); }}><IcoSmile /></button>
          {!inThread && <button title="Responder em thread" onClick={() => onOpenThread(msg)}><IcoThread /></button>}
          {onSave && (
            <button title={saved ? 'Remover das salvas' : 'Salvar mensagem'} className={saved ? 'on' : ''} onClick={() => onSave(msg)}>
              <IcoStar on={saved} />
            </button>
          )}
          <button
            title={msg.pinned ? 'Desafixar' : 'Fixar mensagem'}
            onClick={() => {
              if (msg.pinned) onPin(msg, 0);
              else { setPinPick((v) => !v); setPicker(false); }
            }}
          ><IcoPin /></button>
          {onCopyLink && (
            <button title={copied ? 'Link copiado!' : 'Copiar link da mensagem'} onClick={() => {
              onCopyLink(msg);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}>{copied ? <IcoCheck /> : <IcoLink />}</button>
          )}
          {onTask && <button title="Marcar tarefa da obra" onClick={() => onTask(msg)}><IcoCheckSq /></button>}
          {mine && <button title="Editar" onClick={startEdit}><IcoPencil /></button>}
          {mine && <button title="Excluir" onClick={() => onDelete(msg)}><IcoTrash /></button>}
        </div>
      )}
      {picker && (
        <div className="ck-emojipick" onMouseLeave={() => setPicker(false)}>
          {EMOJIS.map((em) => (
            <button key={em} onClick={() => { onReact(msg, em); setPicker(false); }}>{em}</button>
          ))}
        </div>
      )}
      {pinPick && (
        <div className="ck-pinpickpop" onMouseLeave={() => setPinPick(false)}>
          <div className="ck-pinpick-title">Fixar por quanto tempo?</div>
          {PIN_DURATIONS.map((d) => (
            <button key={d.label} onClick={() => { onPin(msg, d.hours); setPinPick(false); }}>{d.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageList({ listRef, messages, me, usersById, mentionNames, mentionTargets, onReact, onOpenThread, onEdit, onDelete, onPin, onSave, savedIds, onTask, onCopyLink, onReply, onQuote, inThread }) {
  return (
    <div className={inThread ? 'ck-thread-replies' : 'ck-msgs'} ref={listRef}>
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
        return (
          <React.Fragment key={m.id}>
            {newDay && <div className="ck-day">{dayLabel(m.created_at)}</div>}
            <Message
              msg={m} prev={newDay ? null : prev} me={me} usersById={usersById}
              mentionNames={mentionNames} mentionTargets={mentionTargets} onReact={onReact} onOpenThread={onOpenThread}
              onEdit={onEdit} onDelete={onDelete} onPin={onPin} onSave={onSave} savedIds={savedIds}
              onTask={onTask} onCopyLink={onCopyLink} onReply={onReply} onQuote={onQuote} inThread={inThread}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composer com @menções e upload
// ---------------------------------------------------------------------------

function Composer({ placeholder, boot, mentionTargets, onSend, api, onTyping, onSchedule, scheduled, onCancelScheduled, replyTo, onCancelReply, usersById }) {
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedAt, setSchedAt] = useState('');
  const [rec, setRec] = useState(null); // { mr } enquanto grava
  const [recSecs, setRecSecs] = useState(0);
  const taRef = useRef(null);
  const fileRef = useRef(null);
  const recRef = useRef(null); // { chunks, cancel }
  const mem = useMention(mentionTargets, input, setInput, taRef);

  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setRecSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [rec]);

  useEffect(() => {
    if (replyTo && taRef.current) taRef.current.focus();
  }, [replyTo]);

  const startRec = async () => {
    if (rec || uploading) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const info = { chunks: [], cancel: false, transcript: [], sr: null, done: false };
      recRef.current = info;
      // transcrição ao vivo em paralelo (Web Speech pt-BR) — mesmo padrão do Instala;
      // sem suporte (Firefox) o áudio vai sem texto
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const sr = new SR();
        sr.lang = 'pt-BR';
        sr.continuous = true;
        sr.interimResults = false;
        sr.onresult = (ev) => {
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            if (ev.results[i].isFinal) {
              const txt = (ev.results[i][0]?.transcript || '').trim();
              if (txt) info.transcript.push(txt);
            }
          }
        };
        sr.onerror = () => {};
        // Chrome encerra a sessão em pausas de fala — religa enquanto ainda grava
        sr.onend = () => { if (!info.done) setTimeout(() => { if (!info.done) { try { sr.start(); } catch {} } }, 300); };
        try { sr.start(); info.sr = sr; } catch {}
      }
      mr.ondataavailable = (e) => { if (e.data && e.data.size) info.chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRec(null);
        if (info.cancel || !info.chunks.length) return;
        const type = (mr.mimeType || 'audio/webm').split(';')[0];
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const f = new File(info.chunks, `audio-${pad(d.getHours())}h${pad(d.getMinutes())}.${ext}`, { type });
        setUploading(true);
        try {
          const up = await api.upload(f);
          // o último trecho da transcrição chega logo depois do stop — espera um tico
          if (info.sr) await new Promise((r) => setTimeout(r, 900));
          onSend(info.transcript.join(' ').trim(), up);
        } catch (e) {
          alert('Falha no envio do áudio: ' + e.message);
        } finally {
          setUploading(false);
        }
      };
      mr.start(250);
      setRecSecs(0);
      setRec({ mr });
    } catch (e) {
      alert('Não consegui acessar o microfone. Verifique a permissão do navegador. (' + e.message + ')');
    }
  };

  const stopRec = (cancel) => {
    if (!rec) return;
    const info = recRef.current;
    info.cancel = cancel;
    info.done = true;
    try { info.sr?.stop(); } catch {}
    rec.mr.stop();
  };

  const pickFile = async (f) => {
    if (!f) return;
    setUploading(true);
    try {
      setFile(await api.upload(f));
    } catch (e) {
      alert('Falha no upload: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const send = () => {
    const text = input.trim();
    if (!text && !file) return;
    onSend(text, file);
    setInput('');
    setFile(null);
    mem.close();
    if (taRef.current) { taRef.current.style.height = 'auto'; taRef.current.focus(); }
  };

  const openSched = () => {
    if (!schedOpen) {
      const d = new Date(Date.now() + 60 * 60 * 1000);
      d.setMinutes(0, 0, 0);
      const pad = (n) => String(n).padStart(2, '0');
      setSchedAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    }
    setSchedOpen((v) => !v);
  };

  const doSchedule = () => {
    const text = input.trim();
    if (!text && !file) return alert('Escreva a mensagem antes de agendar');
    const when = new Date(schedAt);
    if (isNaN(when.getTime()) || when.getTime() < Date.now() + 60 * 1000) return alert('Escolha uma data futura');
    onSchedule(text, file, when.toISOString());
    setInput('');
    setFile(null);
    setSchedOpen(false);
    if (taRef.current) { taRef.current.style.height = 'auto'; taRef.current.focus(); }
  };

  const onKey = (e) => {
    // a lista de menção tem prioridade sobre enviar/cancelar resposta
    if (mem.onKey(e)) return;
    if (e.key === 'Escape' && replyTo && onCancelReply) return onCancelReply();
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="ck-composer">
      <MentionPop mention={mem.mention} candidates={mem.candidates} onPick={mem.insert} />
      {replyTo && (
        <div className="ck-replybar">
          <IcoReply size={14} />
          <div className="ck-replybar-body">
            <span className="ck-quote-author">{(usersById && usersById.get(replyTo.sender_id) || { name: 'Usuário' }).name}</span>
            <span className="ck-quote-text">{replyTo.content || replyTo.file_name || 'Anexo'}</span>
          </div>
          <button className="ck-replybar-x" title="Cancelar resposta" onClick={onCancelReply}><IcoX size={14} /></button>
        </div>
      )}
      <div className="ck-composer-box">
        {file && (
          <span className="ck-filechip">
            <IcoClip size={13} /> {file.file_name}
            <button onClick={() => setFile(null)}><IcoX size={13} /></button>
          </span>
        )}
        <textarea
          ref={taRef} rows={1} placeholder={placeholder} value={input}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
            mem.detect(e.target.value, e.target.selectionStart);
            if (onTyping && e.target.value.trim()) onTyping();
          }}
          onKeyDown={onKey}
        />
        <div className="ck-composer-actions">
          {rec ? (
            <>
              <span className="ck-recdot" />
              <span className="ck-rectime">{Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, '0')}</span>
              <span className="ck-grow" />
              <button className="ck-iconbtn" title="Cancelar gravação" onClick={() => stopRec(true)}><IcoX /></button>
              <button className="ck-send" onClick={() => stopRec(false)}>Enviar áudio</button>
            </>
          ) : (
            <>
              <button className="ck-iconbtn" title="Anexar arquivo" onClick={() => fileRef.current && fileRef.current.click()}>
                {uploading ? <span className="ck-spin" /> : <IcoClip />}
              </button>
              <input ref={fileRef} type="file" hidden onChange={(e) => { pickFile(e.target.files[0]); e.target.value = ''; }} />
              <button className="ck-iconbtn" title="Gravar áudio" onClick={startRec}><IcoMic /></button>
              <button className="ck-iconbtn" title="Mencionar pessoa ou setor" onClick={mem.atClick}><IcoAt /></button>
              {onSchedule && (
                <button className={'ck-iconbtn' + (schedOpen || (scheduled || []).length ? ' on' : '')} title="Agendar envio" onClick={openSched}>
                  <IcoClock />
                </button>
              )}
              <span className="ck-grow" />
              <button className="ck-send" disabled={!input.trim() && !file} onClick={send}>Enviar</button>
            </>
          )}
        </div>
      </div>
      {schedOpen && onSchedule && (
        <div className="ck-schedpop">
          <div className="ck-sched-title"><IcoClock size={13} /> Agendar envio</div>
          <div className="ck-sched-form">
            <input type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)} />
            <button className="ck-send" onClick={doSchedule}>Agendar</button>
          </div>
          {(scheduled || []).length > 0 && (
            <div className="ck-sched-list">
              {scheduled.map((s) => (
                <div key={s.id} className="ck-schedrow">
                  <IcoClock size={12} />
                  <span className="ck-sched-when">{dayLabel(s.send_at)} {timeLabel(s.send_at)}</span>
                  <span className="ck-sched-text">{s.content || s.file_name || ''}</span>
                  <button className="ck-iconbtn" title="Cancelar agendamento" onClick={() => onCancelScheduled(s.id)}><IcoX size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modais: nova DM, abrir obra, busca global
// ---------------------------------------------------------------------------

function PickerModal({ title, placeholder, items, onQuery, onPick, onClose, renderItem, empty }) {
  const [q, setQ] = useState('');
  useEffect(() => { if (onQuery) onQuery(q); }, [q]);
  return (
    <div className="ck-modalbg" onClick={onClose}>
      <div className="ck-modal" onClick={(e) => e.stopPropagation()}>
        <input autoFocus placeholder={placeholder || title} value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} />
        <div className="ck-modal-list">
          {items(q).map((it) => (
            <button key={it.key} onClick={() => onPick(it)}>{renderItem(it)}</button>
          ))}
          {items(q).length === 0 && <div className="ck-modal-empty">{empty || 'Nada encontrado'}</div>}
        </div>
      </div>
    </div>
  );
}

function SearchModal({ api, usersById, convName, onOpen, onClose }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setHits([]); return; }
    timer.current = setTimeout(() => {
      api.search(q).then(setHits).catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(timer.current);
  }, [q]);
  return (
    <div className="ck-modalbg" onClick={onClose}>
      <div className="ck-modal" onClick={(e) => e.stopPropagation()}>
        <input autoFocus placeholder="Buscar mensagens…" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} />
        <div className="ck-modal-list">
          {hits.map((h) => {
            const sender = usersById.get(h.sender_id);
            // snippet FTS vem com \x01…\x02 marcando o trecho casado
            const snip = String(h.snippet || h.content || '').split(/[\x01\x02]/);
            return (
              <button key={h.id} onClick={() => onOpen(h)}>
                <Avatar user={sender} name={sender ? sender.name : '?'} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 700 }}>{sender ? sender.name : 'Usuário'}</span>
                  <span style={{ color: 'var(--ink-dim)', fontSize: 12 }}> em {convName(h.conv_type, h.conv_id)} · {dayLabel(h.created_at)}</span>
                  <span className="ck-hit-snip">
                    {snip.map((s, i) => (i % 2 === 1 ? <b key={i}>{s}</b> : <span key={i}>{s}</span>))}
                  </span>
                </span>
              </button>
            );
          })}
          {hits.length === 0 && <div className="ck-modal-empty">{q.trim().length < 2 ? 'Digite pelo menos 2 letras' : 'Nenhuma mensagem encontrada'}</div>}
        </div>
      </div>
    </div>
  );
}

function PinsModal({ api, active, usersById, mentionNames, onUnpin, onClose }) {
  const [pins, setPins] = useState(null);
  useEffect(() => {
    api.pins(active.type, active.id).then(setPins).catch(() => setPins([]));
  }, [active.type, active.id]);
  return (
    <div className="ck-modalbg" onClick={onClose}>
      <div className="ck-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ck-modal-title"><IcoPin size={14} /> Mensagens fixadas</div>
        <div className="ck-modal-list">
          {(pins || []).map((p) => {
            const sender = usersById.get(p.sender_id);
            return (
              <div key={p.id} className="ck-pinrow">
                <Avatar user={sender} name={sender ? sender.name : '?'} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontWeight: 700 }}>{sender ? sender.name : 'Usuário'}</span>
                  <span style={{ color: 'var(--dim)', fontSize: 12 }}> · {dayLabel(p.created_at)} {timeLabel(p.created_at)}</span>
                  <span className="ck-hit-snip"><InlineText text={p.content || p.file_name || ''} mentionNames={mentionNames} /></span>
                </span>
                <button className="ck-iconbtn" title="Desafixar" onClick={() => { onUnpin(p); setPins((ps) => ps.filter((x) => x.id !== p.id)); }}>
                  <IcoX size={13} />
                </button>
              </div>
            );
          })}
          {pins && pins.length === 0 && <div className="ck-modal-empty">Nenhuma mensagem fixada nesta conversa</div>}
          {!pins && <div className="ck-modal-empty">Carregando…</div>}
        </div>
      </div>
    </div>
  );
}

// Nova conversa: primeiro os setores; clicando, as pessoas dele (com foto).
// Busca digitada pula direto pra lista de pessoas.
function NewDmModal({ boot, online, onPick, onClose }) {
  const [q, setQ] = useState('');
  const [sector, setSector] = useState(null); // setor selecionado (objeto) ou null
  const me = boot.me;
  const users = (boot.users || []).filter((u) => String(u.id) !== String(me.id));
  const bySector = new Map();
  for (const u of users) {
    const k = String(u.sector_id || '');
    if (!bySector.has(k)) bySector.set(k, []);
    bySector.get(k).push(u);
  }
  const filt = q.trim().toLowerCase();
  const secName = (u) => {
    const s = (boot.sectors || []).find((x) => String(x.id) === String(u.sector_id));
    return s ? s.name : '';
  };
  const personRow = (u) => (
    <button key={u.id} className="ck-dmrow" onClick={() => onPick(u)}>
      <Avatar user={u} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ fontWeight: 700, display: 'block' }}>
          {u.name} {online.has(u.id) && <span className="ck-dot on" style={{ display: 'inline-block' }} />}
        </span>
        <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{u.email}</span>
      </span>
      <span style={{ fontSize: 11, color: 'var(--ink-dim)' }}>{secName(u)}</span>
    </button>
  );
  return (
    <div className="ck-modalbg" onClick={onClose}>
      <div className="ck-modal" onClick={(e) => e.stopPropagation()}>
        <input autoFocus placeholder="Buscar pessoa…" value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} />
        <div className="ck-modal-list">
          {filt ? (
            <>
              {users.filter((u) => u.name.toLowerCase().includes(filt)).slice(0, 30).map(personRow)}
              {users.filter((u) => u.name.toLowerCase().includes(filt)).length === 0 && (
                <div className="ck-modal-empty">Ninguém com esse nome</div>
              )}
            </>
          ) : sector ? (
            <>
              <button className="ck-dmback" onClick={() => setSector(null)}>
                <IcoChevL size={14} /> Setores · <b>{sector.name}</b>
              </button>
              {(bySector.get(String(sector.id)) || []).map(personRow)}
              {(bySector.get(String(sector.id)) || []).length === 0 && (
                <div className="ck-modal-empty">Ninguém neste setor</div>
              )}
            </>
          ) : (
            (boot.sectors || [])
              .filter((s) => (bySector.get(String(s.id)) || []).length > 0)
              .map((s) => {
                const n = (bySector.get(String(s.id)) || []).length;
                return (
                  <button key={s.id} className="ck-dmrow" onClick={() => setSector(s)}>
                    <span className="ck-secava" style={{ background: colorFor(s.name) }}>{initials(s.name)}</span>
                    <span style={{ fontWeight: 700, flex: 1 }}>{s.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{n} {n === 1 ? 'pessoa' : 'pessoas'}</span>
                  </button>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}

// "Geral da obra" — descrição do grupo + membros + toda a mídia por categoria.
function ObraInfoModal({ api, threadId, boot, usersById, sectorsById, onClose }) {
  const obra = (boot.obras_visiveis || []).find((o) => o.thread_id === threadId) || {};
  const [tab, setTab] = useState('geral');
  const [desc, setDesc] = useState(obra.description || '');
  const [saving, setSaving] = useState(false);
  const [media, setMedia] = useState(null);
  const [tags, setTags] = useState(obra.tags || []);
  const [tagInput, setTagInput] = useState('');

  const saveTags = async (next) => {
    setTags(next);
    try {
      await api.obraTags(threadId, next);
    } catch (e) {
      alert('Falha ao salvar tags: ' + e.message);
    }
  };
  const addTag = (t) => {
    const v = String(t || '').trim().toUpperCase().slice(0, 30);
    setTagInput('');
    if (v && !tags.includes(v)) saveTags([...tags, v]);
  };
  useEffect(() => {
    api.obraMedia(threadId).then(setMedia).catch(() => setMedia([]));
  }, [threadId]);

  const saveDesc = async () => {
    setSaving(true);
    try {
      await api.obraDesc(threadId, desc.trim());
    } catch (e) {
      alert('Falha ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const rows = media || [];
  const fotos = rows.filter((m) => m.file_type && m.file_type.startsWith('image/'));
  const videos = rows.filter((m) => m.file_type && m.file_type.startsWith('video/'));
  const docs = rows.filter((m) => m.file_path && !(m.file_type && (m.file_type.startsWith('image/') || m.file_type.startsWith('video/'))));
  const links = [];
  for (const m of rows) {
    const found = String(m.content || '').match(URL_RE) || [];
    for (const url of found) links.push({ key: m.id + url, url, msg: m });
  }
  const senderName = (m) => (usersById.get(m.sender_id) || { name: 'Usuário' }).name;
  const TABS = [
    ['geral', 'Geral', null],
    ['fotos', 'Fotos', fotos.length],
    ['videos', 'Vídeos', videos.length],
    ['docs', 'Docs', docs.length],
    ['links', 'Links', links.length],
  ];

  return (
    <div className="ck-modalbg" onClick={onClose}>
      <div className="ck-modal ck-obrainfo" onClick={(e) => e.stopPropagation()}>
        <div className="ck-modal-title">
          <IcoHome size={14} /> {obra.nome || 'Obra'}
          {obra.cliente && <span style={{ fontWeight: 400, color: 'var(--dim)' }}> · {obra.cliente}</span>}
        </div>
        <div className="ck-obrainfo-tabs">
          {TABS.map(([id, label, count]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              {label}{count != null && count > 0 ? ` (${count})` : ''}
            </button>
          ))}
        </div>
        <div className="ck-obrainfo-body">
          {tab === 'geral' && (
            <>
              <div className="ck-obrainfo-label">Tags de status</div>
              <div className="ck-tagrow">
                {tags.map((t) => (
                  <TagChip key={t} tag={t} onRemove={() => saveTags(tags.filter((x) => x !== t))} />
                ))}
                {tags.length === 0 && <span style={{ color: 'var(--dim)', fontSize: 12 }}>Nenhuma tag — marque como está a obra</span>}
              </div>
              <div className="ck-tagrow">
                {TAG_PRESETS.filter((p) => !tags.includes(p)).map((p) => (
                  <button key={p} className="ck-tagadd" onClick={() => addTag(p)}>+ {p}</button>
                ))}
              </div>
              <div className="ck-tagnew">
                <input
                  placeholder="Tag personalizada… (Enter adiciona)" value={tagInput} maxLength={30}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addTag(tagInput); }}
                />
                <button className="ck-send" onClick={() => addTag(tagInput)}>Adicionar</button>
              </div>
              <div className="ck-obrainfo-label">Descrição do grupo</div>
              <textarea
                className="ck-obrainfo-desc" rows={4} maxLength={2000}
                placeholder="Escopo, combinados, informações importantes desta obra…"
                value={desc} onChange={(e) => setDesc(e.target.value)}
              />
              <div className="ck-obrainfo-actions">
                <button className="ck-send" disabled={saving} onClick={saveDesc}>{saving ? 'Salvando…' : 'Salvar descrição'}</button>
              </div>
              <div className="ck-obrainfo-label">Membros</div>
              <div className="ck-obrainfo-members">
                {(obra.members || []).map((m) => {
                  if (m.type === 'sector') {
                    const s = sectorsById.get(String(m.id));
                    return <span key={'s' + m.id} className="ck-memberchip sec">{s ? s.name : 'Setor'}</span>;
                  }
                  const u = usersById.get(m.id);
                  return (
                    <span key={'u' + m.id} className="ck-memberchip">
                      <Avatar user={u} name={u ? u.name : '?'} className="ck-ava sm" />
                      {u ? u.name : 'Usuário'}
                    </span>
                  );
                })}
                {(obra.members || []).length === 0 && <span style={{ color: 'var(--dim)', fontSize: 12 }}>Sem membros marcados</span>}
              </div>
            </>
          )}
          {tab === 'fotos' && (
            fotos.length ? (
              <div className="ck-mediagrid">
                {fotos.map((m) => (
                  <a key={m.id} href={m.file_path} target="_blank" rel="noreferrer" title={senderName(m) + ' · ' + dayLabel(m.created_at)}>
                    <img src={m.file_path} alt={m.file_name || 'foto'} loading="lazy" />
                  </a>
                ))}
              </div>
            ) : <div className="ck-modal-empty">{media ? 'Nenhuma foto nesta obra' : 'Carregando…'}</div>
          )}
          {tab === 'videos' && (
            videos.length ? (
              <div className="ck-mediagrid vid">
                {videos.map((m) => <video key={m.id} src={m.file_path} controls preload="metadata" />)}
              </div>
            ) : <div className="ck-modal-empty">{media ? 'Nenhum vídeo nesta obra' : 'Carregando…'}</div>
          )}
          {tab === 'docs' && (
            docs.length ? docs.map((m) => (
              <a key={m.id} className="ck-mediadoc" href={m.file_path} target="_blank" rel="noreferrer" download={m.file_name || true}>
                <IcoDoc size={15} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.file_name || 'arquivo'}</span>
                  <span style={{ fontSize: 11, color: 'var(--dim)' }}>{senderName(m)} · {dayLabel(m.created_at)}</span>
                </span>
              </a>
            )) : <div className="ck-modal-empty">{media ? 'Nenhum documento nesta obra' : 'Carregando…'}</div>
          )}
          {tab === 'links' && (
            links.length ? links.map((l) => (
              <a key={l.key} className="ck-mediadoc" href={l.url} target="_blank" rel="noreferrer">
                <IcoLink size={15} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.url}</span>
                  <span style={{ fontSize: 11, color: 'var(--dim)' }}>{senderName(l.msg)} · {dayLabel(l.msg.created_at)}</span>
                </span>
              </a>
            )) : <div className="ck-modal-empty">{media ? 'Nenhum link nesta obra' : 'Carregando…'}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Mensagens salvas (favoritas) do usuário — todas as conversas.
function SavedModal({ api, usersById, mentionNames, convName, onOpen, onUnsave, onClose }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api.savedList().then(setItems).catch(() => setItems([]));
  }, []);
  return (
    <div className="ck-modalbg" onClick={onClose}>
      <div className="ck-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ck-modal-title"><IcoStar size={14} on /> Mensagens salvas</div>
        <div className="ck-modal-list">
          {(items || []).map((p) => {
            const sender = usersById.get(p.sender_id);
            return (
              <div key={p.id} className="ck-pinrow">
                <Avatar user={sender} name={sender ? sender.name : '?'} />
                <button className="ck-pinjump" onClick={() => onOpen(p)}>
                  <span style={{ fontWeight: 700 }}>{sender ? sender.name : 'Usuário'}</span>
                  <span style={{ color: 'var(--dim)', fontSize: 12 }}> em {convName(p.conv_type, p.conv_id)} · {dayLabel(p.created_at)}</span>
                  <span className="ck-hit-snip"><InlineText text={p.content || p.file_name || ''} mentionNames={mentionNames} /></span>
                </button>
                <button className="ck-iconbtn" title="Remover das salvas"
                  onClick={() => { onUnsave(p); setItems((xs) => xs.filter((x) => x.id !== p.id)); }}>
                  <IcoX size={13} />
                </button>
              </div>
            );
          })}
          {items && items.length === 0 && <div className="ck-modal-empty">Nenhuma mensagem salva — use a estrela ao passar o mouse numa mensagem</div>}
          {!items && <div className="ck-modal-empty">Carregando…</div>}
        </div>
      </div>
    </div>
  );
}

function ProfileModal({ api, me, onClose }) {
  const [name, setName] = useState(me.name || '');
  const [avatar, setAvatar] = useState(me.avatar_url || null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const pick = async (f) => {
    if (!f) return;
    if (!String(f.type || '').startsWith('image/')) return alert('Escolha uma imagem');
    setUploading(true);
    try {
      const up = await api.upload(f);
      setAvatar(up.file_path);
    } catch (e) {
      alert('Falha no upload: ' + e.message);
    } finally {
      setUploading(false);
    }
  };
  const save = async () => {
    setSaving(true);
    try {
      await api.saveProfile(name.trim(), avatar);
      onClose();
    } catch (e) {
      alert('Falha ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="ck-modalbg" onClick={onClose}>
      <div className="ck-modal ck-profile" onClick={(e) => e.stopPropagation()}>
        <div className="ck-modal-title">Meu perfil</div>
        <div className="ck-profile-body">
          <button className="ck-profile-ava" title="Trocar foto" onClick={() => fileRef.current && fileRef.current.click()}>
            {avatar
              ? <img className="ck-avaimg" src={avatar} alt={name} />
              : <span style={{ background: colorFor(name || me.name) }}>{initials(name || me.name)}</span>}
            <span className="ck-profile-cam">{uploading ? <span className="ck-spin" /> : <IcoCamera size={14} />}</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }} />
          <div className="ck-profile-fields">
            <label>
              Nome de exibição
              <input value={name} maxLength={80} placeholder={me.name} onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }} />
            </label>
            <div className="ck-profile-mail">{me.email}</div>
          </div>
        </div>
        <div className="ck-profile-actions">
          {avatar && <button onClick={() => setAvatar(null)}>Remover foto</button>}
          <span className="ck-grow" />
          <button onClick={onClose}>Cancelar</button>
          <button className="ck-send" disabled={saving || uploading} onClick={save}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}

function TasksModal({ api, threadId, boot, usersById, prefill, version, onClose }) {
  const [data, setData] = useState(null);
  const [title, setTitle] = useState(prefill ? prefill.title : '');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    api.tarefas(threadId).then(setData).catch(() => setData({ tasks: [], open_count: 0 }));
  }, [threadId, version]);
  const create = async () => {
    const t = title.trim();
    if (!t) return;
    setCreating(true);
    try {
      await api.criarTarefa(threadId, {
        title: t,
        assigneeId: assignee || null,
        dueDate: due || null,
        sourceMsgId: prefill ? prefill.sourceMsgId : null,
      });
      setTitle('');
      setAssignee('');
      setDue('');
    } catch (e) {
      alert('Falha ao criar tarefa: ' + e.message);
    } finally {
      setCreating(false);
    }
  };
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="ck-modalbg" onClick={onClose}>
      <div className="ck-modal ck-tasksmodal" onClick={(e) => e.stopPropagation()}>
        <div className="ck-modal-title"><IcoCheckSq size={14} /> Tarefas da obra</div>
        <div className="ck-taskform">
          <input autoFocus placeholder="Nova tarefa…" value={title} maxLength={300}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') onClose(); }} />
          <div className="ck-taskform-row">
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Sem responsável</option>
              {(boot.users || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            <button className="ck-send" disabled={creating || !title.trim()} onClick={create}>Criar</button>
          </div>
        </div>
        <div className="ck-modal-list">
          {(data?.tasks || []).map((t) => {
            const resp = t.assignee_id ? usersById.get(t.assignee_id) : null;
            const overdue = !t.done && t.due_date && t.due_date < today;
            return (
              <div key={t.id} className={'ck-taskrow' + (t.done ? ' done' : '')}>
                <button className="ck-taskcheck" title={t.done ? 'Reabrir' : 'Concluir'}
                  onClick={() => api.toggleTarefa(t.id).catch((e) => alert(e.message))}>
                  {t.done ? <IcoCheckSq size={15} /> : <span className="ck-taskbox" />}
                </button>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="ck-tasktitle">{t.title}</span>
                  <span className="ck-taskmeta">
                    {resp && <span>{resp.name}</span>}
                    {t.due_date && (
                      <span className={overdue ? 'ck-overdue' : ''}>
                        prazo {t.due_date.slice(8, 10)}/{t.due_date.slice(5, 7)}
                      </span>
                    )}
                  </span>
                </span>
                <button className="ck-iconbtn" title="Excluir tarefa"
                  onClick={() => { if (window.confirm('Excluir esta tarefa?')) api.delTarefa(t.id).catch((e) => alert(e.message)); }}>
                  <IcoTrash size={13} />
                </button>
              </div>
            );
          })}
          {data && data.tasks.length === 0 && <div className="ck-modal-empty">Nenhuma tarefa nesta obra ainda</div>}
          {!data && <div className="ck-modal-empty">Carregando…</div>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Teca — copiloto de IA sobre a conversa ativa
// ---------------------------------------------------------------------------

function TecaPanel({ api, active, convName, onClose }) {
  const [items, setItems] = useState([]); // { q, a, err }
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);
  const activeRef = useRef(active);

  useEffect(() => {
    if (activeRef.current.type !== active.type || activeRef.current.id !== active.id) {
      activeRef.current = active;
      setItems([]);
    }
  }, [active]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items, busy]);

  const ask = async (q) => {
    q = String(q || '').trim();
    if (!q || busy) return;
    setText('');
    setBusy(true);
    const conv = active;
    try {
      const r = await api.teca(conv.type, conv.id, q);
      if (activeRef.current.type === conv.type && activeRef.current.id === conv.id) {
        setItems((xs) => [...xs, { q, a: r.answer }]);
      }
    } catch (e) {
      setItems((xs) => [...xs, { q, err: e.message || 'Teca indisponível' }]);
    }
    setBusy(false);
  };

  return (
    <div className="ck-thread ck-teca">
      <div className="ck-head">
        <div className="ck-grow">
          <div className="ck-head-title"><IcoSpark size={14} /> Teca</div>
          <div className="ck-head-sub">{convName(active.type, active.id)}</div>
        </div>
        <button className="ck-iconbtn" onClick={onClose}><IcoX /></button>
      </div>
      <div className="ck-teca-body" ref={bodyRef}>
        {!items.length && !busy && (
          <div className="ck-teca-hint">
            Pergunte qualquer coisa sobre esta conversa — a Teca responde com base nas últimas mensagens.
          </div>
        )}
        {items.map((it, i) => (
          <div key={i} className="ck-teca-qa">
            <div className="ck-teca-q">{it.q}</div>
            {it.err
              ? <div className="ck-teca-a ck-teca-err">{it.err}</div>
              : <div className="ck-teca-a"><InlineText text={it.a} mentionNames={[]} /></div>}
          </div>
        ))}
        {busy && <div className="ck-teca-a ck-teca-wait">Teca está pensando…</div>}
      </div>
      <div className="ck-teca-quick">
        <button disabled={busy} onClick={() => ask('Faça um resumo objetivo desta conversa: principais assuntos, decisões e pendências.')}>
          Resumir conversa
        </button>
        <button disabled={busy} onClick={() => ask('Liste as pendências e próximos passos citados nesta conversa, indicando o responsável quando houver.')}>
          Pendências
        </button>
      </div>
      <form
        className="ck-teca-form"
        onSubmit={(e) => { e.preventDefault(); ask(text); }}
      >
        <input
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Pergunte à Teca sobre a conversa…" disabled={busy}
        />
        <button type="submit" disabled={busy || !text.trim()}>Perguntar</button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App({ token, onLogout, onAuthFail, theme, onToggleTheme }) {
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const api = useMemo(() => makeApi(() => tokenRef.current, null), []);

  const [boot, setBoot] = useState(null);
  const [bootErr, setBootErr] = useState(null);
  const [online, setOnline] = useState(new Set());
  const [active, setActive] = useState(null); // { type, id }
  const [messages, setMessages] = useState([]);
  const [thread, setThread] = useState(null); // { root, replies, convType, convId }
  const [replyTo, setReplyTo] = useState(null); // quote-reply estilo WhatsApp
  const replyToRef = useRef(null);
  replyToRef.current = replyTo;
  const [tecaOpen, setTecaOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [sideQ, setSideQ] = useState('');
  const [modal, setModal] = useState(null); // 'dm' | 'obra' | 'search' | 'pins' | 'profile' | 'tasks'
  const [obraResults, setObraResults] = useState([]);
  const [typers, setTypers] = useState({}); // 'type:id' -> { userId: expiraEm }
  const [scheduled, setScheduled] = useState([]); // mensagens agendadas pendentes (minhas)
  const [taskPrefill, setTaskPrefill] = useState(null); // { title, sourceMsgId }
  const [savedIds, setSavedIds] = useState(() => new Set()); // ids das minhas mensagens salvas
  const [tasksVersion, setTasksVersion] = useState(0); // bump = TasksModal refetch
  const [pushOn, setPushOn] = useState(typeof Notification !== 'undefined' && Notification.permission === 'granted');
  const [soundOn, setSoundOn] = useState(localStorage.getItem('parket_chat_sound') !== 'off');
  const [obrasOpen, setObrasOpen] = useState(localStorage.getItem('parket_chat_obras_open') !== '0');
  const toggleObras = () => setObrasOpen((o) => {
    localStorage.setItem('parket_chat_obras_open', o ? '0' : '1');
    return !o;
  });
  const toggleSound = () => {
    const next = !soundOn;
    localStorage.setItem('parket_chat_sound', next ? 'on' : 'off');
    setSoundOn(next);
    if (next) { lastKnockAt = 0; playKnock(); }
  };
  const [pushBanner, setPushBanner] = useState(
    typeof Notification !== 'undefined' && 'serviceWorker' in navigator &&
    Notification.permission === 'default' && !localStorage.getItem('parket_chat_push_banner_off')
  );

  const socketRef = useRef(null);
  const activeRef = useRef(null);
  const threadRef = useRef(null);
  const bootRef = useRef(null);
  const listRef = useRef(null);
  const threadListRef = useRef(null);
  activeRef.current = active;
  threadRef.current = thread;
  bootRef.current = boot;

  const usersById = useMemo(() => {
    // sender_id pode voltar do SQLite como número; chaveia e busca sempre por string
    const m = new Map((boot?.users || []).map((u) => [String(u.id), u]));
    return { get: (id) => m.get(String(id)) };
  }, [boot]);
  const sectorsById = useMemo(() => new Map((boot?.sectors || []).map((s) => [s.id, s])), [boot]);
  const mentionNames = useMemo(
    () => [...(boot?.sectors || []).map((s) => s.name), ...(boot?.users || []).map((u) => u.name)],
    [boot]
  );
  // mesma lista, em formato de autocomplete (composer e edição de mensagem)
  const mentionTargets = useMemo(() => mentionTargetsFrom(boot), [boot]);

  const scrollDown = (ref) => requestAnimationFrame(() => {
    const el = (ref || listRef).current;
    if (el) el.scrollTop = el.scrollHeight;
  });

  const patchConv = useCallback((type, id, fn) => {
    setBoot((b) => {
      if (!b) return b;
      const key = type === 'channel' ? 'channels' : type === 'dm' ? 'dms' : 'obras_visiveis';
      const idKey = type === 'obra' ? 'thread_id' : 'id';
      return { ...b, [key]: (b[key] || []).map((c) => (c[idKey] === id ? fn(c) : c)) };
    });
  }, []);

  const markRead = useCallback((type, id, lastMsgId) => {
    if (!lastMsgId) return;
    api.marcarLido(type, id, lastMsgId).catch(() => {});
    patchConv(type, id, (c) => ({ ...c, unread: 0, mentions: 0 }));
  }, [api, patchConv]);

  // ----- nomes de conversa -----
  const convName = useCallback((type, id) => {
    const b = bootRef.current;
    if (!b) return '';
    if (type === 'channel') {
      const ch = (b.channels || []).find((c) => c.id === id);
      return ch ? '#' + ch.name : '#?';
    }
    if (type === 'dm') {
      const dm = (b.dms || []).find((d) => d.id === id);
      const u = dm && usersById.get(dm.other_user_id);
      return u ? u.name : 'Conversa';
    }
    const o = (b.obras_visiveis || []).find((x) => x.thread_id === id);
    return o ? o.nome : 'Obra';
  }, [usersById]);

  // ----- abrir conversa -----
  const openConv = useCallback((type, id, opts = {}) => {
    setActive({ type, id });
    setThread(null);
    setReplyTo(null);
    setSideOpen(false);
    setMessages([]);
    const base = convPath(type, id, bootRef.current);
    const path = base + (opts.msgId ? '#m' + opts.msgId : '');
    if (opts.replaceUrl || location.pathname === base) history.replaceState({ conv: [type, id] }, '', path);
    else if (!opts.noHistory) history.pushState({ conv: [type, id] }, '', path);
    api.messages(type, id).then((rows) => {
      setMessages(rows);
      if (opts.msgId) {
        // espera o React commitar a lista antes de procurar a âncora
        const tryScroll = (tries) => {
          const el = document.getElementById('m' + opts.msgId);
          if (el) {
            el.scrollIntoView({ block: 'center' });
            el.classList.add('hl');
            setTimeout(() => el.classList.remove('hl'), 2600);
          } else if (tries > 0) setTimeout(() => tryScroll(tries - 1), 80);
          else scrollDown();
        };
        requestAnimationFrame(() => tryScroll(12));
      } else scrollDown();
      if (rows.length) markRead(type, id, rows[rows.length - 1].id);
    }).catch((e) => {
      setMessages([]);
      console.warn('messages:', e.message);
    });
  }, [api, markRead]);

  const copyMsgLink = useCallback((msg) => {
    const act = activeRef.current;
    if (!act) return;
    // DM: id numérico no link — o slug do nome só resolve pro próprio dono da URL
    const base = act.type === 'dm' ? '/dm/' + act.id : convPath(act.type, act.id, bootRef.current);
    const url = location.origin + base + '#m' + msg.id;
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).catch(() => prompt('Link da mensagem:', url));
    else prompt('Link da mensagem:', url);
  }, []);

  const openThread = useCallback((msg) => {
    api.thread(msg.id).then((t) => {
      setTecaOpen(false);
      setThread(t);
      scrollDown(threadListRef);
    }).catch((e) => alert('Thread: ' + e.message));
  }, [api]);

  // ----- boot + socket -----
  useEffect(() => {
    let disposed = false;
    api.bootstrap().then((data) => {
      if (disposed) return;
      setBoot(data);
      setOnline(new Set(data.online || []));
      setSavedIds(new Set(data.saved || []));
      api.scheduledList().then((s) => { if (!disposed) setScheduled(s); }).catch(() => {});
      // deep-link: path /canal|/dm|/obra ou legado ?conv=channel:3 (clique em push)
      const conv = new URLSearchParams(location.search).get('conv');
      const hashMsg = /^#m(\d+)$/.exec(location.hash);
      const msgId = hashMsg ? Number(hashMsg[1]) : null;
      let target = null;
      if (conv) {
        const [t, i] = conv.split(':');
        if (['channel', 'dm', 'obra'].includes(t) && Number(i)) target = { type: t, id: Number(i) };
      } else {
        target = parseConvPath(location.pathname, data);
      }
      if (target && target.id == null && target.userId) {
        // /dm/<nome> sem DM existente: cria sob demanda
        api.criarDm(target.userId).then((dm) => {
          setBoot((b) => (b.dms.some((d) => d.id === dm.id) ? b : { ...b, dms: [...b.dms, { ...dm, unread: 0, mentions: 0 }] }));
          setTimeout(() => openConv('dm', dm.id, { replaceUrl: true }), 0);
        }).catch(() => history.replaceState(null, '', '/'));
      } else if (target) {
        setTimeout(() => openConv(target.type, target.id, { replaceUrl: true, msgId }), 0);
      } else if (location.pathname !== '/' || conv) {
        history.replaceState(null, '', '/');
      }
    }).catch((e) => {
      if (disposed) return;
      if (e.status === 401) (onAuthFail || onLogout)();
      else setBootErr(e.message);
    });

    const socket = io({ auth: { token: tokenRef.current }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('message:new', (msg) => {
      const act = activeRef.current;
      const th = threadRef.current;
      const isActive = act && act.type === msg.conv_type && act.id === msg.conv_id;
      if (msg.parent_id != null) {
        // reply: aparece na thread aberta; painel principal só atualiza contador via thread:update
        if (th && th.root && th.root.id === msg.parent_id) {
          setThread((t) => (t && t.root.id === msg.parent_id ? { ...t, replies: [...t.replies, msg] } : t));
          scrollDown(threadListRef);
        }
      } else if (isActive) {
        setMessages((ms) => (ms.some((m) => m.id === msg.id) ? ms : [...ms, msg]));
        scrollDown();
      }
      if (isActive && document.hasFocus()) {
        markRead(msg.conv_type, msg.conv_id, msg.id);
      } else {
        const meId = String(bootRef.current?.me?.id);
        if (String(msg.sender_id) !== meId) {
          const mentioned = (msg.mentions || []).some(
            (m) => (m.type === 'user' && String(m.id) === meId) || (m.type === 'sector' && String(m.id) === String(bootRef.current?.me?.sector_id))
          );
          patchConv(msg.conv_type, msg.conv_id, (c) => ({
            ...c, unread: (c.unread || 0) + 1, mentions: (c.mentions || 0) + (mentioned ? 1 : 0),
          }));
          playKnock();
        }
      }
    });

    socket.on('message:update', (msg) => {
      const apply = (m) => (m.id === msg.id ? { ...m, ...msg } : m);
      setMessages((ms) => ms.map(apply));
      setThread((t) => (t ? { ...t, root: apply(t.root), replies: t.replies.map(apply) } : t));
    });

    socket.on('pin:update', (p) => {
      const apply = (m) => (m.id === p.message_id ? { ...m, pinned: p.pinned ? 1 : 0 } : m);
      setMessages((ms) => ms.map(apply));
      setThread((t) => (t ? { ...t, root: apply(t.root), replies: t.replies.map(apply) } : t));
    });

    socket.on('typing', ({ userId, convType, convId }) => {
      const meId = String(bootRef.current?.me?.id);
      if (String(userId) === meId) return;
      const key = convType + ':' + convId;
      setTypers((t) => ({ ...t, [key]: { ...(t[key] || {}), [userId]: Date.now() + 4000 } }));
    });

    const typingPrune = setInterval(() => {
      setTypers((t) => {
        const now = Date.now();
        let changed = false;
        const next = {};
        for (const [key, users] of Object.entries(t)) {
          const alive = Object.fromEntries(Object.entries(users).filter(([, exp]) => exp > now));
          if (Object.keys(alive).length !== Object.keys(users).length) changed = true;
          if (Object.keys(alive).length) next[key] = alive;
        }
        return changed ? next : t;
      });
    }, 1500);

    socket.on('thread:update', (t) => {
      const act = activeRef.current;
      if (act && act.type === t.conv_type && act.id === t.conv_id) {
        setMessages((ms) => ms.map((m) => (m.id === t.parent_id ? { ...m, reply_count: t.reply_count, last_reply_at: t.last_reply_at } : m)));
      }
    });

    socket.on('reaction:update', (r) => {
      const apply = (m) => {
        if (m.id !== r.message_id) return m;
        const reactions = { ...(m.reactions || {}) };
        const list = new Set(reactions[r.emoji] || []);
        if (r.added) list.add(r.user_id); else list.delete(r.user_id);
        if (list.size) reactions[r.emoji] = [...list]; else delete reactions[r.emoji];
        return { ...m, reactions };
      };
      setMessages((ms) => ms.map(apply));
      setThread((t) => (t ? { ...t, root: apply(t.root), replies: t.replies.map(apply) } : t));
    });

    socket.on('presence', ({ userId, online: isOn }) => {
      setOnline((s) => {
        const n = new Set(s);
        if (isOn) n.add(userId); else n.delete(userId);
        return n;
      });
    });
    socket.on('presence:all', (ids) => setOnline(new Set(ids)));

    socket.on('dm:new', (dm) => {
      setBoot((b) => {
        if (!b || (b.dms || []).some((d) => d.id === dm.id)) return b;
        return { ...b, dms: [...b.dms, { ...dm, unread: 0, mentions: 0 }] };
      });
    });

    socket.on('obra:acesso', (payload) => {
      setBoot((b) => {
        if (!b) return b;
        const has = (b.obras_visiveis || []).some((o) => o.thread_id === payload.thread_id);
        const obras = has
          ? b.obras_visiveis.map((o) => (o.thread_id === payload.thread_id ? { ...o, ...payload } : o))
          : [...(b.obras_visiveis || []), { ...payload, unread: 0, mentions: 0 }];
        return { ...b, obras_visiveis: obras, obras_sugeridas: (b.obras_sugeridas || []).filter((o) => String(o.id) !== String(payload.obra_id)) };
      });
    });

    socket.on('read:update', ({ convType, convId }) => {
      patchConv(convType, convId, (c) => ({ ...c, unread: 0, mentions: 0 }));
    });

    socket.on('profile:update', (p) => {
      const patch = (u) => (String(u.id) === String(p.user_id) ? { ...u, name: p.name, avatar_url: p.avatar_url } : u);
      setBoot((b) => (b ? { ...b, me: patch(b.me), users: (b.users || []).map(patch) } : b));
    });

    socket.on('scheduled:sent', ({ id, error }) => {
      setScheduled((s) => s.filter((x) => x.id !== id));
      if (error) alert('Mensagem agendada não enviada: ' + error);
    });

    socket.on('tarefa:update', () => setTasksVersion((v) => v + 1));

    // voltar/avançar do navegador
    const onPop = () => {
      const b = bootRef.current;
      if (!b) return;
      const t = parseConvPath(location.pathname, b);
      if (t && t.id != null) openConv(t.type, t.id, { noHistory: true });
      else {
        setActive(null);
        setThread(null);
        setMessages([]);
      }
    };
    window.addEventListener('popstate', onPop);

    return () => {
      disposed = true;
      clearInterval(typingPrune);
      window.removeEventListener('popstate', onPop);
      socket.disconnect();
    };
  }, []);

  // título da aba = total de não-lidas
  useEffect(() => {
    if (!boot) return;
    const total =
      (boot.channels || []).reduce((a, c) => a + (c.unread || 0), 0) +
      (boot.dms || []).reduce((a, c) => a + (c.unread || 0), 0) +
      (boot.obras_visiveis || []).reduce((a, c) => a + (c.unread || 0), 0);
    document.title = (total > 0 ? `(${total}) ` : '') + 'Parket Chat';
  }, [boot]);

  // marcar lida ao focar a janela com conversa aberta
  useEffect(() => {
    const onFocus = () => {
      const act = activeRef.current;
      if (act && messages.length) markRead(act.type, act.id, messages[messages.length - 1].id);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [messages, markRead]);

  // ----- envio -----
  const send = (text, file) => {
    const act = activeRef.current;
    if (!act || !socketRef.current) return;
    const rt = replyToRef.current;
    socketRef.current.emit(
      'message:send',
      { convType: act.type, convId: act.id, content: text, file, replyToId: rt ? rt.id : null },
      (res) => { if (res && res.error) alert(res.error); }
    );
    if (rt) setReplyTo(null);
  };
  // Clique no bloco citado: rola até a mensagem original (se ainda na lista)
  const jumpToQuote = useCallback((q) => {
    const el = document.getElementById('m' + q.id);
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.classList.add('hl');
    setTimeout(() => el.classList.remove('hl'), 2600);
  }, []);
  const sendReply = (text, file) => {
    const th = threadRef.current;
    if (!th || !socketRef.current) return;
    socketRef.current.emit(
      'message:send',
      { convType: th.convType, convId: th.convId, content: text, file, parentId: th.root.id },
      (res) => { if (res && res.error) alert(res.error); }
    );
  };
  const react = (msg, emoji) => {
    if (socketRef.current) socketRef.current.emit('reaction:toggle', { messageId: msg.id, emoji });
  };
  const editMsg = (msg, content) => {
    if (socketRef.current) socketRef.current.emit('message:edit', { messageId: msg.id, content }, (res) => {
      if (res && res.error) alert(res.error);
    });
  };
  const delMsg = (msg) => {
    if (!window.confirm('Excluir esta mensagem?')) return;
    if (socketRef.current) socketRef.current.emit('message:delete', { messageId: msg.id }, (res) => {
      if (res && res.error) alert(res.error);
    });
  };
  const pinMsg = (msg, hours) => {
    if (socketRef.current) socketRef.current.emit('pin:toggle', { messageId: msg.id, hours: hours || 0 }, (res) => {
      if (res && res.error) alert(res.error);
    });
  };
  const saveMsg = async (msg) => {
    try {
      const r = await api.saveToggle(msg.id);
      setSavedIds((s) => {
        const n = new Set(s);
        if (r.saved) n.add(msg.id); else n.delete(msg.id);
        return n;
      });
    } catch (e) {
      alert(e.message);
    }
  };
  const scheduleMsg = async (text, file, sendAt) => {
    const act = activeRef.current;
    if (!act) return;
    try {
      const row = await api.scheduleMessage({ convType: act.type, convId: act.id, content: text, file, sendAt });
      setScheduled((s) => [...s, row].sort((a, b) => a.send_at.localeCompare(b.send_at)));
    } catch (e) {
      alert('Falha ao agendar: ' + e.message);
    }
  };
  const cancelSched = async (id) => {
    try {
      await api.cancelScheduled(id);
      setScheduled((s) => s.filter((x) => x.id !== id));
    } catch (e) {
      alert(e.message);
    }
  };
  const openTasks = (msg) => {
    setTaskPrefill(msg ? { title: String(msg.content || '').slice(0, 140), sourceMsgId: msg.id } : null);
    setModal('tasks');
  };

  // "digitando…" — avisa a room no máximo a cada 2s
  const lastTypingSent = useRef(0);
  const sendTyping = useCallback((convType, convId) => {
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    if (socketRef.current) socketRef.current.emit('typing', { convType, convId });
  }, []);

  const typingLabel = (convType, convId) => {
    const users = typers[convType + ':' + convId] || {};
    const now = Date.now();
    const names = Object.entries(users)
      .filter(([, exp]) => exp > now)
      .map(([uid]) => (usersById.get(uid) || { name: 'Alguém' }).name);
    if (!names.length) return null;
    if (names.length === 1) return names[0] + ' está digitando…';
    if (names.length === 2) return names.join(' e ') + ' estão digitando…';
    return names.length + ' pessoas estão digitando…';
  };

  // ----- push -----
  const pushRegister = async () => {
    const { key } = await api.pushKey();
    if (!key) throw new Error('Push não configurado no servidor');
    const reg = await navigator.serviceWorker.ready;
    const b64 = key.replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob(b64 + pad);
    const appKey = new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
    await api.pushSubscribe(sub.toJSON());
    setPushOn(true);
  };

  const enablePush = async () => {
    try {
      if (!('serviceWorker' in navigator) || typeof Notification === 'undefined') return alert('Navegador sem suporte a notificações');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
      await pushRegister();
    } catch (e) {
      alert('Falha ao ativar notificações: ' + e.message);
    }
  };

  // Notificação local pelo SW — testa a exibição sem depender do push do Google.
  const testNotification = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('Teste local — Parket Chat', {
        body: 'Se você está vendo isso, a exibição de notificações funciona neste computador.',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
      });
    } catch (e) {
      alert('Falha no teste de notificação: ' + e.message);
    }
  };

  // Permissão já concedida mas subscription pode não existir no servidor
  // (permissão dada sem o POST completar, ou banco resetado) — re-registra no load.
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!('serviceWorker' in navigator)) return;
    pushRegister().catch(() => {});
  }, []);

  // ----- render -----
  if (bootErr) {
    return (
      <div className="ck-login">
        <div className="ck-login-card">
          <div className="ck-login-title">Parket <span>Chat</span></div>
          <div className="ck-login-error">{bootErr}</div>
          <button onClick={() => location.reload()}>Tentar de novo</button>
        </div>
      </div>
    );
  }
  if (!boot) {
    return <div className="ck-login"><div className="ck-login-title">Parket <span>Chat</span></div><div className="ck-login-sub">Carregando…</div></div>;
  }

  const me = boot.me;
  const filt = sideQ.trim().toLowerCase();
  const match = (s) => !filt || String(s || '').toLowerCase().includes(filt);
  const channels = (boot.channels || []).filter((c) => match(c.name));
  const dms = (boot.dms || []).filter((d) => match((usersById.get(d.other_user_id) || {}).name));
  const obras = (boot.obras_visiveis || []).filter((o) => match(o.nome) || match(o.cliente) || (o.tags || []).some((t) => match(t)));
  const sugeridas = (boot.obras_sugeridas || []).filter((o) => match(o.nome) || match(o.cliente));
  // pessoas sem DM ainda (aparecem quando filtradas na busca lateral)
  const dmUserIds = new Set((boot.dms || []).map((d) => d.other_user_id));
  const pessoas = filt
    ? (boot.users || []).filter((u) => u.id !== me.id && !dmUserIds.has(u.id) && match(u.name))
    : [];

  const headTitle = active ? convName(active.type, active.id) : null;
  const headTags = active && active.type === 'obra'
    ? (((boot.obras_visiveis || []).find((x) => x.thread_id === active.id) || {}).tags || [])
    : [];
  const headSub = (() => {
    if (!active) return '';
    if (active.type === 'channel') {
      const ch = (boot.channels || []).find((c) => c.id === active.id);
      const s = ch && ch.sector_id != null ? sectorsById.get(String(ch.sector_id)) : null;
      return s ? 'Canal do setor ' + s.name : 'Canal geral';
    }
    if (active.type === 'dm') {
      const dm = (boot.dms || []).find((d) => d.id === active.id);
      const u = dm && usersById.get(dm.other_user_id);
      return u ? (online.has(u.id) ? 'online' : 'offline') + ' · ' + u.email : '';
    }
    const o = (boot.obras_visiveis || []).find((x) => x.thread_id === active.id);
    return o && o.cliente ? o.cliente : 'Conversa da obra';
  })();

  return (
    <div className="ck-app">
      {sideOpen && <div className="ck-sidebg" onClick={() => setSideOpen(false)} />}
      <div className={'ck-side' + (sideOpen ? ' open' : '')}>
        <div className="ck-side-head">
          <div className="ck-brandava">P</div>
          <div className="ck-logo">
            <div className="ck-brand">PARKET</div>
            <div className="ck-brandsub">CHAT INTERNO</div>
          </div>
          <button className="ck-iconbtn" title="Buscar mensagens" onClick={() => setModal('search')}><IcoSearch /></button>
        </div>
        <div className="ck-side-search">
          <input placeholder="Filtrar conversas…" value={sideQ} onChange={(e) => setSideQ(e.target.value)} />
        </div>
        <div className="ck-side-body">
          <div className="ck-sec">Canais</div>
          {channels.map((ch) => (
            <button
              key={ch.id}
              className={'ck-item' + (active && active.type === 'channel' && active.id === ch.id ? ' on' : '') + (ch.unread ? ' unread' : '')}
              onClick={() => openConv('channel', ch.id)}
            >
              <span className="ck-hash">#</span>
              <span className="ck-name">{ch.name}</span>
              {ch.mentions > 0 && <span className="ck-badge">@{ch.mentions}</span>}
              {!ch.mentions && ch.unread > 0 && <span className="ck-badge">{ch.unread}</span>}
            </button>
          ))}

          <div className="ck-sec">Mensagens diretas
            <button className="ck-plus" title="Nova conversa" onClick={() => setModal('dm')}><IcoPlus size={14} /></button>
          </div>
          {dms.map((dm) => {
            const u = usersById.get(dm.other_user_id) || { name: 'Usuário' };
            return (
              <button
                key={dm.id}
                className={'ck-item' + (active && active.type === 'dm' && active.id === dm.id ? ' on' : '') + (dm.unread ? ' unread' : '')}
                onClick={() => openConv('dm', dm.id)}
              >
                <span className={'ck-dot' + (online.has(u.id) ? ' on' : '')} />
                <span className="ck-name">{u.name}</span>
                {dm.unread > 0 && <span className="ck-badge">{dm.unread}</span>}
              </button>
            );
          })}
          {pessoas.map((u) => (
            <button key={'p' + u.id} className="ck-item" onClick={async () => {
              const dm = await api.criarDm(u.id);
              setBoot((b) => (b.dms.some((d) => d.id === dm.id) ? b : { ...b, dms: [...b.dms, { ...dm, unread: 0, mentions: 0 }] }));
              openConv('dm', dm.id);
            }}>
              <Avatar user={u} />
              <span className="ck-name">{u.name}</span>
            </button>
          ))}

          <div className="ck-sec">
            <button className="ck-secbtn" title={obrasOpen ? 'Recolher obras' : 'Mostrar obras'} onClick={toggleObras}>
              <span className={'ck-caret' + (obrasOpen ? ' open' : '')}><IcoChevL size={11} /></span>
              Obras{!obrasOpen && obras.length + sugeridas.length > 0 ? ` (${obras.length + sugeridas.length})` : ''}
            </button>
            <button className="ck-plus" title="Abrir conversa de obra" onClick={() => { setObraResults([]); setModal('obra'); }}><IcoPlus size={14} /></button>
          </div>
          {(obrasOpen
            ? obras
            : obras.filter((o) => o.unread > 0 || o.mentions > 0 || (active && active.type === 'obra' && active.id === o.thread_id))
          ).map((o) => (
            <button
              key={o.thread_id}
              className={'ck-item' + (active && active.type === 'obra' && active.id === o.thread_id ? ' on' : '') + (o.unread ? ' unread' : '')}
              onClick={() => openConv('obra', o.thread_id)}
            >
              <span className="ck-hash"><IcoHome size={13} /></span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="ck-name" style={{ display: 'block' }}>{o.nome}</span>
                {o.cliente && <span className="ck-sub">{o.cliente}</span>}
                {(o.tags || []).length > 0 && (
                  <span className="ck-tagrow sm">{o.tags.slice(0, 2).map((t) => <TagChip key={t} tag={t} small />)}</span>
                )}
              </span>
              {o.mentions > 0 && <span className="ck-badge">@{o.mentions}</span>}
              {!o.mentions && o.unread > 0 && <span className="ck-badge">{o.unread}</span>}
            </button>
          ))}
          {(obrasOpen ? sugeridas : []).map((o) => (
            <button key={'s' + o.id} className="ck-item" style={{ opacity: .75 }} onClick={async () => {
              const t = await api.abrirObra(o.id);
              openConv('obra', t.thread_id);
            }}>
              <span className="ck-hash"><IcoMapPin size={13} /></span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="ck-name" style={{ display: 'block' }}>{o.nome}</span>
                {o.cliente && <span className="ck-sub">{o.cliente}</span>}
              </span>
            </button>
          ))}
        </div>
        <div className="ck-me">
          <button className="ck-mebtn" title="Editar perfil" onClick={() => setModal('profile')}>
            <Avatar user={me} />
            <span className="ck-name">{me.name}</span>
          </button>
          <button className="ck-iconbtn" title={soundOn ? 'Silenciar som de mensagem' : 'Ativar som de mensagem'} onClick={toggleSound}>
            {soundOn ? <IcoVol size={14} /> : <IcoVolX size={14} />}
          </button>
          <button className="ck-iconbtn" title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'} onClick={onToggleTheme}>
            {theme === 'dark' ? <IcoSun size={14} /> : <IcoMoon size={14} />}
          </button>
          <button onClick={onLogout}>Sair</button>
        </div>
      </div>

      <div className="ck-main">
        <div className="ck-head">
          <button className="ck-iconbtn ck-burger" onClick={() => setSideOpen(true)}><IcoMenu size={18} /></button>
          {active ? (
            active.type === 'obra' ? (
              <button className="ck-grow ck-headclick" title="Geral da obra" onClick={() => setModal('obrainfo')}>
                <div className="ck-head-title">
                  {headTitle}
                  {headTags.map((t) => <TagChip key={t} tag={t} small />)}
                </div>
                <div className="ck-head-sub">{headSub}</div>
              </button>
            ) : (
              <div className="ck-grow">
                <div className="ck-head-title">{headTitle}</div>
                <div className="ck-head-sub">{headSub}</div>
              </div>
            )
          ) : (
            <div className="ck-grow"><div className="ck-head-title">Parket Chat</div></div>
          )}
          {active && active.type === 'obra' && (
            <button className="ck-iconbtn" title="Geral da obra — descrição, membros e mídia" onClick={() => setModal('obrainfo')}><IcoInfo /></button>
          )}
          {active && active.type === 'obra' && (
            <button className="ck-iconbtn" title="Tarefas da obra" onClick={() => openTasks(null)}><IcoCheckSq /></button>
          )}
          <button className="ck-iconbtn" title="Mensagens salvas" onClick={() => setModal('saved')}><IcoStar /></button>
          {active && (
            <button
              className={'ck-iconbtn' + (tecaOpen ? ' on' : '')}
              title="Teca — pergunte sobre a conversa"
              onClick={() => { setThread(null); setTecaOpen((v) => !v); }}
            ><IcoSpark /></button>
          )}
          {active && (
            <button className="ck-iconbtn" title="Mensagens fixadas" onClick={() => setModal('pins')}><IcoPin /></button>
          )}
          <button className="ck-iconbtn" title="Buscar mensagens" onClick={() => setModal('search')}><IcoSearch /></button>
          <button
            className={'ck-iconbtn' + (pushOn ? ' on' : '')}
            title={pushOn ? 'Notificações ativas — clique pra testar' : 'Ativar notificações'}
            onClick={pushOn ? testNotification : enablePush}
          ><IcoBell /></button>
        </div>

        {pushBanner && (
          <div className="ck-pushbanner">
            <IcoBell size={14} />
            <span>Ative as notificações pra receber menções e mensagens mesmo com o chat fechado.</span>
            <button className="ck-pushbanner-cta" onClick={async () => { await enablePush(); setPushBanner(false); }}>Ativar</button>
            <button className="ck-iconbtn" title="Dispensar" onClick={() => { localStorage.setItem('parket_chat_push_banner_off', '1'); setPushBanner(false); }}><IcoX size={12} /></button>
          </div>
        )}

        {active ? (
          <>
            <MessageList
              listRef={listRef} messages={messages} me={me} usersById={usersById}
              mentionNames={mentionNames} mentionTargets={mentionTargets} onReact={react} onOpenThread={openThread}
              onEdit={editMsg} onDelete={delMsg} onPin={pinMsg} onSave={saveMsg} savedIds={savedIds}
              onCopyLink={copyMsgLink}
              onTask={active.type === 'obra' ? openTasks : null}
              onReply={setReplyTo} onQuote={jumpToQuote}
            />
            {typingLabel(active.type, active.id) && (
              <div className="ck-typing">{typingLabel(active.type, active.id)}</div>
            )}
            <Composer
              placeholder={'Mensagem para ' + headTitle} boot={boot} mentionTargets={mentionTargets} api={api} onSend={send}
              onTyping={() => sendTyping(active.type, active.id)}
              onSchedule={scheduleMsg}
              scheduled={scheduled.filter((s) => s.conv_type === active.type && s.conv_id === active.id)}
              onCancelScheduled={cancelSched}
              replyTo={replyTo} onCancelReply={() => setReplyTo(null)} usersById={usersById}
            />
          </>
        ) : (
          <div className="ck-empty">
            <div className="big"><IcoThread size={44} /></div>
            <div style={{ fontWeight: 700, color: 'var(--ink)' }}>Bem-vindo ao Parket Chat</div>
            <div style={{ fontSize: 13 }}>Escolha um canal, pessoa ou obra na barra lateral</div>
          </div>
        )}
      </div>

      {thread && (
        <div className="ck-thread">
          <div className="ck-head">
            <div className="ck-grow">
              <div className="ck-head-title">Thread</div>
              <div className="ck-head-sub">{convName(thread.convType, thread.convId)}</div>
            </div>
            <button className="ck-iconbtn" onClick={() => setThread(null)}><IcoX /></button>
          </div>
          <div className="ck-thread-root">
            <Message
              msg={thread.root} prev={null} me={me} usersById={usersById} mentionNames={mentionNames}
              mentionTargets={mentionTargets} onReact={react} onOpenThread={() => {}} onEdit={editMsg} onDelete={delMsg} onPin={pinMsg}
              onSave={saveMsg} savedIds={savedIds} inThread
            />
          </div>
          <MessageList
            listRef={threadListRef} messages={thread.replies} me={me} usersById={usersById}
            mentionNames={mentionNames} mentionTargets={mentionTargets} onReact={react} onOpenThread={() => {}}
            onEdit={editMsg} onDelete={delMsg} onPin={pinMsg} onSave={saveMsg} savedIds={savedIds} inThread
          />
          {typingLabel(thread.convType, thread.convId) && (
            <div className="ck-typing">{typingLabel(thread.convType, thread.convId)}</div>
          )}
          <Composer
            placeholder="Responder na thread…" boot={boot} mentionTargets={mentionTargets} api={api} onSend={sendReply}
            onTyping={() => sendTyping(thread.convType, thread.convId)}
          />
        </div>
      )}

      {tecaOpen && active && !thread && (
        <TecaPanel api={api} active={active} convName={convName} onClose={() => setTecaOpen(false)} />
      )}

      {modal === 'dm' && (
        <NewDmModal
          boot={boot} online={online}
          onPick={async (u) => {
            setModal(null);
            const dm = await api.criarDm(u.id);
            setBoot((b) => (b.dms.some((d) => d.id === dm.id) ? b : { ...b, dms: [...b.dms, { ...dm, unread: 0, mentions: 0 }] }));
            openConv('dm', dm.id);
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'saved' && (
        <SavedModal
          api={api} usersById={usersById} mentionNames={mentionNames} convName={convName}
          onOpen={(p) => { setModal(null); openConv(p.conv_type, p.conv_id, { msgId: p.parent_id || p.id }); }}
          onUnsave={saveMsg}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'obrainfo' && active && active.type === 'obra' && (
        <ObraInfoModal
          api={api} threadId={active.id} boot={boot} usersById={usersById} sectorsById={sectorsById}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'obra' && (
        <PickerModal
          title="Abrir obra" placeholder="Buscar obra ou cliente…"
          onQuery={(q) => { api.buscarObras(q).then(setObraResults).catch(() => setObraResults([])); }}
          items={() => obraResults.map((o) => ({ key: o.id, o }))}
          renderItem={(it) => (
            <>
              <span className="ck-hash"><IcoHome size={13} /></span>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 700, display: 'block' }}>{it.o.nome}</span>
                {it.o.cliente && <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{it.o.cliente}</span>}
              </span>
            </>
          )}
          onPick={async (it) => {
            setModal(null);
            try {
              const t = await api.abrirObra(it.o.id);
              openConv('obra', t.thread_id);
            } catch (e) {
              alert(e.message);
            }
          }}
          onClose={() => setModal(null)}
          empty="Digite pra buscar as obras do sistema"
        />
      )}

      {modal === 'profile' && (
        <ProfileModal api={api} me={me} onClose={() => setModal(null)} />
      )}

      {modal === 'tasks' && active && active.type === 'obra' && (
        <TasksModal
          api={api} threadId={active.id} boot={boot} usersById={usersById}
          prefill={taskPrefill} version={tasksVersion}
          onClose={() => { setModal(null); setTaskPrefill(null); }}
        />
      )}

      {modal === 'pins' && active && (
        <PinsModal
          api={api} active={active} usersById={usersById} mentionNames={mentionNames}
          onUnpin={pinMsg} onClose={() => setModal(null)}
        />
      )}

      {modal === 'search' && (
        <SearchModal
          api={api} usersById={usersById} convName={convName}
          onOpen={async (hit) => {
            setModal(null);
            openConv(hit.conv_type, hit.conv_id);
            if (hit.parent_id != null) {
              const parent = { id: hit.parent_id };
              setTimeout(() => openThread(parent), 300);
            }
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root: gestão de token + registro do service worker
// ---------------------------------------------------------------------------

function Root() {
  const badTokens = useRef(new Set());
  const [theme, setTheme] = useState(() => (localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'));
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = theme === 'light' ? '#efece6' : '#050505';
  }, [theme]);
  const [token, setToken] = useState(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (tokenAlive(saved)) return saved;
    localStorage.removeItem(TOKEN_KEY);
    return readSupabaseToken(badTokens.current);
  });

  const login = (t, refresh) => {
    localStorage.setItem(TOKEN_KEY, t);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    setToken(t);
  };
  const logout = () => {
    if (token) badTokens.current.add(token);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setToken(readSupabaseToken(badTokens.current));
  };
  const authFail = async () => {
    const t = await gotrueRefresh();
    if (t) setToken(t);
    else logout();
  };

  useEffect(() => {
    if (!token && localStorage.getItem(REFRESH_KEY)) {
      gotrueRefresh().then((t) => t && setToken(t));
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  if (!token) return <LoginView onLogin={login} />;
  return <App key={token} token={token} onLogout={logout} onAuthFail={authFail} theme={theme} onToggleTheme={toggleTheme} />;
}

createRoot(document.getElementById('root')).render(<Root />);
