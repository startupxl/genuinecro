import { useState } from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { confirmPasswordReset } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) {
      toast.error("This reset link is invalid or has expired.");
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      toast.success("Password updated successfully!");
      navigate("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    }
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-svh items-center justify-center bg-background px-4"
    >
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-foreground mb-1 font-display">GenuineCRO</h1>
        <p className="text-sm text-muted-foreground mb-6">Set your new password.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full h-10 pl-10 pr-3 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>
    </motion.div>
  );
};

export default ResetPassword;
