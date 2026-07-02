import type { ReactNode } from "react";
import WorkspaceNav from "./WorkspaceNav";

interface AppShellProps {
  children: ReactNode;
  onLogoClick?: () => void;
  onSignIn?: () => void;
}

const AppShell = ({ children, onLogoClick, onSignIn }: AppShellProps) => {
  return (
    <div className="flex min-h-svh bg-background">
      <WorkspaceNav onLogoClick={onLogoClick} onSignIn={onSignIn} />
      <main className="flex-1 overflow-y-auto min-h-0 relative">{children}</main>
    </div>
  );
};

export default AppShell;
