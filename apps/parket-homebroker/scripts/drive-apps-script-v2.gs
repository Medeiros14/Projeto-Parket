/**
 * PARKET DRIVE APPS SCRIPT v2 (Home Broker + Projetos)
 * ----------------------------------------------------
 * O QUE: web app unico que centraliza toda operacao de pasta/arquivo no
 * shared drive de clientes da Parket. Substitui o script v1 (que so criava
 * pasta de projeto) mantendo 100% de compatibilidade com o payload antigo
 * usado pelo gestao e pelo Space ({client_name, root_folder_id}).
 *
 * ACOES (campo "action" do JSON; sem "action" = create_folder, backcompat):
 *   create_folder   -> cria/acha pasta do cliente sob root_folder_id (v1)
 *   ensure_hb_folder-> garante "Home Broker/<CLIENTE>" (funil comercial);
 *                      se o cliente ja tem pasta na area de Projetos, reusa
 *   upload_file     -> salva arquivo base64 dentro da pasta do cliente
 *   upsert_file     -> cria OU atualiza arquivo pelo nome (orcamento editado
 *                      substitui o PDF no Drive, mesmo file_id, e o Drive
 *                      guarda o historico de versoes nativamente)
 *   upload_from_url -> o PROPRIO script baixa o arquivo de uma URL publica
 *                      (UrlFetchApp) e salva na pasta com upsert por nome.
 *                      Serve pra arquivo de 35-50MB que nao passa no POST
 *                      base64; limite aqui e o do UrlFetchApp (~50MB)
 *   get_upload_token-> devolve o OAuth token do script (sistemas@) pra um
 *                      backend confiavel fazer upload RESUMABLE direto na
 *                      Drive API (arquivo >50MB, sem limite). Exige secret
 *                      (Script Property TOKEN_SECRET) porque o /exec e
 *                      publico; sem secret configurado a action recusa
 *   move_folder     -> move pasta pra area de Projetos (fechou negocio)
 *   archive_folder  -> move pasta pra "Home Broker/_Arquivo" (lead perdido)
 *   list_folder     -> lista arquivos+subpastas de um folder_id (painel do
 *                      card no HB pra vendedor SEM conta Google; read-only,
 *                      sem secret, mesma postura do upload_file)
 *   create_subfolder-> cria subpasta em parent_id (painel do card no HB)
 *
 * REGRAS DE NEGOCIO (Will 01/09/2026):
 *   - 1 pasta por CLIENTE (dedup por nome normalizado), nunca por card
 *   - NUNCA deletar nem mandar pra lixeira (purga em 30d e o cliente pode
 *     voltar em 1 ano): arquivamento = mover pra _Arquivo, delete e manual
 *   - mover pasta NAO troca o folder_id, entao links salvos continuam validos
 *
 * DEPLOY: colar no editor do Apps Script existente (mesmo projeto do v1),
 * Implantar > Gerenciar implantacoes > editar > Nova versao. A URL /exec
 * NAO muda, entao gestao/Space continuam funcionando sem redeploy.
 * OBRIGATORIO pro upsert_file: no editor, menu Servicos (+) > adicionar
 * "Drive API" (v3). Sem isso o update de conteudo do arquivo nao funciona
 * (DriveApp puro nao substitui conteudo mantendo o mesmo file_id).
 *
 * LIMITE: payload POST do Apps Script ~50MB; base64 infla ~33%, entao o
 * upload_file aguenta arquivo de ate ~35MB. Acima disso o chamador deve
 * cair no fallback (Supabase Storage).
 */

// ── CONFIG ──────────────────────────────────────────────────────────────
// Pasta "Home Broker" criada pelo Will 01/09 (shared drive > Comercial >
// Home Broker). E a raiz das pastas de lead do funil comercial.
var HB_FOLDER_ID = '1BHyQaT_IonZKgauWUd2JcogF3yd-ULC_';
// Area de Projetos: raiz onde vivem as pastas de cliente fechado (mesmo
// root que o gestao ja usa como DRIVE_ROOT_FOLDER, em OUTRO shared drive).
// ATENCAO: o Google nao move PASTA entre shared drives; o move_folder
// detecta isso e migra recriando a estrutura + movendo os arquivos.
var PROJETOS_ROOT_ID = '0AF-R0Sev8WPcUk9PVA';
// Subpasta de arquivamento dos leads perdidos (dentro da Home Broker).
var ARQUIVO_FOLDER_NAME = '_Arquivo';

