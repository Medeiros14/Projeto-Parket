-- ============================================================
-- Seed de modelos de documento — Fase A (5 críticos) + Fase B (~20)
-- HTML com placeholders: {{nome}}, {{cpf}}, {{empresa}}, {{cnpj}}, {{cargo}},
--   {{data}}, {{descricao}}, {{motivo}}, {{valor}}, {{periodo_de}}, {{periodo_ate}}, etc.
-- ============================================================

-- Limpa antes (idempotente)
DELETE FROM rh.modelos_documento WHERE tipo IN (
  'advertencia','contrato_clt','contrato_pj','termo_emprestimo','suspensao',
  'comunicado_desocupacao','nr','termo_celular','termo_veiculo','termo_aditivo_horario',
  'termo_antecipacao_ferias','trct','aviso_previo','dispensa_justa_causa',
  'ficha_registro','ficha_epi'
);

-- ──────────────────────────────────────────────────────────────
-- FASE A — 5 críticos
-- ──────────────────────────────────────────────────────────────

-- 1) Advertência (3 variantes em 1 paramétrico via campo "motivo_categoria")
INSERT INTO rh.modelos_documento (tipo, variante, titulo, categoria, ordem, conteudo_html, campos) VALUES
('advertencia', 'falta', 'Advertência por falta injustificada', 'advertencia', 10,
'<h1 style="text-align:center;text-transform:uppercase;letter-spacing:.05em">ADVERTÊNCIA POR ESCRITO</h1>
<p style="text-align:right;margin-top:30px">{{cidade}}, {{data}}</p>
<p style="margin-top:30px"><strong>Senhor(a)</strong> {{nome}},<br>CPF: {{cpf}}<br>Cargo: {{cargo}}</p>
<p style="margin-top:24px;text-align:justify">Comunicamos que <strong>{{empresa}}</strong> CNPJ {{cnpj}}, na qualidade de empregadora, vem por meio desta aplicar a presente <strong>ADVERTÊNCIA</strong> em razão de <strong>FALTAS INJUSTIFICADAS</strong> ocorridas em <strong>{{datas_faltas}}</strong>.</p>
<p style="text-align:justify">As faltas injustificadas constituem violação às obrigações contratuais e ao dever de assiduidade previsto no Art. 482 da CLT.</p>
<p style="text-align:justify">{{descricao_adicional}}</p>
<p style="text-align:justify;margin-top:24px"><strong>Reiteramos que a reincidência poderá ensejar aplicação de penalidade mais severa, incluindo suspensão e/ou rescisão por justa causa.</strong></p>
<p style="margin-top:40px">Atenciosamente,</p>
<p>____________________________<br>{{empresa}}<br>{{cnpj}}</p>
<p style="margin-top:30px">Ciente em ___/___/_____<br><br>____________________________<br>{{nome}}</p>',
'[
  {"key":"cidade","label":"Cidade","type":"text","required":true,"default":"São Paulo"},
  {"key":"data","label":"Data","type":"date","required":true},
  {"key":"datas_faltas","label":"Datas das faltas","type":"text","required":true,"placeholder":"ex: 03/05/2026, 04/05/2026"},
  {"key":"descricao_adicional","label":"Descrição adicional","type":"textarea"}
]'::jsonb),

('advertencia', 'atraso', 'Advertência por atrasos', 'advertencia', 11,
'<h1 style="text-align:center;text-transform:uppercase">ADVERTÊNCIA POR ESCRITO</h1>
<p style="text-align:right;margin-top:30px">{{cidade}}, {{data}}</p>
<p style="margin-top:30px"><strong>Senhor(a)</strong> {{nome}},<br>CPF: {{cpf}}<br>Cargo: {{cargo}}</p>
<p style="margin-top:24px;text-align:justify">A <strong>{{empresa}}</strong> CNPJ {{cnpj}} aplica a presente <strong>ADVERTÊNCIA</strong> em razão de <strong>ATRASOS</strong> registrados nos seguintes dias: <strong>{{datas_atrasos}}</strong>.</p>
<p style="text-align:justify">Esses atrasos prejudicam a continuidade do trabalho e violam o dever de pontualidade exigido pelo contrato e pela CLT.</p>
<p style="text-align:justify">{{descricao_adicional}}</p>
<p style="margin-top:24px;text-align:justify"><strong>A reincidência poderá ensejar penalidade mais severa.</strong></p>
<p style="margin-top:40px">Atenciosamente,</p>
<p>____________________________<br>{{empresa}}</p>
<p style="margin-top:30px">Ciente em ___/___/_____<br><br>____________________________<br>{{nome}}</p>',
'[
  {"key":"cidade","label":"Cidade","type":"text","required":true,"default":"São Paulo"},
  {"key":"data","label":"Data","type":"date","required":true},
  {"key":"datas_atrasos","label":"Datas dos atrasos","type":"text","required":true},
  {"key":"descricao_adicional","label":"Descrição adicional","type":"textarea"}
]'::jsonb),

