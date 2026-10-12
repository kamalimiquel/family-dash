import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'

// `?kiosk=1` hides the pointer and disables text selection — used by the
// Raspberry Pi Chromium kiosk launcher (see scripts/kiosk.sh).
if (new URLSearchParams(window.location.search).has('kiosk')) {
  document.body.classList.add('kiosk')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
