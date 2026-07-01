import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "./AppHeader";
import WorkspaceNav from "./WorkspaceNav";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col min-h-svh bg-background">
      <AppHeader onGoHome={() => navigate("/dashboard")} onSignIn={() => navigate("/")} />
      <div className="flex flex-1 min-h-0">
        <WorkspaceNav />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
