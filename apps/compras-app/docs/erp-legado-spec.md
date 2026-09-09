# Spec do ERP de Compras legado (Google Apps Script) — base para o port React (compras.parket.works)

Fonte: `/tmp/erp_userhtml.html` (single-file HTML+JS, build frontend `2026-07-31.8`, checada contra `obterVersaoBackend()`).
Backend: Google Apps Script + Planilha Google (abas = "tabelas"). Todas as chamadas via `google.script.run.<fn>(...)` com `withSuccessHandler`/`withFailureHandler`.

## 0. Convenções globais do frontend

- **Envelope de resposta**: várias funções retornam `{ linhas: [...], debug: "..." }` (ou JSON-string disso, ou array puro). O helper `analisarResposta(resBruta, debugElementId)` normaliza: `linhas = res.linhas || (Array.isArray(res) ? res : [])`, `debug = res.debug || ''`. Cada view tem um `<div id="*-debug">` que exibe o campo `debug`.
- **Tabelas "array-of-arrays"**: `obterDadosKanban`, `obterDadosAba`, `pesquisarDadosAba`, `pesquisarFinanceiroComData` retornam matriz onde `linhas[0]` é a linha de CABEÇALHO (nomes das colunas da planilha) e as demais são dados. Já `obterSaldoEstoqueAtual`, `relatorioMovimentacaoEstoqueFiltrado` e `relatorioPorProjetoFiltrado` retornam matriz SEM cabeçalho (posições fixas). `obterRelatorioPedidosCompra` e `obterDetalhesCartaoKanban` retornam objetos com chaves nomeadas.
- **Datas**: inputs `type="date"` mandam `YYYY-MM-DD`; o backend devolve ora ISO com `T...Z`, ora `dd/mm/aaaa` — o front formata com `formatarDataExibicao()` / `toLocaleDateString('pt-BR')`.
- **Toasts**: `mostrarToast(msg, 'sucesso'|'erro'|'aviso'|'info')`; confirmação via `confirmarAcao(msg)` (Promise<boolean>). Nenhum `alert/confirm` nativo.
- **Impressão**: área oculta `#print-area` + `body.modo-impressao` + `window.print()` (`imprimir(titulo)`), pois `window.open` é bloqueado nos callbacks. Layout formal comum: `imprimirDocumentoFormal(titulo, metaExtra, colunas, linhasHtml, rodape)` com cabeçalho fixo "PARKET — Rua Lopes Chaves, 62 - Barra Funda - CEP 01154-010 - São Paulo / SP" + "Emitido em {hoje}".
- **Sidebar → views**: `switchView(viewName, el)`. Views nomeadas: `kanban`, `form-solicitacao`, `clientes`, `produtos`, `transportadoras`, `fornecedores`, `estoque-atual`, `xml`, `estoque-manual`, `estoque-saida`, `financeiro`, `rel-pedidos`, `rel-entrada-estoque`, `rel-saida-estoque`, `rel-projeto`. Qualquer view não tratada explicitamente cai no branch genérico (`view-generic`) — é assim que os 4 cadastros funcionam: `abaAtualAtiva = viewName` e `carregarDadosTabela(viewName)`.
- Botão global "Sincronizar" na top-bar → `carregarKanban()`.

---

## 1. Views

### 1.1 `view-kanban` — Painel Kanban (Fluxo de Solicitações)

- Container: `#kanban-board`; debug: `#kanban-debug`.
- Carga: `carregarKanban()` → `obterDadosKanban()` → envelope `{linhas, debug}`; `linhas` é array-of-arrays COM cabeçalho.
- **Índices usados da linha do Kanban** (colunas da aba/planilha do Kanban):
  - `row[0]` = ID do cartão (ex.: usado como chave em drag/click)
  - `row[1]` = Título — **o título embute os itens**: formato `"<titulo> | Itens: <item1> | <item2> | ..."`; o card mostra só `split(' | Itens:')[0]`
  - `row[2]` = Solicitante
  - `row[4]` = Etapa (comparada case-insensitive, com colapso de espaços)
  - `row[6]` = Valor (renderizado `R$ parseFloat(row[6]||0).toFixed(2)` no rodapé do card)
  - (`row[3]`, `row[5]` não são lidos pelo board; pelo objeto de detalhes, a aba contém também data, pedidoPor, setor, prazo, projeto, observações — ver 1.1.2)
- **Etapas fixas (7 colunas, strings exatas — viram enum no novo app)**:
  1. `1. Solicitado (Entrada)`
  2. `2. Em Cotação`
  3. `3. Aguard. Liberação Pagto`
  4. `4. Liberação Fornecedor`
  5. `5. Em Rota de Entrega`
  6. `6. Recebido e Conferido`
  7. `7. Finalizados`
  - Etapas na planilha que não batem com nenhuma coluna são reportadas no debug ("Etapas na planilha que não bateram...").
