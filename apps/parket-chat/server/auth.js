/**
 * Autenticação por JWT (SSO).
 * A plataforma do setor já autenticou o usuário e assina um JWT com o MESMO
 * JWT_SECRET deste serviço, contendo { id: <id do usuário no banco da Parket> }.
 * O chat confia nesse token. O login por e-mail/senha (rota /api/login) existe
 * SÓ para testes locais.
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const repository = require('./repository');

const JWT_SECRET = process.env.JWT_SECRET || 'parket-chat-dev-secret-trocar-em-producao';
if (!process.env.JWT_SECRET) {
  console.warn('[parket-chat] AVISO: JWT_SECRET não definido — usando segredo de desenvolvimento.');
}

// O Supabase Cloud da Parket assina access_tokens novos com ES256 (chave
// assimétrica); os antigos/locais são HS256 com o JWT_SECRET. Aceita os dois:
// HS256 valida com o segredo, ES256/RS256 valida com a chave pública do JWKS.
const JWKS_URL =
  process.env.SUPABASE_JWKS_URL || 'https://hbxpilrxmitvzebluoom.supabase.co/auth/v1/.well-known/jwks.json';
let jwksCache = { keys: [], at: 0 };
async function jwkByKid(kid) {
  const stale = Date.now() - jwksCache.at > 10 * 60 * 1000;
  if ((stale || !jwksCache.keys.some((k) => k.kid === kid)) && Date.now() - jwksCache.at > 30 * 1000) {
    try {
      const res = await fetch(JWKS_URL);
      jwksCache = { keys: (await res.json()).keys || [], at: Date.now() };
    } catch (e) {
      console.warn('[parket-chat] falha ao buscar JWKS:', e.message);
    }
  }
  return jwksCache.keys.find((k) => k.kid === kid) || null;
}

async function verifyToken(token) {
  const header = JSON.parse(Buffer.from(String(token).split('.')[0], 'base64').toString());
  if (!header.alg || header.alg === 'HS256') return jwt.verify(token, JWT_SECRET, { ignoreExpiration: false });
  const jwk = await jwkByKid(header.kid);
  if (!jwk) throw new Error(`kid ${header.kid} não encontrado no JWKS`);
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  return jwt.verify(token, key, { algorithms: ['ES256', 'RS256'], ignoreExpiration: false });
}

function signToken(user) {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
}

async function userFromToken(token) {
  // Aceita tanto o token próprio do chat ({ id }) quanto o access_token do
  // Supabase/GoTrue das plataformas ({ sub: uuid }).
  const payload = await verifyToken(token);
  const userId = payload.id || payload.sub;
  if (!userId) throw new Error('token sem id de usuário');
  const user = await repository.getUser(userId);
  if (!user) throw new Error('usuário do token não existe');
  return user;
}

/** Middleware Express: exige Authorization: Bearer <jwt>. */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'token ausente' });
    req.user = await userFromToken(token);
    next();
  } catch (e) {
    let sub = '?';
    try { sub = JSON.parse(Buffer.from((req.headers.authorization || '').slice(7).split('.')[1], 'base64').toString()).sub || '?'; } catch (e2) {}
    console.warn(`[parket-chat] 401 ${req.path} sub=${sub}: ${e.message}`);
    res.status(401).json({ error: 'token inválido' });
  }
}

/** Middleware Socket.io: JWT no handshake (auth.token). */
async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error('token ausente'));
    socket.data.user = await userFromToken(token);
    next();
  } catch (e) {
    next(new Error('token inválido'));
  }
}

module.exports = { signToken, userFromToken, requireAuth, socketAuth, JWT_SECRET };
