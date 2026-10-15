import { useLocation } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { getHomeAutoItems, getOrganizerBrands } from '../components/site/homeAutoCarousels'
import { isSiteModuleRenderable } from '../components/site/moduleContent'
import { SiteModuleRenderer } from '../components/site/SiteModuleRenderer'
import { useOrganizerStore } from '../hooks/useOrganizerStore'
import { getOrganizerPageModules, isOrganizerNodeAvailable, isOrganizerPreviewMode } from '../types/organizer'

// Pagina inicial da loja: renderiza, em ordem, os modulos que o lojista
// montou no Organizador para a pagina "home" (banners, carrosseis, grids etc).
export function HomePage() {
  const { store } = useOrganizerStore()
  const location = useLocation()
  // Modo preview do Organizador: mostra modulos/paginas ainda nao publicados
  const previewMode = isOrganizerPreviewMode(location.search)

  // Marcas e itens "automaticos" (carrosseis que o Organizador preenche
  // sozinho, ex: mais vendidos) sao calculados fora do loop de modulos
  const brands = getOrganizerBrands(store.nodes, previewMode)
  const autoItemsByModuleId = getHomeAutoItems(store.nodes, store.tags, previewMode)

  // So entram na pagina os modulos disponiveis (respeitando o preview) e que
  // tem conteudo de verdade pra mostrar (manual ou auto-preenchido)
  const modules = getOrganizerPageModules(store.nodes, 'home').filter(
    (node) =>
      isOrganizerNodeAvailable(node, previewMode) &&
      (isSiteModuleRenderable(node, store.nodes, brands, previewMode) ||
        Boolean(autoItemsByModuleId[node.id]?.length)),
  )

  return (
    <div className="space-y-10 sm:space-y-12 lg:space-y-16">
      {modules.map((module, index) => (
        // Delay crescente por indice da um efeito cascata na animacao de entrada
        <Reveal key={module.id} delay={40 + index * 35}>
          <SiteModuleRenderer
            module={module}
            nodes={store.nodes}
            tags={store.tags}
            brands={brands}
            previewMode={previewMode}
            autoItems={autoItemsByModuleId[module.id]}
          />
        </Reveal>
      ))}
    </div>
  )
}
