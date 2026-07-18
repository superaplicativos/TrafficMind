# 🚀 Deploy em Produção — TrafficMind

Guia completo para subir o TrafficMind em produção real. Cenário recomendado:
**Vercel (frontend) + Upstash (cache) + Railway (backend opcional)** — tudo no
free tier, custo R$ 0/mês até ~1.000 usuários/dia.

---

## 📋 Pré-requisitos

- [ ] Conta no GitHub (já temos: `superaplicativos/TrafficMind`)
- [ ] Chave TomTom API (já temos)
- [ ] Conta na Vercel
- [ ] Conta no Upstash (opcional, para cache)
- [ ] Conta no Railway (opcional, para backend separado)

---

## 🎯 Cenário A: Vercel only (mais simples — recomendado)

O Next.js já tem API routes embutidas. Pra MVP, só a Vercel basta.

### Passo 1: Importar repositório na Vercel

1. Acesse https://vercel.com/new
2. Faça login com sua conta GitHub
3. Clique em **"Import Git Repository"**
4. Selecione `superaplicativos/TrafficMind`
5. **NÃO clique em Deploy ainda** — primeiro configure as variáveis de ambiente

### Passo 2: Configurar variáveis de ambiente

Na mesma tela de import, em **"Environment Variables"**, adicione:

| Name | Value | Environments |
|------|-------|--------------|
| `TOMTOM_API_KEY` | `sua_chave_tomtom_aqui` | Production, Preview, Development |
| `NEXT_PUBLIC_APP_URL` | (deixe vazio, Vercel preenche) | Production |

### Passo 3: Deploy

1. Clique em **"Deploy"**
2. Aguarde ~2 minutos (build + deploy)
3. Vercel vai dar uma URL como `trafficmind.vercel.app`
4. Pronto! 🎉

### Passo 4: Configurar domínio próprio (opcional)

1. Na Vercel: **Settings → Domains**
2. Adicione `trafficmind.com.br` (ou o domínio que você comprou)
3. Vercel vai dar instruções de DNS (apontar CNAME para `cname.vercel-dns.com`)
4. SSL é automático via Let's Encrypt

---

## 🎯 Cenário B: Vercel + Upstash Redis (cache)

Para reduzir custo de TomTom em ~70%, adicione cache Redis.

### Passo 1: Criar banco no Upstash

1. Acesse https://console.upstash.com
2. Faça login com GitHub
3. **"Create Database"**
4. Name: `trafficmind-cache`
5. Region: `AWS ap-south-1` (Mais próximo do Brasil — R$ 0 free tier)
6. Clique em **"Create"**

### Passo 2: Copiar URL de conexão

Na página do banco, copie a **`UPSTASH_REDIS_REST_URL`** e o
**`UPSTASH_REDIS_REST_TOKEN`**.

### Passo 3: Adicionar variáveis na Vercel

Volte na Vercel → seu projeto → **Settings → Environment Variables**:

| Name | Value |
|------|-------|
| `UPSTASH_REDIS_URL` | `https://xxx.upstash.io` |
| `UPSTASH_REDIS_TOKEN` | `xxx-long-token` |

### Passo 4: Redeploy

Na Vercel: **Deployments → ⋮ → Redeploy**

---

## 🎯 Cenário C: Full stack (Vercel + Railway + Postgres)

Para ter backend NestJS separado com persistência real.

### Passo 1: Provisionar Postgres no Railway

1. Acesse https://railway.app
2. Faça login com GitHub
3. **"New Project" → "Provision PostgreSQL"**
4. Aguarde 30 segundos
5. Vá em **"Variables"** e copie a `DATABASE_URL` (formato `postgresql://...`)

### Passo 2: Deploy do backend no Railway

1. No Railway: **"New → GitHub Repo"**
2. Selecione `superaplicativos/TrafficMind`
3. **Root Directory:** `backend`
4. Em **Variables**, adicione:
   - `DATABASE_URL` = (URL copiada acima)
   - `TOMTOM_API_KEY` = sua chave
   - `PORT` = `4000`
   - `CORS_ORIGIN` = URL da Vercel (ex: `https://trafficmind.vercel.app`)
5. **Deploy** — Railway detecta Dockerfile automaticamente

### Passo 3: Apontar frontend para backend Railway

Na Vercel, adicione variável:

