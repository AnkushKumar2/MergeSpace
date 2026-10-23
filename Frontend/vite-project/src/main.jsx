import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import Root from './site/Root.jsx'
import './site/site.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
