# Parket Chat

Backend único de mensagens da Parket + widget de chat embutível nas 9 plataformas de setor
(homebroker, valor, compras, gestao, projetos, instala, verifica, contrato, core `.parket.works`).

O chat **não é um site separado**: é um ícone flutuante dentro de cada plataforma que abre um
painel estilo Slack. Todas as plataformas conversam com o mesmo backend.

## Como rodar

```bash
npm install
npm start        # builda o frontend (esbuild) e sobe tudo na porta 3000
```

- Exemplo de plataforma com o widget embutido: **http://localhost:3000/exemplo-plataforma.html**
- Usuários de teste: `ana@parket.com.br`, `carla@parket.com.br`, `elisa@parket.com.br`, …
  (ver `server/repository.js`) — senha de todos: **`parket123`**

Scripts:

| Comando         | O que faz                                              |
|-----------------|--------------------------------------------------------|
| `npm run build` | Empacota o React em `public/app.js` via esbuild        |
| `npm start`     | Build + servidor Express/Socket.io na porta 3000       |
| `npm test`      | Testes ponta-a-ponta com Playwright (chromium headless)|

## Os dois tipos de conversa

### 1. Conversa de OBRA/CLIENTE — regra de visibilidade (o coração do sistema)

Cada obra tem **uma** conversa (`obra_threads`), criada quando alguém a abre pela primeira vez
(botão **"Nova conversa de obra"** → autocomplete das obras que **já existem** no banco da Parket).

**Quem vê a conversa de uma obra?** Somente quem está em `obra_members`:

- **Quem criou** a conversa entra como membro automaticamente.
- **Marcar `@Setor` ou `@Pessoa` numa mensagem da obra adiciona esse setor/pessoa como membro.**
  A partir daí, ele vê **todo o histórico da obra desde o começo** (como entrar num grupo) e
  recebe as próximas mensagens em tempo real (evento `obra:acesso` + entrada na room).
- Um usuário tem acesso se **o setor dele** está em `obra_members` **OU** se **ele próprio** está.
- Quem não foi marcado **não vê nada** daquela obra — a regra é validada **no servidor** em todas
  as rotas REST e eventos de socket (`GET /api/messages?obra=ID` devolve **403** para não-membros).

### 2. Conversa entre setores

- Canais gerais `#geral` e `#avisos` (todos veem).
- Canal privado do próprio setor (`#homebroker`, `#valoria`, …) — isolamento validado no servidor.
- Mensagens diretas (DM) entre quaisquer duas pessoas.
- Aqui, marcar `@Setor`/`@Pessoa` **apenas notifica** (badge laranja) — não altera acesso.

## Conectar ao banco real da Parket

O chat **não duplica** usuários, setores nem obras. Todo o acesso a esses dados está isolado em
**`server/repository.js`** — procure os comentários **`// TODO Parket: conectar ao banco real`**.

Funções a implementar com SQL real (exemplos de query já no arquivo):

- `getUser(id)`, `getUserByEmail(email)` (esta última só para o login de teste)
- `getSectors()`, `getSector(id)`, `getUsers()`, `getUsersBySector(sectorId)`
- `getObras(query)` — busca usada no **autocomplete de obras**
- `getObra(id)`

As **tabelas novas do chat** (`channels`, `dms`, `obra_threads`, `obra_members`, `messages`,
`reads`, `mentions`) ficam em SQLite (`data/chat.db`) via `server/chatdb.js`. Se preferir tê-las
no Postgres da empresa, troque apenas as queries desse módulo — o resto do código não conhece SQLite.

## Como embutir o widget

### Forma 1 — `<script>` + `<div>` (recomendada; ver `public/exemplo-plataforma.html`)

```html
<div id="parket-chat"></div>
<script src="https://chat.parket.works/app.js" data-parket-chat
        data-api="https://chat.parket.works"
        data-token="<JWT emitido pelo SSO da plataforma>"></script>
```

