# apps/infra/

Componentes de infraestrutura da Parket. Nao sao "apps" no sentido
de UI/UX — sao pecas que fazem o ecossistema funcionar.

## Conteudo

- **parket-api/** — Gateway nginx + PostgREST pro Cloud Supabase.
  Serve `api.parket.works`.
- **parket-pg-local/** — Stack Postgres 15 local + GoTrue auth +
  Storage + PostgREST. Fonte de verdade operacional da Parket.
- **parket-supabase-proxy/** — Proxy pro GoTrue local com rewrites
  pra clientes esperarem shape da API Supabase.
- **parket-waha/** — Gateway WhatsApp official API via WAHA.
- **parket-auth-guard/** — OTP WhatsApp de aprovacao pra transacoes
  financeiras sensiveis.

Ver `../../ARQUITETURA.md` pra entender como esses pecas se
encaixam no ecossistema completo.