```
NEXT_PUBLIC_API_BASE = https://trafficmind-backend.up.railway.app
```

Mas atenção: o frontend já tem API routes do Next.js que funcionam standalone.
Você só precisa do backend Railway se quiser separar API do frontend
(recomendado para escala > 10k usuários/dia).

---

## 🔐 Configurar Secrets no GitHub Actions

Para CI/CD funcionar (lint + build em cada PR):

### 1. Vercel Token

1. https://vercel.com/account/tokens → **"Create Token"**
2. Nome: `TrafficMind GitHub Actions`
3. Scope: Full Account
4. Copie o token

### 2. Vercel Org ID e Project ID

Após importar o projeto na Vercel:

1. Vercel → seu projeto → **Settings → General**
2. Role até "Git" ou copie:
   - **Org ID**: aparece na URL `/orgs/ORG_ID/...`
   - **Project ID**: aparece na URL `.../projects/PROJECT_ID/...`

### 3. Adicionar Secrets no GitHub

Acesse: https://github.com/superaplicativos/TrafficMind/settings/secrets/actions

Clique em **"New repository secret"** para cada:

| Secret Name | Value |
|-------------|-------|
| `TOMTOM_API_KEY` | sua chave TomTom |
| `VERCEL_TOKEN` | token gerado em (1) |
| `VERCEL_ORG_ID` | Org ID de (2) |
| `VERCEL_PROJECT_ID` | Project ID de (2) |

Depois disso, **todo push na `main`** dispara deploy automático pra Vercel.

---

## ✅ Checklist Pós-Deploy

Depois de subir pra produção, teste estes endpoints:

```bash
# Substitua URL pela sua URL da Vercel
URL=https://trafficmind.vercel.app

# 1. Health check (deve mostrar tomtom em todos os providers)
curl $URL/api/health

# 2. Geocode
curl "$URL/api/geocode?q=Aeroporto%20de%20Congonhas"

# 3. Routing
curl -X POST $URL/api/route \
  -H "Content-Type: application/json" \
  -d '{"origin":{"lat":-23.5613,"lng":-46.6565},"destination":{"lat":-23.5889,"lng":-46.7178}}'

# 4. Traffic flow
curl "$URL/api/traffic?south=-23.58&west=-46.70&north=-23.55&east=-46.65"
```

Esperado:
- `/api/health` → `{"provider":{"routing":"tomtom","geocoding":"tomtom","traffic":"tomtom-flow"}}`
- Geocode → 6 resultados
- Routing → 5 rotas com scores diferentes
- Traffic → 4 leituras reais

---

## 🐛 Troubleshooting

### Build falha na Vercel com "TOMTOM_API_KEY not defined"

Adicione a variável em **Settings → Environment Variables** e faça **redeploy**
(não basta salvar).

### Erro 500 em `/api/route`

Verifique os logs: Vercel → seu projeto → **Logs**. Provável causa: TomTom
rate limit (free tier 2.500 routing/dia). Reduza paralelismo em
`src/server/infrastructure/tomtom/tomtom-client.ts` (já está sequential).

### Erro de CORS

O backend já manda `Access-Control-Allow-Origin: *` em `/api/route`. Se ainda
assim tiver erro, verifique se está chamando com URL completa em vez de
relativa.

### Mapa não carrega tiles

CARTO tiles têm rate limit não documentado. Se quebrar, troque por Mapbox
(free 100k req/mês) ou self-host com tileserver-gl.

---

## 💰 Custos Estimados em Produção

| Cenário | Tráfego | Custo/mês |
|---------|---------|-----------|
| Vercel only, free tier | < 100 deploys/dia, < 100GB bandwidth | R$ 0 |
| Vercel + Upstash | < 10k cmd/dia Redis | R$ 0 |
| Vercel Pro | Tráfego médio (~10k usuários/dia) | ~R$ 100 |
| + TomTom paid | > 2.500 routing/dia | ~R$ 100-500 |
| Railway Pro | Backend com persistência | ~R$ 50-100 |

**Custo total MVP em produção:** R$ 0/mês (free tier) até ~R$ 700/mês (10k
usuários/dia com TomTom pago).

---

## 🆘 Suporte

- Issues: https://github.com/superaplicativos/TrafficMind/issues
- Documentação técnica: [`docs/INTEGRATIONS.md`](INTEGRATIONS.md)
- README: [`README.md`](README.md)
