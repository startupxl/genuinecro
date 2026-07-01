import { Home, LogIn, LogOut, User, ChevronDown, CreditCard, UserCog, HelpCircle, Settings, FileSpreadsheet } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logoImg from "@/assets/logo.png";

interface AppHeaderProps {
  onGoHome?: () => void;
  onSignIn?: () => void;
  compact?: boolean;
}

const AppHeader = ({ onGoHome, onSignIn, compact = false }: AppHeaderProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "U";

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "User";

  const navLinks = [
    { label: "Home", icon: Home, action: onGoHome || (() => navigate("/")), path: "/" },
    { label: "Bulk", icon: FileSpreadsheet, action: () => navigate("/bulk"), path: "/bulk" },
    { label: "Account", icon: UserCog, action: () => navigate("/account"), path: "/account" },
    { label: "Subscription", icon: CreditCard, action: () => navigate("/subscription"), path: "/subscription" },
    { label: "Help Center", icon: HelpCircle, action: () => navigate("/help"), path: "/help" },
    { label: "Settings", icon: Settings, action: () => navigate("/settings"), path: "/settings" },
  ];

  return (
    <header className="flex items-center justify-between px-3 md:px-4 py-2 bg-surface border-b border-border/30 flex-shrink-0">
      {/* Left: Logo + Nav Links */}
      <div className="flex items-center gap-4">
        <button
          onClick={onGoHome || (() => navigate("/"))}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          title="Back to home"
        >
          <img src={logoImg} alt="GenuineCRO" className="h-7 w-auto object-contain" />
        </button>

        <nav className="hidden md:flex items-center gap-1 ml-2">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <button
                key={link.label}
                onClick={link.action}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <link.icon className="h-3.5 w-3.5" />
                {link.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right: User menu */}
      <div className="flex items-center gap-2">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-secondary transition-colors">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-foreground hidden sm:inline max-w-[120px] truncate">
                  {displayName}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                {user.email && (
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onGoHome || (() => navigate("/"))} className="cursor-pointer">
                <Home className="mr-2 h-4 w-4" />
                Home
              </DropdownMenuItem>
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
            onClick={onSignIn}
            className="flex items-center gap-1 text-xs text-foreground px-3 py-1.5 rounded-md border border-border hover:bg-secondary transition-colors"
          >
            <LogIn className="h-3 w-3" />
            Sign in
          </button>
        )}
      </div>
    </header>
  );
};

export default AppHeader;
