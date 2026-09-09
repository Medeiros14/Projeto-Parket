import re

# 1. Revert requirements.txt
try:
    with open('backend/requirements.txt', 'r') as f:
        reqs = f.read()
    reqs = reqs.replace('\ngoogle-auth-oauthlib\n', '')
    reqs = reqs.replace('\ngoogle-auth-oauthlib', '')
    with open('backend/requirements.txt', 'w') as f:
        f.write(reqs)
except Exception as e:
    pass

# 2. Revert config.py
try:
    with open('backend/app/config.py', 'r') as f:
        config = f.read()

    config = re.sub(r'\s*GOOGLE_CLIENT_ID: Optional\[str\] = None\s*', '\n', config)
    config = re.sub(r'\s*GOOGLE_CLIENT_SECRET: Optional\[str\] = None\s*', '\n', config)

    with open('backend/app/config.py', 'w') as f:
        f.write(config)
except Exception as e:
    pass
    
# 3. Revert .env
try:
    with open('.env', 'r') as f:
        lines = f.readlines()
    with open('.env', 'w') as f:
        for line in lines:
            if not line.startswith("GOOGLE_CLIENT_"):
                f.write(line)
except Exception as e:
    pass