- **Drag & drop**: HTML5 nativo (`draggable`, `ondragstart="drag(event, id)"`, coluna com `ondrop="drop(event, '<etapa>')"`). No drop → `atualizarEtapaCartao(id, novaEtapa)` (novaEtapa = string exata da etapa) e recarrega o board. Mover para `"7. Finalizados"` exige confirmação.
- **Card (elemento)**: título, ID em destaque (âmbar), linha inferior com solicitante e `R$ <valor>`.

#### 1.1.1 Modal de detalhes do cartão (`#modal-detalhes-cartao`)

- Abre no clique do card: `abrirDetalhesCartao(id)` → `obterDetalhesCartaoKanban(id)` → **objeto cartão**:
  ```
  { id, titulo, data, solicitante, pedidoPor, setor, prazo, projeto, observacoes, etapa }
  ```
  (`titulo` inclui o sufixo `" | Itens: ..."`; o modal separa: título exibido = `partes[0] + " — " + cartao.id`; materiais = `partes[1].split(" | ")` viram `<li>`.)
- Elementos: `#det-titulo`, `#det-subtitulo` ("Solicitado em {data}"), `#det-solicitante`, `#det-pedido-por`, `#det-setor`, `#det-prazo`, `#det-projeto`, `#det-materiais` (lista), `#det-observacoes`, `#det-status-badge` (etapa). O objeto bruto fica em `dataset.cartaoRaw`.
- Botões: `#btn-editar-cartao`, `#btn-excluir-cartao`, `#btn-pdf-cartao`.

#### 1.1.2 Edição inline do cartão (`#det-painel-edicao`)

- Campos (todos opcionais, pré-preenchidos do cartão):

| id | label | tipo |
|---|---|---|
| `edit-solicitante` | Solicitante | text |
| `edit-setor` | Setor | text |
| `edit-prazo` | Prazo de Entrega | date |
| `edit-observacoes` | Observações | textarea |

- Salvar (`salvarEdicaoCartao`) → `atualizarCartaoCompleto(cartaoAtualId, { solicitante, setor, prazo, observacoes })` → retorna string msg; reabre detalhes + recarrega Kanban. **Título/materiais/projeto/pedidoPor NÃO são editáveis** aqui.

#### 1.1.3 Excluir / PDF

- Excluir: confirmação → `excluirCartaoKanban(cartaoAtualId)` → msg string.
- PDF: `gerarPdfCartaoKanban(cartaoAtualId)` → **retorna URL** (arquivo no Drive) → `window.open(url, '_blank')`.

### 1.2 `view-form-solicitacao` — Nova Solicitação (form estilizado "PARKET / Solicitação de Compras")

Campos:

| id | label | tipo | obrigatório | observação |
|---|---|---|---|---|
| `sol-seu-nome` | Seu Nome * | text | sim | vira `seuNome` (solicitante) |
| `sol-pedido-por` | Pedido por (quem usa o material) * | text | sim | `pedidoPor` |
| `sol-setor` | Setor | text | não | placeholder "ALMOX, OBRA, FÁBRICA..." |
| `sol-depto` | Departamento de Destino * | select | sim | opções: `Almoxarifado`, `Produção`, `Manutenção`, `Administrativo`, `Projetos` (default `""` = "Selecione...") |
| `sol-projeto` | Projeto Vinculado (Opcional) | text | não | busca livre por nome/obra (sem autocomplete implementado no legado) |
| `sol-materiais-container` | Materiais * | linhas dinâmicas | ≥1 linha | ver abaixo |
| `sol-prazo` | Prazo Estimado de Entrega * | date | marcado * no label, **mas o JS não valida** | |
| `sol-obs` | Observações | textarea rows=3 | não | |

Linha de material (`adicionarLinhaMaterialSolicitacao()`, ids `sol-mat-N`), 3 inputs por linha + botão remover:

| classe | placeholder | obrigatório |
|---|---|---|
| `.sol-mat-nome` | "Material" | sim (linha só entra se nome E qtd) |
| `.sol-mat-qtd` | "Qtd (10 PÇ)" | sim — **texto livre, quantidade+unidade juntas** |
| `.sol-mat-just` | "Justificativa * (por quê)" | não validado |

