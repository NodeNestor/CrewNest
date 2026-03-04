import { Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import CommandCenter from './pages/CommandCenter';
import Engineers from './pages/Engineers';
import Projects from './pages/Projects';
import Memory from './pages/Memory';
import Activity from './pages/Activity';
import Settings from './pages/Settings';
import ImmersiveView from './pages/ImmersiveView';

export default function App() {
  const location = useLocation();
  const isImmersive = location.pathname.startsWith('/engineer/');

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {!isImmersive && <Sidebar />}
      <main className={isImmersive ? 'flex-1' : 'flex-1 overflow-hidden'} style={{ minHeight: 0 }}>
        <Routes>
          <Route path="/" element={<CommandCenter />} />
          <Route path="/engineers" element={<Engineers />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/memory" element={<Memory />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/engineer/:id" element={<ImmersiveView />} />
        </Routes>
      </main>
    </div>
  );
}
