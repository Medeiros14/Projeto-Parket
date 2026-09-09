// Servidor de auth de emergência — usado quando o GoTrue do Supabase tá fora.
// Valida email/senha direto na tabela auth.users (mesma fonte do Supabase)
// e gera um JWT assinado com o mesmo JWT_SECRET — o PostgREST aceita.

import Fastify from "fastify";
import cors from "@fastify/cors";
import staticPlugin from "@fastify/static";
import pkg from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || "8989", 10);
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "hbxpilrxmitvzebluoom";
const DATABASE_URL = process.env.DATABASE_URL;

if (!JWT_SECRET) {
  console.error("FATAL: SUPABASE_JWT_SECRET não definido");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("FATAL: DATABASE_URL não definido");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false },
});

const app = Fastify({ logger: { level: "info" } });
await app.register(cors, {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
});
await app.register(staticPlugin, {
  root: path.join(__dirname, "public"),
  prefix: "/",
});

// Health
app.get("/health", async () => ({ ok: true, ts: Date.now() }));

// Login de emergência
app.post("/api/emergency-login", async (req, reply) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return reply.code(400).send({ error: "email e password obrigatórios" });
  }

  try {
    // Busca usuário direto na auth.users (tabela do Supabase Auth)
    const r = await pool.query(
      `SELECT id, email, encrypted_password, email_confirmed_at, banned_until, raw_user_meta_data, raw_app_meta_data
       FROM auth.users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email]
    );

    if (r.rows.length === 0) {
      return reply.code(401).send({ error: "Email ou senha inválidos" });
    }
    const user = r.rows[0];

    if (user.banned_until && new Date(user.banned_until) > new Date()) {
      return reply.code(403).send({ error: "Usuário banido" });
    }

    // Compara senha (bcrypt — mesmo formato do GoTrue)
    const ok = await bcrypt.compare(password, user.encrypted_password || "");
    if (!ok) {
      return reply.code(401).send({ error: "Email ou senha inválidos" });
    }

    // Gera JWT no MESMO formato do GoTrue pra PostgREST aceitar
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60 * 24 * 7; // 7 dias
    const payload = {
      aud: "authenticated",
      exp,
      iat: now,
      iss: `https://${SUPABASE_PROJECT_REF}.supabase.co/auth/v1`,
      sub: user.id,
      email: user.email,
      phone: "",
      app_metadata: user.raw_app_meta_data || { provider: "email", providers: ["email"] },
      user_metadata: user.raw_user_meta_data || {},
      role: "authenticated",
      aal: "aal1",
      amr: [{ method: "password", timestamp: now }],
      session_id: cryptoRandom(),
      is_anonymous: false,
    };

    const access_token = jwt.sign(payload, JWT_SECRET, { algorithm: "HS256" });
    const refresh_token = cryptoRandom(48);

    return {
      access_token,
      token_type: "bearer",
      expires_in: 60 * 60 * 24 * 7,
      expires_at: exp,
      refresh_token,
      user: {
        id: user.id,
        aud: "authenticated",
        role: "authenticated",
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
        phone: "",
        app_metadata: user.raw_app_meta_data || {},
        user_metadata: user.raw_user_meta_data || {},
        identities: [],
        created_at: user.created_at || new Date().toISOString(),
        updated_at: user.updated_at || new Date().toISOString(),
      },
    };
  } catch (e) {
    req.log.error(e, "emergency_login_error");
    return reply.code(500).send({ error: String(e?.message || e) });
  }
});

function cryptoRandom(len = 32) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`emergency-auth :${PORT}`);
} catch (e) {
  console.error(e);
  process.exit(1);
}
