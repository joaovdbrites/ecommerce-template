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

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/admin" element={<OrganizerPage />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/arabes" element={<CategoryPage title="Árabes" />} />
          <Route path="/feminino" element={<CategoryPage title="Feminino" />} />
          <Route path="/masculino" element={<CategoryPage title="Masculino" />} />
          <Route path="/importados" element={<CategoryPage title="Importados" />} />
          <Route path="/unisex" element={<CategoryPage title="Unisex" />} />
          <Route path="/pagina/:slug" element={<ManagedPage />} />
          <Route path="/produto/:slug" element={<ProductPage />} />
          <Route path="/pedido/:id" element={<OrderTrackingPage />} />
          <Route path="/pedidos" element={<OrdersPage />} />
          <Route path="/pedidos/:id" element={<OrderDetailPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/login" element={<CustomerAuthPage mode="login" />} />
          <Route path="/cadastro" element={<CustomerAuthPage mode="register" />} />
          <Route path="/redefinir-senha" element={<PasswordResetPage />} />
          <Route path="/conta" element={<AccountPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
