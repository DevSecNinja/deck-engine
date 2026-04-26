import { Component } from 'react'
import { useSlides } from '../context/SlideContext'

class SlideErrorBoundaryInner extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Slide failed to render', error, errorInfo)
  }

  render() {
    const { children, index, stateClass } = this.props
    const { error } = this.state

    if (error) {
      return (
        <div className={`slide ${stateClass} slide-error-boundary`} data-slide={index} role="alert">
          <div className="slide-error-boundary__content">
            <h2>This slide failed to render</h2>
            <p>{error.message || 'Unknown rendering error'}</p>
          </div>
        </div>
      )
    }

    return children
  }
}

export default function SlideErrorBoundary({ children, index }) {
  const { current } = useSlides()
  const stateClass = index === current ? 'active' : index < current ? 'exit-left' : ''

  return (
    <SlideErrorBoundaryInner index={index} stateClass={stateClass}>
      {children}
    </SlideErrorBoundaryInner>
  )
}
