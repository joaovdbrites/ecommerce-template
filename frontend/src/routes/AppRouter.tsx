import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { MainLayout } from '../pages/layout/MainLayout'
import { AccountPage } from '../pages/AccountPage'
import { CategoryPage } from '../pages/CategoryPage'
import { CheckoutPage } from '../pages/CheckoutPage'
import { CustomerAuthPage, PasswordResetPage } from '../pages/CustomerAuthPage'
import { HomePage } from '../pages/HomePage'
import { ManagedPage } from '../pages/ManagedPage'
import { OrderTrackingPage } from '../pages/OrderTrackingPage'
import { OrderDetailPage } from '../pages/OrderDetailPage'
import { OrdersPage } from '../pages/OrdersPage'
import { OrganizerPage } from '../pages/OrganizerPage'
import { ProductPage } from '../pages/ProductPage'

// O React Router nao reseta o scroll ao trocar de rota (so o browser faz
// isso em navegacao "de verdade"). Sem isso, ir de uma pagina longa pra uma
// curta abre a nova pagina ja scrollada, as vezes quase no rodape.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

// Roteador principal da loja: define todas as rotas publicas e onde cada
// pagina entra no layout (com ou sem header/footer da loja).
export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Painel administrativo (Organizador) fica fora do MainLayout, tem chrome proprio */}
        <Route path="/admin" element={<OrganizerPage />} />
        {/* Todo o resto da loja usa o MainLayout (header, nav mobile, footer etc) */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/categoria-a" element={<CategoryPage />} />
          <Route path="/categoria-b" element={<CategoryPage />} />
          <Route path="/destaques" element={<CategoryPage />} />
          <Route path="/pagina/:slug" element={<ManagedPage />} />
          <Route path="/produto/:slug" element={<ProductPage />} />
          <Route path="/pedido/:id" element={<OrderTrackingPage />} />
          <Route path="/pedidos" element={<OrdersPage />} />
          <Route path="/pedidos/:id" element={<OrderDetailPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          {/* Login e cadastro reusam o mesmo componente, so trocando o modo */}
          <Route path="/login" element={<CustomerAuthPage mode="login" />} />
          <Route path="/cadastro" element={<CustomerAuthPage mode="register" />} />
          <Route path="/redefinir-senha" element={<PasswordResetPage />} />
          <Route path="/conta" element={<AccountPage />} />
          {/* Qualquer rota desconhecida volta pra home em vez de mostrar 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
