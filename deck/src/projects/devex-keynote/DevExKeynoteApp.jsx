import { SlideProvider } from '../../context/SlideContext'
import Navigation from '../../components/Navigation'
import CoverSlide from './CoverSlide'
import ButterflyArtSlide from './ButterflyArtSlide'
import HourglassSlide from './HourglassSlide'
import ThankYouSlide from '../../slides/GenericThankYouSlide'

const TOTAL = 4

export default function DevExKeynoteApp() {
  return (
    <SlideProvider totalSlides={TOTAL} project="devex-keynote">
      <Navigation />
      <div className="deck">
        <CoverSlide />
        <ButterflyArtSlide index={1} />
        <HourglassSlide index={2} />
        <ThankYouSlide index={3} tagline="DevEx Keynote · 2026" footerText="DevEx Keynote" />
      </div>
    </SlideProvider>
  )
}
