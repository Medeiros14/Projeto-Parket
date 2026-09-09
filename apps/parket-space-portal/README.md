# parket-space-portal

> Portal intranet da Parket (`space.parket.works`). Menu por
> departamento que decide quais apps o usuario ve.

## O que faz

- Login unico via GoTrue
- Home no formato `NavonaDashboard` com apps reais + Biblioteca
- Setor de cada usuario decide quais apps aparecem
- Tela admin de acessos (app ↔ departamento + overrides por usuario)
- Overrides por usuario NAO cria login — so libera app no portal
  (login precisa existir no auth GoTrue antes)
- Priority 150 no Traefik — nao colide com dashboard antigo

## Como se interliga com o ecossistema

- **Le de:** `user_profiles` (dept), `portal_apps` (catalogo de apps),
  `portal_departamentos_apps` (mapa dept→apps), `portal_overrides`.
- **Escreve em:** ele proprio — nao dispara nada em outros apps.
- **E usado por:** todos os funcionarios como ponto de entrada.

## Stack

- React + Vite + Tailwind
- Backend leve (Node ou FastAPI) so pra list/config
- Postgres schema `portal.*`
- Deploy stack `parket-space-portal`, space.parket.works

## Onde uso IA

Nao usa.

## Como rodar localmente

```bash
cd apps/parket-space-portal
npm install && npm run dev
```

## O que aprendi

- **Cadastro de fiscal exige 7 pontos.** Fiscal novo passa por 7
  registros em 3 bancos. Space "Overrides por usuario" nao cria
  login, so libera app no portal.
- Priority Traefik >100 evita conflito com Dashboard golden legado.