('advertencia', 'saida_antecipada', 'Advertência por saída antecipada', 'advertencia', 12,
'<h1 style="text-align:center;text-transform:uppercase">ADVERTÊNCIA POR ESCRITO</h1>
<p style="text-align:right;margin-top:30px">{{cidade}}, {{data}}</p>
<p style="margin-top:30px"><strong>Senhor(a)</strong> {{nome}},<br>CPF: {{cpf}}<br>Cargo: {{cargo}}</p>
<p style="margin-top:24px;text-align:justify">A <strong>{{empresa}}</strong> aplica esta <strong>ADVERTÊNCIA</strong> em razão de <strong>SAÍDA ANTECIPADA INJUSTIFICADA</strong> nos dias: <strong>{{datas_saidas}}</strong>.</p>
<p style="text-align:justify">{{descricao_adicional}}</p>
<p style="margin-top:24px"><strong>A reincidência poderá ensejar penalidade mais severa.</strong></p>
<p style="margin-top:40px">Atenciosamente,</p>
<p>____________________________<br>{{empresa}}</p>
<p style="margin-top:30px">Ciente em ___/___/_____<br><br>____________________________<br>{{nome}}</p>',
'[{"key":"cidade","label":"Cidade","type":"text","required":true,"default":"São Paulo"},
  {"key":"data","label":"Data","type":"date","required":true},
  {"key":"datas_saidas","label":"Datas das saídas","type":"text","required":true},
  {"key":"descricao_adicional","label":"Descrição adicional","type":"textarea"}]'::jsonb),

-- 2) Contrato CLT (paramétrico — empresa é selecionada na emissão)
('contrato_clt', null, 'Contrato de trabalho CLT', 'contrato', 20,
'<h1 style="text-align:center;text-transform:uppercase">CONTRATO INDIVIDUAL DE TRABALHO</h1>
<p style="margin-top:24px;text-align:justify"><strong>EMPREGADOR:</strong> {{empresa}}, CNPJ {{cnpj}}, com sede em {{empresa_endereco}}, doravante denominada EMPREGADORA.</p>
<p style="text-align:justify"><strong>EMPREGADO:</strong> {{nome}}, CPF {{cpf}}, RG {{rg}}, residente em {{endereco}}, doravante denominado EMPREGADO.</p>
<h3 style="margin-top:24px">CLÁUSULA 1ª — OBJETO</h3>
<p style="text-align:justify">O EMPREGADO é admitido para exercer a função de <strong>{{cargo}}</strong>, cumprindo jornada de trabalho de <strong>{{jornada_horas}} horas semanais</strong>, das <strong>{{horario_inicio}}</strong> às <strong>{{horario_fim}}</strong>, com intervalo de {{intervalo}}.</p>
<h3>CLÁUSULA 2ª — REMUNERAÇÃO</h3>
<p style="text-align:justify">O salário do EMPREGADO é de <strong>R$ {{salario}}</strong> mensais, pagos até o 5º dia útil do mês subsequente.</p>
<h3>CLÁUSULA 3ª — VIGÊNCIA</h3>
<p style="text-align:justify">O presente contrato vigora a partir de <strong>{{data_admissao}}</strong>, com prazo de experiência de <strong>{{periodo_experiencia}} dias</strong>, prorrogável conforme CLT.</p>
<h3>CLÁUSULA 4ª — DEMAIS DISPOSIÇÕES</h3>
<p style="text-align:justify">Aplicam-se ao presente contrato as disposições da CLT, da Convenção Coletiva de Trabalho da categoria, e demais normas trabalhistas vigentes.</p>
<p style="margin-top:30px;text-align:right">{{cidade}}, {{data}}</p>
<table style="width:100%;margin-top:50px"><tr>
<td style="text-align:center;width:50%">____________________________<br><strong>EMPREGADOR</strong><br>{{empresa}}</td>
<td style="text-align:center;width:50%">____________________________<br><strong>EMPREGADO</strong><br>{{nome}}<br>CPF: {{cpf}}</td>
</tr></table>',
'[{"key":"cidade","label":"Cidade","type":"text","required":true,"default":"São Paulo"},
  {"key":"data","label":"Data","type":"date","required":true},
  {"key":"empresa_endereco","label":"Endereço da empresa","type":"text","required":true},
  {"key":"rg","label":"RG do empregado","type":"text"},
  {"key":"endereco","label":"Endereço do empregado","type":"text","required":true},
  {"key":"jornada_horas","label":"Jornada (horas/semana)","type":"number","default":44},
  {"key":"horario_inicio","label":"Horário início","type":"text","default":"08:00"},
  {"key":"horario_fim","label":"Horário fim","type":"text","default":"18:00"},
  {"key":"intervalo","label":"Intervalo","type":"text","default":"1 hora"},
  {"key":"salario","label":"Salário (R$)","type":"text","required":true},
  {"key":"data_admissao","label":"Data de admissão","type":"date","required":true},
  {"key":"periodo_experiencia","label":"Período experiência (dias)","type":"number","default":45}]'::jsonb),

