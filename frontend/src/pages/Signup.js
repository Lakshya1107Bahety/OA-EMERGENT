import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { HeartPulse, Loader2 } from "lucide-react";

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "healthcare_worker" });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", form);
      login(data.access_token, data.user);
      toast.success("Account created");
      navigate("/app/dashboard");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="flex items-center justify-center p-6 order-2 lg:order-1">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-lg text-slate-900">JointCare AI</span>
          </Link>
          <h1 className="font-heading text-3xl font-bold text-slate-900">Create your account</h1>
          <p className="mt-2 text-slate-600">Join the OA screening network.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" required value={form.name} onChange={set("name")}
                data-testid="signup-name-input" className="mt-1.5 h-12 rounded-xl" placeholder="Anita Das" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={form.email} onChange={set("email")}
                data-testid="signup-email-input" className="mt-1.5 h-12 rounded-xl" placeholder="you@clinic.in" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={form.password} onChange={set("password")}
                data-testid="signup-password-input" className="mt-1.5 h-12 rounded-xl" placeholder="At least 6 characters" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="mt-1.5 h-12 rounded-xl" data-testid="signup-role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="healthcare_worker">Healthcare Worker</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={loading} data-testid="signup-submit-button"
              className="w-full h-12 rounded-xl text-base">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-slate-600 text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-semibold" data-testid="go-login-link">Log in</Link>
          </p>
        </div>
      </div>
      <div className="hidden lg:block relative order-1 lg:order-2">
        <img
          src="https://images.pexels.com/photos/20860607/pexels-photo-20860607.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
          alt="Physiotherapy" className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-secondary/30" />
      </div>
    </div>
  );
}
