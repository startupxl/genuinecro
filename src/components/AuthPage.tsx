import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowLeft, MousePointerClick, Zap, Search, TrendingUp } from "lucide-react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { toast } from "sonner";

interface AuthPageProps {
  onBack: () => void;
  message?: string;
  initialMode?: "login" | "signup";
}

const googleProvider = new GoogleAuthProvider();

const AuthPage = ({ onBack, message, initialMode = "login" }: AuthPageProps) => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Welcome back!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    }
    setLoading(false);
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      await sendEmailVerification(credential.user);
      toast.success("Account created! Check your email to verify your address.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      });
      toast.success("Password reset link sent to your email.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset link");
    }
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-svh bg-background"
    >
      <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </button>

        <h1 className="text-xl font-semibold text-foreground mb-1 font-display">
          GenuineCRO
        </h1>

        {message && (
          <p className="text-sm text-primary mb-4">{message}</p>
        )}

        {mode === "forgot" ? (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              Enter your email to reset your password.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full h-10 pl-10 pr-3 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to login
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              {mode === "login" ? "Sign in to your account." : "Create your account."}
            </p>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-10 rounded-md border border-border bg-surface text-sm font-medium text-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-2 mb-4 disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-[10px] text-muted-foreground uppercase tracking-wider">or</span>
              </div>
            </div>

            <form onSubmit={mode === "login" ? handleEmailLogin : handleEmailSignup} className="space-y-3">
              {mode === "signup" && (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    className="w-full h-10 pl-10 pr-3 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full h-10 pl-10 pr-3 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full h-10 pl-10 pr-3 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                  minLength={6}
                />
              </div>

              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </button>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            <p className="text-xs text-muted-foreground text-center mt-4">
              {mode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button onClick={() => setMode("signup")} className="text-primary hover:text-primary/80 transition-colors">
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button onClick={() => setMode("login")} className="text-primary hover:text-primary/80 transition-colors">
                    Sign in
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </div>
      </div>

      <div
        data-testid="auth-preview-panel"
        className="hidden md:flex flex-1 items-center justify-center relative overflow-hidden bg-gradient-to-br from-primary via-primary to-[#062e26] p-10"
      >
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        />
        <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-black/10 blur-3xl pointer-events-none" />

        <div className="max-w-md w-full relative">
          <p className="text-2xl font-semibold text-primary-foreground font-display mb-8 leading-snug">
            See exactly where visitors drop off — and what it's costing you.
          </p>

          <div className="relative" style={{ perspective: "1200px" }}>
            <div
              className="bg-surface rounded-xl shadow-2xl shadow-black/40 border border-white/10 overflow-hidden text-left"
              style={{ transform: "rotateY(-3deg) rotateX(1.5deg)" }}
            >
              <div className="flex items-center gap-1.5 px-3 py-2 bg-secondary/60 border-b border-border">
                <span className="h-2 w-2 rounded-full bg-friction-high/70" />
                <span className="h-2 w-2 rounded-full bg-friction-med/70" />
                <span className="h-2 w-2 rounded-full bg-friction-low/70" />
                <span className="ml-2 flex items-center gap-1 text-[9px] text-muted-foreground bg-background rounded-full px-2 py-0.5">
                  <Lock className="h-2.5 w-2.5" />
                  startupxl.com/pricing
                </span>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Conversion Score</span>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">startupxl.com · Homepage</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-semibold text-foreground">
                      72<span className="text-xs font-normal text-muted-foreground">/100</span>
                    </span>
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-friction-med/10 text-friction-med">
                      Needs work
                    </span>
                  </div>
                </div>

                <div data-testid="auth-preview-chart" className="mb-3">
                  <svg viewBox="0 0 240 64" className="w-full h-16" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="authPreviewGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <line x1="0" y1="16" x2="240" y2="16" stroke="hsl(var(--border))" strokeDasharray="2 3" strokeWidth="1" />
                    <line x1="0" y1="32" x2="240" y2="32" stroke="hsl(var(--border))" strokeDasharray="2 3" strokeWidth="1" />
                    <line x1="0" y1="48" x2="240" y2="48" stroke="hsl(var(--border))" strokeDasharray="2 3" strokeWidth="1" />
                    <path
                      d="M0,46 C20,44 40,50 60,40 C80,30 100,38 120,26 C140,14 160,24 180,16 C200,8 220,14 240,6 L240,64 L0,64 Z"
                      fill="url(#authPreviewGradient)"
                    />
                    <path
                      d="M0,46 C20,44 40,50 60,40 C80,30 100,38 120,26 C140,14 160,24 180,16 C200,8 220,14 240,6"
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <circle cx="240" cy="6" r="3.5" fill="hsl(var(--primary))" stroke="hsl(var(--surface))" strokeWidth="1.5" />
                  </svg>
                  <div className="flex justify-between text-[8px] text-muted-foreground/60 mt-0.5 px-0.5">
                    <span>4 weeks ago</span>
                    <span>Today</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-2 border-l-2 border-l-friction-high bg-background rounded p-2">
                    <MousePointerClick className="h-3.5 w-3.5 text-friction-high mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">CTA Effectiveness</span>
                      <p className="text-xs font-medium text-foreground mt-0.5">Weak call-to-action</p>
                      <span className="inline-block text-[9px] font-medium text-primary bg-primary/10 rounded-full px-1.5 py-0.5 mt-1">
                        +15–30% potential lift
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 border-l-2 border-l-friction-med bg-background rounded p-2">
                    <Zap className="h-3.5 w-3.5 text-friction-med mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Performance</span>
                      <p className="text-xs font-medium text-foreground mt-0.5">Slow page load</p>
                      <span className="inline-block text-[9px] font-medium text-primary bg-primary/10 rounded-full px-1.5 py-0.5 mt-1">
                        −12–20% bounce
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -top-3 -right-3 bg-background border border-border rounded-lg shadow-lg px-3 py-2 text-left">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-2.5 w-2.5" />
                Trend
              </p>
              <p className="text-xs font-semibold text-primary">+8 pts</p>
            </div>

            <div className="absolute -bottom-3 -left-3 bg-background border border-border rounded-lg shadow-lg px-3 py-2 flex items-center gap-1.5">
              <Search className="h-3 w-3 text-primary flex-shrink-0" />
              <p className="text-[10px] font-medium text-foreground whitespace-nowrap">108 friction points found</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AuthPage;
