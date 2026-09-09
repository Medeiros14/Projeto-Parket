FROM supabase/gotrue:v2.169.0
USER root
# Esvazia migrations que falham em schema já migrado/clonado.
# A backfill 20221208132122 tenta UPDATE com cast inválido que falha em schemas atualizados.
RUN find /usr/local/etc/auth/migrations -name '*.sql' -exec sh -c '> "$1"' _ {} \;
USER 65532:65532
