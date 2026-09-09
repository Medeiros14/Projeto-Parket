"""
Sync the 'Claude OAuth Backup' row in ai_accounts with the fresh token
sitting in /root/.claude/.credentials.json, so EAS can serve valor.parket.works again.
"""
import os, json, time, sys
from sqlalchemy import create_engine, text
import psycopg2  # noqa

# Read creds
with open("/root/.claude/.credentials.json") as f:
    cj = json.load(f)
oauth = cj["claudeAiOauth"]
access = oauth["accessToken"]
refresh = oauth["refreshToken"]
expires_at_ms = int(oauth["expiresAt"])
now_ms = int(time.time() * 1000)
expires_in = max(60, (expires_at_ms - now_ms) // 1000)

print(f"[creds] access_token={access[:20]}… len={len(access)}")
print(f"[creds] refresh_token={refresh[:20]}… len={len(refresh)}")
print(f"[creds] expires_in_sec={expires_in}  (~{expires_in/3600:.1f}h)")

# DB
DB_URL = f"postgresql://{os.environ['POSTGRES_USER']}:{os.environ['POSTGRES_PASSWORD']}@{os.environ['POSTGRES_HOST']}:{os.environ.get('POSTGRES_PORT','5432')}/{os.environ['POSTGRES_DB']}"
e = create_engine(DB_URL)
with e.begin() as c:
    row = c.execute(text("""
        SELECT id::text, label, is_active, is_healthy, consecutive_errors
        FROM ai_accounts
        WHERE label = 'Claude OAuth Backup' AND provider='claude'
        LIMIT 1
    """)).mappings().first()
    if not row:
        print("[db] Claude OAuth Backup NOT FOUND"); sys.exit(1)
    print(f"[db] before: {dict(row)}")

    c.execute(text("""
        UPDATE ai_accounts
        SET session_token = :tok,
            extra = jsonb_build_object(
                'auth_type','oauth',
                'opencode_id','anthropic',
                'refresh_token', :ref,
                'expires_in', :exp
            )::json,
            updated_at = now(),
            last_used = now(),
            consecutive_errors = 0,
            is_active = TRUE,
            is_healthy = TRUE,
            last_error = NULL
        WHERE id = (:id)::uuid
    """), {"tok": access, "ref": refresh, "exp": expires_in, "id": row["id"]})

    row2 = c.execute(text("""
        SELECT id::text, label, is_active, is_healthy, consecutive_errors,
               LEFT(session_token, 25) AS token_preview,
               extra->>'expires_in' AS expires_in
        FROM ai_accounts WHERE id = (:id)::uuid
    """), {"id": row["id"]}).mappings().first()
    print(f"[db] after: {dict(row2)}")
print("[ok] sync complete")
