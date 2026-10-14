import type { OrganizerStatus } from '../types/organizer'

export type ItemStatusPresentation = {
  /** Card/imagem em tons de cinza (em breve e esgotado). */
  grayscale: boolean
  /** Texto que substitui o preco (ex: "Em breve", "Esgotado"); null = mostra preco normal. */
  priceOverrideText: string | null
  /** Só "pouco no estoque" mostra quantas unidades restam. */
  showStockCount: boolean
  /** Texto curto pro badge de disponibilidade quando não é preco/estoque. */
  availableLabel: string
}

export function getItemStatusPresentation(status: OrganizerStatus | undefined): ItemStatusPresentation {
  switch (status) {
    case 'coming-soon':
      return { grayscale: true, priceOverrideText: 'Em breve', showStockCount: false, availableLabel: 'Em breve' }
    case 'out-of-stock':
      return { grayscale: true, priceOverrideText: 'Esgotado', showStockCount: false, availableLabel: 'Esgotado' }
    case 'low-stock':
      return { grayscale: false, priceOverrideText: null, showStockCount: true, availableLabel: 'Disponível' }
    default:
      return { grayscale: false, priceOverrideText: null, showStockCount: false, availableLabel: 'Disponível' }
  }
}
