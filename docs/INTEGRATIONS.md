# Integrações Externas — TrafficMind

Documento de referência para todas as integrações externas do MVP. Inclui
endpoints usados, limites do free tier, fallbacks e como trocar de provider.

## TomTom (provider ativo)

O TrafficMind usa a [TomTom Developer Portal](https://developer.tomtom.com/)
como provider principal de dados geográficos e de trânsito. Uma única chave
de API habilita quatro serviços.

### Serviços usados

| Serviço                  | Endpoint                                                  | Uso                                              |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------ |
| Search API (geocode)     | `/search/2/search/{query}.json`                           | Busca de endereço por texto livre                |
| Search API (reverse)     | `/search/2/reverseGeocode/{lat},{lng}.json`               | Coordenada → endereço legível                    |
| Routing API              | `/routing/1/calculateRoute/{locations}/json`              | Cálculo de rota com tráfego em tempo real        |
| Traffic Flow API         | `/traffic/services/4/flowSegmentData/absolute/10/json`    | Velocidade atual de uma via específica           |
| Traffic Incidents API    | `/traffic/services/5/incidentDetails`                     | Acidentes, obras, congestionamentos ativos       |

### Configuração

```bash
# .env
TOMTOM_API_KEY=sua_chave_aqui
```

A chave é lida em `src/server/application/container.ts`. Se ausente, o MVP
cai automaticamente para os providers simulados (ver seção Fallback abaixo).

### Limites do free tier (verificar no portal TomTom)

| Serviço               | Limite gratuito | Custo acima                       |
| --------------------- | --------------- | --------------------------------- |
| Search API            | 25.000 req/dia  | ~$0.5 por 1.000 req adicionais    |
| Routing API           | 2.500 req/dia   | ~$1.0 por 1.000 req adicionais    |
| Traffic Flow API      | 25.000 req/dia  | ~$0.5 por 1.000 req adicionais    |
| Traffic Incidents API | 25.000 req/dia  | ~$0.5 por 1.000 req adicionais    |

**Gasto estimado em uso normal:** para 1.000 usuários/dia calculando em
média 3 rotas cada (3.000 rotas/dia), você fica dentro do free tier de
Search e Traffic, mas estoura o de Routing (500 req adicionais ≈ $0.50/dia).

### Estratégia de cache

Para reduzir custo, dois caches em memória estão ativos:

- **Search (geocode):** cacheado por 60s no React Query (`staleTime`).
- **Traffic Flow regional:** cacheado por 30s em `TomTomTrafficRepository`.
- **Traffic Flow por via:** cacheado por 60s em `TomTomTrafficRepository`.

Rotas NÃO são cacheadas (cada cálculo é único por par origem-destino-tempo).
Se quiser cachear, adicione Redis no backend NestJS com TTL de 5 minutos.

### Códigos de erro

| HTTP | Causa                              | Ação                                  |
| ---- | ---------------------------------- | ------------------------------------- |
| 200  | OK                                 | -                                     |
| 400  | Requisição inválida                | Verificar parâmetros lat/lng          |
| 403  | Chave inválida ou quota excedida   | Verificar portal TomTom               |
| 429  | Rate limit (muitas req/s)          | Reduzir paralelismo ou cachear mais   |
| 5xx  | Erro interno TomTom                | Retry exponencial (já implementado)   |

---

## Fallback automático (sem TomTom)

Se `TOMTOM_API_KEY` não estiver definida, o container de DI ativa os
providers simulados:

| Provider               | Substituto (sem TomTom)                     |
| ---------------------- | ------------------------------------------- |
| `TomTomGeocodingService` | `NominatimGeocodingService` (OSM público) |
| `TomTomRoutingEngine`  | `OsrmRoutingEngine` (demo público)          |
| `TomTomTrafficRepository` | `TrafficEngine` (simulação determinística) |
| `TrafficPredictor`     | `MockTrafficPredictor` (sem mudança)        |

Esse modo é útil para desenvolvimento local, testes sem custo de API e
demonstrações offline. O endpoint `/api/health` mostra qual provider está
ativo:

```bash
curl http://localhost:3000/api/health
{
  "provider": {
    "routing": "tomtom" | "osrm",
    "geocoding": "tomtom" | "nominatim",
    "traffic": "tomtom-flow" | "simulated",
    "ai": "mock"
  }
}
```

---

## Substituir providers

A arquitetura Clean permite trocar qualquer provider sem tocar nos use
cases ou no frontend. Cada provider é uma classe que implementa uma
interface do domínio em `src/server/domain/index.ts`.

### Trocar TomTom por Google Maps

1. Crie `src/server/infrastructure/google-maps/google-maps-client.ts`.
2. Crie `GoogleMapsGeocodingService implements GeocodingService`.
3. Crie `GoogleMapsRoutingEngine implements RoutingEngine`.
4. Em `src/server/application/container.ts`, troque as três linhas que
   instanciam os providers TomTom pelas do Google Maps.
5. Pronto. Nenhuma outra linha muda.

### Trocar TomTom por Mapbox

Mesma estrutura. Mapbox Directions API suporta `annotations` similares ao
TomTom e tem free tier de 100.000 req/mês.

### Plugar IA real no slot do TrafficPredictor

1. Treine um modelo (ex: XGBoost, Graph Neural Network) sobre dados
   históricos de telemetria.
2. Exponha o modelo como microserviço HTTP (FastAPI, Flask) ou rode
   in-process via ONNX/TF.js.
3. Crie `MlTrafficPredictor implements TrafficPredictor` em
   `src/server/infrastructure/predictor/ml-traffic-predictor.ts`.
4. Em `container.ts`, troque `MockTrafficPredictor` por `MlTrafficPredictor`.

Nenhuma mudança em controllers, hooks React ou componentes.

---

## Próximos passos recomendados

1. **Self-host OSRM para São Paulo** — elimina rate limit do demo público
   e reduz latência. Imagem Docker oficial: `osrm/osrm-backend`.

2. **Integrar TomTom Map Display API** — substituir tiles raster da CARTO
   por tiles vetoriais do TomTom (mais rápidos, customizáveis, com dados
   de tráfego embutidos visualmente).

3. **Adicionar Redis cache** — para rotas frequentes. TTL 5 min por par
   origem-destino reduz custo de TomTom em ~70%.

4. **Plugar Traffic Incidents no scorer** — o endpoint já está integrado
   no cliente (`TomTomClient.getIncidents`), falta conectar ao
   `RouteScoringService` para aplicar `accidentPenalty` em rotas que
   cruzam incidentes ativos.
