-- =====================================================================
-- 023_contrato_geral_v1_termos.sql
-- Banco: Supabase Cloud hbxpilrxmitvzebluoom (Valor)
--
-- O QUE FAZ (F2 do contrato geral do prestador, tarefa #1986):
--   Grava o texto integral da VERSAO 1 dos termos gerais no catalogo
--   prestador_contratos (tabela pre-existente de 17/06 que so tinha um
--   placeholder de 138 chars). O conteudo_md e markdown simples:
--   "## N. TITULO" abre clausula; o wizard do Instala (F3) e o PDF
--   (contrato_geral_pdf.py) renderizam a partir dele.
--
-- PLACEHOLDERS substituidos no aceite (dados_prestador do
-- prestador_contrato_aceites): {{PRESTADOR_NOME}},
-- {{PRESTADOR_CPF_CNPJ}}, {{PRESTADOR_ENDERECO}}.
--
-- BASE: contrato de prestacao de servicos Parket 07/2026 (14 clausulas,
-- termo_pdf.py) adaptado pra GLOBAL conforme decisoes com Will 01/09:
--   - clausula 3 DA ADESAO DE OBRAS: obra adere por codigo WhatsApp,
--     anexo so com itens e metragem (valores no extrato do Instala);
--   - clausula 14 versionamento (re-aceite; anexo preso a versao aceita)
--   - clausula 15 assinatura eletronica (MP 2.200-2 / Lei 14.063)
--   - clausula 16 LGPD.
-- Sem travessao e sem emoji no texto (regras do Will pra pagina visivel).
-- REVISADO 01/09: acentuacao completa aplicada no texto (pedido do Will).
-- =====================================================================

update public.prestador_contratos set
  titulo = 'Contrato Geral de Prestação de Serviços Parket',
  vigente = true,
  conteudo_md = $MD$## 1. DAS PARTES

**PKT SERVIÇOS DE REVESTIMENTOS LTDA**, pessoa jurídica de direito privado, com sede na Rua Coronel Ottoni Maciel, nº 373, Sala 53, Bairro Vila Izabel, Curitiba/PR, CEP 80320-000, inscrita no CNPJ nº 22.951.220/0001-33, doravante denominada **EMPRESA**;

**{{PRESTADOR_NOME}}**, inscrito no CPF/CNPJ nº **{{PRESTADOR_CPF_CNPJ}}**, residente em **{{PRESTADOR_ENDERECO}}**, doravante denominado **PRESTADOR DE SERVIÇOS**.

As partes firmam o presente Contrato Geral de Prestação de Serviços, regido pelas cláusulas abaixo. Este contrato é único e vale para todas as obras que o PRESTADOR vier a assumir junto à EMPRESA, na forma da cláusula 3.

## 2. OBJETO

O presente contrato tem como objeto a instalação de produtos comercializados pela EMPRESA, conforme especificações, orientações técnicas e prazos definidos para cada obra. O PRESTADOR declara conhecer as características técnicas dos produtos e se compromete a realizar as instalações conforme as orientações da EMPRESA.

## 3. DA ADESÃO DE OBRAS

Cada obra atribuída ao PRESTADOR adere a este contrato como ANEXO, no momento em que o PRESTADOR inicia a obra no aplicativo Instala e confirma a adesão com o código de verificação enviado ao seu WhatsApp.

O anexo de cada obra relaciona os itens e as metragens sob responsabilidade do PRESTADOR naquela obra. Ao confirmar a adesão, o PRESTADOR declara que assume a execução daqueles itens nos termos deste contrato.

A adesão de obra não constitui contrato novo: aplica a versão vigente deste contrato aceita pelo PRESTADOR. Os valores correspondentes a cada obra ficam disponíveis ao PRESTADOR no extrato de Pagamentos do aplicativo Instala.

## 4. REMUNERAÇÃO

Os pagamentos serão realizados da seguinte forma:

- Serviços concluídos até o dia 10: pagamento no dia 15 do mesmo mês.
- Serviços concluídos até o dia 25: pagamento no dia 30 do mesmo mês.

As medições terão uma retenção de 25% que será paga ao final da obra com o termo de entrega assinado pelo cliente.

O pagamento será efetuado mediante:

- envio de medições;
- registro fotográfico da obra;
- aprovação da EMPRESA e do CLIENTE.

O PRESTADOR não poderá cobrar diretamente qualquer valor do cliente final, sendo essa responsabilidade exclusiva da EMPRESA.

## 5. ÁREA DE ATUAÇÃO

O PRESTADOR poderá executar serviços em todo território nacional ou internacional, sem exclusividade. Qualquer alteração no projeto ou no escopo do serviço deverá ser previamente autorizada pela EMPRESA, mesmo que solicitada pelo cliente final.

## 6. EXECUÇÃO DOS SERVIÇOS

O PRESTADOR deverá:

- executar os serviços conforme especificações técnicas fornecidas pela EMPRESA;
- utilizar ferramentas adequadas e equipamentos de segurança necessários;
- manter comunicação constante sobre o andamento dos serviços;
- informar imediatamente qualquer irregularidade que possa comprometer a qualidade da instalação.

## 7. DAS OBRIGAÇÕES DO PRESTADOR

São obrigações do PRESTADOR:

- manter sua empresa regularizada perante órgãos fiscais e tributários;
- utilizar uniformes e EPIs obrigatórios durante a execução dos serviços;
- preservar a imagem e reputação da EMPRESA;
- manter sigilo sobre informações comerciais, estratégicas e valores praticados pela EMPRESA;
- comunicar eventuais reclamações ou problemas identificados durante a execução das obras.

## 8. PRAZO E VIGÊNCIA

O presente contrato vigora por prazo indeterminado a partir do aceite eletrônico do PRESTADOR. Cada obra aderida segue os prazos de execução definidos pela EMPRESA no respectivo anexo.

Qualquer das partes pode encerrar este contrato mediante comunicação com 30 dias de antecedência, permanecendo o PRESTADOR responsável pela conclusão das obras já aderidas e em andamento.

Situações de força maior, como impedimentos de acesso à obra, decisões judiciais, manifestações ou paralisações e condições climáticas severas, não gerarão penalidades para nenhuma das partes.

## 9. DOS PRODUTOS E PROCEDIMENTOS

O PRESTADOR deverá seguir rigorosamente:

- as instruções de instalação fornecidas pela EMPRESA;
- os prazos estabelecidos;
- as orientações técnicas e de segurança.

Não é permitido conceder descontos, prorrogações ou alterações comerciais sem autorização da EMPRESA.

## 10. PENALIDADES

O descumprimento dos prazos ou das condições estabelecidas poderá resultar na retenção de até 30% do valor do serviço, a título de penalidade contratual. Caso os prejuízos superem esse valor, a EMPRESA poderá buscar ressarcimento por vias legais.

## 11. DA GARANTIA

O PRESTADOR concede garantia de 12 (doze) meses sobre os serviços executados em cada obra, contados a partir da entrega e aprovação final da instalação.

## 12. RELAÇÃO

O presente contrato estabelece relação de prestação de serviços autônoma, não gerando vínculo empregatício entre as partes.

## 13. CESSÃO

Este contrato e as obras aderidas não poderão ser transferidos ou cedidos a terceiros sem autorização prévia e por escrito da outra parte.

## 14. VERSIONAMENTO E ALTERAÇÕES

Este contrato é versionado. Alterações nos termos gerais serão publicadas como nova versão e apresentadas ao PRESTADOR para novo aceite eletrônico no seu próximo acesso ao aplicativo Instala.

As obras aderidas permanecem regidas pela versão do contrato vigente no momento da adesão de cada uma. A recusa de nova versão não afeta as obras já aderidas, mas impede a adesão de novas obras.

## 15. ASSINATURA ELETRÔNICA

As partes reconhecem como válida a assinatura eletrônica deste contrato e das adesões de obra, nos termos do art. 10, parágrafo 2º, da MP 2.200-2/2001 e da Lei 14.063/2020.

A assinatura do PRESTADOR é composta por: confirmação do número de WhatsApp por código de verificação, registro fotográfico do rosto no ato do aceite com resumo criptográfico SHA-256, assinatura manuscrita em tela e registro de data, hora, endereço IP e identificação do dispositivo utilizado.

## 16. PROTEÇÃO DE DADOS

O PRESTADOR autoriza o tratamento dos seus dados pessoais, incluindo nome, documentos, telefone, imagem e registros de assinatura, exclusivamente para a execução deste contrato, gestão das obras e cumprimento de obrigações legais, nos termos da Lei 13.709/2018 (LGPD).

## 17. USO DE UNIFORMES, EPIs E FERRAMENTAS

O PRESTADOR declara estar ciente da obrigatoriedade do uso de uniforme e Equipamentos de Proteção Individual durante toda a execução dos serviços.

EPIs obrigatórios:

- Luvas;
- Calçados de segurança;
- Protetor auditivo;
- Óculos de segurança;
- Respirador semifacial com filtro;
- Capacete.

O PRESTADOR declara possuir as ferramentas necessárias para execução dos serviços, incluindo: martelo de borracha, nível, formão, serra tico-tico, serra circular, serra de bancada, meia esquadria, parafusadeira, furadeira, compressor, pinador, plaina, esmerilhadeira e martelete.

## 18. ACEITE

E por estarem de acordo, as partes firmam o presente contrato por meio eletrônico, com a trilha de auditoria descrita na cláusula 15 fazendo prova do aceite do PRESTADOR.$MD$
where versao = 1;
