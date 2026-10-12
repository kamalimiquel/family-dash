import { PHOTO } from '../config'

/**
 * Full-bleed background photo with a legibility scrim on top.
 * Sits behind the dashboard content and ignores pointer events.
 */
export function Background() {
  return (
    <div className="backdrop" aria-hidden="true">
      <img
        className="backdrop__photo"
        src={PHOTO.src}
        alt=""
        decoding="async"
        fetchPriority="high"
      />
      <div className="backdrop__scrim" />
    </div>
  )
}
