import { SlideProvider } from './context/SlideContext'
import Navigation from './components/Navigation'
import CoverSlide from './slides/CoverSlide'
import AgendaSlide from './slides/AgendaSlide'
import OpportunitySlide from './slides/OpportunitySlide'
import IntentSlide from './slides/IntentSlide'
import ApproachSlide from './slides/ApproachSlide'
import PresentersSlide from './slides/PresentersSlide'
import GovernanceSlide from './slides/GovernanceSlide'
import ThankYouSlide from './slides/ThankYouSlide'
import CustomerCoverSlide from './slides/CustomerCoverSlide'
import CustomerIntroSlide from './slides/CustomerIntroSlide'
import CustomerGoalsSlide from './slides/CustomerGoalsSlide'
import CustomerCommitmentSlide from './slides/CustomerCommitmentSlide'
import CustomerNextStepsSlide from './slides/CustomerNextStepsSlide'
import SelectorSlide from './slides/SelectorSlide'
import AppendixEmailSlide from './slides/AppendixEmailSlide'
import SpeakerInviteSlide from './slides/SpeakerInviteSlide'

const TOTAL = 19

export default function App() {
  return (
    <SlideProvider totalSlides={TOTAL}>
      <Navigation />
      <div className="deck">
        <SelectorSlide />
        <CoverSlide />
        <AgendaSlide />
        <OpportunitySlide />
        <IntentSlide />
        <ApproachSlide />
        <PresentersSlide />
        <GovernanceSlide />
        <ThankYouSlide />
        <SpeakerInviteSlide />
        <CustomerCoverSlide />
        <CustomerIntroSlide />
        <CustomerGoalsSlide />
        <ApproachSlide index={13} />
        <PresentersSlide index={14} />
        <CustomerCommitmentSlide />
        <CustomerNextStepsSlide />
        <ThankYouSlide index={17} />
        <AppendixEmailSlide />
      </div>
    </SlideProvider>
  )
}
