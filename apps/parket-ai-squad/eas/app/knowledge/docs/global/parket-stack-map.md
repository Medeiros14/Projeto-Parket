# Mapa de Stacks Parket

Visão geral dos 40+ serviços rodando no servidor Hetzner (`server.parket.works`, IP `178.104.239.191`). Orquestrado via **Docker Swarm**, roteado por **Traefik** (cert resolver: `letsencryptresolver`).

## Apps de produto (subdomínio `*.parket.works`)

| Stack | Domínio | Função |
|---|---|---|
| `parket-dashboard` | `space.parket.works`, `draw.parket.works` | Space (gestão), Draw (CAD). Tem 3 services: dashboard (golden), frontend (draw), backend (draw API). |
| `parket-space-v2` | `space.parket.works/v2/` | Rebuild Figma (Vite+React) em paralelo |
| `parket-valoria` | `valoria.parket.works` | Apartamento da equipe Valoria (catálogo+simulador) |
| `parket-core` | `app.parket.works` | Core/financeiro/contratos |
| `parket-rh` + `parket-rh-api` | `rh.parket.works` | RH (calendário, Clicksign, documentos) |
| `parket-fiscal` | `fiscal.parket.works` | App fiscal (vistorias, fotos) |
| `parket-cs` | `cs.parket.works` | Atendimento ao cliente |
| `parket-instala` | `instala.parket.works` | App de prestadores/instaladores |
| `parket-cronograma` | `cronograma.parket.works` | App cronograma de obras |
| `parket-docusign` | (interno) | Assinatura digital Financeiro |
| `parket-homebroker` | `hb.parket.works` | Homebroker WhatsApp |
| `parket-wavoip` | `wavoip.parket.works` | Voip integração |
| `parket-site` | `parket.com.br` | Site institucional |
| `parket-devportal` | `devportal.parket.works` | Portal interno de devs |
| `parket-emergency` | (interno) | Emergency endpoints |
| `parket-skills` | `skills.parket.works` | Catálogo de skills |
| `parket-ai-squad` | `agente.parket.works`, `os.parket.works` | Teca V2, alerters, EAS |

## Infraestrutura

| Stack | Função |
|---|---|
| `parket-api` | Gateway nginx + GoTrue (auth) + PostgREST (Cloud passthrough) |
| `parket-pg` | Postgres principal (GoTrue, dados próprios) |
| `parket-pg-local` | Réplica espelho do Supabase Cloud |
| `parket-pg-realtime` | Supabase Realtime local |
| `parket-pg-rest` | PostgREST apontando pra pg-local (10x speedup) |
| `parket-pg-storage` | Supabase Storage local |
| `traefik` | Reverse proxy + Let's Encrypt |
| `portainer` | Painel de gestão Docker |
| `evolutionapi` | API WhatsApp (Evolution) com 3 instâncias: Parket, Comercial-Parket, Secretaria |
| `chatwoot` | Plataforma de atendimento (legacy) |
| `penpot` | Alternativa Figma open-source |

## Bancos e domínios externos

- **Supabase principal (Cloud)**: project `hbxpilrxmitvzebluoom`, `https://hbxpilrxmitvzebluoom.supabase.co`, gateway em `api.parket.works`
- **Supabase Valoria**: project próprio (catálogo isolado)
- **Supabase Draw**: project `kstldkfhoiqepmuqmcmq` (estado DXF/croqui)

## Regras de ouro

- Dashboard (`parket-dashboard`) é **golden-only** — golden é produção, mudanças só via hotpatch + `/root/deploy-dashboard.sh`
- Stacks `parket-dashboard`, `parket-pg*` NÃO podem ser removidos (`docker stack rm`)
- DNS Cloudflare. Cert via Let's Encrypt (resolver = `letsencryptresolver`)
