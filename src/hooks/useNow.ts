import { useEffect, useState } from 'react'

/**
 * Returns the current time, re-rendering once per second and re-aligning
 * itself to the wall-clock second boundary on every tick (so the displayed
 * time never drifts even after the kiosk has been running for days).
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer = 0

    const scheduleTick = () => {
      timer = window.setTimeout(() => {
        setNow(new Date())
        scheduleTick()
      }, 1000 - (Date.now() % 1000))
    }

    scheduleTick()
    return () => window.clearTimeout(timer)
  }, [])

  return now
}
