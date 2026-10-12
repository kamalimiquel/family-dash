import { Background } from './components/Background'
import { CalendarWidget } from './components/CalendarWidget'
import { ClockWidget } from './components/ClockWidget'
import { PhotoCredit } from './components/PhotoCredit'
import { TasksWidget } from './components/TasksWidget'
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
      <CalendarWidget state={agenda} />
      <TasksWidget state={agenda} />
      <PhotoCredit />
    </main>
  )
}