-- 3) Termo de Empréstimo
('termo_emprestimo', null, 'Termo de empréstimo de equipamento', 'termo', 30,
'<h1 style="text-align:center;text-transform:uppercase">TERMO DE EMPRÉSTIMO</h1>
<p style="margin-top:24px;text-align:justify">Pelo presente termo, <strong>{{empresa}}</strong>, CNPJ {{cnpj}}, EMPRESTA ao(à) Sr(a). <strong>{{nome}}</strong>, CPF {{cpf}}, ocupante do cargo de {{cargo}}, o seguinte item:</p>
<table style="width:100%;border-collapse:collapse;margin-top:16px">
<tr style="background:#f0f0f0"><th style="border:1px solid #999;padding:6px;text-align:left">DESCRIÇÃO</th><th style="border:1px solid #999;padding:6px">SÉRIE/PATRIMÔNIO</th><th style="border:1px solid #999;padding:6px">VALOR</th></tr>
<tr><td style="border:1px solid #999;padding:6px">{{descricao_item}}</td><td style="border:1px solid #999;padding:6px;text-align:center">{{numero_serie}}</td><td style="border:1px solid #999;padding:6px;text-align:right">R$ {{valor}}</td></tr>
</table>
<h3 style="margin-top:24px">CONDIÇÕES</h3>
<ul style="text-align:justify">
<li>O equipamento deverá ser usado <strong>exclusivamente para fins profissionais</strong>.</li>
<li>O EMPREGADO se responsabiliza pela <strong>guarda, manutenção e devolução</strong> em perfeito estado.</li>
<li>Em caso de dano por negligência, perda ou furto, o valor será descontado em folha conforme CLT.</li>
<li>O equipamento deve ser <strong>devolvido no encerramento do contrato</strong> ou quando solicitado pela empresa.</li>
</ul>
<p style="margin-top:30px;text-align:right">{{cidade}}, {{data}}</p>
<table style="width:100%;margin-top:50px"><tr>
<td style="text-align:center;width:50%">____________________________<br><strong>EMPRESA</strong><br>{{empresa}}</td>
<td style="text-align:center;width:50%">____________________________<br><strong>FUNCIONÁRIO</strong><br>{{nome}}<br>CPF: {{cpf}}</td>
</tr></table>',
'[{"key":"cidade","label":"Cidade","type":"text","required":true,"default":"São Paulo"},
  {"key":"data","label":"Data","type":"date","required":true},
  {"key":"descricao_item","label":"Descrição do item","type":"textarea","required":true,"placeholder":"ex: Notebook Dell Latitude 5440, 16GB RAM, 512GB SSD"},
  {"key":"numero_serie","label":"Número de série / patrimônio","type":"text"},
  {"key":"valor","label":"Valor do item (R$)","type":"text","required":true}]'::jsonb),

-- 4) Suspensão por falta
('suspensao', null, 'Suspensão disciplinar', 'advertencia', 13,
'<h1 style="text-align:center;text-transform:uppercase">SUSPENSÃO DISCIPLINAR</h1>
<p style="text-align:right;margin-top:30px">{{cidade}}, {{data}}</p>
<p style="margin-top:30px"><strong>Senhor(a)</strong> {{nome}},<br>CPF: {{cpf}}<br>Cargo: {{cargo}}</p>
<p style="margin-top:24px;text-align:justify">A <strong>{{empresa}}</strong>, CNPJ {{cnpj}}, aplica ao(à) Sr(a) <strong>{{nome}}</strong> a penalidade de <strong>SUSPENSÃO DISCIPLINAR DE {{dias_suspensao}} DIA(S)</strong>, no período de <strong>{{periodo_de}} a {{periodo_ate}}</strong>, em razão de:</p>
<p style="text-align:justify;padding:12px;background:#f8f8f8;border-left:3px solid #c00">{{motivo}}</p>
<p style="text-align:justify;margin-top:16px">Durante o período de suspensão, fica vedado o acesso às dependências da empresa, sem direito a remuneração, conforme Art. 474 da CLT.</p>
<p style="text-align:justify"><strong>Reiteramos que nova reincidência poderá ensejar rescisão por justa causa.</strong></p>
<p style="margin-top:40px">Atenciosamente,</p>
<p>____________________________<br>{{empresa}}</p>
<p style="margin-top:30px">Ciente em ___/___/_____<br><br>____________________________<br>{{nome}}</p>',
'[{"key":"cidade","label":"Cidade","type":"text","required":true,"default":"São Paulo"},
  {"key":"data","label":"Data","type":"date","required":true},
  {"key":"dias_suspensao","label":"Dias de suspensão","type":"number","required":true,"default":1},
  {"key":"periodo_de","label":"Período de","type":"date","required":true},
  {"key":"periodo_ate","label":"Período até","type":"date","required":true},
  {"key":"motivo","label":"Motivo","type":"textarea","required":true}]'::jsonb),

-- 5) Comunicado desocupação moradia
('comunicado_desocupacao', null, 'Comunicado de desocupação de moradia', 'termo', 31,
'<h1 style="text-align:center;text-transform:uppercase">COMUNICADO DE DESOCUPAÇÃO</h1>
<p style="text-align:right;margin-top:30px">{{cidade}}, {{data}}</p>
<p style="margin-top:30px"><strong>Sr(a).</strong> {{nome}}<br>CPF: {{cpf}}</p>
<p style="margin-top:24px;text-align:justify">Por meio deste, <strong>{{empresa}}</strong> CNPJ {{cnpj}} comunica que o(a) imóvel localizado em <strong>{{endereco_imovel}}</strong>, atualmente ocupado por Vossa Senhoria a título de cessão de moradia vinculada ao contrato de trabalho, deverá ser <strong>DESOCUPADO até {{data_desocupacao}}</strong>.</p>
<p style="text-align:justify">Motivo: {{motivo}}</p>
<p style="text-align:justify">Solicitamos a entrega do imóvel em condições adequadas, conforme recebido, com chaves e demais itens originalmente entregues.</p>
<p style="text-align:justify;margin-top:16px">Em caso de dúvidas, entrar em contato com o setor de RH.</p>
<p style="margin-top:40px">Atenciosamente,</p>
<p>____________________________<br>{{empresa}}</p>
<p style="margin-top:30px">Ciente em ___/___/_____<br><br>____________________________<br>{{nome}}</p>',
'[{"key":"cidade","label":"Cidade","type":"text","required":true,"default":"São Paulo"},
  {"key":"data","label":"Data","type":"date","required":true},
  {"key":"endereco_imovel","label":"Endereço do imóvel","type":"text","required":true},
  {"key":"data_desocupacao","label":"Prazo desocupação","type":"date","required":true},
  {"key":"motivo","label":"Motivo","type":"textarea","required":true}]'::jsonb);

