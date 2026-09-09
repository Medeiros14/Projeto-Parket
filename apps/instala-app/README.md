# instala-app

> App mobile-first do instalador (`instala.parket.works`). Roda no
> celular do instalador em canteiro de obra: check-in, foto,
> progresso por item, ficha tecnica, pagamento.

## O que faz

Bottom nav estilo Tripos: **HOJE | AGENDA | INICIAR | EQUIPE | RECEBER**.

- **HOJE** — obras do dia, chip "FAZENDO HOJE" abre camera in-app, X
  separado pra parar, feedback "parou as HH:MM".
- **AGENDA** — 4 abas Agenda/Iniciar/Equipe/Ranking.
- **INICIAR** — check-in com GPS + camera obrigatorios, contrato
  geral prestador (F4 ativacao por obra com OTP).
- **Progresso diario** — qtd do dia obrigatoria (parcial e finalizar
  ja com foto), barra por item, falta em destaque, historico de dias
  no card do item.
- **Ficha tecnica v2** — chave_match, markdown, cola, video, cache offline.
- **Conferencia de material** volume a volume.
- **Fila offline** completa (IndexedDB) — check-in, medicao, finalizar,
  backoff, badge, atencao.
- **RECEBER (Pagamentos)** — R$/m² + ganhos por obra, extrato do pago.
- **Ocorrencias** + solicitar material — pedido cai no verifica pro
  fiscal aprovar antes de virar compra.
- **Meus custos** — no /mais, endpoint app + CORS core.
- **Ditado por voz** em todos os textos.
- **Camera in-app** via `getUserMedia` (visor + permissao) nos 4 pontos
  de foto.
- **Card de obra simplificado** — UUID oculto, icones lucide, chips
  maiores.
- **Login por email e senha** (era PIN antes).
- **URL reflete perfil logado** (`/david` na Hoje).

## Como se interliga com o ecossistema

- **Le de:** `parket-gestao` (obras do instalador via
  `vw_instala_minhas_obras`), fiscal (feedback), gestao/ficha_tecnica.
- **Escreve em:** `gestao.eventos` (progresso), `parket-chat` (msg
  no thread da obra), `parket-fiscal` (pedido de material vai pro
  fiscal aprovar).
- **Depende de:** api.parket.works (auth), IndexedDB, MediaDevices,
  Web Speech, service worker (PWA).
- **E usado por:** instaladores em campo.

## Stack

- React + Vite + Tailwind + PWA
- Backend compartilha `parket-gestao` (namespace `/instala`)
- Postgres schema `instala.*`
- Deploy stack `instala-app`, instala.parket.works

## Onde uso IA

- Ditado por voz Web Speech pt-BR (browser-side)
- Notificacoes de novidades (task 2065 em progresso)

## Como rodar localmente

```bash
cd apps/instala-app
cp .env.example .env
npm install && npm run dev
```

## O que aprendi

- **Fotos com feedback + gate de check-in visivel.** Instalador que
  nao ve confirmacao envia 5x a mesma foto.
- **Camera in-app > input=file.** Input abre app externo em Android,
  perde contexto.
- **Fila offline resistente.** Rede em obra e instavel; toda escrita
  vai pra IndexedDB primeiro, backoff exponencial, badge no icone
  do bottom nav mostra quantos itens pendentes.
- **URL personalizada** (`/david`) evita instalador logar como colega
  por acidente.
- **Compressao antes de subir foto** — foto de celular sem compressao
  esgota upload em rede ruim.