// ── ROUTER ──────────────────────────────────────────────────────────────
function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents);
    // Sem "action" = contrato v1 do gestao/Space (create_folder).
    var action = req.action || 'create_folder';
    if (action === 'create_folder')       out = acaoCreateFolder(req);
    else if (action === 'ensure_hb_folder') out = acaoEnsureHbFolder(req);
    else if (action === 'upload_file')      out = acaoUploadFile(req);
    else if (action === 'upsert_file')      out = acaoUpsertFile(req);
    else if (action === 'upload_from_url')  out = acaoUploadFromUrl(req);
    else if (action === 'get_upload_token') out = acaoGetUploadToken(req);
    else if (action === 'move_folder')      out = acaoMoveFolder(req);
    else if (action === 'archive_folder')   out = acaoArchiveFolder(req);
    else if (action === 'list_folder')      out = acaoListFolder(req);
    else if (action === 'create_subfolder') out = acaoCreateSubfolder(req);
    else out = { success: false, error: 'acao desconhecida: ' + action };
  } catch (err) {
    out = { success: false, error: String(err) };
  }
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

// GET simples pra smoke test no browser (nao expoe nada sensivel).
// v2.2 = v2.1 + list_folder/create_subfolder; a versao confirma o deploy.
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, version: 'v2.2' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── HELPERS ─────────────────────────────────────────────────────────────
// Normaliza nome de cliente pra dedup: minusculo, sem acento, espacos
// colapsados. "  Joao  da Silva " == "JOÃO DA SILVA" == mesma pasta.
function normalizarNome(nome) {
  return String(nome || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/\s+/g, ' ')                              // colapsa espacos
    .trim()
    .toLowerCase();
}

// Procura subpasta pelo nome NORMALIZADO dentro de um pai (dedup real,
// getFoldersByName do DriveApp e exact-match e nao serviria).
function acharSubpasta(paiFolder, nome) {
  var alvo = normalizarNome(nome);
  var it = paiFolder.getFolders();
  while (it.hasNext()) {
    var f = it.next();
    if (normalizarNome(f.getName()) === alvo) return f;
  }
  return null;
}

// Acha ou cria subpasta (nome exibido = nome original, match = normalizado).
function garantirSubpasta(paiFolder, nome) {
  var f = acharSubpasta(paiFolder, nome);
  if (f) return f;
  return paiFolder.createFolder(String(nome).replace(/\s+/g, ' ').trim());
}

// Pasta raiz "Home Broker" (id fixo, criada pelo Will no drive Comercial).
function pastaHomeBroker() {
  return DriveApp.getFolderById(HB_FOLDER_ID);
}

function respostaPasta(folder, extras) {
  var out = {
    success: true,
    folder_id: folder.getId(),
    folder_url: folder.getUrl(),
    folder_name: folder.getName()
  };
  if (extras) for (var k in extras) out[k] = extras[k];
  return out;
}

// ── ACOES ───────────────────────────────────────────────────────────────

// v1 (backcompat gestao/Space): pasta do cliente direto sob root_folder_id.
// req: { client_name, root_folder_id? }
function acaoCreateFolder(req) {
  if (!req.client_name) return { success: false, error: 'client_name obrigatorio' };
  var root = DriveApp.getFolderById(req.root_folder_id || PROJETOS_ROOT_ID);
  return respostaPasta(garantirSubpasta(root, req.client_name));
}