-- ──────────────────────────────────────────────────────────────
-- FASE B — NRs (texto fixo, só assinatura de ciência)
-- ──────────────────────────────────────────────────────────────

INSERT INTO rh.modelos_documento (tipo, variante, titulo, categoria, ordem, conteudo_html, campos) VALUES
('nr', '01', 'NR-01 — Disposições Gerais e Gerenciamento de Riscos', 'nr', 41,
'<h1 style="text-align:center">NR-01 — DISPOSIÇÕES GERAIS</h1>
<p style="margin-top:20px;text-align:justify"><strong>Termo de Ciência da NR-01 — Disposições Gerais e Gerenciamento de Riscos Ocupacionais</strong></p>
<p style="text-align:justify">Eu, <strong>{{nome}}</strong>, CPF {{cpf}}, ocupante do cargo de {{cargo}} na <strong>{{empresa}}</strong>, declaro estar CIENTE das disposições da Norma Regulamentadora NR-01, que estabelece os campos de aplicação das normas regulamentadoras e disciplina o gerenciamento de riscos ocupacionais (PGR).</p>
<p style="text-align:justify">Comprometo-me a:</p>
<ul style="text-align:justify">
<li>Cumprir as ordens de serviço expedidas pela empresa;</li>
<li>Colaborar com o cumprimento das NRs aplicáveis;</li>
<li>Submeter-se aos exames médicos previstos no PCMSO;</li>
<li>Comunicar quaisquer riscos identificados durante o trabalho.</li>
</ul>
<p style="margin-top:30px;text-align:right">{{cidade}}, {{data}}</p>
<p style="margin-top:50px;text-align:center">____________________________<br>{{nome}}<br>CPF: {{cpf}}</p>',
'[{"key":"cidade","label":"Cidade","type":"text","default":"São Paulo"},{"key":"data","label":"Data","type":"date","required":true}]'::jsonb),

('nr', '06', 'NR-06 — Equipamento de Proteção Individual (EPI)', 'nr', 42,
'<h1 style="text-align:center">NR-06 — EPI</h1>
<p style="margin-top:20px;text-align:justify"><strong>Termo de Recebimento e Ciência sobre Equipamento de Proteção Individual</strong></p>
<p style="text-align:justify">Eu, <strong>{{nome}}</strong>, CPF {{cpf}}, declaro ter recebido da <strong>{{empresa}}</strong> os seguintes EPIs:</p>
<p style="text-align:justify;padding:12px;background:#f8f8f8">{{epis_recebidos}}</p>
<p style="text-align:justify">Estou ciente que devo:</p>
<ul style="text-align:justify">
<li>Usar o EPI apenas para a finalidade a que se destina;</li>
<li>Responsabilizar-me por sua guarda e conservação;</li>
<li>Comunicar qualquer dano ou extravio à empresa;</li>
<li>Cumprir as determinações do empregador sobre o uso adequado.</li>
</ul>
<p style="text-align:justify"><strong>O não cumprimento poderá ensejar advertência, suspensão ou rescisão por justa causa</strong>, conforme Art. 482 CLT.</p>
<p style="margin-top:30px;text-align:right">{{cidade}}, {{data}}</p>
<p style="margin-top:50px;text-align:center">____________________________<br>{{nome}}</p>',
'[{"key":"cidade","label":"Cidade","type":"text","default":"São Paulo"},
  {"key":"data","label":"Data","type":"date","required":true},
  {"key":"epis_recebidos","label":"EPIs recebidos","type":"textarea","required":true,"placeholder":"ex: 1 Capacete classe B, 1 Bota de segurança nº 41, 2 Luvas de raspa, 1 Óculos UV"}]'::jsonb),

('nr', '12', 'NR-12 — Segurança em Máquinas e Equipamentos', 'nr', 43,
'<h1 style="text-align:center">NR-12 — SEGURANÇA EM MÁQUINAS</h1>
<p style="margin-top:20px;text-align:justify">Eu, <strong>{{nome}}</strong>, CPF {{cpf}}, ocupante do cargo de {{cargo}} na <strong>{{empresa}}</strong>, declaro ter recebido treinamento e estar CIENTE das disposições da NR-12, que estabelece referências técnicas, princípios fundamentais e medidas de proteção para garantir a saúde e a integridade física dos trabalhadores.</p>
<p style="text-align:justify">Comprometo-me a:</p>
<ul style="text-align:justify">
<li>Operar máquinas e equipamentos somente quando capacitado e autorizado;</li>
<li>Utilizar todos os dispositivos de segurança;</li>
<li>Não desativar, modificar ou inutilizar dispositivos de segurança;</li>
<li>Comunicar imediatamente falhas ou anomalias.</li>
</ul>
<p style="margin-top:30px;text-align:right">{{cidade}}, {{data}}</p>
<p style="margin-top:50px;text-align:center">____________________________<br>{{nome}}</p>',
'[{"key":"cidade","label":"Cidade","type":"text","default":"São Paulo"},{"key":"data","label":"Data","type":"date","required":true}]'::jsonb),

