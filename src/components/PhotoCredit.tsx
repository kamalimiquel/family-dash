import { PHOTO } from '../config'

/** Crédito de la foto (obligatorio por la licencia CC BY-SA). */
export function PhotoCredit() {
  return (
    <p className="credit">
      <span className="credit__caption">{PHOTO.caption}</span>
      <span className="credit__meta">
        {PHOTO.author} ·{' '}
        <a href={PHOTO.licenseUrl} target="_blank" rel="noreferrer">
          {PHOTO.license}
        </a>{' '}
        · Wikimedia Commons
      </span>
    </p>
  )
}
