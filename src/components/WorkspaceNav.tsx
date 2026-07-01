import { LayoutDashboard, Wrench, FileText, Search, Activity, Swords, CheckSquare, FileBarChart } from "lucide-react";
import { NavLink } from "react-router-dom";

interface NavSection {
  label: string;
  path: string;
  icon: React.ElementType;
  real: boolean;
}

const sections: NavSection[] = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, real: true },
  { label: "Technical", path: "/technical", icon: Wrench, real: false },
  { label: "Content", path: "/content", icon: FileText, real: false },
  { label: "Conversion", path: "/", icon: Search, real: true },
  { label: "Monitoring", path: "/monitoring", icon: Activity, real: false },
  { label: "Analysis", path: "/competitor-analysis", icon: Swords, real: false },
  { label: "Action Center", path: "/action-center", icon: CheckSquare, real: false },
  { label: "Reports", path: "/reports", icon: FileBarChart, real: false },
];

const WorkspaceNav = () => {
  return (
    <nav className="w-48 flex-shrink-0 border-r border-border bg-surface py-4">
      {sections.map((section) => (
        <NavLink
          key={section.path}
          to={section.path}
          end={section.path === "/"}
          className={({ isActive }) =>
            `flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
              isActive
                ? "bg-secondary text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`
          }
        >
          <span
            className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${section.real ? "bg-primary" : "bg-muted-foreground/40"}`}
          />
          <section.icon className="h-3.5 w-3.5 flex-shrink-0" />
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
};

export default WorkspaceNav;