('nr', '18', 'NR-18 — Condições de Segurança na Construção Civil', 'nr', 44,
'<h1 style="text-align:center">NR-18 — CONSTRUÇÃO CIVIL</h1>
<p style="margin-top:20px;text-align:justify">Eu, <strong>{{nome}}</strong>, CPF {{cpf}}, declaro ter recebido treinamento e estar CIENTE das disposições da NR-18, que estabelece diretrizes administrativas, de planejamento e organização para implementação de medidas de controle e sistemas preventivos de segurança em obras de construção civil.</p>
<p style="text-align:justify">Comprometo-me a usar EPIs, respeitar áreas de risco, seguir as instruções do PCMAT e comunicar acidentes ou condições inseguras.</p>
<p style="margin-top:30px;text-align:right">{{cidade}}, {{data}}</p>
<p style="margin-top:50px;text-align:center">____________________________<br>{{nome}}</p>',
'[{"key":"cidade","label":"Cidade","type":"text","default":"São Paulo"},{"key":"data","label":"Data","type":"date","required":true}]'::jsonb),

('nr', '35', 'NR-35 — Trabalho em Altura', 'nr', 45,
'<h1 style="text-align:center">NR-35 — TRABALHO EM ALTURA</h1>
<p style="margin-top:20px;text-align:justify">Eu, <strong>{{nome}}</strong>, CPF {{cpf}}, declaro ter recebido capacitação para Trabalho em Altura (acima de 2,00m do nível inferior), conforme NR-35.</p>
<p style="text-align:justify">Comprometo-me a:</p>
<ul style="text-align:justify">
<li>Usar cinto de segurança tipo paraquedista, talabarte e demais EPIs específicos;</li>
<li>Inspecionar equipamentos antes do uso;</li>
<li>Não realizar trabalho em altura sob condições inseguras;</li>
<li>Submeter-me a avaliações periódicas de saúde compatíveis com a atividade.</li>
</ul>
<p style="margin-top:30px;text-align:right">{{cidade}}, {{data}}</p>
<p style="margin-top:50px;text-align:center">____________________________<br>{{nome}}</p>',
'[{"key":"cidade","label":"Cidade","type":"text","default":"São Paulo"},{"key":"data","label":"Data","type":"date","required":true}]'::jsonb);

-- ──────────────────────────────────────────────────────────────
-- FASE B — Termos
-- ──────────────────────────────────────────────────────────────

INSERT INTO rh.modelos_documento (tipo, variante, titulo, categoria, ordem, conteudo_html, campos) VALUES
('termo_celular', null, 'Termo de uso de celular corporativo', 'termo', 32,
'<h1 style="text-align:center">TERMO DE USO DE CELULAR CORPORATIVO</h1>
<p style="margin-top:24px;text-align:justify">A <strong>{{empresa}}</strong>, CNPJ {{cnpj}}, fornece ao(à) Sr(a). <strong>{{nome}}</strong>, CPF {{cpf}}, aparelho celular para uso EXCLUSIVAMENTE PROFISSIONAL:</p>
<table style="width:100%;border-collapse:collapse;margin-top:12px"><tr style="background:#f0f0f0"><th style="border:1px solid #999;padding:6px">Aparelho</th><th style="border:1px solid #999;padding:6px">IMEI</th><th style="border:1px solid #999;padding:6px">Linha</th></tr>
<tr><td style="border:1px solid #999;padding:6px">{{aparelho}}</td><td style="border:1px solid #999;padding:6px">{{imei}}</td><td style="border:1px solid #999;padding:6px">{{linha}}</td></tr></table>
<p style="text-align:justify;margin-top:16px">O uso para fins pessoais é proibido. Em caso de dano, perda ou furto, deverá ser comunicado imediatamente. O equipamento será devolvido ao término do contrato.</p>
<p style="margin-top:30px;text-align:right">{{cidade}}, {{data}}</p>
<p style="margin-top:40px;text-align:center">____________________________<br>{{nome}}</p>',
'[{"key":"cidade","label":"Cidade","type":"text","default":"São Paulo"},
  {"key":"data","label":"Data","type":"date","required":true},
  {"key":"aparelho","label":"Modelo do aparelho","type":"text","required":true},
  {"key":"imei","label":"IMEI","type":"text"},
  {"key":"linha","label":"Linha telefônica","type":"text"}]'::jsonb),

('termo_veiculo', null, 'Termo de responsabilidade de veículo', 'termo', 33,
'<h1 style="text-align:center">TERMO DE RESPONSABILIDADE DE VEÍCULO</h1>
<p style="margin-top:24px;text-align:justify">A <strong>{{empresa}}</strong>, CNPJ {{cnpj}}, cede ao(à) Sr(a). <strong>{{nome}}</strong>, CPF {{cpf}}, CNH {{cnh}} categoria {{cnh_cat}}, o veículo:</p>
<table style="width:100%;border-collapse:collapse;margin-top:12px"><tr style="background:#f0f0f0"><th style="border:1px solid #999;padding:6px">Modelo</th><th style="border:1px solid #999;padding:6px">Placa</th><th style="border:1px solid #999;padding:6px">RENAVAM</th></tr>
<tr><td style="border:1px solid #999;padding:6px">{{modelo}}</td><td style="border:1px solid #999;padding:6px">{{placa}}</td><td style="border:1px solid #999;padding:6px">{{renavam}}</td></tr></table>
<p style="text-align:justify;margin-top:16px">O EMPREGADO se responsabiliza pela:</p>
<ul style="text-align:justify"><li>Direção segura e de acordo com a legislação de trânsito;</li><li>Multas e infrações cometidas durante o uso;</li><li>Manutenção e abastecimento (conforme política da empresa);</li><li>Devolução do veículo em condições normais de uso.</li></ul>
<p style="margin-top:30px;text-align:right">{{cidade}}, {{data}}</p>
<p style="margin-top:40px;text-align:center">____________________________<br>{{nome}}</p>',
'[{"key":"cidade","label":"Cidade","type":"text","default":"São Paulo"},
  {"key":"data","label":"Data","type":"date","required":true},
  {"key":"cnh","label":"CNH","type":"text","required":true},
  {"key":"cnh_cat","label":"Categoria CNH","type":"text","default":"B"},
  {"key":"modelo","label":"Modelo do veículo","type":"text","required":true},
  {"key":"placa","label":"Placa","type":"text","required":true},
  {"key":"renavam","label":"RENAVAM","type":"text"}]'::jsonb),

