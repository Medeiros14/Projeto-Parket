import re

with open('backend/app/api/accounts.py', 'r') as f:
    content = f.read()

# Revert start_oauth
start_old_pattern = r'@router\.post\("/oauth/start"\)\s*async def start_oauth.*?@router\.post\("/oauth/complete"\)'
start_new = """@router.post("/oauth/start")
async def start_oauth(data: OAuthStartRequest):
    \"\"\"Initiate OAuth flow (returns URL).\"\"\"
    oc_id = PROVIDER_MAP.get(data.provider)
    if not oc_id:
        raise HTTPException(422, f"Provedor desconhecido ou indisponível: {data.provider}")

    oc = get_opencode_client()
    try:
        response = await oc.start_oauth(oc_id)
        from urllib.parse import urlparse
        if response.get("url"):
            parsed = urlparse(response["url"])
            if parsed.hostname in ("localhost", "127.0.0.1"):
                raise HTTPException(500, "Provedor retornou URL de localhost. Verifique se o OpenCode não travou no fluxo CLI na nuvem.")
        return response
    except Exception as e:
        raise HTTPException(500, f"OpenCode indisponível: {str(e)}")

"""

# Revert complete_oauth
complete_old_pattern = r'@router\.post\("/oauth/complete"\)\s*async def complete_oauth.*?@router\.delete\("/oauth/\{provider\}"\)'
complete_new = """@router.post("/oauth/complete")
async def complete_oauth(data: OAuthCompleteRequest, db: AsyncSession = Depends(get_db)):
    \"\"\"Complete the OAuth flow (with code or auto-polling).\"\"\"
    oc_id = PROVIDER_MAP.get(data.provider)
    if not oc_id:
        raise HTTPException(422, f"Provedor desconhecido: {data.provider}")

    oc = get_opencode_client()

    # Extract code from full URL or raw code string
    code = _extract_code(data.code) if data.code else None

    try:
        success = await oc.complete_oauth(oc_id, data.method_index, code)
    except Exception as e:
        raise HTTPException(400, f"OAuth falhou: {str(e)}")

    if not success:
        raise HTTPException(400, "OAuth falhou — tente novamente")

    # Read the stored token from auth.json
    token = oc.get_access_token(oc_id) or ""
    cred = oc.read_stored_token(oc_id) or {}
    auth_type = "oauth" if cred.get("type") == "oauth" else "api_key"

    # Count existing OAuth accounts for this provider to auto-generate label
    count_result = await db.execute(
        select(AIAccount).where(AIAccount.provider == data.provider)
    )
    existing_oauth = [
        a for a in count_result.scalars().all()
        if (a.extra or {}).get("auth_type") == "oauth"
    ]
    existing_count = len(existing_oauth)
    suffix = f" {existing_count + 1}" if existing_count > 0 else ""
    label = data.label or f"{data.provider.title()} OAuth{suffix}"

    # Always create a new account — allows multiple per provider
    account = AIAccount(
        provider=data.provider,
        label=label,
        session_token=token,
        is_healthy=True,
        extra={"auth_type": auth_type, "opencode_id": oc_id},
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)

    return {
        "ok": True,
        "account": _to_dict(account, hide_token=True),
        "auth_type": auth_type,
    }

"""

content = re.sub(start_old_pattern, start_new + '@router.post("/oauth/complete")', content, flags=re.DOTALL)
content = re.sub(complete_old_pattern, complete_new + '@router.delete("/oauth/{provider}")', content, flags=re.DOTALL)

with open('backend/app/api/accounts.py', 'w') as f:
    f.write(content)
