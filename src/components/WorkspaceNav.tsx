import { useNavigate, NavLink } from "react-router-dom";
import {
  LayoutDashboard, Wrench, FileText, Search, Activity, Swords, CheckSquare, FileBarChart,
  FileSpreadsheet, LogIn, LogOut, UserCog, CreditCard, HelpCircle, Settings, ChevronUp,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logoImg from "@/assets/logo.png";

interface NavSection {
  label: string;
  path: string;
  icon: React.ElementType;
  real: boolean;
}

const sections: NavSection[] = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, real: true },
  { label: "Technical", path: "/technical", icon: Wrench, real: true },
  { label: "Content", path: "/content", icon: FileText, real: false },
  { label: "Conversion", path: "/", icon: Search, real: true },
  { label: "Monitoring", path: "/monitoring", icon: Activity, real: false },
  { label: "Analysis", path: "/competitor-analysis", icon: Swords, real: false },
  { label: "Action Center", path: "/action-center", icon: CheckSquare, real: true },
  { label: "Reports", path: "/reports", icon: FileBarChart, real: false },
  { label: "Bulk", path: "/bulk", icon: FileSpreadsheet, real: true },
];

interface WorkspaceNavProps {
  onLogoClick?: () => void;
  onSignIn?: () => void;
}

const WorkspaceNav = ({ onLogoClick, onSignIn }: WorkspaceNavProps) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { currentPlan } = useSubscription();

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "U";
  const displayName = user?.displayName || user?.email || "User";

  return (
    <nav className="w-48 flex-shrink-0 border-r border-border bg-surface py-4 flex flex-col">
      <button
        onClick={onLogoClick || (() => navigate("/"))}
        className="flex items-center px-4 pb-4 mb-2 border-b border-border hover:opacity-80 transition-opacity"
        title="Back to home"
      >
        <img src={logoImg} alt="GenuineCRO" className="h-6 w-auto object-contain" />
      </button>

      <div className="flex-1">
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
      </div>

      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-4 py-2.5 border-t border-border hover:bg-secondary/50 transition-colors">
              <Avatar className="h-6 w-6 flex-shrink-0">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{currentPlan} plan</p>
              </div>
              <ChevronUp className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuItem onClick={() => navigate("/account")} className="cursor-pointer">
              <UserCog className="mr-2 h-4 w-4" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/subscription")} className="cursor-pointer">
              <CreditCard className="mr-2 h-4 w-4" />
              Subscription
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/help")} className="cursor-pointer">
              <HelpCircle className="mr-2 h-4 w-4" />
              Help Center
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button
          onClick={onSignIn || (() => navigate("/"))}
          className="flex items-center gap-2 px-4 py-2.5 border-t border-border text-sm text-foreground hover:bg-secondary/50 transition-colors"
        >
          <LogIn className="h-3.5 w-3.5" />
          Sign in
        </button>
      )}
    </nav>
  );
};

export default WorkspaceNav;