('termo_aditivo_horario', null, 'Termo aditivo de alteração de horário', 'termo', 34,
'<h1 style="text-align:center">TERMO ADITIVO — ALTERAÇÃO DE JORNADA</h1>
<p style="margin-top:24px;text-align:justify">As partes <strong>{{empresa}}</strong> CNPJ {{cnpj}} (EMPREGADORA) e <strong>{{nome}}</strong>, CPF {{cpf}} (EMPREGADO), de comum acordo, alteram o contrato individual de trabalho nos seguintes termos:</p>
<p style="text-align:justify"><strong>Cláusula 1ª:</strong> A jornada de trabalho fica alterada para <strong>{{nova_jornada}}</strong>, das <strong>{{novo_inicio}} às {{novo_fim}}</strong>, com intervalo de {{novo_intervalo}}, a partir de <strong>{{data_inicio}}</strong>.</p>
<p style="text-align:justify"><strong>Cláusula 2ª:</strong> Permanecem inalteradas as demais cláusulas do contrato original.</p>
<p style="margin-top:30px;text-align:right">{{cidade}}, {{data}}</p>
<table style="width:100%;margin-top:40px"><tr><td style="text-align:center;width:50%">____________________________<br>EMPREGADORA<br>{{empresa}}</td><td style="text-align:center;width:50%">____________________________<br>EMPREGADO<br>{{nome}}</td></tr></table>',
'[{"key":"cidade","label":"Cidade","type":"text","default":"São Paulo"},
  {"key":"data","label":"Data","type":"date","required":true},
  {"key":"nova_jornada","label":"Nova jornada","type":"text","required":true,"placeholder":"ex: 44 horas semanais"},
  {"key":"novo_inicio","label":"Novo horário início","type":"text","default":"08:00"},
  {"key":"novo_fim","label":"Novo horário fim","type":"text","default":"18:00"},
  {"key":"novo_intervalo","label":"Novo intervalo","type":"text","default":"1 hora"},
  {"key":"data_inicio","label":"Data início da nova jornada","type":"date","required":true}]'::jsonb),

('termo_antecipacao_ferias', null, 'Termo de antecipação de férias', 'termo', 35,
'<h1 style="text-align:center">TERMO DE ANTECIPAÇÃO DE FÉRIAS</h1>
<p style="margin-top:24px;text-align:justify">A <strong>{{empresa}}</strong>, CNPJ {{cnpj}}, e o(a) Sr(a). <strong>{{nome}}</strong>, CPF {{cpf}}, ocupante do cargo de {{cargo}}, formalizam por este TERMO a antecipação do gozo de férias nos seguintes termos:</p>
<p style="text-align:justify"><strong>Período aquisitivo:</strong> {{aquisitivo_de}} a {{aquisitivo_ate}}</p>
<p style="text-align:justify"><strong>Período de gozo:</strong> {{gozo_de}} a {{gozo_ate}} ({{dias}} dias)</p>
<p style="text-align:justify"><strong>Pagamento:</strong> a remuneração das férias mais o terço constitucional será paga em até 2 dias antes do início do gozo.</p>
<p style="margin-top:30px;text-align:right">{{cidade}}, {{data}}</p>
<table style="width:100%;margin-top:40px"><tr><td style="text-align:center;width:50%">____________________________<br>EMPREGADORA</td><td style="text-align:center;width:50%">____________________________<br>EMPREGADO</td></tr></table>',
'[{"key":"cidade","label":"Cidade","type":"text","default":"São Paulo"},
  {"key":"data","label":"Data","type":"date","required":true},
  {"key":"aquisitivo_de","label":"Período aquisitivo (de)","type":"date","required":true},
  {"key":"aquisitivo_ate","label":"Período aquisitivo (até)","type":"date","required":true},
  {"key":"gozo_de","label":"Gozo (de)","type":"date","required":true},
  {"key":"gozo_ate","label":"Gozo (até)","type":"date","required":true},
  {"key":"dias","label":"Dias","type":"number","default":30}]'::jsonb);

-- ──────────────────────────────────────────────────────────────
-- FASE B — Rescisão
-- ──────────────────────────────────────────────────────────────

