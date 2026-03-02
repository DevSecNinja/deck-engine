import { useState, useEffect } from 'react'
import ProjectPicker from './ProjectPicker'
import GhcpApp from './GhcpApp'
import DevPlanApp from './projects/dev-plan/DevPlanApp'
import DevExKeynoteApp from './projects/devex-keynote/DevExKeynoteApp'

const FIXED_PROJECT = import.meta.env.VITE_PROJECT || null
const VALID_PROJECTS = ['ghcp', 'dev-plan', 'devex-keynote']

function getRoute() {
  if (FIXED_PROJECT && VALID_PROJECTS.includes(FIXED_PROJECT)) return FIXED_PROJECT
  const hash = window.location.hash.replace('#/', '')
  if (VALID_PROJECTS.includes(hash)) return hash
  return null
}

export default function App() {
  const [route, setRoute] = useState(getRoute)

  // Force hash to match fixed project on mount
  useEffect(() => {
    if (FIXED_PROJECT && VALID_PROJECTS.includes(FIXED_PROJECT)) {
      window.location.hash = '#/' + FIXED_PROJECT
    }
  }, [])

  useEffect(() => {
    if (FIXED_PROJECT) return // no hash navigation in fixed-project mode
    const onHash = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Allow Escape to return to picker (only when no fixed project)
  useEffect(() => {
    if (!route || FIXED_PROJECT) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        window.location.hash = ''
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [route])

  if (route === 'ghcp') return <GhcpApp />
  if (route === 'dev-plan') return <DevPlanApp />
  if (route === 'devex-keynote') return <DevExKeynoteApp />
  return <ProjectPicker />
}
