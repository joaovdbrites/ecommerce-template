import { useLocation } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { getHomeAutoItems, getOrganizerBrands } from '../components/site/homeAutoCarousels'
import { isSiteModuleRenderable } from '../components/site/moduleContent'
import { SiteModuleRenderer } from '../components/site/SiteModuleRenderer'
import { useOrganizerStore } from '../hooks/useOrganizerStore'
import { getOrganizerPageModules, isOrganizerNodeAvailable, isOrganizerPreviewMode } from '../types/organizer'

export function HomePage() {
  const { store } = useOrganizerStore()
  const location = useLocation()
  const previewMode = isOrganizerPreviewMode(location.search)

  const brands = getOrganizerBrands(store.nodes, previewMode)
  const autoItemsByModuleId = getHomeAutoItems(store.nodes, store.tags, previewMode)

  const modules = getOrganizerPageModules(store.nodes, 'home').filter(
    (node) =>
      isOrganizerNodeAvailable(node, previewMode) &&
      (isSiteModuleRenderable(node, store.nodes, brands, previewMode) ||
        Boolean(autoItemsByModuleId[node.id]?.length)),
  )

  return (
    <div className="space-y-10 sm:space-y-12 lg:space-y-16">
      {modules.map((module, index) => (
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
