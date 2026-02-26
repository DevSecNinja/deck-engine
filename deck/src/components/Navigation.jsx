import { useSlides } from '../context/SlideContext'
import styles from './Navigation.module.css'
import { useState, useEffect } from 'react'

export default function Navigation() {
  const { current, totalSlides, go, goTo } = useSlides()
  const [hintVisible, setHintVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), 5000)
    return () => clearTimeout(t)
  }, [])

  const progress = ((current + 1) / totalSlides) * 100

  return (
    <>
      {/* Progress bar */}
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      {/* Home button */}
      {current !== 0 && (
        <button
          className={styles.homeBtn}
          onClick={() => goTo(0)}
          title="Back to home"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12l9-9 9 9" />
            <path d="M9 21V9h6v12" />
          </svg>
        </button>
      )}

      {/* Nav buttons */}
      <button
        className={`${styles.navBtn} ${styles.prev}`}
        disabled={current === 0}
        onClick={() => go(-1)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        className={`${styles.navBtn} ${styles.next}`}
        disabled={current === totalSlides - 1}
        onClick={() => go(1)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>

      {/* Keyboard hint */}
      {hintVisible && (
        <div className={styles.keyHint}>
          <span className={styles.kbd}>&larr;</span>
          <span className={styles.kbd}>&rarr;</span> or click arrows to navigate
        </div>
      )}
    </>
  )
}
