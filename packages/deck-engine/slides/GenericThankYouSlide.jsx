import Slide from '../components/Slide.jsx'
import BottomBar from '../components/BottomBar.jsx'

export default function GenericThankYouSlide({ index = 10, subtitle, tagline, footerText }) {
  return (
    <Slide index={index} className="deck-ty">
      <div className="accent-bar" />

      <div className="deck-ty-glow deck-ty-glow1" />
      <div className="deck-ty-glow deck-ty-glow2" />
      <div className="deck-ty-glow deck-ty-glow3" />

      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
        <div key={i} className={`deck-ty-streak deck-ty-streak${i}`} />
      ))}

      <div className="content-frame content-gutter">
        <div className="deck-ty-content">
          <h2 className="deck-ty-title">Thank You</h2>
          <p className="deck-ty-subtitle">
            {subtitle || <>Let&rsquo;s build something great &mdash; together.</>}
          </p>
          <div className="deck-ty-divider" />
          {tagline && <p className="deck-ty-tagline">{tagline}</p>}
        </div>
      </div>

      <BottomBar text={footerText} />
    </Slide>
  )
}
