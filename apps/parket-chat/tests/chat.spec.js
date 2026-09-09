/**
 * Teste ponta-a-ponta do Parket Chat (Playwright, chromium headless).
 * Três usuários de setores diferentes em contextos isolados:
 *   Ana   — Homebroker (setor 1)
 *   Carla — Valoria    (setor 2)
 *   Elisa — Compras    (setor 3)
 */
const { test, expect } = require('@playwright/test');

test.describe.configure({ mode: 'serial' });

let ctxAna, ctxCarla, ctxElisa;
let ana, carla, elisa;
let anaToken, carlaToken, elisaToken;
let obraThreadId;

async function loginWidget(page, email) {
  await page.goto('/exemplo-plataforma.html');
  await page.getByTestId('chat-fab').click();
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill('parket123');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('chat-panel')).toBeVisible({ timeout: 15000 });
  return page.evaluate(() => sessionStorage.getItem('pk-chat-token'));
}

async function sendMessage(page, text) {
  await page.getByTestId('message-input').fill(text);
  await page.getByTestId('send-button').click();
}

test.beforeAll(async ({ browser }) => {
  ctxAna = await browser.newContext();
  ctxCarla = await browser.newContext();
  ctxElisa = await browser.newContext();
  ana = await ctxAna.newPage();
  carla = await ctxCarla.newPage();
  elisa = await ctxElisa.newPage();
  anaToken = await loginWidget(ana, 'ana@parket.com.br');
  carlaToken = await loginWidget(carla, 'carla@parket.com.br');
  elisaToken = await loginWidget(elisa, 'elisa@parket.com.br');
});

test.afterAll(async () => {
  await ctxAna?.close();
  await ctxCarla?.close();
  await ctxElisa?.close();
});

test('1. usuários de setores diferentes logados em contextos separados', async () => {
  await expect(ana.locator('.pk-me-sector')).toHaveText('Homebroker');
  await expect(carla.locator('.pk-me-sector')).toHaveText('Valoria');
  await expect(elisa.locator('.pk-me-sector')).toHaveText('Compras');
});

test('2. conversa de obra: abrir, histórico e marcação de @Setor via autocomplete', async () => {
  // Ana abre a conversa da obra 101 pelo autocomplete
  await ana.getByTestId('nova-obra').click();
  await ana.getByTestId('obra-search-input').fill('Alameda');
  await ana.getByTestId('obra-result').first().click();
  await expect(ana.getByTestId('conv-title')).toContainText('Alameda Jaú');

  // Mensagem ANTES de qualquer marcação (histórico)
  await sendMessage(ana, 'Histórico: medição feita ontem no local');
  await expect(ana.getByTestId('message').last()).toContainText('medição feita ontem');

  // Antes da marcação, Carla (Valoria) NÃO vê a obra
  await expect(carla.locator('[data-testid^="obra-item-"]')).toHaveCount(0);

  // Marca @Valoria usando o autocomplete do @
  await ana.getByTestId('message-input').pressSequentially('Chamando @Valo');
  await expect(ana.getByTestId('mention-menu')).toBeVisible();
  await ana.getByTestId('mention-opt-sector-2').click();
  await ana.getByTestId('message-input').pressSequentially('para revisar o orçamento');
  await ana.getByTestId('send-button').click();

  // Menção destacada na mensagem enviada
  await expect(ana.getByTestId('mention').last()).toHaveText('@Valoria');
});

test('3. setor marcado passa a ver a obra COM o histórico anterior', async () => {
  // A obra aparece na sidebar da Carla em tempo real (evento obra:acesso)
  const item = carla.getByTestId('obra-item-101');
  await expect(item).toBeVisible({ timeout: 15000 });
  await item.click();

  // Vê inclusive a mensagem enviada ANTES da marcação
  await expect(carla.getByTestId('messages')).toContainText('Histórico: medição feita ontem no local');
  await expect(carla.getByTestId('messages')).toContainText('Chamando @Valoria');
  // Topo mostra os participantes: Ana (pessoa que criou) e o setor Valoria (marcado)
  await expect(carla.getByTestId('obra-members')).toContainText('Ana Souza');
  await expect(carla.getByTestId('obra-members')).toContainText('Valoria');
});

test('4. setor NÃO marcado NÃO vê a obra (sidebar e API → 403)', async () => {
  // Elisa (Compras) não tem a obra na sidebar
  await expect(elisa.locator('[data-testid^="obra-item-"]')).toHaveCount(0);

  // Descobre o thread_id real via bootstrap da Ana
  const boot = await ana.request.get('/api/bootstrap', {
    headers: { Authorization: 'Bearer ' + anaToken },
  });
  obraThreadId = (await boot.json()).obras_visiveis[0].thread_id;

  // Chamada direta à API com o token da Elisa → 403
  const res = await elisa.request.get('/api/messages?obra=' + obraThreadId, {
    headers: { Authorization: 'Bearer ' + elisaToken },
  });
  expect(res.status()).toBe(403);
});

