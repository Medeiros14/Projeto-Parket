"""
Sandbox control: which phones run on Teca V2.

Rollout strategy: start with one phone (Will's), then expand.
Set TECA_V2_FORCE_ALL=1 env var to enable for everyone.
"""
import os

# Whitelist of phones running on V2 — kept in code for visibility.
# To add a number: append to this set. Format: digits-only, with country code.
SANDBOX_PHONES = {
    "5511939213329",  # Will (sandbox)
    "5511992432727",  # Sandbox 2
}


def normalize_phone(phone: str) -> str:
    return "".join(c for c in (phone or "") if c.isdigit())


def is_v2_enabled_for_phone(phone: str) -> bool:
    """Returns True if Teca V2 should handle this phone instead of V1."""
    if os.getenv("TECA_V2_FORCE_ALL") == "1":
        return True
    return normalize_phone(phone) in SANDBOX_PHONES