// Pasta do lead no funil comercial: "Home Broker/<CLIENTE>".
// Se o cliente JA tem pasta na area de Projetos (fechou antes / voltou),
// reusa essa em vez de criar duplicata no Home Broker.
// req: { client_name }
function acaoEnsureHbFolder(req) {
  if (!req.client_name) return { success: false, error: 'client_name obrigatorio' };
  var hb = pastaHomeBroker();

  // 1. Ja existe no Home Broker? (inclui _Arquivo: lead perdido que voltou
  //    e desarquivado automaticamente, movendo de volta pro Home Broker)
  var f = acharSubpasta(hb, req.client_name);
  if (f) return respostaPasta(f, { origem: 'home_broker' });
  var arquivo = acharSubpasta(hb, ARQUIVO_FOLDER_NAME);
  if (arquivo) {
    f = acharSubpasta(arquivo, req.client_name);
    if (f) { f.moveTo(hb); return respostaPasta(f, { origem: 'desarquivada' }); }
  }

  // 2. Ja existe na area de Projetos? (cliente antigo que fechou) Reusa.
  var root = DriveApp.getFolderById(PROJETOS_ROOT_ID);
  f = acharSubpasta(root, req.client_name);
  if (f) return respostaPasta(f, { origem: 'projetos' });

  // 3. Nao existe em lugar nenhum: cria no Home Broker.
  return respostaPasta(garantirSubpasta(hb, req.client_name), { origem: 'criada' });
}

// Upload de anexo do vendedor pra pasta do cliente.
// req: { folder_id, filename, mime_type?, data_base64 }
function acaoUploadFile(req) {
  if (!req.folder_id)   return { success: false, error: 'folder_id obrigatorio' };
  if (!req.filename)    return { success: false, error: 'filename obrigatorio' };
  if (!req.data_base64) return { success: false, error: 'data_base64 obrigatorio' };
  var folder = DriveApp.getFolderById(req.folder_id);
  var blob = Utilities.newBlob(
    Utilities.base64Decode(req.data_base64),
    req.mime_type || 'application/octet-stream',
    req.filename
  );
  var file = folder.createFile(blob);
  return {
    success: true,
    file_id: file.getId(),
    file_url: file.getUrl(),
    // download_url serve pra <a href> direto (sem viewer do Drive)
    download_url: 'https://drive.google.com/uc?id=' + file.getId() + '&export=download',
    name: file.getName(),
    bytes: file.getSize(),
    mime_type: file.getMimeType(),
    folder_id: folder.getId()
  };
}

// Cria OU atualiza arquivo pelo NOME dentro da pasta (caso de uso: PDF do
// orcamento; proposta editada substitui o conteudo mantendo o mesmo file_id,
// entao links salvos continuam validos e o Drive guarda as versoes antigas
// no historico nativo do arquivo). Match de nome usa a mesma normalizacao
// das pastas (acento/caixa/espacos).
// req: { folder_id, filename, mime_type?, data_base64 }
function acaoUpsertFile(req) {
  if (!req.folder_id)   return { success: false, error: 'folder_id obrigatorio' };
  if (!req.filename)    return { success: false, error: 'filename obrigatorio' };
  if (!req.data_base64) return { success: false, error: 'data_base64 obrigatorio' };
  var folder = DriveApp.getFolderById(req.folder_id);
  var blob = Utilities.newBlob(
    Utilities.base64Decode(req.data_base64),
    req.mime_type || 'application/octet-stream',
    req.filename
  );
  return upsertBlobPorNome(folder, blob);
}

// Nucleo do upsert: dado um blob ja montado (com nome), cria OU substitui
// o arquivo de mesmo nome normalizado dentro da pasta. Compartilhado entre
// upsert_file (base64 no POST) e upload_from_url (script baixa sozinho).
function upsertBlobPorNome(folder, blob) {
  // Procura arquivo existente com o mesmo nome normalizado.
  var alvo = normalizarNome(blob.getName());
  var existente = null;
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (normalizarNome(f.getName()) === alvo) { existente = f; break; }
  }

  var file, atualizado;
  if (existente) {
    // Drive API v3 (servico avancado): substitui o CONTEUDO mantendo id.
    Drive.Files.update({}, existente.getId(), blob, { supportsAllDrives: true });
    file = DriveApp.getFileById(existente.getId());
    atualizado = true;
  } else {
    file = folder.createFile(blob);
    atualizado = false;
  }
  return {
    success: true,
    file_id: file.getId(),
    file_url: file.getUrl(),
    download_url: 'https://drive.google.com/uc?id=' + file.getId() + '&export=download',
    name: file.getName(),
    bytes: file.getSize(),
    updated: atualizado,          // true = substituiu versao anterior
    folder_id: folder.getId()
  };
}