Salvar (`salvarSolicitacaoParketWeb`, botão `#btn-salvar-solicitacao`):
- Valida `seuNome`, `pedidoPor`, `depto` e ≥1 material (nome+qtd).
- Payload → `adicionarCartaoKanban(d)`:
  ```js
  {
    seuNome, pedidoPor, setor, departamento, projeto,
    materiais: [{ material, quantidade, justificativa }, ...],
    prazo,          // YYYY-MM-DD
    observacoes
  }
  ```
- Retorno: string msg; volta para a view kanban. O backend gera o ID do cartão e monta `titulo` = algo + `" | Itens: ..."` (o front só desmonta esse formato; a numeração/ID é 100% do backend).

### 1.3 `view-xml` — Importar XML NF-e

Campos:

| id | label | tipo | obrigatório |
|---|---|---|---|
| `xml-projeto` | Projeto / Centro de Custo | text (placeholder "Ex: Obra Shopping Norte") | sim (validado no JS) |
| `xmlFile` | (file-box) | file `accept=".xml"` | sim |

Comportamento (`enviarXMLWeb`, botão `#btn-processar-xml`):
- `FileReader.readAsText(file, "UTF-8")` → **`processarXmlNFe(xmlTextoPuro, projeto)`** — recebe o **conteúdo do XML como STRING de texto** (NÃO base64) + string do projeto.
- Retorno: string msg (toast de sucesso); limpa os campos. **A UI não recebe estrutura nenhuma de volta** — todo o efeito (cadastrar/atualizar Fornecedor, dar entrada dos itens no Estoque com código/descrição/qtd/valor, lançar duplicatas/parcelas no Financeiro/Contas a Pagar) acontece no backend, conforme o texto da tela: "O sistema lerá o XML e atualizará Fornecedores, Estoque e Financeiro automaticamente." No port, o parse do NF-e (emitente, itens `det/prod`, duplicatas `cobr/dup` com nNF, vencimentos e valores) precisa reproduzir esse pipeline server-side.

### 1.4 `view-estoque-atual` — Consultar Estoque (Posição Atual)

- Filtro client-side: `#filtro-estoque` (`oninput="filtrarEstoqueAtual()"` — busca substring em qualquer célula, sobre cache `cacheEstoqueAtual`).
- Carga: `obterSaldoEstoqueAtual()` → array-of-arrays **SEM cabeçalho**, posições fixas:
  - `r[0]` Código, `r[1]` Descrição, `r[2]` Qtd Atual, `r[3]` Valor Unit. (R$), `r[4]` Valor Total (R$)
- Colunas da tabela renderizada: `Código | Descrição | Qtd Atual | Valor Unit. (R$) | Valor Total (R$)`.
- **O saldo é calculado no backend** (entradas − saídas da aba de movimentação); o front só exibe.

### 1.5 `view-estoque-manual` — Entrada Manual de Estoque & Financeiro

Campos de cabeçalho:

| id | label | tipo | obrigatório |
|---|---|---|---|
| `man-projeto` | Projeto / Centro de Custo (*) | text | sim (validado) |
| `man-forn` | Fornecedor (Opcional) | text | não |
| `man-doc` | Documento / Motivo | text (placeholder "Ex: MAN-001") | não |
| `man-data` | Data | date | não |

Linhas de material (`adicionarLinhaMaterial('man')`, container `#man-itens-container`, ids `linha-man-N`):

| classe | label | tipo | obs |
|---|---|---|---|
| `.mat-desc` | Descrição | text | "Nome do produto" |
| `.mat-qtd` | Quantidade | number | |
| `.mat-valor` | Valor Unit. (R$) | number step 0.01 | |
| — | "Código automático" | (texto estático) | **o backend gera o código do produto** (PRD-xxxx) na entrada manual |

Linhas de pagamento (`adicionarLinhaPagamento()`, container `#man-pagamentos-container`, ids `linha-pag-N`) — "Pagamentos Múltiplos (Contas a Pagar)":

| classe | label | tipo |
|---|---|---|
| `.pag-data` | Data de Vencimento | date |
| `.pag-valor` | Valor da Parcela (R$) | number step 0.01 |

Salvar (`salvarEntradaManualWeb`, botão `#btn-salvar-entrada-manual`):
- Valida projeto e ≥1 item (descrição+qtd). Pagamentos só entram se `valor > 0` (lista pode ser vazia).
- Payload → `salvarEntradaManual(d)`:
  ```js
  {
    projeto, fornecedor, documento, data,          // data YYYY-MM-DD
    itens: [{ descricao, quantidade, valorUnitario }, ...],   // qtd/valor como string do input number
    pagamentos: [{ dataVencimento, valor }, ...]
  }
  ```
- Retorno: string msg; reseta a view (1 linha de item + 1 de pagamento).

### 1.6 `view-estoque-saida` — Saída de Material do Estoque

