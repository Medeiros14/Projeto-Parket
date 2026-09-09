import { io } from 'socket.io-client';
const BASE = 'http://127.0.0.1:3999';
const j = (r) => r.json();
const login = async (email) => (await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'parket123' }) }).then(j)).token;
const api = (t) => (p, o = {}) => fetch(BASE + p, { ...o, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t, ...(o.headers || {}) } }).then(j);

const tAna = await login('ana@parket.com.br');
const tWill = await login('will@parket.com.br');
const A = api(tAna), W = api(tWill);

const boot = await A('/api/bootstrap');
console.log('bootstrap: canais=' + boot.channels.length, 'users=' + boot.users.length);
const geral = boot.channels.find((c) => c.name === 'geral');

const sock = io(BASE, { auth: { token: tAna }, transports: ['websocket'] });
const emit = (ev, p) => new Promise((res) => sock.emit(ev, p, res));
await new Promise((res) => sock.on('connect', res));

const m1 = await emit('message:send', { convType: 'channel', convId: geral.id, content: 'Orçamento do cumaru chevron pronto @Will' });
console.log('msg raiz:', m1.ok, 'id=' + m1.message.id, 'mentions=' + JSON.stringify(m1.message.mentions));

const m2 = await emit('message:send', { convType: 'channel', convId: geral.id, content: 'resposta dentro da thread', parentId: m1.message.id });
console.log('reply:', m2.ok, 'parent=' + m2.message.parent_id);

const bad = await emit('message:send', { convType: 'channel', convId: geral.id, content: 'reply de reply', parentId: m2.message.id });
console.log('reply-de-reply bloqueado:', bad.error === 'thread inválida');

const r1 = await emit('reaction:toggle', { messageId: m1.message.id, emoji: '👍' });
console.log('reaction add:', r1.ok, r1.added === true);

const th = await A('/api/thread/' + m1.message.id);
console.log('thread GET: replies=' + th.replies.length, 'root reply_count=' + th.root.reply_count, 'root reactions=' + JSON.stringify(th.root.reactions));

const msgs = await A('/api/messages?channel=' + geral.id);
const root = msgs.find((m) => m.id === m1.message.id);
console.log('main list: replies escondidas=' + !msgs.some((m) => m.id === m2.message.id), 'reply_count=' + root.reply_count, 'reactions=' + JSON.stringify(root.reactions));

const hits = await W('/api/search?q=cumaru');
console.log('search will: hits=' + hits.length, 'snippet=' + JSON.stringify(hits[0] && hits[0].snippet));

const key = await A('/api/push/key');
console.log('push key endpoint:', 'key' in key);
const subRes = await A('/api/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription: { endpoint: 'https://example.com/ep1', keys: {} } }) });
console.log('push subscribe:', subRes.ok);

sock.disconnect();
process.exit(0);