test('5. menção a PESSOA concede acesso + badge laranja de menção (widget fechado)', async () => {
  // Elisa fecha o painel — o badge deve aparecer no ícone flutuante
  await elisa.getByTestId('chat-fab').click();
  await expect(elisa.getByTestId('chat-panel')).not.toBeVisible();

  // Ana menciona a pessoa @Elisa Ramos na obra
  await sendMessage(ana, '@Elisa Ramos consegue cotar o material?');

  // Badge laranja (menção) no ícone flutuante fechado
  const fabBadge = elisa.getByTestId('fab-badge');
  await expect(fabBadge).toBeVisible({ timeout: 15000 });
  await expect(fabBadge).toHaveClass(/pk-badge-mention/);

  // Reabre: obra na sidebar com badge laranja
  await elisa.getByTestId('chat-fab').click();
  const item = elisa.getByTestId('obra-item-101');
  await expect(item).toBeVisible();
  await expect(item.getByTestId('conv-badge')).toHaveClass(/pk-badge-mention/);

  // Abre e vê TODO o histórico da obra
  await item.click();
  await expect(elisa.getByTestId('messages')).toContainText('Histórico: medição feita ontem no local');
  await expect(elisa.getByTestId('messages')).toContainText('@Elisa Ramos');
});

test('6. canal #geral em tempo real + badge vermelho de não-lida', async () => {
  // Carla abre o #geral e fica esperando
  await carla.getByTestId('channel-item-geral').click();
  await expect(carla.getByTestId('conv-title')).toHaveText('#geral');

  // Ana envia no #geral
  await ana.getByTestId('channel-item-geral').click();
  await sendMessage(ana, 'Bom dia a todos os setores!');

  // Carla vê a mensagem chegar sem recarregar
  await expect(carla.getByTestId('messages')).toContainText('Bom dia a todos os setores!', { timeout: 15000 });

  // Elisa (em outra conversa) recebe badge VERMELHO (sem menção) no #geral
  const badge = elisa.getByTestId('channel-item-geral').getByTestId('conv-badge');
  await expect(badge).toBeVisible({ timeout: 15000 });
  await expect(badge).not.toHaveClass(/pk-badge-mention/);
});

test('7. mensagem direta (DM) entre dois usuários + presença online', async () => {
  // Ana cria DM com Carla (id 3)
  await ana.getByTestId('nova-dm').click();
  await ana.getByTestId('dm-pick-3').click();
  await expect(ana.getByTestId('conv-title')).toHaveText('Carla Mendes');
  await sendMessage(ana, 'Oi Carla, viu a obra da Alameda?');

  // DM aparece pra Carla em tempo real, com badge e presença online da Ana
  const dmItem = carla.getByTestId('dm-item-1');
  await expect(dmItem).toBeVisible({ timeout: 15000 });
  await expect(dmItem.getByTestId('conv-badge')).toBeVisible();
  await expect(carla.getByTestId('presence-1')).toHaveClass(/pk-on/);

  await dmItem.click();
  await expect(carla.getByTestId('messages')).toContainText('Oi Carla, viu a obra da Alameda?');
});

test('8. usuário não acessa canal de outro setor (API → 403)', async () => {
  // Canal do setor da Carla (valoria), descoberto pelo bootstrap dela
  const boot = await carla.request.get('/api/bootstrap', {
    headers: { Authorization: 'Bearer ' + carlaToken },
  });
  const canais = (await boot.json()).channels;
  const canalValoria = canais.find((c) => c.name === 'valoria');
  expect(canalValoria).toBeTruthy();

  // Ana (Homebroker) tenta ler o canal da Valoria → 403
  const res = await ana.request.get('/api/messages?channel=' + canalValoria.id, {
    headers: { Authorization: 'Bearer ' + anaToken },
  });
  expect(res.status()).toBe(403);

  // E Carla não vê o canal do Homebroker na própria lista
  expect(canais.some((c) => c.name === 'homebroker')).toBe(false);
});

test('9. menção NÃO vaza para homônimos-prefixo ("@Elisa Ramos" ≠ "Elisa"/"Eli")', async () => {
  // O teste 5 mencionou "@Elisa Ramos" (id 5). Os usuários "Elisa" (12) e
  // "Eli" (13) não podem ter virado membros da obra por substring do nome.
  const boot = await ana.request.get('/api/bootstrap', {
    headers: { Authorization: 'Bearer ' + anaToken },
  });
  const members = (await boot.json()).obras_visiveis[0].members;
  expect(members.some((m) => m.type === 'user' && m.id === '5')).toBe(true);
  expect(members.some((m) => m.type === 'user' && (m.id === '12' || m.id === '13'))).toBe(false);
});
