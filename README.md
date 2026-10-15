# Minha Loja

Template full-stack de ecommerce, com identidade visual (cores, tipografia,
logo, formato de botoes/janelas, densidade) editavel pelo proprio admin em
Configuracoes > Aparencia, sem precisar mexer em codigo.

Uso proprietario - ver [LICENSE.md](LICENSE.md).

## Stack

- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: Go + Gin + JWT
- Banco: PostgreSQL
- Infra: Docker Compose

## O que esta pronto

- Loja online com home, categorias, detalhe de produto, pedidos e checkout
- PostgreSQL com migrations e seed automatica
- API REST com autenticacao JWT para clientes
- Arquitetura de pagamento preparada com provider mockado

## Como rodar em desenvolvimento (Docker)

```bash
docker compose -f .vscode/docker-compose.dev.yml up -d
```

Sobem tres containers: `db` (Postgres), `backend` (Go, `http://localhost:8081`)
e `frontend` (Vite com hot reload, `http://localhost:5174`). Seed automatico
cria um administrador padrao (`admin@editor.local` / `editor1234` por padrao —
troque via `ADMIN_EMAIL`/`ADMIN_PASSWORD`) e um cliente de teste.

## Como rodar em producao

```bash
JWT_SECRET=troque-por-algo-forte POSTGRES_PASSWORD=troque-por-algo-forte docker compose up --build
```

Sobem dois containers:

- `app`: backend Go + frontend buildado (estatico), servidos em `http://localhost:8080`
- `db`: PostgreSQL, acessivel apenas pela rede interna do compose (nao exposto no host)

O frontend ja sai buildado e servido pelo backend, entao nao precisa subir Vite separado para usar o sistema.

Em producao (ex.: EasyPanel), o `app` roda como servico "App" comum (build da `Dockerfile`) e o Postgres roda como servico de banco de dados nativo/gerenciado, apontado via `DATABASE_URL` — sem depender do `docker-compose.yml`, que serve principalmente para rodar tudo localmente.

## Desenvolvimento separado

Para desenvolver frontend e backend separadamente, use as pastas `frontend/` e
`backend/`. A organizacao do frontend esta documentada em
[frontend/README.md](frontend/README.md) e a API em
[backend/README.md](backend/README.md).

```text
backend/   API, regras de negocio, banco de dados e arquivos estaticos
frontend/  interface React, rotas, componentes e estado do cliente
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Validacoes disponiveis:

```bash
npm run lint
npm run format:check
npm run build
```

## Variaveis de ambiente

- Backend: [backend/.env.example](backend/.env.example)
- Frontend: [frontend/.env.example](frontend/.env.example)

## Mercado Pago

Sem credenciais do Mercado Pago, o backend usa um provider mockado.

O pagamento e feito com o Payment Brick (Checkout Transparente) embutido na propria
pagina de checkout — cartao de credito com parcelamento ou Pix, sem redirecionar o
cliente para o site do Mercado Pago. A Public Key e exposta via `GET /api/store/config`
(campo `mpPublicKey`) para o frontend inicializar o SDK; o Access Token nunca sai do
backend.

## Endpoints principais

- `GET /api/store/config` — configuracao publica da loja (frete, tema visual, WhatsApp)
- `GET/PUT /api/organizer` — arvore de paginas/itens do site (o "CMS" do admin)
- `GET /api/orders` / `GET /api/order/:id`
- `POST /api/checkout`
- `POST /api/auth/customer/register` / `POST /api/auth/customer/login`
- `GET/PUT /api/admin/theme-settings` — aparencia (cores, fontes, logo, rodape)

## Observacoes

- Seed automatico cria regras de frete e um cupom de boas-vindas; catalogo e paginas sao montados pelo Organizador (admin).
- Checkout cria cliente automaticamente para futuras compras.
- Estoque baixa em vendas pagas online.
