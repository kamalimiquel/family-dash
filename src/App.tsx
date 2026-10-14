import { Background } from './components/Background'
import { CalendarWidget } from './components/CalendarWidget'
import { MapWidget } from './components/MapWidget'
import { NewsStrip } from './components/NewsStrip'
import { NowWidget } from './components/NowWidget'
import { PdfWidget } from './components/PdfWidget'
import { TasksWidget } from './components/TasksWidget'
import { useAgenda } from './hooks/useAgenda'
import { useNews } from './hooks/useNews'
import { useNow } from './hooks/useNow'
import { usePdf } from './hooks/usePdf'
import { useWeather } from './hooks/useWeather'
import './App.css'

export default function App() {
  const now = useNow()
  const weather = useWeather()
  const agenda = useAgenda()
  const news = useNews()
  const pdf = usePdf()

  return (
    <main className="screen">
      <Background />
      <NowWidget now={now} weather={weather} />
      <MapWidget />
      <TasksWidget state={agenda} />
      <CalendarWidget state={agenda} />
      <PdfWidget state={pdf} />
      <NewsStrip state={news} />
    </main>
  )
}
