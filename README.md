# On Perfumaria e Importados

Aplicacao full-stack para ecommerce de perfumes importados e arabes.

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

## Como rodar com Docker

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
Iconi/     arquivos originais dos icones do projeto
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

- `GET /api/store/home`
- `GET /api/products`
- `GET /api/products/:slug`
- `GET /api/customer/orders`
- `GET /api/customer/orders/:id`
- `POST /api/checkout`
- `POST /api/auth/customer/register`
- `POST /api/auth/customer/login`

## Observacoes

- Seed automatico cria categorias, marcas, produtos mockados e cupom.
- Checkout cria cliente automaticamente para futuras compras.
- Estoque baixa em vendas pagas online.
