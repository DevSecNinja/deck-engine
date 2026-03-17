/**
 * Three Goals — triple card layout with icons and accent colors.
 *
 * Props:
 *   title       – heading (default: "Three clear goals")
 *   subtitle    – under the title
 *   goals       – array of 3: { title, description, icon (JSX or emoji string), accent }
 *   footerText  – bottom bar text
 *
 * Accent values: 'accent' (teal), 'purple', 'green', 'pink', 'blue', 'orange'
 *
 * 🤖 Prompt tips:
 *   "Change the goals to reflect our Q3 OKRs"
 *   "Use company-specific icons and pink/purple/green accents"
 *   "Add a fourth goal about customer satisfaction"
 */
import Slide from '../components/Slide.jsx'
import BottomBar from '../components/BottomBar.jsx'

const defaultGoals = [
  {
    title: 'Ship with Confidence',
    description: 'Every commit is tested, every deploy is automated. Move fast without breaking things.',
    icon: '⚡',
    accent: 'accent',
  },
  {
    title: 'Measure What Matters',
    description: 'Track the metrics that drive business outcomes, not vanity stats.',
    icon: '📊',
    accent: 'purple',
  },
  {
    title: 'Grow the Community',
    description: 'Open source first. Documentation as a feature. Make it easy for others to contribute.',
    icon: '🌍',
    accent: 'green',
  },
]

export default function GenericGoalsSlide({
  index = 0,
  title = 'Three clear goals',
  subtitle = 'What success looks like for this initiative',
  goals = defaultGoals,
  footerText,
}) {
  return (
    <Slide index={index} className="deck-goals">
      <div className="accent-bar" />
      <div className="orb deck-goals-orb1" />
      <div className="orb deck-goals-orb2" />
      <div className="orb deck-goals-orb3" />

      <div className="deck-goals-body content-frame content-gutter">
        <div className="deck-goals-header">
          <h2 className="deck-goals-title">{title}</h2>
          <p className="deck-goals-subtitle">{subtitle}</p>
        </div>

        <div className="deck-goals-cards">
          {goals.map((g, i) => (
            <div key={i} className={`deck-goals-card deck-goals-card-${g.accent || 'accent'}`}>
              <div className="deck-goals-card-glow" />
              <div className="deck-goals-card-icon">
                {typeof g.icon === 'string' ? <span style={{ fontSize: 36 }}>{g.icon}</span> : g.icon}
              </div>
              <h3 className="deck-goals-card-title">{g.title}</h3>
              <p className="deck-goals-card-desc">{g.description}</p>
            </div>
          ))}
        </div>
      </div>

      <BottomBar text={footerText} />
    </Slide>
  )
}
