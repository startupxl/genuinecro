import { useNavigate, NavLink } from "react-router-dom";
import {
  LayoutDashboard, Wrench, FileText, Search, Activity, Swords, CheckSquare, FileBarChart,
  FileSpreadsheet, LogIn, LogOut, UserCog, CreditCard, HelpCircle, Settings, ChevronUp, X,
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
  isOpen?: boolean;
  onNavigate?: () => void;
}

const WorkspaceNav = ({ onLogoClick, onSignIn, isOpen = false, onNavigate }: WorkspaceNavProps) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { currentPlan } = useSubscription();

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "U";
  const displayName = user?.displayName || user?.email || "User";

  const handleLogoClick = () => {
    onNavigate?.();
    (onLogoClick || (() => navigate("/")))();
  };

  const handleSignIn = () => {
    onNavigate?.();
    (onSignIn || (() => navigate("/")))();
  };

  return (
    <nav
      className={`fixed inset-y-0 left-0 z-40 w-48 flex-shrink-0 border-r border-border bg-surface py-4 flex flex-col transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center gap-1 px-3 pb-4 mb-2 border-b border-border">
        <button
          onClick={handleLogoClick}
          className="flex-1 flex items-center justify-center hover:opacity-80 transition-opacity"
          title="Back to home"
        >
          <img src={logoImg} alt="GenuineCRO" className="h-10 w-full object-contain" />
        </button>
        {isOpen && (
          <button
            type="button"
            onClick={() => onNavigate?.()}
            aria-label="Close menu"
            className="md:hidden flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1">
        {sections.map((section) => (
          <NavLink
            key={section.path}
            to={section.path}
            end={section.path === "/"}
            onClick={() => onNavigate?.()}
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
            <DropdownMenuItem onClick={() => { onNavigate?.(); navigate("/account"); }} className="cursor-pointer">
              <UserCog className="mr-2 h-4 w-4" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { onNavigate?.(); navigate("/subscription"); }} className="cursor-pointer">
              <CreditCard className="mr-2 h-4 w-4" />
              Subscription
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { onNavigate?.(); navigate("/help"); }} className="cursor-pointer">
              <HelpCircle className="mr-2 h-4 w-4" />
              Help Center
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { onNavigate?.(); navigate("/settings"); }} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { onNavigate?.(); signOut(); }} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button
          onClick={handleSignIn}
          className="flex items-center gap-2 px-4 py-3 mt-1 border-t border-border text-sm text-foreground hover:bg-secondary/50 transition-colors"
        >
          <span className="h-1.5 w-1.5 flex-shrink-0" />
          <LogIn className="h-3.5 w-3.5 flex-shrink-0" />
          Sign in
        </button>
      )}
    </nav>
  );
};

export default WorkspaceNav;