INSERT INTO rh.modelos_documento (tipo, variante, titulo, categoria, ordem, conteudo_html, campos) VALUES
('aviso_previo', null, 'Aviso prévio (empregador)', 'rescisao', 50,
'<h1 style="text-align:center">AVISO PRÉVIO</h1>
<p style="margin-top:24px;text-align:justify">A <strong>{{empresa}}</strong>, CNPJ {{cnpj}}, comunica ao(à) Sr(a). <strong>{{nome}}</strong>, CPF {{cpf}}, ocupante do cargo de {{cargo}}, a rescisão do contrato de trabalho a partir de <strong>{{data_rescisao}}</strong>, mediante a concessão do AVISO PRÉVIO previsto na CLT.</p>
<p style="text-align:justify"><strong>Modalidade:</strong> {{modalidade}}</p>
<p style="text-align:justify"><strong>Motivo:</strong> {{motivo}}</p>
<p style="text-align:justify">As verbas rescisórias devidas serão pagas no prazo legal e no local indicado pelo empregador.</p>
<p style="margin-top:30px;text-align:right">{{cidade}}, {{data}}</p>
<p style="margin-top:40px;text-align:center">____________________________<br>{{nome}}</p>',
'[{"key":"cidade","label":"Cidade","type":"text","default":"São Paulo"},
  {"key":"data","label":"Data","type":"date","required":true},
  {"key":"data_rescisao","label":"Data de rescisão","type":"date","required":true},
  {"key":"modalidade","label":"Modalidade","type":"select","options":["Aviso prévio trabalhado","Aviso prévio indenizado"],"required":true},
  {"key":"motivo","label":"Motivo","type":"textarea","required":true}]'::jsonb),

('dispensa_justa_causa', null, 'Dispensa por justa causa', 'rescisao', 51,
'<h1 style="text-align:center">RESCISÃO POR JUSTA CAUSA</h1>
<p style="margin-top:24px;text-align:justify">A <strong>{{empresa}}</strong>, CNPJ {{cnpj}}, RESCINDE o contrato de trabalho com o(a) Sr(a). <strong>{{nome}}</strong>, CPF {{cpf}}, ocupante do cargo de {{cargo}}, por <strong>JUSTA CAUSA</strong>, com base no Art. 482 da CLT, alínea <strong>{{alinea_482}}</strong> ({{descricao_alinea}}).</p>
<p style="text-align:justify"><strong>Fatos motivadores:</strong></p>
<p style="text-align:justify;padding:12px;background:#f8f8f8;border-left:3px solid #c00">{{fatos}}</p>
<p style="text-align:justify;margin-top:16px">A presente rescisão produz efeitos a partir de <strong>{{data_rescisao}}</strong>, sendo devidas apenas as verbas previstas em lei para essa modalidade.</p>
<p style="margin-top:30px;text-align:right">{{cidade}}, {{data}}</p>
<p style="margin-top:40px;text-align:center">____________________________<br>{{nome}}</p>',
'[{"key":"cidade","label":"Cidade","type":"text","default":"São Paulo"},
  {"key":"data","label":"Data","type":"date","required":true},
  {"key":"data_rescisao","label":"Data rescisão","type":"date","required":true},
  {"key":"alinea_482","label":"Alínea Art. 482 CLT","type":"select","options":["a","b","c","d","e","f","g","h","i","j","k","l","m","n"],"required":true},
  {"key":"descricao_alinea","label":"Descrição da alínea","type":"text","required":true,"placeholder":"ex: ato de improbidade"},
  {"key":"fatos","label":"Fatos motivadores","type":"textarea","required":true}]'::jsonb),

-- ──────────────────────────────────────────────────────────────
-- FASE B — Contratos PJ
-- ──────────────────────────────────────────────────────────────

('contrato_pj', 'designer', 'Contrato PJ — Designer', 'contrato', 21,
'<h1 style="text-align:center">CONTRATO DE PRESTAÇÃO DE SERVIÇOS — DESIGNER</h1>
<p style="margin-top:24px;text-align:justify"><strong>CONTRATANTE:</strong> {{empresa}}, CNPJ {{cnpj}}.<br><strong>CONTRATADO:</strong> {{nome}}, CPF {{cpf}}, atuando como Designer autônomo.</p>
<h3>OBJETO</h3>
<p style="text-align:justify">Prestação de serviços de design gráfico, criação de peças visuais, identidade de marca e materiais publicitários.</p>
<h3>REMUNERAÇÃO</h3>
<p style="text-align:justify"><strong>R$ {{valor}}</strong> {{periodicidade}}, mediante NF emitida.</p>
<h3>PRAZO</h3>
<p style="text-align:justify">A partir de {{data_inicio}}, por prazo {{prazo_tipo}}.</p>
<h3>RESCISÃO</h3>
<p style="text-align:justify">Qualquer das partes pode rescindir mediante aviso prévio de 30 dias.</p>
<p style="margin-top:30px;text-align:right">{{cidade}}, {{data}}</p>
<table style="width:100%;margin-top:40px"><tr><td style="text-align:center;width:50%">____________________________<br>CONTRATANTE</td><td style="text-align:center;width:50%">____________________________<br>CONTRATADO</td></tr></table>',
'[{"key":"cidade","label":"Cidade","type":"text","default":"São Paulo"},
  {"key":"data","label":"Data","type":"date","required":true},
  {"key":"valor","label":"Valor (R$)","type":"text","required":true},
  {"key":"periodicidade","label":"Periodicidade","type":"select","options":["mensais","por projeto","por hora"],"default":"mensais"},
  {"key":"data_inicio","label":"Data início","type":"date","required":true},
  {"key":"prazo_tipo","label":"Tipo de prazo","type":"select","options":["indeterminado","determinado de 6 meses","determinado de 12 meses"],"default":"indeterminado"}]'::jsonb),

