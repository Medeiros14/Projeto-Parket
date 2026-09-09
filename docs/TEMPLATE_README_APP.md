# {NOME_DO_APP}

> Uma frase que descreve o que este app resolve na Parket.

## O que faz

Explicacao em 2-4 paragrafos:
- Qual dor de negocio ele resolve
- Quem usa (setor, papel: fiscal, comercial, cliente final, etc)
- Principais telas / funcionalidades

## Como se interliga com o ecossistema

- **Le de:** (ex: `parket-gestao` via API, tabela X do Postgres local)
- **Escreve em:** (ex: `parket-chat` via webhook, tabela Y do Cloud)
- **Depende de:** (ex: `parket-auth-guard` pra login, `parket-whisper` pra transcricao)
- **E usado por:** (ex: `Dashboardparketapp` embute o widget deste app)

## Stack

- **Frontend:** (React + Vite + Tailwind, ou HTML puro, ou React Native)
- **Backend:** (FastAPI, Node/Express, sem backend proprio)
- **Banco:** (Postgres local schema `xxx`, Supabase Cloud, Redis)
- **Deploy:** (Docker Swarm stack `xxx`, dominio `xxx.parket.works`, Traefik)
- **Bibliotecas notaveis:** (lista curta de libs que dao a "cara" do app)

## Onde uso IA (Claude / LLM)

- (ex: extracao de tarefas de reunioes gravadas via Whisper + Claude)
- (ex: Teca conversacional pra montar orcamento por linguagem natural)
- (ex: analise de qualidade de leads chegando do WhatsApp)
- Se nao usa IA: escrever "nao usa IA diretamente".

## Como rodar localmente

```bash
# passo a passo mais comum
cp .env.example .env  # preencher variaveis
npm install           # ou pip install -r requirements.txt
npm run dev           # ou uvicorn app.main:app --reload
```

## Estrutura de pastas

```
{arvore resumida do app com comentarios}
```

## O que aprendi construindo isso

2-4 bullets curtos: decisoes tecnicas, tradeoffs, coisas dificeis que resolvi.
Isso é o que recrutador quer ver.
