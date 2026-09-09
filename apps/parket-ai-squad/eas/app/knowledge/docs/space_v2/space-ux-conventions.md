# Convenções de UX/UI — Space Parket

Padrões que mantêm a coerência das ~10 plataformas. Antes de propor uma mudança, audite contra estas convenções.

## Linguagem visual oficial

### Tipografia (pranchas + proposta + dashboard)
- **Texto preto bold sem caixa** pra labels primários (em pranchas e UI). Memória `project_pranchas_visual_parket`.
- **Cinza médio** pra info secundária / off-disciplina. NUNCA caixa cinza atrás do label.
- Hierarquia clara H1/H2/H3 semânticos — não usar `<h1>` em todo lugar pra ficar grande.
- **Lâmina no nome do produto:** PAINEL/REVESTIMENTO/FORRO com acabamento LÂMINA — o nome TEM que sair com "LÂMINA". Nunca stripar.

### Cores Parket (golden — dark mode)
- Fundo principal: `#0A0A0A`
- Dourado primário: `#D4A853` (CTAs, destaque)
- Taupe secundário: `#B8AA9A` (botões secundários, bordas)
- Texto principal: branco / `rgba(255,255,255,0.9)`
- Texto secundário: `rgba(255,255,255,0.5)` / `rgba(255,255,255,0.3)`
- Borders sutis: `rgba(184,170,154,0.15-0.3)`

### Theme Navona (em construção, /v2/)
- Mais editorial / "tipográfico", paleta mais quente. Aplicado via tokens (não hardcoded).
- Memória `project_navona*` e `Caminho D Step 2` (#674) ✅ tokens + fontes no source.

### Microinterações
- **Com propósito.** Loading state real, não decorativo.
- 300ms ease-out padrão pra transitions de modal/drawer.
- Skeleton loaders que casam com o layout final (não pop genérico).
- Respeitar `prefers-reduced-motion`.

## Fluxos críticos (memória + tasks)

### Criar orçamento (Space simulador → proposta)
1. Card no Kanban Comercial → tab Simulador
2. Adicionar ambiente → escolher material no catálogo
3. Edit modal: T(prev=>...) sync + await update + **AUX-merge** (NUNCA `g()` completo) — `feedback_orcamento_optimistic_update`
4. Gravar subtipo (RIPADO/TOBLERONE/RÉGUA) na categoria — `feedback`
5. Box ✓ pra marcar proposta principal (3 partes acopladas: data-attrs MARCFIX + pkt2 + main.py) — `feedback_proposta_principal_selector`
6. Link de proposta termina em `&v=<timestamp>` (OG preview WhatsApp)

### Edit modal de RECORTES (#756 in progress)
- Botão ✏️ em linha de RECORTES deve abrir modal rico do catálogo (igual o de criação).
- Critical: NÃO recriar — reusar o componente existente.

### PDF/Print
- proposta-publica-page-V*FIX precisa incluir `frete_valor` no objeto passado pro `propostaGenerator`.
- Lista ASSETS de force-reload deve incluir novos chunks.
- PDF Pranchas Custom: **PX_PER_MM ≤ 6** (cairosvg rejeita PNG alta resolução em ≥ 7).

## Anti-padrões (não fazer)

- ❌ Não recriar componente que já existe (memória `feedback_escopo_minimo`). Reusar.
- ❌ Não usar emoji nas UIs (a menos que pedido específico).
- ❌ Não copiar Figma pixel-perfect sem semântica HTML / a11y.
- ❌ Não introduzir biblioteca nova sem auditar o que já existe (26 Radix + shadcn cobrem 95%).
- ❌ Não usar `dangerouslySetInnerHTML` exceto pra propostaGenerator (que já é controlado).
- ❌ Não bloquear UI durante save — sempre optimistic update com rollback em caso de erro.
- ❌ Não inventar feature flags pra rollback parcial — preferir hotpatch + rollback completo do chunk.

## A11y — mínimo aceito
- Contraste 4.5:1 (texto normal) e 3:1 (texto large).
- Touch targets ≥ 44×44px (mobile).
- Focus visível em todos elementos interativos.
- Modal: focus trap + Esc fecha + restore focus ao elemento que abriu.
- Labels associadas (`<label for>` ou `aria-labelledby`).
- ARIA roles corretos em comboboxes, dialogs, tabs (seguir APG).

## Mobile-first onde importa
- **proposta.parket.works** — cliente abre no celular. Prioridade máxima.
- **dashboard interno** — desktop primary, mas tem que rodar em tablet também.
- Touch + click events ambos suportados.

## Quando alterar UI do golden

Lista de checks antes de fazer:
1. Já tem componente parecido? Reusar.
2. Token de cor/spacing existe? Usar token, não hex.
3. Quebra a coerência cross-app? Verificar nas outras plataformas.
4. Tem teste/smoke a fazer pós-deploy?
5. Posso fazer em chunk separado (hotpatch isolado) ou precisa golden rebuild?

A resposta da última pergunta deve **sempre ser hotpatch isolado**. Golden não é rebuild rotineiro.
