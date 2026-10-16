import { Background } from './components/Background'
import { AgentRoom } from './components/AgentRoom'
import { CalendarWidget } from './components/CalendarWidget'
import { KioskExitButton } from './components/KioskExitButton'
import { MapWidget } from './components/MapWidget'
import { NewsStrip } from './components/NewsStrip'
import { NowWidget } from './components/NowWidget'
import { PdfWidget } from './components/PdfWidget'
import { ScreenIdle } from './components/ScreenIdle'
import { TasksWidget } from './components/TasksWidget'
import { useAgenda } from './hooks/useAgenda'
import { useAgents } from './hooks/useAgents'
import { useLocations } from './hooks/useLocations'
import { useNews } from './hooks/useNews'
import { useNow } from './hooks/useNow'
import { usePdf } from './hooks/usePdf'
import { useScreenIdleMinutes } from './hooks/useScreenIdleMinutes'
import { useWeather } from './hooks/useWeather'
import './App.css'

export default function App() {
  const now = useNow()
  const weather = useWeather()
  const agenda = useAgenda()
  const news = useNews()
  const pdf = usePdf()
  const locations = useLocations()
  const agents = useAgents()
  const idleMinutes = useScreenIdleMinutes()

  return (
    <main className="screen">
      <Background />
      <NowWidget now={now} weather={weather} />
      <MapWidget state={locations} />
      <TasksWidget state={agenda} />
      <CalendarWidget state={agenda} />
      <PdfWidget state={pdf} />
      <AgentRoom state={agents} />
      <NewsStrip state={news} />
      <KioskExitButton />
      {/* La última: cuando está puesta se queda con todos los toques. */}
      <ScreenIdle idleMinutes={idleMinutes} />
    </main>
  )
}
