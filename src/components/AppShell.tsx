import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import WorkspaceNav from "./WorkspaceNav";

interface AppShellProps {
  children: ReactNode;
  onLogoClick?: () => void;
  onSignIn?: () => void;
}

const AppShell = ({ children, onLogoClick, onSignIn }: AppShellProps) => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-svh bg-background">
      <WorkspaceNav
        onLogoClick={onLogoClick}
        onSignIn={onSignIn}
        isOpen={isMobileNavOpen}
        onNavigate={() => setIsMobileNavOpen(false)}
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

      <main className="flex-1 overflow-y-auto min-h-0 relative">{children}</main>
    </div>
  );
};

export default AppShell;
