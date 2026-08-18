import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeAuth } from './auth.ts'

function Bootstrap() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void initializeAuth()
      .catch(() => setError('Não foi possível conectar ao serviço de autenticação. Verifique se o Keycloak está disponível.'))
      .finally(() => setReady(true))
  }, [])

  if (!ready) return <main className="auth-loading">Preparando acesso seguro...</main>
  if (error) return <main className="auth-loading auth-error">{error}</main>
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
)
