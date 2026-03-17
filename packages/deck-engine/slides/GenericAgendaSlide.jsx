/**
 * Agenda — timeline-style agenda with time blocks, parallel tracks,
 * speaker avatars, and optional logo/branding corner.
 *
 * Props:
 *   eyebrow     – small label (default: "Event agenda")
 *   title       – heading, supports JSX
 *   description – subtitle text
 *   blocks      – array of { time, end, label, sub?, icon, color, parallel?, tracks?: [] }
 *   footerText  – bottom bar text
 *
 * 🤖 Prompt tips:
 *   "Change the agenda to a 3-hour workshop with 4 sessions"
 *   "Add a lunch break at 12:30 and a keynote at 14:00"
 *   "Replace the parallel tracks with two workshop rooms"
 */
import Slide from '../components/Slide.jsx'
import BottomBar from '../components/BottomBar.jsx'

const defaultBlocks = [
  { time: '09:00', end: '09:15', label: 'Welcome & Introduction', icon: '🎙', color: 'accent' },
  { time: '09:15', end: '09:45', label: 'Opening Keynote', sub: 'Your amazing speaker here', icon: '🎤', color: 'blue' },
  { time: '09:45', end: '10:00', label: 'Break', icon: '☕', color: 'muted' },
  {
    time: '10:00', end: '12:00', label: 'Breakout Sessions', icon: '💻', color: 'purple',
    parallel: true,
    tracks: [
      { name: 'Track A: Building', emoji: '🔨', desc: 'Hands-on coding and architecture' },
      { name: 'Track B: Designing', emoji: '🎨', desc: 'UX, product design, and prototyping' },
      { name: 'Track C: Scaling', emoji: '🚀', desc: 'Infrastructure, DevOps, and platform engineering' },
    ],
  },
  { time: '12:00', end: '13:00', label: 'Lunch & Networking', icon: '🍕', color: 'green' },
]

export default function GenericAgendaSlide({
  index = 0,
  eyebrow = 'Event agenda',
  title,
  description = 'Keynotes, hands-on breakouts, and time to connect.',
  blocks = defaultBlocks,
  footerText,
}) {
  return (
    <Slide index={index} className="deck-agenda">
      <div className="accent-bar" />
      <div className="orb deck-agenda-orb1" />
      <div className="orb deck-agenda-orb2" />

      <div className="deck-agenda-body content-frame content-gutter">
        <div className="deck-agenda-header">
          <p className="deck-agenda-eyebrow">{eyebrow}</p>
          <h1 className="deck-agenda-title">
            {title || <>The <span className="deck-agenda-highlight">Agenda</span></>}
          </h1>
          <p className="deck-agenda-desc">{description}</p>
        </div>

        <div className="deck-agenda-timeline">
          <div className="deck-agenda-rail" />
          {blocks.map((block, i) => (
            <div key={i} className={`deck-agenda-block deck-agenda-${block.color || 'accent'}`}>
              <div className="deck-agenda-time">{block.time}</div>
              <div className="deck-agenda-dot" />
              <div className="deck-agenda-card">
                <div className="deck-agenda-card-header">
                  <span className="deck-agenda-icon">{block.icon}</span>
                  <span className="deck-agenda-label">{block.label}</span>
                  <span className="deck-agenda-range">{block.time} – {block.end}</span>
                </div>
                {block.sub && <span className="deck-agenda-sub">{block.sub}</span>}
                {block.parallel && block.tracks && (
                  <div className="deck-agenda-tracks">
                    {block.tracks.map((t, j) => (
                      <div key={j} className="deck-agenda-track">
                        <span className="deck-agenda-track-emoji">{t.emoji}</span>
                        <div className="deck-agenda-track-info">
                          <span className="deck-agenda-track-name">{t.name}</span>
                          {t.desc && <span className="deck-agenda-track-desc">{t.desc}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomBar text={footerText} />
    </Slide>
  )
}
