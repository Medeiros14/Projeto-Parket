# Patches aplicados na imagem golden

Estes arquivos são patches aplicados sobre a imagem Docker golden (82db7f52afb6).
Para reconstruir a imagem:
  docker build -t parket-dashboard:latest ./patches/

## Patches:
- **dept-layout**: botões Qualificado/Não Qualificado no funil de entrada, sem Perdido no funil de vendas, abas Levantamento e Gerar Orçamento no card Comercial, seletor equipes, WhatsApp prestadores
- **orcamento-simulador-tab**: botão "Gerar Link" (era "HTML"), URL proposta.parket.works
- **proposta-publica-page**: vídeo Heromobile-v3, contrato coluna única responsivo
- **propostaGenerator**: contrato column-fill balance
- **solicitar-compras-page**: expedição vai para logística
- **index.html**: tracking de propostas, script de botões
