import { AuthProvider } from './contexts/AuthContext'
import { CartProvider } from './contexts/CartContext'
import { AppRouter } from './routes/AppRouter'

// Componente raiz da aplicacao: so empilha os providers globais (autenticacao
// e carrinho) por cima do roteador, pra qualquer pagina ter acesso a eles.
function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppRouter />
      </CartProvider>
    </AuthProvider>
  )
}

export default App
