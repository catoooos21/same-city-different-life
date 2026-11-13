import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { LangProvider, useLang } from './lang'
import { About, CasePage, Home } from './pages'
import './styles.css'

function Shell() {
  const { t, lang, setLang } = useLang()
  return (
    <>
      <header className="top">
        <NavLink to="/" className="brand">
          <span className="brand-name">{t('appName')}</span>
          <span className="brand-sub">{t('tagline')}</span>
        </NavLink>
        <nav>
          <NavLink to="/" end>{t('navHome')}</NavLink>
          <NavLink to="/about">{t('navAbout')}</NavLink>
          <button className="lang" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>{t('langToggle')}</button>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/case/:caseId" element={<CasePage />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <footer>
        <p>{t('footerData')}</p>
        <p>{t('footerNote')}</p>
      </footer>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </LangProvider>
  </StrictMode>,
)
