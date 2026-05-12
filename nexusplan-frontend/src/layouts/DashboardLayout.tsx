import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar, { TopNavbar } from '../components/Sidebar';
import { RealtimeProvider } from '../context/RealtimeContext';
import { ChatProvider } from '../context/ChatContext';
import CursorOverlay from '../components/CursorOverlay';
import AICopilot from '../components/AICopilot';
import { useParams } from 'react-router-dom';

const DashboardLayout: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <RealtimeProvider>
      <ChatProvider>
      <div className="app-shell">
        <TopNavbar />

        <div className="app-body">
          <Sidebar />
          <main className="app-main">
            <Outlet />
          </main>
        </div>

        <CursorOverlay />
        <AICopilot projectId={id} />
      </div>
      </ChatProvider>
    </RealtimeProvider>
  );
};

export default DashboardLayout;
