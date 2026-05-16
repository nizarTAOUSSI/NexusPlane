import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar, { TopNavbar } from '../components/Sidebar';
import { RealtimeProvider } from '../context/RealtimeContext';
import { ChatProvider } from '../context/ChatContext';
import { GlobalSearchProvider } from '../context/GlobalSearchContext';
import GlobalSearchOverlay from '../components/GlobalSearchOverlay';
import CursorOverlay from '../components/CursorOverlay';
import AICopilot from '../components/AICopilot';
import { useParams } from 'react-router-dom';

const DashboardLayout: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <RealtimeProvider>
      <ChatProvider>
      <GlobalSearchProvider>
      <div className="app-shell">
        <TopNavbar onMobileMenuToggle={() => setMobileNavOpen(o => !o)} />
        <GlobalSearchOverlay />

        <div className="app-body">
          <Sidebar isMobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
          <main className="app-main">
            <Outlet />
          </main>
        </div>

        <CursorOverlay />
        <AICopilot projectId={id} />
      </div>
      </GlobalSearchProvider>
      </ChatProvider>
    </RealtimeProvider>
  );
};

export default DashboardLayout;