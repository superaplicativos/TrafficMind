# 🧠 TrafficMind — Navegação Inteligente com IA

> **MVP funcional** de um aplicativo de navegação que diferencia-se dos
> concorrentes tradicionais (Waze, Google Maps) por não otimizar apenas
> por tempo. Calcula **5 rotas alternativas simultâneas** e as classifica
> com um **score composto transparente** que combina tempo, trânsito,
> cruzamentos e complexidade da via.

![Status](https://img.shields.io/badge/status-MVP%201.1-06B6D4)
![Provider](https://img.shields.io/badge/dados-TomTom%20realtime-F59E0B)
![License](https://img.shields.io/badge/license-MIT-10B981)
![Node](https://img.shields.io/badge/node-%3E%3D20-339933)

---

## 🎯 O que é

O TrafficMind é um motor de roteamento **multi-critério**. Em vez de te dar
só a rota mais rápida (como Waze), ele calcula cinco alternativas com
estratégias distintas e as ranqueia por um score explicável:

```
score = ETA × etaWeight
      + trafficLevel × trafficWeight
      + intersectionCount × intersectionPenalty
      + accidents × accidentPenalty
      + roadComplexity × roadComplexityWeight
```

Menor score vence. O usuário vê o **breakdown** do score em barras
proporcionais — sabe exatamente **por que** uma rota foi recomendada.

### As 5 estratégias

| Estratégia          | Label             | Como calcula                                    |
| ------------------- | ----------------- | ----------------------------------------------- |
| `fastest`           | Mais rápida       | Minimiza tempo com tráfego em tempo real        |
| `shortest`          | Mais curta        | Minimiza distância total                        |
| `scenic`            | Cênica            | Modo eco, evita rodovias (vias mais calmas)     |
| `least_turns`       | Menos curvas      | Modo eco, evita pedágios (menos manobras)       |
| `experimental`      | IA experimental   | Fastest com peso 10× em tráfego (slot de IA)    |

Cada estratégia calcula uma geometria **realmente diferente** no TomTom
Routing — não é a mesma rota com pesos diferentes.

---

## ✨ Features do MVP

### Mapa interativo
- MapLibre GL JS com tema dark (CARTO)
- Marcadores animados: localização (pulso ciano), destino (pin âmbar)
- Polylines coloridas por estratégia, selecionáveis
- Long-press no mapa = drop de pin com reverse geocoding

### Geolocalização
- WatchPosition contínuo com alta precisão
- Auto-request de permissão quando destino é setado
- Fallback "Usar centro do mapa como partida" se GPS for negado
- Indicador visual de progresso (Passo 1 → 2 → ✓)

### Busca de endereço
- TomTom Search API (free tier 25k req/dia)
- Debounce 350ms no client, resultados em português
- Bias para Brasil (`countrySet=BR`, `language=pt-BR`)

### Cálculo de rotas
- TomTom Routing API com `traffic=true` (incorpora trânsito histórico + real-time)
- 5 estratégias em paralelo (Promise.all, ~1-2s total)
- ETA com atraso de tráfego real (`trafficDelayInSeconds`)

### Trânsito em tempo real
- TomTom Traffic Flow API (velocidade real por segmento)
- Nível 0..100 calculado como `1 - (currentSpeed / freeFlowSpeed)`
- Amostragem em grid 3×3 dentro do viewport, cache 30s

### Score multi-critério
- 4 componentes: tempo, trânsito, cruzamentos, complexidade
- Pesos configuráveis por estratégia
- Breakdown visual em barras coloridas no painel

### Slot de IA preparado
- Interface `TrafficPredictor` com 3 métodos:
  - `predictRoadWeight(roadId)` — multiplicador de custo
  - `predictCongestion(roadId, horizon)` — nível futuro 0..100
  - `predictETA(route)` — ETA predito
- Implementação mock incluída. Trocar por ML real = 1 linha em `container.ts`.

### UI mobile-first em português
- Tema dark inspirado no Google Maps dark mode
- Bottom sheet colapsável (3 estados: recolhido / meio / expandido)
- Toasts com dedup (Sonner)
- Animações sutis (Framer Motion)
- 100% em pt-BR, sem jargão técnico

---

## 🏗️ Arquitetura

Clean Architecture em 4 camadas. A regra de dependência é unidirecional:
camadas externas dependem das internas, nunca o contrário.

```
src/server/
├── domain/                    # Entidades, value objects, interfaces (ports)
│   └── index.ts               #   GeoCoordinate, Route, TrafficPredictor...
├── application/               # Casos de uso + serviços de domínio
│   ├── services/
│   │   ├── route-scoring.service.ts        # Score composto + ranking
│   │   ├── traffic-engine.service.ts       # Simulação (fallback)
│   │   └── scoring-weights.ts              # Pesos default + overrides
│   ├── use-cases/
│   │   ├── calculate-routes.use-case.ts
│   │   ├── get-traffic.use-case.ts
│   │   └── geocode.use-case.ts
│   └── container.ts           # ⭐ Composition root (DI)
├── infrastructure/            # Adaptadores concretos
│   ├── tomtom/                # Provider ativo (dados reais)
│   │   ├── tomtom-client.ts                # Cliente HTTP unificado
│   │   ├── tomtom-geocoding-service.ts     # Implementa GeocodingService
│   │   ├── tomtom-routing-engine.ts        # Implementa RoutingEngine
│   │   └── tomtom-traffic-repository.ts    # Implementa TrafficRepository
│   ├── osrm/                  # Fallback (demo público)
│   ├── nominatim/             # Fallback (OSM público)
│   └── predictor/
│       └── mock-traffic-predictor.ts       # Slot de IA (mock)
└── presentation/              # API routes (thin controllers)
```

API routes em `src/app/api/`:
- `POST /api/route` — calcula e ranqueia 5 rotas
- `GET  /api/geocode?q=` — busca endereço
- `GET  /api/reverse-geocode?lat=&lng=` — coordenada → endereço
- `GET  /api/traffic?south=&west=&north=&east=` — trânsito da região
- `GET  /api/health` — probe + qual provider está ativo
- `GET  /docs/openapi.json` — spec OpenAPI 3.0

---

## 🚀 Quick Start

### Pré-requisitos

- Node.js 20+
- TomTom API key (gratuita em [developer.tomtom.com](https://developer.tomtom.com/))

### Instalação

```bash
# 1. Clone
git clone https://github.com/seu-usuario/trafficmind.git
cd trafficmind

# 2. Instale dependências
bun install   # ou npm install

# 3. Configure ambiente
cp .env.example .env
# Edite .env e cole sua TOMTOM_API_KEY

# 4. Rode em desenvolvimento
bun run dev
```

Abra [http://localhost:3000](http://localhost:3000).

> **Sem chave TomTom?** O MVP funciona no modo simulado automaticamente
> (usa OSRM + Nominatim + simulação de tráfego). Útil para demos offline.

### Deploy com Docker

```bash
# Stack completa: frontend + backend NestJS + Postgres + Redis + OSRM
docker compose up
```

Serviços expostos:
- Frontend Next.js: `http://localhost:3000`
- Backend NestJS: `http://localhost:4000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- OSRM: `localhost:5000`

---

## 🔧 Configuração

### Variáveis de ambiente

| Var                | Default                              | Descrição                                  |
| ------------------ | ------------------------------------ | ------------------------------------------ |
| `TOMTOM_API_KEY`   | (vazio → modo simulado)              | Chave do TomTom. Habilita dados reais.     |
| `OSRM_ENDPOINT`    | `https://router.project-osrm.org`    | Servidor OSRM (fallback sem TomTom)        |
| `DATABASE_URL`     | `file:./db/custom.db`                | Connection string do Prisma                |
| `NEXT_PUBLIC_API_BASE` | (vazio)                          | URL base da API para o browser              |

Veja [`.env.example`](.env.example) para o template completo.

### Trocar de provider

A arquitetura Clean permite trocar TomTom por qualquer outro provider
(Google Maps, Mapbox, HERE) sem tocar em use cases ou frontend. Veja
[`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) para o passo a passo.

---

## 📊 Roadmap

### Curto prazo (4-6 semanas)
- [ ] Backend NestJS rodando em Docker (substituir API routes)
- [ ] PostgreSQL + PostGIS para persistência de rotas
- [ ] Redis cache de rotas frequentes (TTL 5 min)
- [ ] Self-host OSRM com extract de São Paulo
- [ ] Deploy em VPS (DigitalOcean / Hetzner)

### Médio prazo (8-12 semanas)
- [ ] Sistema de autenticação (NextAuth.js)
- [ ] Favoritos e histórico de rotas por usuário
- [ ] PWA com service worker (offline básico)
- [ ] Conectar TomTom Traffic Incidents ao scorer (`accidentPenalty`)
- [ ] Painel administrativo de vias monitoradas

### Longo prazo (3-6 meses)
- [ ] Modelo de IA preditiva (regressão sobre histórico)
- [ ] Crowdsourcing de trânsito (reports dos usuários)
- [ ] Apps nativos iOS/Android (Capacitor)
- [ ] Otimização para veículos elétricos
- [ ] Integração com smart cities (semáforos, dados abertos)

---

## 💰 Custos de operação

### MVP (modo real com TomTom, free tier)
- TomTom: **R$ 0/mês** (até 2.500 routing req/dia)
- Hospedagem preview: **R$ 0**
- **Total: R$ 0/mês**

### Produção (~1.000 usuários/dia)
- VPS 4vCPU/8GB: **R$ 200-400/mês**
- TomTom (acima do free tier): **~R$ 50-150/mês**
- Domínio + SSL: **R$ 15/mês**
- **Total: R$ 265-565/mês**

Veja [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) para detalhes de quotas
TomTom e estratégias de cache para reduzir custo.

---

## 🛠️ Stack

### Frontend
- Next.js 16, React 19, TypeScript 5
- Tailwind CSS 4, shadcn/ui (New York)
- MapLibre GL JS 5
- TanStack Query 5, Zustand 5
- Framer Motion, Lucide icons, Sonner

### Backend
- Next.js API Routes (Node.js 20)
- Zod 4 (validação)
- OpenAPI 3.0 (spec em `/public/docs/openapi.json`)
- NestJS 10 (referência para deploy Docker, em `backend/`)

### Infraestrutura
- PostgreSQL 16 + PostGIS 3.4
- Redis 7
- OSRM (self-host em Docker)
- TomTom API (Search, Routing, Traffic Flow, Traffic Incidents)

### DevOps
- Docker + Docker Compose
- Caddy (proxy reverso com SSL automático)

---

## 📁 Estrutura do projeto

```
trafficmind/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes (presentation layer)
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Home (mapa + UI)
│   │   └── globals.css         # Tema dark customizado
│   ├── components/
│   │   ├── navigation/         # Componentes do mapa e UX
│   │   └── ui/                 # shadcn/ui components
│   ├── hooks/navigation/       # Hooks React (GPS, store, mutations)
│   ├── lib/navigation/         # Types e API client do frontend
│   └── server/                 # Backend Clean Architecture
│       ├── domain/             # Entidades + interfaces (ports)
│       ├── application/        # Use cases + services + container DI
│       ├── infrastructure/     # Adaptadores (TomTom, OSRM, Nominatim)
│       └── presentation/       # (vazio — API routes vivem em app/api)
├── backend/                    # NestJS reference (para deploy separado)
├── docs/
│   └── INTEGRATIONS.md         # Doc de integrações externas
├── public/docs/
│   └── openapi.json            # Spec OpenAPI 3.0
├── docker-compose.yml          # Stack completa
├── Dockerfile                  # Frontend
├── .env.example
└── README.md
```

---

## 🧪 Testando o MVP

### Modo demo (sem GPS)
Adicione `?origin=lat,lng` à URL para definir origem sem solicitar GPS:

```
http://localhost:3000/?origin=-23.5613,-46.6565    # Av. Paulista
http://localhost:3000/?origin=-21.1775,-47.8103    # Ribeirão Preto
http://localhost:3000/?origin=-22.9068,-43.1729    # Rio de Janeiro
```

### Endpoints de API
```bash
# Health check
curl http://localhost:3000/api/health

# Buscar endereço
curl "http://localhost:3000/api/geocode?q=Aeroporto%20de%20Congonhas"

# Calcular rotas
curl -X POST http://localhost:3000/api/route \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {"lat": -23.5613, "lng": -46.6565},
    "destination": {"lat": -23.4263, "lng": -46.4818}
  }'

# Trânsito de uma região
curl "http://localhost:3000/api/traffic?south=-23.58&west=-46.70&north=-23.55&east=-46.65"
```

---

## 📄 Licença

MIT. Veja [LICENSE](LICENSE).

---

## 🙋 Créditos

Dados geográficos: © OpenStreetMap contributors, © TomTom, © CARTO.
Mapa renderizado com MapLibre GL JS (open-source).
