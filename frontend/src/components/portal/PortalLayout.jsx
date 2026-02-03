import { Outlet } from 'react-router-dom';
import { PortalProvider } from '../../context/PortalContext';
import PortalHeader from './PortalHeader';

export default function PortalLayout() {
  return (
    <PortalProvider>
      <div className="min-h-screen bg-[#F8F9FA]">
        <PortalHeader />
        <main className="pt-20 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </PortalProvider>
  );
}