// Arquivo GRANDE (>35MB nao passa no POST base64): o script baixa direto da
// URL publica (bucket card-attachments do Supabase, por ex.) via UrlFetchApp
// e salva na pasta com o MESMO upsert por nome do upsert_file (rerun-safe).
// Limite: resposta do UrlFetchApp e ~50MB; acima disso retorna erro e o
// chamador mantem o arquivo onde esta.
// req: { folder_id, filename, mime_type?, source_url }
function acaoUploadFromUrl(req) {
  if (!req.folder_id)  return { success: false, error: 'folder_id obrigatorio' };
  if (!req.filename)   return { success: false, error: 'filename obrigatorio' };
  if (!req.source_url) return { success: false, error: 'source_url obrigatorio' };
  var resp = UrlFetchApp.fetch(req.source_url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    return { success: false,
             error: 'download falhou: HTTP ' + resp.getResponseCode() };
  }
  // Renomeia o blob: o nome que vale e o do anexo, nao o do path da URL.
  var blob = resp.getBlob()
    .setName(req.filename)
    .setContentType(req.mime_type || 'application/octet-stream');
  return upsertBlobPorNome(DriveApp.getFolderById(req.folder_id), blob);
}

// Arquivo MUITO grande (>50MB, alem do UrlFetchApp): entrega o OAuth token
// da conta do script (sistemas@) pra um backend confiavel fazer o upload
// RESUMABLE direto na Drive API v3 (sem limite pratico de tamanho).
// SEGURANCA: o /exec e publico (a URL esta no bundle do frontend), entao a
// action exige um secret que vive em Script Properties (Configuracoes do
// projeto > Propriedades do script > TOKEN_SECRET), fora do codigo e do
// git. Sem a property configurada a action recusa sempre (fail closed).
// O token expira em ~1h e tem so os escopos que o script ja usa (Drive).
// req: { secret }
function acaoGetUploadToken(req) {
  var secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET');
  if (!secret) {
    return { success: false,
             error: 'TOKEN_SECRET nao configurado nas Script Properties' };
  }
  if (!req.secret || req.secret !== secret) {
    return { success: false, error: 'secret invalido' };
  }
  return { success: true, token: ScriptApp.getOAuthToken(), expires_in_s: 3600 };
}

// Move todo o conteudo de uma pasta pra outra, recursivamente (usado na
// migracao entre shared drives, onde mover a PASTA em si nao e permitido;
// arquivos movem normal e mantem o mesmo file_id).
function migrarConteudo(srcFolder, destFolder) {
  var fit = srcFolder.getFiles();
  while (fit.hasNext()) fit.next().moveTo(destFolder);
  var dit = srcFolder.getFolders();
  while (dit.hasNext()) {
    var sub = dit.next();
    migrarConteudo(sub, garantirSubpasta(destFolder, sub.getName()));
  }
}

// Cliente fechou: move a pasta pra area de Projetos (ou destino explicito).
// Mesmo shared drive = move direto (folder_id nao muda). Shared drive
// diferente = Google nao deixa mover pasta, entao recria a pasta no destino,
// move os arquivos (file_ids mantidos) e arquiva a casca vazia no _Arquivo.
// Nesse caso o retorno traz o folder_id NOVO: o chamador PRECISA atualizar
// kanban_cards.details.drive_folder_id.
// req: { folder_id, dest_folder_id? }
function acaoMoveFolder(req) {
  if (!req.folder_id) return { success: false, error: 'folder_id obrigatorio' };
  var folder = DriveApp.getFolderById(req.folder_id);
  var dest = DriveApp.getFolderById(req.dest_folder_id || PROJETOS_ROOT_ID);
  // Idempotente: ja esta no destino? Nao move de novo.
  var pais = folder.getParents();
  while (pais.hasNext()) {
    if (pais.next().getId() === dest.getId()) {
      return respostaPasta(folder, { moved: false, motivo: 'ja estava no destino' });
    }
  }
  try {
    folder.moveTo(dest);
    return respostaPasta(folder, { moved: true });
  } catch (err) {
    // Destino em OUTRO shared drive: migra conteudo e arquiva a casca.
    var nova = garantirSubpasta(dest, folder.getName());
    migrarConteudo(folder, nova);
    folder.moveTo(garantirSubpasta(pastaHomeBroker(), ARQUIVO_FOLDER_NAME));
    return respostaPasta(nova, {
      moved: true,
      migrated: true,              // pasta recriada no outro drive
      old_folder_id: folder.getId() // casca vazia arquivada no _Arquivo
    });
  }
}

