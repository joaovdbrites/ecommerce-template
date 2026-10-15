// Devolve uma funcao formatadora de valores monetarios em Real (pt-BR), pra
// quem precisa exibir preco sem repetir a config do Intl.NumberFormat.
export function useCurrency() {
  return (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
}
