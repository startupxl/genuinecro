import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowLeft } from "lucide-react";
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
        className="hidden md:flex flex-1 items-center justify-center bg-gradient-to-br from-primary to-primary/80 p-10"
      >
        <div className="max-w-sm text-center">
          <p className="text-2xl font-semibold text-primary-foreground font-display mb-8">
            See exactly where visitors drop off — and what it's costing you.
          </p>
          <div className="bg-surface rounded-lg shadow-lg p-4 text-left relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Conversion Score</span>
              <span className="text-2xl font-semibold text-foreground">
                72<span className="text-xs font-normal text-muted-foreground">/100</span>
              </span>
            </div>
            <div data-testid="auth-preview-chart" className="flex items-end gap-1 h-10 mb-3">
              <div className="flex-1 bg-primary/30 rounded-sm" style={{ height: "40%" }} />
              <div className="flex-1 bg-primary/30 rounded-sm" style={{ height: "70%" }} />
              <div className="flex-1 bg-primary rounded-sm" style={{ height: "90%" }} />
              <div className="flex-1 bg-primary/30 rounded-sm" style={{ height: "55%" }} />
              <div className="flex-1 bg-primary/30 rounded-sm" style={{ height: "65%" }} />
            </div>
            <div className="space-y-2">
              <div className="border-l-4 border-l-friction-high bg-background rounded p-2">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground">CTA Effectiveness</span>
                <p className="text-xs font-medium text-foreground mt-0.5">Weak call-to-action</p>
                <p className="text-[10px] text-primary font-medium mt-0.5">↑ Could increase conversion by 15–30%</p>
              </div>
              <div className="border-l-4 border-l-friction-med bg-background rounded p-2">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Performance</span>
                <p className="text-xs font-medium text-foreground mt-0.5">Slow page load</p>
                <p className="text-[10px] text-primary font-medium mt-0.5">↑ Could reduce bounce by 12–20%</p>
              </div>
            </div>
            <div className="absolute -top-3 -right-3 bg-background border border-border rounded-lg shadow-lg px-3 py-2 text-left">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Trend</p>
              <p className="text-xs font-semibold text-primary">+8 pts</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AuthPage;