Campos de cabeçalho:

| id | label | tipo | obrigatório |
|---|---|---|---|
| `sai-projeto` | Projeto / Centro de Custo (*) | text | sim (validado) |
| `sai-doc` | Documento / Protocolo (opcional, automático se vazio) | text | não — **backend gera número de protocolo sequencial se vazio** |
| `sai-cliente` | Cliente (código - nome) | text (placeholder "Ex: 1206 - Leandro Bitencourt Silva") | não |
| `sai-endereco` | Endereço do Cliente | text | não |
| `sai-data` | Data | date | não |
| `sai-obs` | Observações | textarea rows=2 | não |

Linhas de material (`adicionarLinhaMaterial('sai')`, container `#sai-itens-container`) — layout DIFERENTE do 'man':

| classe | label | tipo | obs |
|---|---|---|---|
| `.mat-cod` | Código | text + `list="produtos-cadastrados-list"` | placeholder "PRD-0001"; `oninput="autopreencherDescricao(this)"` |
| `.mat-desc` | Descrição | text | autopreenchida da lista de produtos (placeholder "(automático)") |
| `.mat-qtd` | Quantidade | number | |
| `.mat-und` | Unidade | text, default `"UN"`, uppercase | |

- Ao entrar na view: `carregarProdutosCadastrados()` → `obterProdutosCadastrados()` → `[{ codigo, descricao }, ...]` popula o `<datalist id="produtos-cadastrados-list">` e o cache `listaProdutosCadastrados` usado no autocomplete de descrição.
- Salvar (`salvarSaidaMaterialWeb`, botão `#btn-salvar-saida`): valida projeto e ≥1 item (código+qtd); confirmação "Confirma a saída de N material(is)...".
- Payload → `salvarSaidaMaterial(d)`:
  ```js
  {
    projeto, documento, cliente, enderecoCliente, observacoes, data,
    itens: [{ codigo, descricao, quantidade, unidade }, ...]   // unidade default 'UN'
  }
  ```
- **Retorno é um objeto**: `{ mensagem, protocolo }`. Se `protocolo` presente, imprime automaticamente o **Protocolo de Entrega** (`imprimirProtocoloSaida`). Estrutura do protocolo:
  ```js
  {
    numero,                 // nº do documento/protocolo (gerado se sai-doc vazio)
    dataEmissao, horaEstoque,
    cliente, endereco, observacoes,
    itens: [{ produto, unidade, quantidade }, ...]
  }
  ```
- Layout do protocolo impresso: cabeçalho empresa (constante `EMPRESA_PARKET`: PARKET, Rua Lopes Chaves 62 - Barra Funda, CEP 01154-010, São Paulo/SP), box "Documento {numero}", seção "PROTOCOLO DE ENTREGA" com **campos fixos hardcoded**: `Natureza de Operação: 9 - Saída de material` e `Tipo de Movimento: 6`; tabela Item/Produto/UND/Quantidade; total de quantidade; observações; declaração de recebimento; 3 linhas de assinatura (Assinatura Recebedor / Data / Hora).

### 1.7 `view-financeiro` — Contas a Pagar

Filtros:

| id | label | tipo |
|---|---|---|
| `fin-filtro-de` | Vencimento De | date |
| `fin-filtro-ate` | Vencimento Até | date |
| `fin-filtro-forn` | Fornecedor | text |
| `fin-filtro-nf` | Nota Fiscal / Documento | text |
| `fin-filtro-proj` | Projeto | text |

- Buscar (`buscarRelatorioFinanceiro`) → `pesquisarFinanceiroComData(forn, nf, proj, de, ate)` → envelope `{linhas, debug}`; `linhas` COM cabeçalho (nomes das colunas da aba Financeiro). Renderiza tabela com os cabeçalhos que vierem; datas ISO viram `dd/mm/aaaa`. Ao entrar na view, filtros são limpos e a busca roda vazia (traz tudo).
- **Colunas conhecidas da aba Financeiro** (deduzidas de `imprimirContasAPagarFormal`, que localiza índices por nome de cabeçalho, lowercase): `Fornecedor` (exato), `Nota Fiscal` (exato), `Data Vencimento` (exato), coluna contendo `valor`, coluna contendo `status`, `Projeto` (exato). Ou seja, a parcela tem no mínimo: fornecedor, nota fiscal/documento, data de vencimento, valor, status (ex.: pago/em aberto — valores não visíveis no front) e projeto. **Não há na UI legada campos de forma de pagamento nem ação de "dar baixa"** — status só é exibido.
- Impressão formal: colunas `Fornecedor | Nota Fiscal | Vencimento | Valor (dir.) | Projeto | Status`, rodapé "Total do período: R$ X" (soma da coluna valor) e meta "Período dd/mm/aaaa – dd/mm/aaaa" (ou "Todos os períodos").

