import { CategoryWindow } from '../components/category/CategoryWindow'

// Pagina de categoria/vitrine (usada por /categoria-a, /categoria-b e
// /destaques): toda a logica real fica no componente CategoryWindow, que
// descobre qual categoria exibir a partir da rota atual.
export function CategoryPage() {
  return <CategoryWindow />
}
