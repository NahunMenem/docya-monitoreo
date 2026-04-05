"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import { loginAdmin, loginAdminWithGoogle } from "@/lib/auth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number>
          ) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_MONITOREO_GOOGLE_CLIENT_ID ||
  "327572770521-tom99oocat1tcp9pahlejsar4iu62lhg.apps.googleusercontent.com";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!googleButtonRef.current || !window.google) return;

    googleButtonRef.current.innerHTML = "";
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async ({ credential }) => {
        if (!credential) {
          setError("Google no devolvió una credencial válida");
          return;
        }

        setLoading(true);
        setError(null);
        try {
          const data = await loginAdminWithGoogle(credential);
          localStorage.setItem("docya_token", data.access_token);
          localStorage.setItem("docya_admin", JSON.stringify(data.admin));
          router.push("/dashboard");
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo ingresar con Google"
          );
          setLoading(false);
        }
      },
    });

    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      width: 320,
    });
  }, [router]);

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
        <div className="text-center mb-8">
          <img
            src="https://res.cloudinary.com/dqsacd9ez/image/upload/v1757197807/logoblanco_1_qdlnog.png"
            alt="DocYa"
            className="h-10 mx-auto mb-5"
          />
          <h1
            className="text-xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Panel de Monitoreo
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Acceso exclusivo para el equipo DocYa
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{
                color: "var(--text-secondary)",
                letterSpacing: "0.04em",
              }}
            >
              EMAIL
            </label>
            <div className="relative">
              <Mail
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              />
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

          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{
                color: "var(--text-secondary)",
                letterSpacing: "0.04em",
              }}
            >
              CONTRASEÑA
            </label>
            <div className="relative">
              <Lock
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              />
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

          {error && (
            <div
              className="flex items-center gap-2 rounded-lg p-3 text-sm"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#f87171",
              }}
            >
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center mt-2"
            style={{ height: "2.75rem" }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Ingresando...
              </span>
            ) : (
              <>
                Ingresar <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div
            className="h-px flex-1"
            style={{ background: "var(--border-subtle)" }}
          />
          <span
            className="text-xs uppercase tracking-[0.18em]"
            style={{ color: "var(--text-muted)" }}
          >
            o
          </span>
          <div
            className="h-px flex-1"
            style={{ background: "var(--border-subtle)" }}
          />
        </div>

        <div className="flex justify-center">
          <div ref={googleButtonRef} />
        </div>

        <p
          className="mt-3 text-center text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Solo la cuenta Google autorizada puede ingresar al monitoreo.
        </p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <div className="pulse-dot" />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Sistema operativo
          </span>
        </div>
      </div>
    </div>
  );
}
