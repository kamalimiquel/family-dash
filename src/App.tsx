import { Background } from './components/Background'
import { ClockWidget } from './components/ClockWidget'
import { PhotoCredit } from './components/PhotoCredit'
import { WeatherWidget } from './components/WeatherWidget'
import { useNow } from './hooks/useNow'
import { useWeather } from './hooks/useWeather'
import './App.css'

export default function App() {
  const now = useNow()
  const weather = useWeather()

  return (
    <main className="screen">
      <Background />
      <ClockWidget now={now} />
      <WeatherWidget state={weather} />
      <PhotoCredit />
    </main>
  )
}
