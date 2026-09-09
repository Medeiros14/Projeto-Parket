"""DDD → state mapping. Used by Cortex to decide showroom (SP) vs. Meet (outside)."""

# DDDs do estado de SP (incluindo capital e interior)
SP_DDDS = {"11", "12", "13", "14", "15", "16", "17", "18", "19"}


def extract_ddd(phone: str) -> str | None:
    """
    Given a Brazilian phone like '5511939213329' or '11939213329',
    return the 2-digit DDD ('11') or None.
    """
    digits = "".join(c for c in (phone or "") if c.isdigit())
    if not digits:
        return None
    # Strip country code 55 if present
    if digits.startswith("55") and len(digits) >= 12:
        digits = digits[2:]
    if len(digits) < 10:
        return None
    return digits[:2]


def is_sp_ddd(phone: str) -> bool:
    ddd = extract_ddd(phone)
    return ddd in SP_DDDS if ddd else False


def guessed_region_label(phone: str) -> str:
    """Human-readable hint about where the lead is based on DDD."""
    ddd = extract_ddd(phone)
    if not ddd:
        return "desconhecida"
    if ddd in SP_DDDS:
        return "São Paulo (capital ou interior)"
    return f"fora de SP (DDD {ddd})"
