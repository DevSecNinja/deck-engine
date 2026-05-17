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
 *   "In agent mode, turn this slide into Kubernetes vs Container Apps"
 *   "Rewrite both option cards using our real trade-offs and presenter-friendly wording"
 *   "Inspect this slide, tell me what looks off, and refine the comparison"
 */
import Slide from '../components/Slide.jsx'
import BottomBar from '../components/BottomBar.jsx'
import EditableList from '../components/EditableList.jsx'
import { markSampleContent } from '../sampleContent.js'

const SAMPLE_OPTIONS = markSampleContent([
  {
    id: 'option-a',
    num: '01',
    badge: 'Option A',
    title: 'Describe Option A To Copilot',
    description: 'Use this card for your first real path, architecture, strategy, or trade-off, then let Copilot turn it into presenter-ready copy.',
    items: ['Ask Copilot in agent mode to define Option A', 'Give it outcomes, risks, and constraints', 'Review the live slide and refine the wording'],
    tags: ['🤖 Agent mode', '🅰️ Option A', '🔁 Refine live'],
  },
  {
    id: 'option-b',
    num: '02',
    badge: 'Option B',
    title: 'Ask For The Contrast In Option B',
    description: 'Use this card for the second path so Copilot can turn the slide into a real comparison instead of two isolated lists.',
    items: ['Tell Copilot what changes in Option B', 'Ask it to sharpen the difference vs Option A', 'Delete the sample text once the slide is real'],
    tags: ['🤖 Copilot draft', '🅱️ Option B', '🧪 Inspect result'],
  },
], { kind: 'comparison-options' })

export default function GenericTwoOptionsSlide({
  index = 0,
  eyebrow = 'Sample slide · build with Copilot',
  title,
  options = SAMPLE_OPTIONS,
  footerText,
}) {
  const isSampleOptions = options?.__sample === true
  return (
    <Slide index={index} className="deck-two-options">
      <div className="accent-bar" />
      <div className="orb deck-two-options-orb1" />
      <div className="orb deck-two-options-orb2" />

      <div className="deck-two-options-body content-frame content-gutter">
        <div className="deck-two-options-header">
          <p className="deck-two-options-eyebrow">{eyebrow}</p>
          <h1 className="deck-two-options-title">
            {title || <>Ask Copilot To Build Your <span className="deck-two-options-highlight">Real Comparison</span></>}
          </h1>
          {isSampleOptions && (
            <p className="deck-two-options-sample-note">
              Recommended flow: ask Copilot in agent mode to rewrite both cards with your real options, inspect the slide in the live preview, refine anything that feels off, then remove the sample text before using this deck as context.
            </p>
          )}
        </div>

        <div className="deck-two-options-columns">
          <EditableList
            id="twoOptions.options"
            items={options}
            keyOf={(o) => o.id}
            as="div"
            itemAs="div"
            className="deck-two-options-cards"
          >
            {(opt, i) => (
              <div className={`deck-two-options-card deck-two-options-card${i + 1}`}>
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
            )}
          </EditableList>
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
