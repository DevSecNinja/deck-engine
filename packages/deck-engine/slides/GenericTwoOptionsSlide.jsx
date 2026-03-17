/**
 * Two Options — side-by-side comparison with "or" divider.
 *
 * Props:
 *   eyebrow     – small label above the title (default: "Two paths")
 *   title       – main heading, supports JSX (default: "Two <highlight>Options</highlight>")
 *   options     – array of 2 objects: { num, badge, title, description, items[], tags[] }
 *   footerText  – bottom bar text
 *
 * 🤖 Prompt tips:
 *   "Change the two options slide to compare Monolith vs Microservices"
 *   "Update option 1 items to list our product features"
 *   "Make the tags reflect our team values"
 */
import Slide from '../components/Slide.jsx'
import BottomBar from '../components/BottomBar.jsx'

const defaultOptions = [
  {
    num: '01',
    badge: 'Build',
    title: 'Ship Real Solutions',
    description: 'Teams work side-by-side to prototype, iterate, and ship working software.',
    items: ['Working demos & prototypes', 'Prioritized backlog', 'Production-ready pilots'],
    tags: ['🛠 Hands-on', '🎯 Focused', '📦 Tangible'],
  },
  {
    num: '02',
    badge: 'Scale',
    title: 'Ignite the Org',
    description: 'A large-scale engagement to inspire and accelerate technology adoption across teams.',
    items: ['Onboarding at scale', 'Platform adoption', 'Organizational momentum'],
    tags: ['🎤 Keynotes', '🧪 Workshops', '🚀 Scale'],
  },
]

export default function GenericTwoOptionsSlide({
  index = 0,
  eyebrow = 'Two paths',
  title,
  options = defaultOptions,
  footerText,
}) {
  const [a, b] = options
  return (
    <Slide index={index} className="deck-two-options">
      <div className="accent-bar" />
      <div className="orb deck-two-options-orb1" />
      <div className="orb deck-two-options-orb2" />

      <div className="deck-two-options-body content-frame content-gutter">
        <div className="deck-two-options-header">
          <p className="deck-two-options-eyebrow">{eyebrow}</p>
          <h1 className="deck-two-options-title">
            {title || <>Two <span className="deck-two-options-highlight">Options</span></>}
          </h1>
        </div>

        <div className="deck-two-options-columns">
          {[a, b].map((opt, i) => (
            <div key={i} className={`deck-two-options-card deck-two-options-card${i + 1}`}>
              <div className="deck-two-options-card-glow" />
              <div className="deck-two-options-card-inner">
                <div className="deck-two-options-card-top">
                  <span className="deck-two-options-big-num">{opt.num}</span>
                  <span className="deck-two-options-badge" data-variant={i === 0 ? 'a' : 'b'}>{opt.badge}</span>
                </div>
                <h2 className="deck-two-options-card-title">{opt.title}</h2>
                <p className="deck-two-options-card-desc">{opt.description}</p>
                <div className="deck-two-options-divider" />
                <div className="deck-two-options-items">
                  {opt.items?.map((item, j) => (
                    <div key={j} className="deck-two-options-item">
                      <span className="deck-two-options-item-icon">◆</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className="deck-two-options-tags">
                  {opt.tags?.map((tag, j) => (
                    <span key={j} className="deck-two-options-tag">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <div className="deck-two-options-vs">
            <div className="deck-two-options-vs-line" />
            <span className="deck-two-options-vs-text">or</span>
            <div className="deck-two-options-vs-line" />
          </div>
        </div>
      </div>

      <BottomBar text={footerText} />
    </Slide>
  )
}
