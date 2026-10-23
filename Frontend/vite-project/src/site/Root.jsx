import { useEffect } from 'react'
import App from '../app/App.jsx'
import CookieBanner from './CookieBanner.jsx'
import { initAnalytics } from './consent.js'
import NotFoundPage from './NotFoundPage.jsx'
import { PrivacyPage, TermsPage } from './LegalPages.jsx'
import ToastProvider from './Toast.jsx'

// Real URLs for the public pages. Anything else that is not the app's home gets the 404 page.
// (Sign-in and email links always return to "/", so the app itself is unaffected.)
const path = window.location.pathname.replace(/\/+$/, '') || '/'

function Page() {
  if (path === '/privacy') return <PrivacyPage />
  if (path === '/terms') return <TermsPage />
  if (path !== '/' && path !== '/index.html') return <NotFoundPage />
  return <App />
}

export default function Root() {
  useEffect(() => { initAnalytics() }, [])
  return <ToastProvider><Page /><CookieBanner /></ToastProvider>
}