// Lead perdido ha X dias: arquiva em "Home Broker/_Arquivo".
// NUNCA usa lixeira (purga em 30 dias); apagar de verdade e sempre manual.
// req: { folder_id }
function acaoArchiveFolder(req) {
  if (!req.folder_id) return { success: false, error: 'folder_id obrigatorio' };
  var folder = DriveApp.getFolderById(req.folder_id);
  var arquivo = garantirSubpasta(pastaHomeBroker(), ARQUIVO_FOLDER_NAME);
  // Idempotente: ja arquivada? Nao move de novo.
  var pais = folder.getParents();
  while (pais.hasNext()) {
    if (pais.next().getId() === arquivo.getId()) {
      return respostaPasta(folder, { archived: false, motivo: 'ja estava no _Arquivo' });
    }
  }
  folder.moveTo(arquivo);
  return respostaPasta(folder, { archived: true });
}

// Lista o conteudo de uma pasta pro painel "Drive do cliente" no card do HB.
// E o modo FALLBACK do painel: vendedor sem conta Google enxerga a pasta
// atraves do script (que roda como sistemas@). Read-only e sem secret, mesma
// postura do upload_file (o /exec ja e publico e a pasta so tem anexo de
// cliente). Pastas vem primeiro, depois arquivos, ambos em ordem alfabetica.
// req: { folder_id }
function acaoListFolder(req) {
  if (!req.folder_id) return { success: false, error: 'folder_id obrigatorio' };
  var folder = DriveApp.getFolderById(req.folder_id);

  var pastas = [];
  var dit = folder.getFolders();
  while (dit.hasNext()) {
    var d = dit.next();
    pastas.push({
      id: d.getId(),
      name: d.getName(),
      mime_type: 'application/vnd.google-apps.folder',
      is_folder: true,
      size: 0,
      modified: d.getLastUpdated().toISOString(),
      url: d.getUrl()
    });
  }

  var arquivos = [];
  var fit = folder.getFiles();
  while (fit.hasNext()) {
    var f = fit.next();
    arquivos.push({
      id: f.getId(),
      name: f.getName(),
      mime_type: f.getMimeType(),
      is_folder: false,
      size: f.getSize(),
      modified: f.getLastUpdated().toISOString(),
      url: f.getUrl()
    });
  }

  var porNome = function (a, b) {
    return normalizarNome(a.name) < normalizarNome(b.name) ? -1 : 1;
  };
  pastas.sort(porNome);
  arquivos.sort(porNome);

  return {
    success: true,
    folder_id: folder.getId(),
    folder_name: folder.getName(),
    folder_url: folder.getUrl(),
    files: pastas.concat(arquivos)
  };
}

// Cria (ou reusa, dedup por nome normalizado) uma subpasta dentro de
// parent_id. Usado pelo botao "Nova pasta" do painel do card no HB em modo
// fallback (sem conta Google); o modo nativo cria direto na Drive API.
// req: { parent_id, name }
function acaoCreateSubfolder(req) {
  if (!req.parent_id) return { success: false, error: 'parent_id obrigatorio' };
  if (!req.name || !String(req.name).trim()) {
    return { success: false, error: 'name obrigatorio' };
  }
  var pai = DriveApp.getFolderById(req.parent_id);
  return respostaPasta(garantirSubpasta(pai, req.name), { parent_id: pai.getId() });
}
