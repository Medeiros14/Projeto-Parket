"""Config lida do env — sem framework, sem magia."""
import os

# Postgres — mesma tabela ai_accounts que o EAS usa (parket-ai-squad_postgres).
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@parket-ai-squad_postgres:5432/postgres",
)

# Supabase Valoria — pra tools que leem/editam catálogo e teca.aprendizados.
# (a Teca não escreve direto; passa por REST.)
VALORIA_SUPABASE_URL = os.environ.get("VALORIA_SUPABASE_URL", "")
VALORIA_SUPABASE_KEY = os.environ.get("VALORIA_SUPABASE_KEY", "")

# Supabase Parket (gateway local) — pra log_atividade.
PARKET_API_URL = os.environ.get("PARKET_API_URL", "https://api.parket.works")
PARKET_ANON_KEY = os.environ.get("PARKET_ANON_KEY", "")

# Modelo Anthropic. Trocar aqui + docker service update sem rebuild se quiser.
MODEL_ID = os.environ.get("MODEL_ID", "claude-opus-4-7")
MAX_TOKENS = int(os.environ.get("MAX_TOKENS", "32000"))
REQUEST_TIMEOUT = float(os.environ.get("REQUEST_TIMEOUT", "3600"))

# Prompt file.
PROMPT_PATH = os.environ.get("PROMPT_PATH", "/app/prompt/valoria_teca.md")

# Session history: quantas runs anteriores manda pro Claude a cada request.
NUM_HISTORY_RUNS = int(os.environ.get("NUM_HISTORY_RUNS", "8"))

# Basic auth simples (compat com o gateway do EAS).
BASIC_USER = os.environ.get("BASIC_USER", "")
BASIC_PASS = os.environ.get("BASIC_PASS", "")
