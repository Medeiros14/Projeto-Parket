# Proposta OG preview no WhatsApp

## Regra

Todo link de proposta tem que terminar em `&v=<timestamp>` (segundos epoch ou compacto) pra WhatsApp/Telegram/Facebook mostrarem preview com a casa Parket (Open Graph image).

```
https://proposta.parket.works/proposta/<uuid>?u=<email>&v=1718726400
```

Sem o `&v=`, WhatsApp cacheia o preview por dias/semanas e clientes recebem link "estranho" sem imagem.

## Por que

Crawlers de OG do WhatsApp respeitam query string como cache key. Mudar `v=` força refetch do meta tag `og:image`.

## Onde isso é aplicado

- Dashboard, ao gerar link de proposta (botão "Copiar link")
- propostaGenerator (PDF / HTML)
- Webhook que envia link automaticamente
- Dockerfile do dashboard reforça: regex no nginx adiciona `&v=$(date +%s)` se faltar

## Validar

```bash
# Compartilhar o link no WhatsApp Web e ver se preview aparece imediatamente
# Ou debug via Facebook Open Graph Debugger
```

## Memória relacionada

- `proposta/V12FIX-internals.md` (renderer)
