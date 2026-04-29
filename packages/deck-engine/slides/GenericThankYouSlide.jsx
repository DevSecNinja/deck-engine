import Slide from '../components/Slide.jsx'
import BottomBar from '../components/BottomBar.jsx'
import Editable from '../components/Editable.jsx'

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

      <div className="deck-ty-shell content-frame content-gutter">
        <div className="deck-ty-content">
          <Editable as="h2" id="thankYou.title" className="deck-ty-title">Thank You</Editable>
          <Editable as="p" id="thankYou.subtitle" className="deck-ty-subtitle">
            {subtitle || <>Let&rsquo;s build something great &mdash; together.</>}
          </Editable>
          <div className="deck-ty-divider" />
          {tagline && <Editable as="p" id="thankYou.tagline" className="deck-ty-tagline">{tagline}</Editable>}
        </div>

        <div className="deck-ty-watermark" aria-hidden="true">
          <img src="/deckio.png" alt="" className="deck-ty-watermark-icon" />
          <span className="deck-ty-watermark-text">DECKIO</span>
        </div>
      </div>

      <BottomBar text={footerText && <Editable as="span" id="thankYou.footer">{footerText}</Editable>} />
    </Slide>
  )
}
