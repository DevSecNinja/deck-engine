import { SlideProvider } from '../../context/SlideContext'
import Navigation from '../../components/Navigation'
import CoverSlide from './CoverSlide'
import ObjectiveSlide from './ObjectiveSlide'
import TimelineSlide from './TimelineSlide'
import SessionsSlide from './SessionsSlide'
import CoachingTeamSlide from './CoachingTeamSlide'
import TestFlightTeamSlide from './TestFlightTeamSlide'
import CertificationsSlide from './CertificationsSlide'
import AppendixSlide from './AppendixSlide'
import ThankYouSlide from '../../slides/GenericThankYouSlide'

const TOTAL = 9

export default function DevPlanApp() {
  return (
    <SlideProvider totalSlides={TOTAL} project="dev-plan">
      <Navigation />
      <div className="deck">
        <CoverSlide />
        <ObjectiveSlide />
        <SessionsSlide />
        <TimelineSlide />
        <CoachingTeamSlide />
        <TestFlightTeamSlide />
        <AppendixSlide />
        <CertificationsSlide />
        <ThankYouSlide index={8} tagline="Dilruba Turan · Aspire Development Plan · 2026" footerText="Aspire Development Plan · Dilruba Turan" />
      </div>
    </SlideProvider>
  )
}
