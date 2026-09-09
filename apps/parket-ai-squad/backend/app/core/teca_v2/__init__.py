"""
Teca V2 — Multi-agent commercial assistant.

Architecture:
  Cortex (reasoner, Opus 4.7)  ──┐
                                  ├─→ Orchestrator → WhatsApp
  Conversational (writer, Sonnet) ┘

Modules:
  - orchestrator: entry point called by webhook
  - cortex: reasoner. Analyzes + decides actions + tool calls
  - conversational: writer. Generates natural reply
  - state: Redis-backed conversation history + per-phone state
  - tools: backend functions Cortex can call (agendamento, sinalizar humano, RAG site)
  - ddd_locator: maps DDD → state. SP DDDs = 11..19
  - prompts: system prompts for both agents
  - sandbox: whitelist of phones in V2 (production rollout control)
"""

from .orchestrator import handle_message_v2, is_v2_enabled_for_phone  # noqa: F401
