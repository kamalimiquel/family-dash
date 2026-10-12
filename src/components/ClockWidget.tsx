import { formatLongDate, formatSpokenDateTime, getTimeParts } from '../lib/time'

interface ClockWidgetProps {
  now: Date
}

/** Reloj: hora y fecha. No lleva tarjeta propia: vive dentro del widget «ahora». */
export function ClockWidget({ now }: ClockWidgetProps) {
  const { hours, minutes, seconds } = getTimeParts(now)
  const colonOn = now.getSeconds() % 2 === 0

  return (
    <div className="clock" role="timer" aria-label={formatSpokenDateTime(now)}>
      <div className="clock__time" aria-hidden="true">
        <span className="clock__digits">{hours}</span>
        <span className="clock__colon" data-on={colonOn} />
        <span className="clock__digits">{minutes}</span>
        <span className="clock__seconds">{seconds}</span>
      </div>

      <div className="clock__rule" aria-hidden="true" />

      <p className="clock__date" aria-hidden="true">
        {formatLongDate(now)}
      </p>
    </div>
  )
}
