"use client";

import Sidebar from "@/components/sidebar";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Mail,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE!;

export type Usuario = {
  id: string;
  full_name: string | null;
  email: string | null;
  dni: string | null;
  telefono: string | null;
  role: string;
  validado: boolean;
  created_at?: string;
  foto_url?: string | null;
  google_id?: string | null;
  auth_provider?: "google" | "email";
  perfil_completo?: boolean;
  acepta_terminos?: boolean;
};

function ModalNuevoUsuario({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    dni: "",
    telefono: "",
    password: "",
  });
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al crear usuario");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el usuario");
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
      style={{ background: "rgba(4, 21, 28, 0.88)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        className="rounded-3xl p-6 w-full max-w-md glass-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-lg mb-5" style={{ color: "var(--text-primary)" }}>
          Nuevo usuario
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {fields.map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                {label}
              </label>
              <input
                type={type}
                placeholder={placeholder}
                className="field-input"
                value={(form as Record<string, string>)[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                required={key !== "dni" && key !== "telefono"}
              />
            </div>
          ))}
          {error && (
            <p className="text-sm" style={{ color: "#f87171" }}>
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProviderBadge({ user }: { user: Usuario }) {
  const isGoogle = user.auth_provider === "google" || !!user.google_id;
  return (
    <span className={`badge ${isGoogle ? "badge-blue" : "badge-teal"}`}>
      {isGoogle ? "Google" : "Email"}
    </span>
  );
}

function ValidationBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="badge badge-green">
      <CheckCircle2 size={12} />
      Validado
    </span>
  ) : (
    <span className="badge badge-red">
      <XCircle size={12} />
      Pendiente
    </span>
  );
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchUsuarios = async () => {
    const query = encodeURIComponent(search.trim());
    const res = await fetch(`${API}/monitoreo/usuarios?page=${page}&limit=15&q=${query}`);
    const data = await res.json();
    setUsuarios(data.usuarios || []);
    setPages(data.pages || 1);
  };

  useEffect(() => {
    fetchUsuarios();
  }, [page, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const toggleValidado = async (usuario: Usuario) => {
    setBusyId(usuario.id);
    try {
      await fetch(`${API}/monitoreo/usuarios/${usuario.id}/validar`, {
        method: "PUT",
      });
      await fetchUsuarios();
    } finally {
      setBusyId(null);
    }
  };

  const borrarUsuario = async (usuario: Usuario) => {
    const nombre = usuario.full_name || usuario.email || "este usuario";
    const ok = window.confirm(`¿Querés eliminar permanentemente a ${nombre}?`);
    if (!ok) return;

    setBusyId(usuario.id);
    try {
      await fetch(`${API}/monitoreo/usuarios/${usuario.id}`, {
        method: "DELETE",
      });
      await fetchUsuarios();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-base)" }}>
      <Sidebar />

      <main className="flex-1 p-5 md:p-7 pt-16 md:pt-7 space-y-6 overflow-y-auto">
        <div
          className="rounded-[28px] p-6 md:p-7"
          style={{
            background:
              "linear-gradient(135deg, rgba(15,32,39,0.94), rgba(32,58,67,0.88), rgba(44,83,100,0.82))",
            border: "1px solid rgba(20,184,166,0.14)",
            boxShadow: "0 18px 48px rgba(4,21,28,0.28)",
          }}
        >
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em]" style={{ color: "var(--text-muted)" }}>
                Gestión de pacientes
              </p>
              <h1 className="text-3xl font-bold mt-2" style={{ color: "var(--text-primary)" }}>
                Usuarios
              </h1>
              <p className="text-sm mt-2 max-w-2xl" style={{ color: "var(--text-secondary)" }}>
                Acá podés revisar pacientes registrados, cuentas creadas con Google, foto de perfil, estado de validación y gestión administrativa.
              </p>
            </div>
            <button onClick={() => setOpen(true)} className="btn-primary">
              <UserPlus size={15} />
              Nuevo usuario
            </button>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                placeholder="Buscar por nombre, email, DNI o teléfono..."
                className="field-input pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {[
                    "Usuario",
                    "Acceso",
                    "Documento",
                    "Teléfono",
                    "Estado",
                    "Perfil",
                    "Creado",
                    "Acciones",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3 min-w-[250px]">
                        {u.foto_url ? (
                          <img
                            src={u.foto_url}
                            alt={u.full_name || u.email || "Usuario"}
                            className="w-10 h-10 rounded-full object-cover border"
                            style={{ borderColor: "var(--border-default)" }}
                          />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                            style={{
                              background: "rgba(20,184,166,0.12)",
                              color: "var(--brand-primary)",
                              border: "1px solid rgba(20,184,166,0.2)",
                            }}
                          >
                            {(u.full_name || u.email || "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                            {u.full_name || "Sin nombre"}
                          </p>
                          <p className="text-xs truncate flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                            <Mail size={12} />
                            {u.email || "Sin email"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-2">
                        <ProviderBadge user={u} />
                        {u.google_id ? (
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            Vinculado con Google
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="font-mono text-xs">
                      {u.dni || "—"}
                    </td>
                    <td className="text-xs">{u.telefono || "—"}</td>
                    <td>
                      <ValidationBadge ok={!!u.validado} />
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <span className={`badge ${u.perfil_completo ? "badge-green" : "badge-yellow"}`}>
                          {u.perfil_completo ? "Completo" : "Incompleto"}
                        </span>
                        <span className={`badge ${u.acepta_terminos ? "badge-teal" : "badge-red"}`}>
                          {u.acepta_terminos ? "Términos OK" : "Sin términos"}
                        </span>
                      </div>
                    </td>
                    <td className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("es-AR") : "—"}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleValidado(u)}
                          disabled={busyId === u.id}
                          className="btn-ghost !px-3 !py-2"
                          title={u.validado ? "Desvalidar cuenta" : "Validar cuenta"}
                        >
                          <ShieldCheck size={15} />
                        </button>
                        <button
                          onClick={() => borrarUsuario(u)}
                          disabled={busyId === u.id}
                          className="btn-ghost !px-3 !py-2"
                          title="Eliminar usuario"
                          style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.22)" }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {usuarios.length === 0 && (
              <div className="py-12 text-center" style={{ color: "var(--text-muted)" }}>
                <Users size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">
                  {search.trim() ? "No se encontraron usuarios para esa búsqueda" : "No se encontraron usuarios"}
                </p>
              </div>
            )}
          </div>

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
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page === pages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                }}
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
        onSuccess={() => {
          setPage(1);
          fetchUsuarios();
        }}
      />
    </div>
  );
}
