"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  Users,
  Stethoscope,
  ClipboardPlus,
  Wallet,
  UserCog,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Settings,
  Link2,
} from "lucide-react";

const menu = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Monitoreo", href: "/monitoreo", icon: Activity },
  { label: "Usuarios", href: "/usuarios", icon: UserCog },
  { label: "Médicos", href: "/medicos", icon: Stethoscope },
  { label: "Consultas", href: "/consultas", icon: Users },
  { label: "Asignación manual", href: "/asignacion-manual", icon: ClipboardPlus },
  { label: "Liquidaciones", href: "/liquidaciones", icon: Wallet },
  { label: "Referidos", href: "/referidos", icon: Link2 },
  { label: "Configuración", href: "/configuracion", icon: Settings },
];

function NavLink({ item, active, onClick }: { item: typeof menu[0]; active: boolean; onClick?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`nav-link ${active ? "active" : ""}`}
    >
      <div
        className="flex items-center justify-center w-8 h-8 rounded-md transition-colors"
        style={{
          background: active ? "rgba(20,184,166,0.15)" : "transparent",
          color: active ? "var(--brand-primary-light)" : "var(--text-muted)",
        }}
      >
        <Icon size={16} />
      </div>
      <span>{item.label}</span>
      {active && (
        <ChevronRight size={14} className="ml-auto" style={{ color: "var(--brand-primary)" }} />
      )}
    </Link>
  );
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-6 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <img
          src="https://res.cloudinary.com/dqsacd9ez/image/upload/v1757197807/logoblanco_1_qdlnog.png"
          alt="DocYa"
          className="h-8"
        />
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-md hover:bg-white/5 transition-colors" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        )}
      </div>

      {/* Label */}
      <div className="px-5 pt-6 pb-2">
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
          Navegación
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {menu.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname === item.href || pathname.startsWith(item.href + "/")}
            onClick={onClose}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
        <button
          className="nav-link w-full"
          onClick={() => {
            localStorage.removeItem("docya_token");
            localStorage.removeItem("docya_admin");
            window.location.href = "/login";
          }}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-md" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
            <LogOut size={15} />
          </div>
          <span style={{ color: "#f87171" }}>Cerrar sesión</span>
        </button>

        <div className="mt-4 px-2">
          <div className="flex items-center gap-2">
            <div className="pulse-dot" />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Sistema operativo
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            DocYa © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile topbar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 border-b"
        style={{ background: "var(--sidebar-bg)", borderColor: "var(--border-subtle)", backdropFilter: "blur(20px)" }}
      >
        <img src="https://res.cloudinary.com/dqsacd9ez/image/upload/v1757197807/logoblanco_1_qdlnog.png" alt="DocYa" className="h-7" />
        <button onClick={() => setOpen(true)} className="p-1.5 rounded-md hover:bg-white/5 transition-colors" style={{ color: "var(--text-secondary)" }}>
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside
        className="fixed top-0 left-0 z-50 h-full w-64 md:hidden transition-transform duration-300"
        style={{
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--border-subtle)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        <SidebarContent onClose={() => setOpen(false)} />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-60 min-h-screen flex-shrink-0"
        style={{
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--border-subtle)",
          backdropFilter: "blur(20px)",
        }}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
