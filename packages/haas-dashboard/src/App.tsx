import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { AuditLog } from './pages/AuditLog';
import { Settings } from './pages/Settings';
import { ApprovePage } from './pages/ApprovePage';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

export default function App() {
  return (
    <>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      {/* Standalone approval page (no sidebar) — for SME/specialist access */}
      <Route path="/approve/:requestId" element={<ApprovePage />} />
    </Routes>
    <Analytics />
    <SpeedInsights />
    </>
  );
}
