import type { Metadata } from "next";

export const metadata: Metadata = { title: "DocYa · Acceso" };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Background effects */}
      <div
        className="absolute inset-0 grid-bg opacity-60"
        style={{ pointerEvents: "none" }}
      />
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      <div
        className="absolute bottom-1/4 left-1/4 w-72 h-72 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(20,184,166,0.06) 0%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
