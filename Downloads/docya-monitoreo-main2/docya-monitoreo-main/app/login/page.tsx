"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import { loginAdmin } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await loginAdmin(email, password);
      localStorage.setItem("docya_token", data.access_token);
      localStorage.setItem("docya_admin", JSON.stringify(data.admin));
      router.push("/dashboard");
    } catch {
      setError("Email o contraseña incorrectos");
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Logo + title */}
        <div className="text-center mb-8">
          <img
            src="https://res.cloudinary.com/dqsacd9ez/image/upload/v1757197807/logoblanco_1_qdlnog.png"
            alt="DocYa"
            className="h-10 mx-auto mb-5"
          />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Panel de Monitoreo
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Acceso exclusivo para el equipo DocYa
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)", letterSpacing: "0.04em" }}>
              EMAIL
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                type="email"
                placeholder="admin@docya.com.ar"
                className="field-input pl-9"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)", letterSpacing: "0.04em" }}>
              CONTRASEÑA
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                type="password"
                placeholder="••••••••"
                className="field-input pl-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-center gap-2 rounded-lg p-3 text-sm"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
            >
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center mt-2"
            style={{ height: "2.75rem" }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Ingresando...
              </span>
            ) : (
              <>Ingresar <ArrowRight size={15} /></>
            )}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-2">
          <div className="pulse-dot" />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Sistema operativo</span>
        </div>
      </div>
    </div>
  );
}
