# Frontend da On Perfumaria

Interface React da loja, escrita em TypeScript e criada com Vite e Tailwind CSS.

## Comandos

```bash
npm run dev      # servidor local com recarregamento automatico
npm run lint     # analise estatica do codigo
npm run format   # formatacao automatica
npm run build    # verificacao de tipos e build de producao
npm run preview  # visualizacao local do build
```

## Organizacao de `src`

```text
assets/       imagens e icones importados pelos componentes
components/   elementos reutilizaveis da interface
contexts/     autenticacao e sacola compartilhadas pela aplicacao
hooks/        comportamentos React reutilizaveis
layouts/      estruturas comuns entre paginas
pages/        telas associadas as rotas
routes/       declaracao central das rotas
services/     comunicacao com a API
types/        tipos compartilhados
utils/        funcoes puras e formatadores
```

Componentes especificos de um dominio ficam em subpastas, como
`components/category`, `components/item`, `components/mobile` e
`components/desktop`. Um componente deve permanecer diretamente em `components`
quando for reutilizado por diferentes dominios.

## Paginas publicas

| Rota             | Finalidade             |
| ---------------- | ---------------------- |
| `/`              | Pagina inicial         |
| `/comercial`     | Produtos comerciais    |
| `/arabes`        | Perfumes arabes        |
| `/feminino`      | Perfumes femininos     |
| `/masculino`     | Perfumes masculinos    |
| `/importados`    | Perfumes importados    |
| `/unisex`        | Perfumes unissex       |
| `/produto/:slug` | Detalhes de um produto |
| `/pedidos`       | Historico de pedidos   |
| `/pedidos/:id`   | Detalhes de um pedido  |
| `/checkout`      | Finalizacao da compra  |
| `/conta`         | Conta do cliente       |

## Convencoes

- Tipos compartilhados pertencem a `src/types`.
- Formatacao ou apresentacao reutilizavel pertence a `src/utils`.
- Variacoes repetidas devem compartilhar um componente configuravel; os filtros
  das categorias, por exemplo, usam `CategoryWindow` e `CategoryFilterDrawer`.
- Chamadas HTTP devem passar pelo cliente em `src/services/api.ts`.
