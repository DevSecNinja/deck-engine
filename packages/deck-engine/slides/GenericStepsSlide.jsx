/**
 * Steps — progressive disclosure timeline. Steps reveal one at a time
 * via arrow keys when the slide is active.
 *
 * Props:
 *   eyebrow     – small label above title (default: "The playbook")
 *   title       – heading (default: "A Proven Framework")
 *   subtitle    – under the title
 *   steps       – array of { num, title, desc, icon }
 *   footerText  – bottom bar text
 *
 * 🤖 Prompt tips:
 *   "Change the steps slide to show our 4-phase migration plan"
 *   "Add a 6th step about monitoring and observability"
 *   "Make the icons reflect a deployment pipeline"
 */
import { useState, useEffect } from 'react'
import Slide from '../components/Slide.jsx'
import BottomBar from '../components/BottomBar.jsx'
import { useSlides } from '../context/SlideContext.jsx'

const defaultSteps = [
  { num: '01', title: 'Define the Problem', desc: 'Identify the core challenge, constraints, and success criteria before writing a single line of code.', icon: '🎯' },
  { num: '02', title: 'Design the Approach', desc: 'Map the architecture, choose the right tools, and validate assumptions with the team.', icon: '🧠' },
  { num: '03', title: 'Build Iteratively', desc: 'Ship small increments, get feedback early, and let the code evolve with real-world usage.', icon: '🔨' },
  { num: '04', title: 'Test & Validate', desc: 'Automate the boring stuff. Integration tests, load tests, and chaos engineering — trust but verify.', icon: '🧪' },
  { num: '05', title: 'Ship & Observe', desc: 'Deploy with confidence. Monitor, alert, iterate. The best code is the code that runs in production.', icon: '🚀' },
]

export default function GenericStepsSlide({
  index = 0,
  eyebrow = 'The playbook',
  title = 'A Proven Framework',
  subtitle = 'Five steps to ship software that actually moves the needle.',
  steps = defaultSteps,
  footerText,
}) {
  const { current } = useSlides()
  const [visibleCount, setVisibleCount] = useState(0)
  const isActive = current === index

  useEffect(() => { if (isActive) setVisibleCount(0) }, [isActive])

  useEffect(() => {
    if (!isActive) return
    const handler = (e) => {
      const fwd = e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown' || e.key === 'Enter'
      const bwd = e.key === 'ArrowLeft' || e.key === 'PageUp'
      if (fwd && visibleCount < steps.length) { e.stopImmediatePropagation(); e.preventDefault(); setVisibleCount(v => v + 1) }
      else if (bwd && visibleCount > 0) { e.stopImmediatePropagation(); e.preventDefault(); setVisibleCount(v => v - 1) }
    }
    document.addEventListener('keydown', handler, { capture: true })
    return () => document.removeEventListener('keydown', handler, { capture: true })
  }, [isActive, visibleCount, steps.length])

  return (
    <Slide index={index} className="deck-steps">
      <div className="accent-bar" />
      <div className="orb deck-steps-orb1" />
      <div className="orb deck-steps-orb2" />

      <div className="deck-steps-body content-frame content-gutter">
        <div className="deck-steps-header">
          <p className="deck-steps-eyebrow">{eyebrow}</p>
          <h1 className="deck-steps-title">{title}</h1>
          <p className="deck-steps-subtitle">{subtitle}</p>
        </div>

        <div className="deck-steps-timeline">
          {steps.map((step, i) => (
            <div key={step.num} className={`deck-steps-step ${i < visibleCount ? 'deck-steps-visible' : ''}`}>
              <div className="deck-steps-connector">
                <div className="deck-steps-dot" />
                {i < steps.length - 1 && <div className="deck-steps-line" />}
              </div>
              <div className="deck-steps-card">
                <div className="deck-steps-card-top">
                  <span className="deck-steps-num">{step.num}</span>
                  <span className="deck-steps-icon">{step.icon}</span>
                </div>
                <h3 className="deck-steps-card-title">{step.title}</h3>
                <p className="deck-steps-card-desc">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomBar text={footerText} />
    </Slide>
  )
}