### 1.8 `view-rel-pedidos` — Relatório Pedidos de Compra (Kanban completo)

- Filtro client-side `#rel-pedidos-filtro` (busca em `id+titulo+solicitante+projeto+etapa`), botões Atualizar e Imprimir.
- Carga: `obterRelatorioPedidosCompra()` → envelope `{linhas, debug}` onde **linhas = array de OBJETOS**:
  ```
  { id, titulo, solicitante, projeto, data, prazo, etapa }
  ```
- Colunas da tabela: `ID | Título | Solicitante | Projeto | Data | Prazo | Status Atual` (etapa como badge).
- Impressão: mesmas colunas, meta "N pedido(s)", sem rodapé de total (comentário no código: "o Kanban não trabalha com valor fechado por pedido").

### 1.9 `view-rel-entrada-estoque` e `view-rel-saida-estoque` — Relatórios de movimentação

Filtros (prefixos `rel-entrada` / `rel-saida`):

| id | label | tipo |
|---|---|---|
| `rel-entrada-de` / `rel-saida-de` | De | date |
| `rel-entrada-ate` / `rel-saida-ate` | Até | date |
| `rel-entrada-projeto` / `rel-saida-projeto` | Projeto | select populado por `obterListaProjetos()` (retorna `string[]`; opção default `""` = "Todos os Projetos") |

- Buscar (`buscarRelatorio('entrada'|'saida')`) → `relatorioMovimentacaoEstoqueFiltrado(tipo, de, ate, projetoFiltro)` com `tipo` = `'Entrada'` ou `'Saída'` (string exata, com acento). Envelope `{linhas, debug}`; linhas SEM cabeçalho, posições fixas:
  - `row[0]` Data, `row[1]` Código, `row[2]` Descrição, `row[3]` Tipo (`Entrada`/`Saída`), `row[4]` Quantidade, `row[5]` Valor Unitário, `row[6]` Valor Total, `row[7]` Documento/NF, `row[8]` Fornecedor, `row[9]` Projeto
- Tabela renderizada com cabeçalhos hardcoded: `Data | Código | Descrição | Tipo | Quantidade | Valor Unitário | Valor Total | Documento/NF | Fornecedor | Projeto` + rodapé "Total de registros: N | Valor total: R$ X" (soma de `row[6]`).
- Impressão: mesmas 10 colunas + rodapé "Total movimentado".

### 1.10 `view-rel-projeto` — Relatório Consolidado por Projeto

- Filtros: `rel-projeto-de`, `rel-projeto-ate` (date), `rel-projeto-filtro` (select "Projeto Específico", mesma lista de projetos).
- Buscar → `relatorioPorProjetoFiltrado(de, ate, projetoFiltro)`. **Mesmo shape de linhas 10-colunas e mesma renderização/impressão** do 1.9 (inclui entradas E saídas do projeto).

### 1.11 `view-generic` — Cadastros (Clientes / Produtos / Transportadoras / Fornecedores)

- View única reutilizada. `#generic-title` recebe o texto do menu; `abaAtualAtiva` = nome da view (`clientes` | `produtos` | `transportadoras` | `fornecedores`) e é passado como **nome da aba** ao backend.
- Carga: `carregarDadosTabela(tipo)` → `obterDadosAba(tipo)` → envelope; linhas COM cabeçalho (colunas reais da aba da planilha). Cache em `dadosTabelaAtualCache`.
- Busca server-side com debounce 300ms: `#generic-search` → `pesquisarDadosAba(abaAtualAtiva, termo)`.
- Tabela: renderiza TODAS as colunas que o backend devolver + coluna "Ações" com botões Editar / Excluir por linha.
- **Modal de cadastro (`#modal-cadastro`)**: os campos são **gerados dinamicamente a partir dos cabeçalhos** (`linhas[0]`): um `<input type="text" id="modal-campo-{idx}">` por coluna, com label = nome do cabeçalho. Novo registro = inputs vazios; Editar = pré-preenchidos com a linha.
- Salvar (`salvarRegistroModal`) → `salvarRegistroGenerico({ aba: abaAtualAtiva, idOuChaveAntiga: novosDados[0], dados: novosDados })` — `dados` é o **array de valores na ordem das colunas**; a **coluna 0 é a chave primária** (upsert por chave). Retorna msg.
- Excluir → `excluirRegistroGenerico(abaAtualAtiva, chave)` com `chave = linha[0]`.
- **IMPORTANTE PARA O PORT**: o HTML **não contém** nenhuma config JS com os campos por entidade — o schema vem 100% dos cabeçalhos da planilha em runtime. O que dá para afirmar pelo próprio app:
  - **produtos**: pelo menos `codigo` (formato `PRD-0001`, gerado automaticamente na entrada manual/XML) e `descricao` (é o shape de `obterProdutosCadastrados()`); estoque agrega ainda qtd/valor unit., mas isso vive na movimentação, não no cadastro.
  - **clientes**: pelo menos código numérico + nome (padrão `"1206 - Leandro Bitencourt Silva"` usado na Saída) e endereço.
  - **fornecedores**: pelo menos nome (usado no Financeiro e na Entrada Manual); o import de XML "atualiza Fornecedores" (logo deve ter CNPJ + razão social do emitente da NF-e).
  - **transportadoras**: nenhum campo referenciado fora da view genérica.
  - Antes de fechar o schema do port, **exportar os cabeçalhos reais das 4 abas da planilha** (ou chamar `obterDadosAba` uma vez para cada) — a chave (coluna 0) provavelmente é o código.

