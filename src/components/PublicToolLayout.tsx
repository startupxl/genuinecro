import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import logoImg from "@/assets/logo.png";

interface PublicToolLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
}

const PublicToolLayout = ({ title, description, children }: PublicToolLayoutProps) => {
  return (
    <div className="min-h-svh flex flex-col bg-background">
      <header className="border-b border-border px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/" aria-label="GenuineCRO">
            <img src={logoImg} alt="GenuineCRO" className="h-8 object-contain" />
          </Link>
          <Link
            to="/"
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Try a free audit
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-xl font-semibold text-foreground font-display mb-1">{title}</h1>
          <p className="text-sm text-muted-foreground mb-6">{description}</p>
          {children}
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-foreground">
            Want an automated conversion audit like this, for your whole site?
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Try GenuineCRO free <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default PublicToolLayout;
