import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { DashboardProvider } from './context/DashboardContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { bootBranding } from './branding/applyBranding.js' // [branding]

// [branding] Aplica la marca cacheada (o el default LA REAL) antes del primer render: sin flash.
bootBranding()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <DashboardProvider>
          <App />
        </DashboardProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