---

## 2. Superfície completa do backend (google.script.run)

| Função | Args (como o front chama) | Retorno consumido |
|---|---|---|
| `doGet` | — (serve o HTML) | página |
| `obterVersaoBackend()` | — | string versão (comparada com `"2026-07-31.8"`; divergência = aviso no `#build-tag`) |
| `obterDadosKanban()` | — | `{linhas: [[cab],[id,titulo,solicitante,?,etapa,?,valor,...]], debug}` |
| `adicionarCartaoKanban(d)` | objeto da §1.2 | msg string |
| `atualizarEtapaCartao(id, novaEtapa)` | string, string exata da etapa | (ignora retorno; recarrega) |
| `obterDetalhesCartaoKanban(id)` | string | objeto cartão §1.1.1 (ou null) |
| `atualizarCartaoCompleto(id, {solicitante,setor,prazo,observacoes})` | | msg string |
| `excluirCartaoKanban(id)` | | msg string |
| `gerarPdfCartaoKanban(id)` | | URL do PDF |
| `obterDadosAba(aba)` / `pesquisarDadosAba(aba, termo)` | aba ∈ {clientes,produtos,transportadoras,fornecedores} | `{linhas com cabeçalho, debug}` |
| `salvarRegistroGenerico({aba, idOuChaveAntiga, dados[]})` | | msg string |
| `excluirRegistroGenerico(aba, chave)` | | msg string |
| `obterSaldoEstoqueAtual()` | — | `[[cod,desc,qtd,vUnit,vTotal],...]` sem cabeçalho |
| `obterListaProjetos()` | — | `string[]` |
| `obterProdutosCadastrados()` | — | `[{codigo, descricao}]` |
| `processarXmlNFe(xmlTexto, projeto)` | XML como texto UTF-8 + string | msg string |
| `salvarEntradaManual(d)` | objeto §1.5 | msg string |
| `salvarSaidaMaterial(d)` | objeto §1.6 | `{mensagem, protocolo}` |
| `pesquisarFinanceiroComData(forn, nf, proj, de, ate)` | 5 strings | `{linhas com cabeçalho, debug}` |
| `relatorioMovimentacaoEstoqueFiltrado('Entrada'\|'Saída', de, ate, projeto)` | | `{linhas 10 col sem cabeçalho, debug}` |
| `relatorioPorProjetoFiltrado(de, ate, projeto)` | | idem |
| `obterRelatorioPedidosCompra()` | — | `{linhas: [{id,titulo,solicitante,projeto,data,prazo,etapa}], debug}` |

---

## 3. Modelo de dados proposto (planilha → Postgres)

> Chave primária das abas genéricas = coluna 0 (código). IDs de cartão são strings geradas pelo backend GAS (formato não visível no front — verificar no Code.gs; sugerido preservar como `legacy_id` e migrar para sequência própria, ex. `SOL-0001`).

### 3.1 `solicitacoes` (cartões do Kanban / pedidos de compra)

