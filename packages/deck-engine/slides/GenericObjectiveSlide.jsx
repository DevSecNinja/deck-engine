/**
 * Objective — hero statement with KPI counters and feature cards.
 *
 * Props:
 *   label       – small label (default: "Our Objective")
 *   heading     – main statement
 *   kpis        – array of { number, label }
 *   cards       – array of { icon, title, description }
 *   banner      – optional bottom banner { icon, title, description }
 *   footerText  – bottom bar text
 *
 * 🤖 Prompt tips:
 *   "Change the objective to launching our new API platform"
 *   "Update the KPIs to show 50 customers, 5 regions, 99.9% uptime"
 *   "Add a card about developer experience"
 */
import Slide from '../components/Slide.jsx'
import BottomBar from '../components/BottomBar.jsx'

const defaultKpis = [
  { number: '10x', label: 'Faster Deploys' },
  { number: '99.9%', label: 'Uptime SLA' },
  { number: '500+', label: 'Engineers' },
]

const defaultCards = [
  { icon: '🚀', title: 'Ship Faster', description: 'Automate the pipeline from commit to production. Less ceremony, more shipping.' },
  { icon: '🏗️', title: 'Build to Last', description: 'Architecture decisions that scale. Design for the traffic you want, not the traffic you have.' },
  { icon: '🤝', title: 'Grow the Team', description: 'Invest in people. Pair programming, code reviews, and a culture where everyone levels up.' },
]

export default function GenericObjectiveSlide({
  index = 0,
  label = 'Our Objective',
  heading = 'Build the platform developers actually want to use',
  kpis = defaultKpis,
  cards = defaultCards,
  banner,
  footerText,
}) {
  return (
    <Slide index={index} className="deck-objective">
      <div className="accent-bar" />
      <div className="orb deck-objective-orb1" />
      <div className="orb deck-objective-orb2" />

      <div className="deck-objective-body content-frame content-gutter">
        <p className="deck-objective-label">{label}</p>
        <h2 className="deck-objective-heading">{heading}</h2>

        <div className="deck-objective-kpis">
          {kpis.map((kpi, i) => (
            <div key={i} className="deck-objective-kpi">
              <span className="deck-objective-kpi-number">{kpi.number}</span>
              <span className="deck-objective-kpi-label">{kpi.label}</span>
            </div>
          ))}
        </div>

        <div className="deck-objective-cards">
          {cards.map((card, i) => (
            <div key={i} className="deck-objective-card">
              <div className="deck-objective-card-icon">{card.icon}</div>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </div>
          ))}
        </div>

        {banner && (
          <div className="deck-objective-banner">
            <span className="deck-objective-banner-icon">{banner.icon}</span>
            <div>
              <h3>{banner.title}</h3>
              <p>{banner.description}</p>
            </div>
          </div>
        )}
      </div>

      <BottomBar text={footerText} />
    </Slide>
  )
}
