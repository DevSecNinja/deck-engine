/**
 * Table of Contents — clickable agenda with numbered items
 * that navigate to specific slides.
 *
 * Props:
 *   heading     – left panel text (default: "Table of Contents")
 *   items       – array of { num, title, desc, target } where target is slide index
 *   footerText  – bottom bar text
 *
 * 🤖 Prompt tips:
 *   "Change the table of contents to have 7 sections for our product launch"
 *   "Update the descriptions to match our quarterly review agenda"
 *   "Make item 3 point to slide 8 instead"
 */
import Slide from '../components/Slide.jsx'
import BottomBar from '../components/BottomBar.jsx'
import { useSlides } from '../context/SlideContext.jsx'

const defaultItems = [
  { num: 1, title: 'The Problem', desc: 'What we are solving and why it matters to the business.', target: 2 },
  { num: 2, title: 'Our Approach', desc: 'The architecture, trade-offs, and key design decisions.', target: 3 },
  { num: 3, title: 'Demo', desc: 'A live walkthrough of the working prototype.', target: 4 },
  { num: 4, title: 'Roadmap', desc: 'What is shipping next and the timeline to GA.', target: 5 },
  { num: 5, title: 'Ask', desc: 'What we need from leadership to keep momentum.', target: 6 },
]

export default function GenericTocSlide({
  index = 0,
  heading,
  items = defaultItems,
  footerText,
}) {
  const { goTo } = useSlides()

  return (
    <Slide index={index} className="deck-toc">
      <div className="accent-bar" />

      <div className="deck-toc-layout content-frame content-gutter">
        <div className="deck-toc-left">
          <div className="orb deck-toc-orbA" />
          <div className="orb deck-toc-orbB" />

          <svg className="deck-toc-circuit" viewBox="0 0 120 120" fill="none" stroke="rgba(139,148,158,0.5)" strokeWidth="1.2">
            <path d="M10,60 H50 Q60,60 60,50 V20" />
            <path d="M60,20 Q60,10 70,10 H110" />
            <circle cx="10" cy="60" r="3" fill="rgba(86,212,221,0.6)" stroke="none" />
            <circle cx="110" cy="10" r="3" fill="rgba(188,140,255,0.6)" stroke="none" />
            <path d="M50,60 Q60,60 60,70 V100" />
            <circle cx="60" cy="100" r="3" fill="rgba(88,166,255,0.6)" stroke="none" />
          </svg>

          <h2 className="deck-toc-heading">
            {heading || <>Table <span className="deck-toc-muted">of</span><br />Contents</>}
          </h2>
        </div>

        <div className="deck-toc-right">
          <div className="deck-toc-card">
            {items.map(item => (
              <div key={item.num} className="deck-toc-item" onClick={() => item.target != null && goTo(item.target)} style={item.target != null ? { cursor: 'pointer' } : undefined}>
                <div className="deck-toc-num">{item.num}</div>
                <div className="deck-toc-text">
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomBar text={footerText} />
    </Slide>
  )
}
