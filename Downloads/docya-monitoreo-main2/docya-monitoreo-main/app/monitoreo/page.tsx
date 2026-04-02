"use client";

import Sidebar from "@/components/sidebar";
import dynamic from "next/dynamic";
import { MapPinned } from "lucide-react";

const MapaMedicos = dynamic(() => import("../dashboard/mapa-medicos"), { ssr: false });

export default function MonitoreoPage() {
  return (
    <div className="flex h-screen" style={{ background: "var(--bg-base)" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4 border-b flex-shrink-0 pt-16 md:pt-4"
          style={{ borderColor: "var(--border-subtle)", background: "rgba(4,13,18,0.6)", backdropFilter: "blur(20px)" }}
        >
          <div className="p-2 rounded-lg" style={{ background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.2)" }}>
            <MapPinned size={16} style={{ color: "var(--brand-primary)" }} />
          </div>
          <div>
            <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Monitoreo en tiempo real
            </h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Profesionales conectados y disponibles — DocYa
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="pulse-dot" />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Live</span>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 p-4 overflow-hidden">
          <div
            className="h-full rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--border-subtle)" }}
          >
            <MapaMedicos />
          </div>
        </div>
      </div>
    </div>
  );
}