```sql
CREATE TABLE solicitacoes (
  id            bigserial PRIMARY KEY,
  codigo        text UNIQUE NOT NULL,          -- ID do cartão legado (row[0])
  titulo        text NOT NULL,                 -- SEM o sufixo " | Itens: ..." (normalizar na migração!)
  solicitante   text NOT NULL,                 -- seuNome / edit-solicitante
  pedido_por    text,                          -- pedidoPor
  setor         text,                          -- ALMOX/OBRA/FÁBRICA (livre)
  departamento  text,                          -- enum lógico: Almoxarifado|Produção|Manutenção|Administrativo|Projetos
  projeto       text,                          -- FK lógica p/ projetos.nome (legado é string livre)
  etapa         text NOT NULL DEFAULT '1. Solicitado (Entrada)',  -- enum das 7 etapas
  data_solicitacao date,                       -- cartao.data
  prazo_entrega date,                          -- cartao.prazo
  observacoes   text,
  valor         numeric(14,2) DEFAULT 0,       -- row[6] do kanban
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE solicitacao_itens (               -- hoje serializados no título como " | Itens: a | b"
  id              bigserial PRIMARY KEY,
  solicitacao_id  bigint REFERENCES solicitacoes(id) ON DELETE CASCADE,
  material        text NOT NULL,               -- sol-mat-nome
  quantidade      text NOT NULL,               -- sol-mat-qtd é TEXTO LIVRE ("10 PÇ") no legado; opcional: split em qtd numeric + unidade
  justificativa   text
);
```

### 3.2 `produtos`

```sql
CREATE TABLE produtos (
  id         bigserial PRIMARY KEY,
  codigo     text UNIQUE NOT NULL,   -- 'PRD-0001'; gerar sequencial no app (legado: "Código automático")
  descricao  text NOT NULL,
  unidade    text DEFAULT 'UN',
  -- + colunas extras que existirem no cabeçalho da aba Produtos (conferir via obterDadosAba)
  created_at timestamptz DEFAULT now()
);
```

### 3.3 `clientes`

```sql
CREATE TABLE clientes (
  id        bigserial PRIMARY KEY,
  codigo    text UNIQUE NOT NULL,    -- ex. '1206' (exibido como "1206 - Nome")
  nome      text NOT NULL,
  endereco  text,                    -- usado no Protocolo de Entrega
  -- + colunas extras da aba Clientes
  created_at timestamptz DEFAULT now()
);
```

### 3.4 `fornecedores`

```sql
CREATE TABLE fornecedores (
  id           bigserial PRIMARY KEY,
  codigo       text UNIQUE,          -- se a aba tiver; senão usar cnpj
  nome         text NOT NULL,        -- razão social (emitente do XML)
  cnpj         text,                 -- vem do XML NF-e (emit/CNPJ)
  -- + colunas extras da aba Fornecedores (IE, endereço, telefone...)
  created_at   timestamptz DEFAULT now()
);
```

### 3.5 `transportadoras`

```sql
CREATE TABLE transportadoras (
  id      bigserial PRIMARY KEY,
  codigo  text UNIQUE,
  nome    text NOT NULL
  -- schema real 100% dependente do cabeçalho da aba — conferir antes de migrar
);
```

### 3.6 `projetos`

Legado: só uma lista de strings (`obterListaProjetos`) + campo texto-livre em todos os lançamentos.

```sql
CREATE TABLE projetos (
  id    bigserial PRIMARY KEY,
  nome  text UNIQUE NOT NULL         -- "Obra Shopping Norte"
);
```

### 3.7 `estoque_movimentos` (aba de movimentação de estoque — entradas e saídas na mesma tabela)

Deduzido do shape de 10 colunas dos relatórios (que é a projeção direta da aba):

```sql
CREATE TABLE estoque_movimentos (
  id               bigserial PRIMARY KEY,
  data             date NOT NULL,                       -- row[0]
  produto_codigo   text NOT NULL REFERENCES produtos(codigo),  -- row[1]
  descricao        text,                                -- row[2] (denormalizado no legado)
  tipo             text NOT NULL CHECK (tipo IN ('Entrada','Saída')),  -- row[3]
  quantidade       numeric(14,3) NOT NULL,              -- row[4]
  unidade          text DEFAULT 'UN',                   -- itens de saída carregam unidade
  valor_unitario   numeric(14,2) DEFAULT 0,             -- row[5]; saída pode usar custo do estoque
  valor_total      numeric(14,2) DEFAULT 0,             -- row[6]
  documento        text,                                -- row[7] Documento/NF (nº NF, 'MAN-001' ou nº protocolo)
  fornecedor       text,                                -- row[8] (entradas)
  projeto          text,                                -- row[9] centro de custo
  created_at       timestamptz DEFAULT now()
);
-- Saldo atual (view-estoque-atual): agregação
-- SELECT produto_codigo, descricao,
--        SUM(CASE tipo WHEN 'Entrada' THEN quantidade ELSE -quantidade END) qtd_atual,
--        <último/médio> valor_unitario, qtd_atual*valor_unitario valor_total ...
```

### 3.8 `saidas` (cabeçalho do protocolo de saída)

O legado provavelmente só grava linhas de movimento, mas o protocolo tem cabeçalho próprio — no port vale normalizar:

