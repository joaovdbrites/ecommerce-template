import { FileText } from 'lucide-react'
import { useLocation, useParams } from 'react-router-dom'
import { isSiteModuleRenderable } from '../components/site/moduleContent'
import { SiteModuleRenderer } from '../components/site/SiteModuleRenderer'
import { useOrganizerStore } from '../hooks/useOrganizerStore'
import { getOrganizerPageModules, isOrganizerNodeAvailable, isOrganizerPreviewMode } from '../types/organizer'

export function ManagedPage() {
  const { slug = '' } = useParams()
  const location = useLocation()
  const { store } = useOrganizerStore()
  const previewMode = isOrganizerPreviewMode(location.search)
  const route = `/pagina/${slug}`
  const page = store.nodes.find((node) => node.type === 'page' && node.route === route)

  if (!page || !isOrganizerNodeAvailable(page, previewMode)) {
    return (
      <section className="surface-panel mx-auto max-w-2xl p-8 text-center">
        <FileText size={34} className="mx-auto text-[color:var(--color-icon)]" />
        <h1 className="mt-4 text-3xl font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-[#6b665f]">
          Esta página não existe ou ainda não foi publicada no organizador.
        </p>
      </section>
    )
  }

  const modules = getOrganizerPageModules(store.nodes, page.id).filter(
    (node) =>
      isOrganizerNodeAvailable(node, previewMode) &&
      isSiteModuleRenderable(node, store.nodes, [], previewMode),
  )

  return (
    <div className="space-y-8 sm:space-y-10 lg:space-y-12">
      <header className="border-b border-[#e3cfee] pb-5 sm:pb-6 lg:pb-8">
        <h1 className="text-3xl font-semibold text-[#3a164f] sm:text-4xl lg:text-5xl">{page.name}</h1>
        {page.description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6b665f] sm:text-base sm:leading-7">
            {page.description}
          </p>
        ) : null}
      </header>

      {modules.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[#ddc7ea] bg-white/60 p-10 text-center text-sm text-[#6b665f]">
          Esta página foi criada. Adicione e publique módulos pelo organizador.
        </div>
      ) : (
        modules.map((module) => (
          <SiteModuleRenderer
            key={module.id}
            module={module}
            nodes={store.nodes}
            tags={store.tags}
            previewMode={previewMode}
          />
        ))
      )}
    </div>
  )
}
