/**
 * Teca — copiloto de IA do chat. Chama a API Anthropic reusando as contas
 * OAuth do parket-ai-squad (tabela public.ai_accounts), mesmo padrão do
 * "Teca Copiloto" do gestao_api.
 */
const { Pool } = require('pg');

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929';
const UA = 'claude-cli/2.1.81 (external, cli)';

let aiPool = null;
function pool() {
  if (!aiPool && process.env.AI_ACCOUNTS_DSN) {
    aiPool = new Pool({ connectionString: process.env.AI_ACCOUNTS_DSN, max: 2 });
  }
  return aiPool;
}

// cache do token em memória (60s) — evita bater no banco a cada pergunta
let cached = { token: null, until: 0 };

async function getToken(force = false) {
  if (!force && cached.token && Date.now() < cached.until) return cached.token;
  const p = pool();
  if (p) {
    try {
      const token = await tokenFromDb(p, force);
      if (token) {
        cached = { token, until: Date.now() + 60000 };
        return token;
      }
    } catch (e) {
      console.error('[teca] ai_accounts indisponível:', e.message);
    }
  }
  const envTok = process.env.ANTHROPIC_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY || null;
  if (envTok) return envTok;
  throw new Error('nenhuma credencial Anthropic disponível');
}

async function tokenFromDb(p, force = false) {
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    // FOR UPDATE: refresh_token é single-use — corrida com o EAS queima a chain
    const { rows } = await client.query(
      `SELECT id, session_token, extra, updated_at
         FROM ai_accounts
        WHERE provider = 'claude' AND is_active AND is_healthy
          AND extra->>'auth_type' = 'oauth'
        ORDER BY last_used DESC NULLS LAST
        LIMIT 1
        FOR UPDATE`
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return null;
    }
    const acc = rows[0];
    const extra = typeof acc.extra === 'string' ? JSON.parse(acc.extra) : (acc.extra || {});
    const expiresIn = Number(extra.expires_in || 0);
    const expiresAt = new Date(acc.updated_at).getTime() + expiresIn * 1000;
    let token = acc.session_token;

    if (extra.refresh_token && (force || (expiresIn && expiresAt - Date.now() < 300000))) {
      const r = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'claude-cli/2.1.81' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: extra.refresh_token,
          client_id: CLIENT_ID,
        }),
      });
      if (r.ok) {
        const d = await r.json();
        token = d.access_token;
        const newExtra = {
          ...extra,
          refresh_token: d.refresh_token || extra.refresh_token,
          expires_in: d.expires_in || 28800,
        };
        await client.query(
          `UPDATE ai_accounts
              SET session_token = $1, extra = $2::json, updated_at = NOW(), last_used = NOW()
            WHERE id = $3`,
          [d.access_token, JSON.stringify(newExtra), acc.id]
        );
      } else {
        console.error('[teca] refresh OAuth falhou:', r.status, (await r.text()).slice(0, 200));
      }
    } else {
      await client.query('UPDATE ai_accounts SET last_used = NOW() WHERE id = $1', [acc.id]);
    }
    await client.query('COMMIT');
    return token;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function askClaude(systemPrompt, userText, maxTokens = 1024) {
  if (process.env.TECA_MOCK) return 'Resposta mock da Teca para teste E2E.';
  try {
    return await callAnthropic(await getToken(), systemPrompt, userText, maxTokens);
  } catch (e) {
    // updated_at do ai_accounts não é confiável pra expiry — 401 força refresh e tenta 1x
    if (!/Anthropic 401/.test(e.message)) throw e;
    return await callAnthropic(await getToken(true), systemPrompt, userText, maxTokens);
  }
}

async function callAnthropic(token, systemPrompt, userText, maxTokens) {
  const oauth = token.startsWith('sk-ant-oat');
  const headers = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  let system;
  if (oauth) {
    headers.authorization = 'Bearer ' + token;
    headers['anthropic-beta'] = 'claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14';
    headers['x-app'] = 'cli';
    headers['user-agent'] = UA;
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
    system = [
      { type: 'text', text: 'x-anthropic-billing-header: cc_version=2.1.81; cc_entrypoint=api; cch=00000;' },
      { type: 'text', text: systemPrompt },
    ];
  } else {
    headers['x-api-key'] = token;
    system = systemPrompt;
  }
  const r = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userText }],
    }),
  });
  if (!r.ok) {
    const body = (await r.text()).slice(0, 300);
    if (r.status === 401) cached = { token: null, until: 0 };
    throw new Error('Anthropic ' + r.status + ': ' + body);
  }
  const d = await r.json();
  return (d.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

module.exports = { askClaude };
