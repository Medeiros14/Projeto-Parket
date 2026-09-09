# parket-whisper

> Servico self-hosted de transcricao de audio via faster-whisper.
> Usado por reunioes semanais (parket-gestao) e Teca (audio message
> → texto).

## O que faz

- Recebe audio (mp3, ogg, m4a, webm)
- Roda faster-whisper (`large-v3`) em GPU local ou CPU
- Retorna transcricao pt-BR estruturada por segmento (com timestamp)
- Cache por hash do arquivo (nao retranscreve o mesmo audio)

Substituiu Whisper OpenAI hosted por 3 motivos: (1) custo, (2)
privacidade (audio de reuniao gerencial nao sai da Parket), (3)
latencia (roda no proprio servidor).

## Como se interliga com o ecossistema

- **Le de:** audio via HTTP upload
- **Escreve em:** cache local (nao mexe em outros bancos)
- **E usado por:** `parket-gestao` (/reuniao), `parket-teca` (audio
  messages), `parket-chat` (transcricao pt-BR de audios do composer
  — no chat e Web Speech browser-side, mas transcricao offline usa
  este servico)
- **Depende de:** faster-whisper (`>=1.0`), ffmpeg

## Stack

- Python + faster-whisper + FastAPI
- Docker Swarm stack `parket-whisper`
- Modelo baixado uma vez em volume Docker persistente

## Onde uso IA

E o proprio servico de IA (ASR).

## Como rodar localmente

```bash
cd apps/parket-whisper
docker compose up  # ou pip install -r requirements.txt && uvicorn app:app
```

## O que aprendi

- **large-v3 vale a pena mesmo em CPU** — pt-BR fica notavelmente
  melhor que medium.
- **Fila unica** — 1 audio de cada vez pra nao estourar memoria.