Sem `data-token`, o widget mostra o login de teste local. Também dá pra montar por código:

```html
<script src="https://chat.parket.works/app.js"></script>
<script>ParketChat.init({ token: jwtDoUsuario, api: 'https://chat.parket.works' });</script>
```

### Forma 2 — `<iframe>`

```html
<iframe src="https://chat.parket.works/widget.html#token=<JWT>"
        style="position:fixed;right:24px;bottom:24px;width:760px;height:560px;
               border:0;border-radius:12px;box-shadow:0 12px 48px rgba(0,0,0,.35);z-index:99999">
</iframe>
```

No modo iframe o painel fica sempre aberto (o botão flutuante fica por conta da página).
O servidor já envia `Content-Security-Policy: frame-ancestors` liberando `*.parket.works`.

## SSO por JWT

A pessoa já está logada na plataforma do setor. A plataforma assina um JWT com o **mesmo
`JWT_SECRET`** do chat, com o payload:

```json
{ "id": <id do usuário no banco da Parket> }
```

…e o passa ao widget (`data-token` / `ParketChat.init` / fragmento do iframe). O chat valida o
token e carrega o usuário via `repository.getUser(id)`. O login por e-mail/senha
(`POST /api/login`) existe **somente para testes locais**.

## API

| Rota | Descrição |
|---|---|
| `POST /api/login` | Só teste local → `{ token, user }` |
| `GET /api/bootstrap` | `{ me, sectors, users, channels, dms, obras_visiveis, online }` com `unread`/`mentions` por conversa |
| `GET /api/obras/buscar?q=…` | Autocomplete de obras do sistema |
| `POST /api/obras/:obraId/abrir` | Cria/retorna a thread da obra; quem abre vira membro |
| `GET /api/messages?channel=ID \| dm=ID \| obra=ID` | Últimas 100 mensagens (**403** sem acesso) |
| `POST /api/dms { userId }` | Cria/retorna a DM com o usuário |
| `POST /api/read { convType, convId, lastMsgId }` | Persiste última mensagem lida |
| `POST /api/upload` (multipart) | → `{ file_path, file_name, file_type }` (máx. **15 MB**) |

Todas as rotas (exceto login) exigem `Authorization: Bearer <jwt>`.

**Socket.io** (JWT no handshake, `auth: { token }`): rooms `channel:<id>`, `dm:<id>`,
`user:<id>`, `sector:<id>`, `obra:<threadId>`. Eventos:

- `message:send` → persiste, processa menções (em obra: concede acesso), emite `message:new` na room
- `message:new`, `obra:acesso` (setor/pessoa ganhou acesso — sidebar atualiza na hora),
  `obra:membros`, `dm:new` / `dm:join`, `presence` / `presence:all`, `read:update`

Limites: mensagens **4000 caracteres**, uploads **15 MB** — aplicados no servidor.

## Produção

- **`JWT_SECRET`** via variável de ambiente (obrigatório — o mesmo usado pelas plataformas):
  `JWT_SECRET=... PORT=3000 node server/index.js`
- **HTTPS** com Nginx/Caddy na frente (o Socket.io precisa de upgrade de WebSocket):

  ```nginx
  server {
    server_name chat.parket.works;
    location / {
      proxy_pass http://127.0.0.1:3000;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
    }
    client_max_body_size 16m;
  }
  ```

- **pm2** para manter o processo vivo:

  ```bash
  npm run build
  JWT_SECRET=... pm2 start server/index.js --name parket-chat
  pm2 save
  ```

## Testes

```bash
npm test
```

Suíte Playwright (chromium headless) com 3 usuários de setores diferentes em contextos isolados:
histórico da obra visível ao setor recém-marcado, 403 para não-membros (API direta), menção a
pessoa e a setor, badges vermelho/laranja (inclusive com o widget fechado), #geral em tempo real,
DM com presença e isolamento de canal de setor (403).
