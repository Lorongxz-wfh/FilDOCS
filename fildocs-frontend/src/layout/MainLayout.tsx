import React from "react";
import Navbar from "../components/navbar/NavBar";
import Sidebar from "../components/sidebar/SideBar";
import BottomNav from "../components/layout/BottomNav";
import MobileActionFab from "../components/layout/MobileActionFab";
import MaintenanceBanner from "../components/layout/MaintenanceBanner";
import { useThemeContext } from "../lib/ThemeContext";
import { useGlobalNavStats } from "../hooks/useGlobalNavStats";

interface MainLayoutProps {
  children: React.ReactNode;
  onLogout?: () => void;
  noBodyScroll?: boolean;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  onLogout,
  noBodyScroll = false,
}) => {
  const { theme, toggle } = useThemeContext();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const stats = useGlobalNavStats();

  // Update browser tab title with badge count
  React.useEffect(() => {
    const baseTitle = "FilDOCS";
    if (stats.total > 0) {
      document.title = `(${stats.total}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [stats.total]);

  const MemoizedSidebar = React.useMemo(() => (
    <Sidebar
      stats={stats}
      onLogout={onLogout}
      mobileOpen={mobileOpen}
      onMobileClose={() => setMobileOpen(false)}
      theme={theme}
      onThemeToggle={toggle}
    />
  ), [stats, onLogout, mobileOpen, theme, toggle]);

  const MemoizedNavbar = React.useMemo(() => (
    <Navbar
      onThemeToggle={toggle}
      theme={theme}
      onMobileMenuOpen={() => setMobileOpen(true)}
    />
  ), [theme, toggle]);

  return (
    <div
      className={[
          "flex font-sans bg-slate-50 dark:bg-surface-600",
          noBodyScroll ? "h-screen overflow-hidden" : "min-h-screen",
        ].join(" ")}
      >
        {MemoizedSidebar}

        <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
          <MaintenanceBanner />
          {MemoizedNavbar}
          <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-slate-50 dark:bg-surface-600 pb-16 md:pb-0">
            {children}
          </main>
        </div>

        <BottomNav />

        <MobileActionFab />
      </div>
  );
};

export default MainLayout;
