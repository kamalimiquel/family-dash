import { AgendaWidget } from './components/AgendaWidget'
import { Background } from './components/Background'
import { ClockWidget } from './components/ClockWidget'
import { PhotoCredit } from './components/PhotoCredit'
import { WeatherWidget } from './components/WeatherWidget'
import { useAgenda } from './hooks/useAgenda'
import { useNow } from './hooks/useNow'
import { useWeather } from './hooks/useWeather'
import './App.css'

export default function App() {
  const now = useNow()
  const weather = useWeather()
  const agenda = useAgenda()

  return (
    <main className="screen">
      <Background />
      <ClockWidget now={now} />
      <WeatherWidget state={weather} />
      <AgendaWidget state={agenda} />
      <PhotoCredit />
    </main>
  )
}
