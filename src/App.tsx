import { Background } from './components/Background'
import { CalendarWidget } from './components/CalendarWidget'
import { NewsStrip } from './components/NewsStrip'
import { NowWidget } from './components/NowWidget'
import { PhotoCredit } from './components/PhotoCredit'
import { TasksWidget } from './components/TasksWidget'
import { useAgenda } from './hooks/useAgenda'
import { useNews } from './hooks/useNews'
import { useNow } from './hooks/useNow'
import { useWeather } from './hooks/useWeather'
import './App.css'

export default function App() {
  const now = useNow()
  const weather = useWeather()
  const agenda = useAgenda()
  const news = useNews()

  return (
    <main className="screen">
      <Background />
      <NowWidget now={now} weather={weather} />
      <CalendarWidget state={agenda} />
      <TasksWidget state={agenda} />
      <NewsStrip state={news} />
      <PhotoCredit />
    </main>
  )
}
