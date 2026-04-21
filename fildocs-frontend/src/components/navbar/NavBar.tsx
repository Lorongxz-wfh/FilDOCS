import { Menu, Sun, Moon, Monitor, RefreshCw } from "lucide-react";
import SearchBar from "./SearchBar";
import NotificationBell from "./NotificationBell";
import { useRefresh } from "../../lib/RefreshContext";

interface NavbarProps {
  onThemeToggle?: () => void;
  theme?: "light" | "dark" | "system";
  onMobileMenuOpen?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({
  onThemeToggle,
  theme = "light",
  onMobileMenuOpen,
}) => {
  const { triggerRefresh, isRefreshing } = useRefresh();

  return (
    <header className="relative z-50 h-13.5 border-b border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500">
      <div className="flex h-full items-center gap-3 px-4">
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={onMobileMenuOpen}
          className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-surface-400 transition-all active:scale-95"
          aria-label="Open menu"
        >
          <Menu className="h-5.5 w-5.5" />
        </button>

        {/* Global Search — fills middle on mobile */}
        <div className="flex-1 flex justify-center">
          <SearchBar isMobileIconOnly={false} />
        </div>

        {/* Right actions */}
        <div className="flex shrink-0 items-center justify-end gap-1.5">
          {/* Universal Refresh */}
          <button
            type="button"
            onClick={triggerRefresh}
            disabled={isRefreshing}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 active:scale-90 ${
              isRefreshing 
                ? "text-slate-300 dark:text-surface-300 cursor-not-allowed" 
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-surface-400"
            }`}
            title="Refresh current page and sidebar"
          >
            <RefreshCw
              className={`h-4.5 w-4.5 ${isRefreshing ? "animate-spin text-brand-500" : ""}`}
            />
          </button>

          {/* Theme toggle — Hidden on mobile */}
          <button
            type="button"
            onClick={onThemeToggle}
            className="hidden md:flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-surface-400 transition-all duration-200 active:scale-90"
          >
            {theme === "dark" ? (
              <Sun className="h-4.5 w-4.5 text-amber-500 animate-theme-icon" />
            ) : theme === "system" ? (
              <Monitor className="h-4.5 w-4.5 text-brand-500 animate-theme-icon" />
            ) : (
              <Moon className="h-4.5 w-4.5 animate-theme-icon" />
            )}
          </button>

          <NotificationBell />
        </div>
      </div>
    </header>
  );
};

export default Navbar;
