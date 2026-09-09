import os

env_file = "backend/.env"
lines = []
if os.path.exists(env_file):
    with open(env_file, "r") as f:
        lines = f.readlines()

new_lines = []
has_id = False
has_secret = False

for line in lines:
    if line.startswith("GOOGLE_CLIENT_ID="):
        new_lines.append('GOOGLE_CLIENT_ID="672361818964-2rbsf9asmac363gegd3q5mr27kosi991.apps.googleusercontent.com"\n')
        has_id = True
    elif line.startswith("GOOGLE_CLIENT_SECRET="):
        new_lines.append('GOOGLE_CLIENT_SECRET="<REDACTED_GOOGLE_CLIENT_SECRET>"\n')
        has_secret = True
    else:
        new_lines.append(line)

if not has_id:
    new_lines.append('GOOGLE_CLIENT_ID="672361818964-2rbsf9asmac363gegd3q5mr27kosi991.apps.googleusercontent.com"\n')
if not has_secret:
    new_lines.append('GOOGLE_CLIENT_SECRET="<REDACTED_GOOGLE_CLIENT_SECRET>"\n')

with open(env_file, "w") as f:
    f.writelines(new_lines)
