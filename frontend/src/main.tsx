import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Ponto de entrada do bundle: monta o App no elemento #root do index.html.
// StrictMode so ajuda a pegar efeitos colaterais incorretos em dev (duplica
// renders/efeitos), nao afeta o build de producao.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
