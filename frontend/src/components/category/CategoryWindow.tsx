import { FileText } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useOrganizerStore } from '../../hooks/useOrganizerStore'
import { getOrganizerPageModules, isOrganizerNodeAvailable, isOrganizerPreviewMode } from '../../types/organizer'
import { isSiteModuleRenderable } from '../site/moduleContent'
import { SiteModuleRenderer } from '../site/SiteModuleRenderer'

// Acha a pagina pelo caminho da URL (sem prefixo/rota de busca) em vez de um
// mapa de ids cravado - assim qualquer pagina de topo nova no Organizador so
// precisa de uma rota correspondente em AppRouter.tsx, sem editar este arquivo.
export function CategoryWindow() {
  const location = useLocation()
  const { store } = useOrganizerStore()
  // Preview do organizador mostra paginas/modulos ainda nao publicados.
  const previewMode = isOrganizerPreviewMode(location.search)
  const page = store.nodes.find((node) => node.type === 'page' && node.route === location.pathname)
  const pageId = page?.id ?? ''
  // Modulos da pagina, descartando os indisponiveis (fora do ar/nao publicados,
  // exceto em preview) ou que nao tem conteudo para renderizar.
  const modules = getOrganizerPageModules(store.nodes, pageId).filter(
    (node) =>
      isOrganizerNodeAvailable(node, previewMode) &&
      isSiteModuleRenderable(node, store.nodes, [], previewMode),
  )

  // Pagina nao existe ou nao esta disponivel: mostra mensagem de "nao encontrada".
  if (!page || !isOrganizerNodeAvailable(page, previewMode)) {
    return (
      <section className="surface-panel mx-auto max-w-2xl p-8 text-center">
        <FileText size={34} className="mx-auto text-[color:var(--color-icon)]" />
        <h1 className="mt-4 text-3xl font-semibold">Página não encontrada</h1>
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
