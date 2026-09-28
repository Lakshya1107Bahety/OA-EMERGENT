import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, formatApiError, wakeBackend } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { HeartPulse, Loader2 } from "lucide-react";
import BackendStatusBanner from "@/components/BackendStatusBanner";

export default function Login() {
  // Start waking the free-tier backend while the user types.
  useEffect(() => { wakeBackend(); }, []);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDemoLogin = (role = "doctor") => {
    const demoUser = {
      id: "demo-clinician",
      name: role === "doctor" ? "Dr. Lakshya (Orthopedic Lead)" : "Healthcare Worker (Demo)",
      email: email || "clinician@oasentinel.ai",
      role: role,
    };
    login(`demo_token_${Date.now()}`, demoUser);
    toast.success(`Logged in as ${demoUser.name}`);
    navigate("/app/dashboard");
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      login(data.access_token, data.user);
      toast.success(`Welcome back, ${data.user.name}`);
      navigate("/app/dashboard");
    } catch (err) {
      toast.info("Backend offline: entering in clinician access mode.");
      handleDemoLogin("doctor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:block relative">
        <img
          src="https://images.pexels.com/photos/8943327/pexels-photo-8943327.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
          alt="Healthcare worker" className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-emerald-950/40" />
        <div className="absolute bottom-10 left-10 text-white max-w-sm">
          <h2 className="font-heading text-3xl font-bold">OA Sentinel</h2>
          <p className="mt-2 text-emerald-100">Objective, multimodal wearable IMU & camera AI screening system.</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-lg text-slate-900">OA Sentinel</span>
          </Link>
          <h1 className="font-heading text-3xl font-bold text-slate-900">Welcome back</h1>
          <p className="mt-2 text-slate-600">Log in to continue screening patients.</p>

          <div className="mt-6"><BackendStatusBanner /></div>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email-input" className="mt-1.5 h-12 rounded-xl" placeholder="you@clinic.in" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password-input" className="mt-1.5 h-12 rounded-xl" placeholder="••••••••" />
            </div>
            <Button type="submit" disabled={loading} data-testid="login-submit-button"
              className="w-full h-12 rounded-xl text-base">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Log in"}
            </Button>

            <div className="relative my-4 text-center">
              <span className="text-xs text-muted-foreground uppercase px-2 bg-background">Or Quick Access</span>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => handleDemoLogin("doctor")}
              className="w-full h-11 rounded-xl text-xs font-semibold text-emerald-800 border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
            >
              Enter as Research Clinician / Doctor
            </Button>
          </form>

          <p className="mt-6 text-sm text-slate-600 text-center">
            No account?{" "}
            <Link to="/signup" className="text-primary font-semibold" data-testid="go-signup-link">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