```sql
CREATE TABLE saidas (
  id               bigserial PRIMARY KEY,
  numero_protocolo text UNIQUE NOT NULL,   -- gerado se documento vazio ("automático")
  data_emissao     date NOT NULL,
  hora_estoque     time,                   -- protocolo.horaEstoque
  projeto          text NOT NULL,
  cliente          text,                   -- "codigo - nome" no legado; ideal: cliente_id FK
  endereco_cliente text,
  observacoes      text,
  natureza_operacao text DEFAULT '9 - Saída de material',  -- fixo no legado
  tipo_movimento   text DEFAULT '6',                        -- fixo no legado
  created_at       timestamptz DEFAULT now()
);
-- itens da saída = estoque_movimentos com tipo='Saída' e documento = numero_protocolo
```

### 3.9 `financeiro_parcelas` (Contas a Pagar)

Colunas mínimas comprovadas pelos cabeçalhos que o front procura + payloads de entrada:

```sql
CREATE TABLE financeiro_parcelas (
  id              bigserial PRIMARY KEY,
  fornecedor      text,                    -- cabeçalho 'Fornecedor'
  nota_fiscal     text,                    -- cabeçalho 'Nota Fiscal' (nNF do XML ou man-doc)
  data_vencimento date,                    -- cabeçalho 'Data Vencimento'
  valor           numeric(14,2) NOT NULL,  -- cabeçalho contendo 'Valor'
  status          text DEFAULT 'Em aberto',-- cabeçalho contendo 'Status' (valores exatos: conferir na planilha)
  projeto         text,                    -- cabeçalho 'Projeto'
  origem          text,                    -- 'xml' | 'manual' (sugestão port)
  created_at      timestamptz DEFAULT now()
);
```

### 3.10 Mapeamento aba → tabela (resumo)

| Aba planilha (inferida) | Tabela Postgres | Origem dos dados |
|---|---|---|
| Kanban/Solicitações | `solicitacoes` + `solicitacao_itens` | form Nova Solicitação; itens hoje serializados no título |
| Clientes | `clientes` | view-generic |
| Produtos | `produtos` | view-generic + auto-criação por XML/entrada manual |
| Transportadoras | `transportadoras` | view-generic |
| Fornecedores | `fornecedores` | view-generic + upsert pelo XML |
| Movimentação Estoque | `estoque_movimentos` (+`saidas`) | XML, entrada manual, saída |
| Financeiro | `financeiro_parcelas` | XML (duplicatas) + pagamentos da entrada manual |
| (lista de projetos) | `projetos` | `obterListaProjetos` |

---

## 4. Pontos de atenção para o port

1. **Materiais da solicitação são serializados dentro do TÍTULO do cartão** (`"titulo | Itens: a | b"`). Todo o Kanban, detalhes, relatório de pedidos e PDF dependem desse formato. No port, normalizar em `solicitacao_itens` e montar o texto só para exibição/compat.
2. **Quantidade da solicitação é texto livre** ("10 PÇ") — quantidade e unidade juntas num campo.
3. `sol-prazo` tem `*` no label mas não é validado no JS; `sol-mat-just` idem.
4. **Edição de cartão é parcial** (só solicitante/setor/prazo/observações) — materiais e projeto não editáveis no legado.
5. **XML NF-e chega como texto puro** (readAsText UTF-8), não base64; todo o processamento (fornecedor+estoque+financeiro+parcelas) é server-side e a UI só recebe uma mensagem.
6. **Entrada manual cria produto novo com código automático** (PRD-xxxx) a partir da descrição; a saída exige código existente (datalist de `obterProdutosCadastrados`).
7. **Número do protocolo de saída é gerado pelo backend** quando `sai-doc` vazio; a impressão do protocolo dispara automaticamente após salvar, com campos fixos "Natureza de Operação: 9" e "Tipo de Movimento: 6".
8. **Financeiro não tem baixa/edição na UI** — só consulta+filtro+impressão. Status existe na planilha mas não é alterável pelo front.
9. **Saldo de estoque é derivado** (não há aba de saldo editável) — implementar como view/agr. sobre `estoque_movimentos`.
10. **Cadastros genéricos são schema-less no front** — colunas reais vêm dos cabeçalhos da planilha; upsert por coluna-0 como chave (renomear a chave = `idOuChaveAntiga`). Exportar os cabeçalhos reais antes de congelar o schema.
11. Handshake de versão frontend×backend (`obterVersaoBackend`) — no port, trocar por header/endpoint de versão do build.
12. Todos os retornos de listagem podem vir como JSON-string; o novo backend deve padronizar `{linhas, debug}` fora ou aposentar o envelope.
