import { formatLongDate, formatSpokenDateTime, getIsoWeek, getTimeParts } from '../lib/time'

interface ClockWidgetProps {
  now: Date
}

/** Widget 1: hora y fecha, en una tarjeta igual que la del tiempo. */
export function ClockWidget({ now }: ClockWidgetProps) {
  const { hours, minutes, seconds } = getTimeParts(now)
  const dateLabel = formatLongDate(now)
  const spoken = formatSpokenDateTime(now)
  const colonOn = now.getSeconds() % 2 === 0

  return (
    <section className="widget widget--clock" role="timer" aria-label={spoken}>
      <header className="clock__head">
        <span className="clock__label">Hoy</span>
        <span className="clock__week">semana {getIsoWeek(now)}</span>
      </header>

      <div className="clock__time" aria-hidden="true">
        <span className="clock__digits">{hours}</span>
        <span className="clock__colon" data-on={colonOn} />
        <span className="clock__digits">{minutes}</span>
        <span className="clock__seconds">{seconds}</span>
      </div>

      <div className="clock__rule" aria-hidden="true" />

      <p className="clock__date" aria-hidden="true">
        {dateLabel}
      </p>
    </section>
  )
}
