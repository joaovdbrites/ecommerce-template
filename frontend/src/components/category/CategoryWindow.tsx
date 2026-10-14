import { FileText } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useOrganizerStore } from '../../hooks/useOrganizerStore'
import {
  getOrganizerPageModules,
  isOrganizerNodeAvailable,
  isOrganizerPreviewMode,
  normalizeOrganizerSearch,
} from '../../types/organizer'
import { isSiteModuleRenderable } from '../site/moduleContent'
import { SiteModuleRenderer } from '../site/SiteModuleRenderer'

const pageIds: Record<string, string> = {
  arabes: 'arabes',
  feminino: 'feminino',
  masculino: 'masculino',
  importados: 'importados',
  unisex: 'unisex',
}

export function CategoryWindow({ title }: { title: string }) {
  const location = useLocation()
  const { store } = useOrganizerStore()
  const previewMode = isOrganizerPreviewMode(location.search)
  const pageId = pageIds[normalizeOrganizerSearch(title)] ?? normalizeOrganizerSearch(title)
  const page = store.nodes.find((node) => node.id === pageId && node.type === 'page')
  const modules = getOrganizerPageModules(store.nodes, pageId).filter(
    (node) =>
      isOrganizerNodeAvailable(node, previewMode) &&
      isSiteModuleRenderable(node, store.nodes, [], previewMode),
  )

  if (!page || !isOrganizerNodeAvailable(page, previewMode)) {
    return (
      <section className="surface-panel mx-auto max-w-2xl p-8 text-center">
        <FileText size={34} className="mx-auto text-[#d89a28]" />
        <h1 className="mt-4 font-serif text-3xl font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-[#6b665f]">
          Esta página foi removida ou ainda não está publicada no organizador.
        </p>
      </section>
    )
  }

  return (
    <div className="space-y-8 lg:space-y-12">
      {modules.map((module) => (
        <SiteModuleRenderer
          key={module.id}
          module={module}
          nodes={store.nodes}
          tags={store.tags}
          previewMode={previewMode}
        />
      ))}
    </div>
  )
}
