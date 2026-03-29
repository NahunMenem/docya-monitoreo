"use client";

import Sidebar from "@/components/sidebar";
import { useEffect, useState } from "react";
import { UserPlus, Search, Users, ChevronLeft, ChevronRight, CheckCircle, XCircle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE!;

export type Usuario = {
  id: number;
  full_name: string | null;
  email: string | null;
  dni: string | null;
  telefono: string | null;
  role: string;
  validado: boolean;
  created_at?: string;
};

function ModalNuevoUsuario({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ full_name: "", email: "", dni: "", telefono: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/monitoreo/usuarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Error al crear usuario");
      onSuccess();
      onClose();
    } catch {
      setError("No se pudo crear el usuario");
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: "full_name", label: "Nombre completo", type: "text", placeholder: "Juan Pérez" },
    { key: "email", label: "Email", type: "email", placeholder: "juan@email.com" },
    { key: "dni", label: "DNI", type: "text", placeholder: "12345678" },
    { key: "telefono", label: "Teléfono", type: "tel", placeholder: "+5491112345678" },
    { key: "password", label: "Contraseña", type: "password", placeholder: "••••••••" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(4,13,18,0.92)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-md"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-lg mb-5" style={{ color: "var(--text-primary)" }}>Nuevo usuario</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {fields.map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
              <input
                type={type}
                placeholder={placeholder}
                className="field-input"
                value={(form as any)[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                required={key !== "dni" && key !== "telefono"}
              />
            </div>
          ))}
          {error && (
            <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const fetchUsuarios = async () => {
    const res = await fetch(`${API}/monitoreo/usuarios?page=${page}&limit=15`);
    const data = await res.json();
    setUsuarios(data.usuarios || []);
    setPages(data.pages || 1);
  };

  useEffect(() => { fetchUsuarios(); }, [page]);

  const filtrados = usuarios.filter((u) =>
    `${u.full_name || ""} ${u.email || ""} ${u.dni || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-base)" }}>
      <Sidebar />

      <main className="flex-1 p-5 md:p-7 pt-16 md:pt-7 space-y-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Usuarios</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Pacientes y usuarios registrados</p>
          </div>
          <button onClick={() => setOpen(true)} className="btn-primary">
            <UserPlus size={15} />
            Nuevo usuario
          </button>
        </div>

        {/* Table card */}
        <div className="glass-card overflow-hidden">
          {/* Search bar */}
          <div className="p-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                placeholder="Buscar por nombre, email o DNI..."
                className="field-input pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {["Nombre", "Email", "DNI", "Teléfono", "Rol", "Validado", "Creado"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: "rgba(20,184,166,0.12)", color: "var(--brand-primary)", border: "1px solid rgba(20,184,166,0.2)" }}
                        >
                          {(u.full_name || u.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                          {u.full_name || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="text-xs">{u.email || "—"}</td>
                    <td className="font-mono text-xs">{u.dni || "—"}</td>
                    <td className="text-xs">{u.telefono || "—"}</td>
                    <td>
                      <span className={`badge ${u.role === "admin" ? "badge-yellow" : "badge-teal"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      {u.validado
                        ? <CheckCircle size={16} style={{ color: "#4ade80" }} />
                        : <XCircle size={16} style={{ color: "#f87171" }} />}
                    </td>
                    <td className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("es-AR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtrados.length === 0 && (
              <div className="py-12 text-center" style={{ color: "var(--text-muted)" }}>
                <Users size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No se encontraron usuarios</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          <div
            className="flex items-center justify-between px-4 py-3 border-t"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Página {page} de {pages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page === pages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </main>

      <ModalNuevoUsuario
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={() => { setPage(1); fetchUsuarios(); }}
      />
    </div>
  );
}
