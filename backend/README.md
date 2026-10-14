# Backend da On Perfumaria

API HTTP escrita em Go, com Gin, PostgreSQL e autenticacao JWT.

## Organizacao

```text
cmd/api/                inicializacao da aplicacao
internal/auth/          criacao e validacao de tokens
internal/config/        leitura das variaveis de ambiente
internal/database/      conexao, migracoes e dados iniciais
internal/handlers/      rotas HTTP e adaptacao de requisicoes
internal/middlewares/   autenticacao das rotas
internal/models/        modelos compartilhados
internal/payments/      integracao de pagamentos
internal/repositories/  acesso reutilizavel aos dados da loja
internal/services/      regras de negocio
internal/shipping/      calculo e integracoes de frete
migrations/             evolucao incremental do banco PostgreSQL
public/                 build do frontend servido pela API
```

## Execucao local

Preencha as variaveis descritas em `.env.example` e execute:

```bash
go run ./cmd/api
```

O processo aplica as migracoes em ordem alfabetica, executa o seed quando
`AUTO_SEED` estiver ativo e inicia o servidor HTTP.

## Validacao

```bash
gofmt -w .
go test ./...
go vet ./...
go build ./cmd/api
```

As alteracoes de banco devem ser adicionadas em um novo arquivo numerado. Nao
edite uma migracao ja aplicada para alterar dados existentes; crie a proxima
migracao com a transformacao necessaria.
