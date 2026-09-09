"""
AI Account Pool
================
Gerencia todas as contas de IA do banco.
Prioridade: OAuth via OpenCode → API key (fallback).
Rotação automática por token_count e failover por consecutive_errors.
"""

from typing import Optional, Any
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models.ai_account import AIAccount
from app.core.llm_client import build_client

logger = structlog.get_logger(__name__)

ROTATE_ON_ERRORS = 3


class AccountPool:

    # ── Seleção de contas ─────────────────────────────────────────────────────

    async def _get_accounts(
        self,
        db: AsyncSession,
        provider: Optional[str] = None,
        auth_type: Optional[str] = None,
    ) -> list[AIAccount]:
        q = select(AIAccount).where(AIAccount.is_active == True)
        if provider:
            q = q.where(AIAccount.provider == provider)
        result = await db.execute(q.order_by(AIAccount.token_count.asc(), AIAccount.last_used.asc()))
        accounts = list(result.scalars().all())
        if auth_type:
            accounts = [a for a in accounts if (a.extra or {}).get("auth_type", "api_key") == auth_type]
        return accounts

    async def _pick(
        self,
        db: AsyncSession,
        provider: Optional[str] = None,
        auth_type: Optional[str] = None,
    ) -> Optional[AIAccount]:
        accounts = await self._get_accounts(db, provider=provider, auth_type=auth_type)
        # Conta saudável abaixo do limite
        for acc in accounts:
            if acc.is_healthy and acc.token_count < acc.token_limit:
                return acc
        # Todas no limite — reseta a mais saudável e retorna
        for acc in accounts:
            if acc.is_healthy:
                await db.execute(
                    update(AIAccount).where(AIAccount.id == acc.id).values(token_count=0)
                )
                await db.commit()
                return acc
        return None

    # ── Chat (OAuth primeiro, API key como fallback) ──────────────────────────

    async def chat(
        self,
        db: AsyncSession,
        messages: list[dict],
        system_prompt: str = "",
        preferred_provider: Optional[str] = None,
    ) -> str:
        """
        Envia mensagem priorizando contas OAuth (via OpenCode).
        Se todas as OAuth falharem, tenta API key.
        """
        last_error = None

        # 1ª tentativa: OAuth
        for account in await self._get_accounts(db, provider=preferred_provider, auth_type="oauth"):
            if not account.is_healthy:
                continue
            result = await self._try_chat(db, account, messages, system_prompt)
            if result is not None:
                return result
            last_error = Exception(account.last_error or "OAuth falhou")

        # 2ª tentativa: API key (fallback)
        for account in await self._get_accounts(db, provider=preferred_provider, auth_type="api_key"):
            if not account.is_healthy:
                continue
            result = await self._try_chat(db, account, messages, system_prompt)
            if result is not None:
                return result
            last_error = Exception(account.last_error or "API key falhou")

        raise RuntimeError(f"Todas as contas de IA falharam. Último erro: {last_error}")

    async def _try_chat(
        self,
        db: AsyncSession,
        account: AIAccount,
        messages: list[dict],
        system_prompt: str,
    ) -> Optional[str]:
        """Tenta usar uma conta específica. Retorna resposta ou None se falhar."""
        try:
            client = build_client(account.provider, account.session_token, account.extra)
            response = await client.chat(messages, system_prompt=system_prompt)

            chars = sum(len(m.get("content", "")) for m in messages) + len(response)
            await db.execute(
                update(AIAccount).where(AIAccount.id == account.id).values(
                    token_count=AIAccount.token_count + (chars // 4),
                    last_used=__import__("datetime").datetime.utcnow(),
                    consecutive_errors=0,
                    is_healthy=True,
                    last_error=None,
                )
            )
            await db.commit()
            logger.info("account_pool_chat_ok", account_id=str(account.id), provider=account.provider,
                        auth_type=(account.extra or {}).get("auth_type", "api_key"))
            return response

        except Exception as e:
            error_str = str(e)
            logger.warning("account_pool_chat_error", account_id=str(account.id),
                           provider=account.provider, error=error_str)

            # Auto-refresh expired Claude OAuth tokens
            if (account.provider == "claude"
                and (account.extra or {}).get("auth_type") == "oauth"
                and ("authentication_error" in error_str or "401" in error_str)
                and (account.extra or {}).get("refresh_token")):
                refreshed = await self._refresh_claude_token(db, account)
                if refreshed:
                    # Retry once with new token
                    return await self._try_chat_inner(db, account, messages, system_prompt)

            # 529/overloaded é instabilidade da Anthropic, não problema da conta.
            # 3× 529 derrubava is_healthy de TODAS as contas → EAS bootava sem
            # auth e a Valoria devolvia 401 (incidente 10/07/2026).
            transient = "overloaded_error" in error_str or "Error code: 529" in error_str
            new_errors = (account.consecutive_errors or 0) + (0 if transient else 1)
            await db.execute(
                update(AIAccount).where(AIAccount.id == account.id).values(
                    consecutive_errors=new_errors,
                    is_healthy=(new_errors < ROTATE_ON_ERRORS),
                    last_error=error_str,
                )
            )
            await db.commit()
            return None

    async def _try_chat_inner(
        self, db: AsyncSession, account: AIAccount, messages: list[dict], system_prompt: str
    ) -> Optional[str]:
        """Inner retry after token refresh (no recursion)."""
        try:
            client = build_client(account.provider, account.session_token, account.extra)
            response = await client.chat(messages, system_prompt=system_prompt)
            chars = sum(len(m.get("content", "")) for m in messages) + len(response)
            await db.execute(
                update(AIAccount).where(AIAccount.id == account.id).values(
                    token_count=AIAccount.token_count + (chars // 4),
                    last_used=__import__("datetime").datetime.utcnow(),
                    consecutive_errors=0, is_healthy=True, last_error=None,
                )
            )
            await db.commit()
            return response
        except Exception:
            return None

    async def _refresh_claude_token(self, db: AsyncSession, account: AIAccount) -> bool:
        """Refresh an expired Claude OAuth token. Returns True if successful."""
        try:
            from app.core.anthropic_oauth import refresh_anthropic_token
            refresh_token = (account.extra or {}).get("refresh_token", "")
            if not refresh_token:
                return False
            token_data = await refresh_anthropic_token(refresh_token)
            new_extra = dict(account.extra or {})
            new_extra["refresh_token"] = token_data.get("refresh_token", refresh_token)
            await db.execute(
                update(AIAccount).where(AIAccount.id == account.id).values(
                    session_token=token_data["access_token"],
                    extra=new_extra,
                    is_healthy=True, last_error=None, consecutive_errors=0,
                )
            )
            await db.commit()
            # Update in-memory reference
            account.session_token = token_data["access_token"]
            account.extra = new_extra
            logger.info("claude_oauth_token_refreshed", account_id=str(account.id))
            return True
        except Exception as e:
            logger.error("claude_oauth_refresh_failed", account_id=str(account.id), error=str(e))
            return False

    # ── Agno model (apenas API key, para quando Agno for utilizado) ───────────

    async def get_agno_model(
        self, db: AsyncSession, preferred_provider: Optional[str] = None
    ) -> Optional[Any]:
        """
        Retorna instância de modelo Agno usando conta com API key.
        Usado como fallback quando OAuth não está disponível.
        """
        account = await self._pick(db, provider=preferred_provider, auth_type="api_key")
        if not account:
            logger.warning("no_api_key_account_for_agno")
            return None

        try:
            if account.provider == "openai":
                from agno.models.openai import OpenAIChat
                return OpenAIChat(id="gpt-4o", api_key=account.session_token)
            elif account.provider == "claude":
                from agno.models.anthropic import Claude
                return Claude(id="claude-3-5-sonnet-20241022", api_key=account.session_token)
            elif account.provider == "gemini":
                from agno.models.google import Gemini
                model_id = (account.extra or {}).get("model", "gemini-2.5-flash")
                # Use Flash as fallback if Pro is selected (Pro has frequent 503s)
                if model_id == "gemini-2.5-pro":
                    try:
                        return Gemini(id="gemini-2.5-pro", api_key=account.session_token)
                    except Exception:
                        logger.warning("gemini_pro_unavailable_using_flash")
                        return Gemini(id="gemini-2.5-flash", api_key=account.session_token)
                return Gemini(id=model_id, api_key=account.session_token)
        except ImportError as e:
            logger.error("agno_model_import_error", provider=account.provider, error=str(e))

        return None

    # ── Teste de conta ────────────────────────────────────────────────────────

    async def test_account(self, account: AIAccount) -> dict:
        try:
            client = build_client(account.provider, account.session_token, account.extra)
            return await client.test_connection()
        except Exception as e:
            return {"ok": False, "error": str(e), "provider": account.provider}


# Singleton global
account_pool = AccountPool()
