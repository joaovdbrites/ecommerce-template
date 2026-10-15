/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useState } from 'react'
import type { CartItem, Product } from '../types'

// Formato publico do contexto do carrinho: os itens e as acoes para
// manipula-los, usados por qualquer tela que mexa no carrinho.
type CartContextValue = {
  items: CartItem[]
  addItem: (product: Product) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)
const STORAGE_KEY = 'store-cart'

export function CartProvider({ children }: { children: ReactNode }) {
  // Carrinho carrega o estado inicial direto do localStorage (sincrono),
  // assim o carrinho nao aparece vazio por uma fracao de segundo no load.
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })

  // Toda mudanca nos itens e persistida de volta no localStorage, pra o
  // carrinho sobreviver a um refresh da pagina.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  // Adiciona um produto ao carrinho: se ja existe, so incrementa a
  // quantidade; senao, entra como item novo com quantidade 1.
  const addItem = (product: Product) => {
    setItems((current) => {
      const existing = current.find((item) => item.id === product.id)
      if (existing) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        )
      }
      return [...current, { ...product, quantity: 1 }]
    })
  }

  // Remove um produto do carrinho pelo id.
  const removeItem = (productId: string) => {
    setItems((current) => current.filter((item) => item.id !== productId))
  }

  // Atualiza a quantidade de um item; se cair a 0 (ou menos), o item sai do
  // carrinho em vez de ficar com quantidade zero.
  const updateQuantity = (productId: string, quantity: number) => {
    setItems((current) =>
      current
        .map((item) => (item.id === productId ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0),
    )
  }

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart: () => setItems([]) }}
    >
      {children}
    </CartContext.Provider>
  )
}

// Hook de acesso ao contexto do carrinho. Estoura erro cedo se for usado
// fora de CartProvider, em vez de deixar os componentes lidarem com `null`.
export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used inside CartProvider')
  }
  return context
}