('contrato_pj', 'gestor_trafego', 'Contrato PJ — Gestor de Tráfego/IA', 'contrato', 22,
'<h1 style="text-align:center">CONTRATO PJ — GESTOR DE TRÁFEGO / IA</h1>
<p style="margin-top:24px;text-align:justify"><strong>CONTRATANTE:</strong> {{empresa}}, CNPJ {{cnpj}}.<br><strong>CONTRATADO:</strong> {{nome}}, CPF {{cpf}}.</p>
<h3>OBJETO</h3>
<p style="text-align:justify">Gestão de campanhas de tráfego pago (Meta Ads, Google Ads, TikTok Ads), análise de KPIs, otimização de funis e implementação de soluções de IA aplicadas a marketing.</p>
<h3>REMUNERAÇÃO</h3>
<p style="text-align:justify"><strong>R$ {{valor}}</strong> {{periodicidade}}, mediante NF.</p>
<h3>PRAZO</h3>
<p style="text-align:justify">A partir de {{data_inicio}}, por prazo {{prazo_tipo}}.</p>
<p style="margin-top:30px;text-align:right">{{cidade}}, {{data}}</p>',
'[{"key":"cidade","label":"Cidade","type":"text","default":"São Paulo"},
  {"key":"data","label":"Data","type":"date","required":true},
  {"key":"valor","label":"Valor (R$)","type":"text","required":true},
  {"key":"periodicidade","label":"Periodicidade","type":"select","options":["mensais","por projeto"],"default":"mensais"},
  {"key":"data_inicio","label":"Data início","type":"date","required":true},
  {"key":"prazo_tipo","label":"Tipo de prazo","type":"select","options":["indeterminado","determinado de 6 meses","determinado de 12 meses"],"default":"indeterminado"}]'::jsonb),

('contrato_pj', 'video_maker', 'Contrato PJ — Video Maker', 'contrato', 23,
'<h1 style="text-align:center">CONTRATO PJ — VIDEO MAKER</h1>
<p style="margin-top:24px;text-align:justify"><strong>CONTRATANTE:</strong> {{empresa}}, CNPJ {{cnpj}}.<br><strong>CONTRATADO:</strong> {{nome}}, CPF {{cpf}}.</p>
<h3>OBJETO</h3>
<p style="text-align:justify">Produção de conteúdo audiovisual (filmagem, edição, motion graphics, captação) para mídias sociais e materiais institucionais.</p>
<h3>REMUNERAÇÃO</h3>
<p style="text-align:justify"><strong>R$ {{valor}}</strong> {{periodicidade}}, mediante NF.</p>
<h3>PRAZO</h3>
<p style="text-align:justify">A partir de {{data_inicio}}, por prazo {{prazo_tipo}}.</p>
<p style="margin-top:30px;text-align:right">{{cidade}}, {{data}}</p>',
'[{"key":"cidade","label":"Cidade","type":"text","default":"São Paulo"},
  {"key":"data","label":"Data","type":"date","required":true},
  {"key":"valor","label":"Valor (R$)","type":"text","required":true},
  {"key":"periodicidade","label":"Periodicidade","type":"select","options":["mensais","por projeto","por entrega"],"default":"mensais"},
  {"key":"data_inicio","label":"Data início","type":"date","required":true},
  {"key":"prazo_tipo","label":"Tipo de prazo","type":"select","options":["indeterminado","determinado de 6 meses","determinado de 12 meses"],"default":"indeterminado"}]'::jsonb),

-- ──────────────────────────────────────────────────────────────
-- FASE B — Fichas
-- ──────────────────────────────────────────────────────────────

('ficha_epi', null, 'Ficha de Controle de EPI', 'ficha', 60,
'<h1 style="text-align:center">FICHA DE CONTROLE DE EPI</h1>
<p style="margin-top:24px"><strong>EMPRESA:</strong> {{empresa}} — CNPJ {{cnpj}}</p>
<p><strong>FUNCIONÁRIO:</strong> {{nome}} — CPF {{cpf}} — Cargo {{cargo}}</p>
<table style="width:100%;border-collapse:collapse;margin-top:16px">
<thead><tr style="background:#f0f0f0">
<th style="border:1px solid #999;padding:6px">Data</th>
<th style="border:1px solid #999;padding:6px">EPI</th>
<th style="border:1px solid #999;padding:6px">Qtd</th>
<th style="border:1px solid #999;padding:6px">CA</th>
<th style="border:1px solid #999;padding:6px">Observações</th>
</tr></thead>
<tbody>{{linhas_epi}}</tbody></table>
<p style="text-align:justify;margin-top:20px">Recebi os EPIs acima discriminados. Comprometo-me a usá-los corretamente e mantê-los em boas condições.</p>
<p style="margin-top:30px;text-align:right">{{cidade}}, {{data}}</p>
<p style="margin-top:40px;text-align:center">____________________________<br>{{nome}}</p>',
'[{"key":"cidade","label":"Cidade","type":"text","default":"São Paulo"},
  {"key":"data","label":"Data","type":"date","required":true},
  {"key":"linhas_epi","label":"Linhas (HTML <tr><td>...)","type":"textarea","required":true,"placeholder":"<tr><td>03/05/26</td><td>Capacete</td><td>1</td><td>123</td><td>—</td></tr>"}]'::jsonb);

NOTIFY pgrst, 'reload schema';
