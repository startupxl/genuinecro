import { useState, type ReactNode } from "react";
import { Menu, PanelLeftOpen } from "lucide-react";
import WorkspaceNav from "./WorkspaceNav";

const SIDEBAR_COLLAPSED_KEY = "genuinecro_sidebar_collapsed";

interface AppShellProps {
  children: ReactNode;
  onLogoClick?: () => void;
  onSignIn?: () => void;
}

const AppShell = ({ children, onLogoClick, onSignIn }: AppShellProps) => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isDesktopNavCollapsed, setIsDesktopNavCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  const toggleDesktopNav = () => {
    setIsDesktopNavCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // ignore storage failures (e.g. private browsing)
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-svh bg-background">
      <WorkspaceNav
        onLogoClick={onLogoClick}
        onSignIn={onSignIn}
        isOpen={isMobileNavOpen}
        onNavigate={() => setIsMobileNavOpen(false)}
        isCollapsed={isDesktopNavCollapsed}
        onToggleCollapse={toggleDesktopNav}
      />

      {isMobileNavOpen && (
        <div
          data-testid="mobile-nav-backdrop"
          onClick={() => setIsMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
        />
      )}

      {!isMobileNavOpen && (
        <button
          type="button"
          onClick={() => setIsMobileNavOpen(true)}
          aria-label="Open menu"
          className="fixed top-4 left-4 z-50 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-foreground shadow-sm md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      {isDesktopNavCollapsed && (
        <div className="hidden md:flex w-10 flex-shrink-0 flex-col items-center border-r border-border bg-surface py-4">
          <button
            type="button"
            onClick={toggleDesktopNav}
            aria-label="Expand sidebar"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto min-h-0 relative">{children}</main>
    </div>
  );
};

export default AppShell;
