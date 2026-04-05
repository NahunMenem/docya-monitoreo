"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/sidebar";
import {
  Search, ShieldCheck, ShieldOff, Trash2, Pencil, MessageCircle,
  ImageIcon, X, Stethoscope, Wifi, WifiOff, Users,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE!;

type Medico = {
  id: number;
  full_name: string;
  email: string;
  telefono: string;
  matricula: string;
  especialidad: string;
  provincia: string;
  localidad: string;
  dni?: string;
  tipo_documento?: string;
  numero_documento?: string;
  direccion?: string;
  acepta_terminos?: boolean;
  tipo: "medico" | "enfermero";
  validado: boolean;
  matricula_validada: boolean;
  ultimo_ping?: string | null;
  created_at?: string;
  foto_perfil?: string;
  foto_dni_frente?: string;
  foto_dni_dorso?: string;
  selfie_dni?: string;
};

function isOnline(ping?: string | null): boolean {
  if (!ping) return false;
  return Date.now() - new Date(ping).getTime() < 5 * 60 * 1000;
}

export default function MedicosPage() {
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "medico" | "enfermero">("todos");
  const [fotoMedico, setFotoMedico] = useState<Medico | null>(null);
  const [fotoGrande, setFotoGrande] = useState<string | null>(null);
  const [editarMedico, setEditarMedico] = useState<Medico | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [expandedMedicoId, setExpandedMedicoId] = useState<number | null>(null);

  const fetchMedicos = async () => {
    const res = await fetch(`${API}/monitoreo/medicos_registrados`);
    const data = await res.json();
    setMedicos(data.medicos || []);
  };

  useEffect(() => { fetchMedicos(); }, []);

  const medicosFiltrados = useMemo(() =>
    medicos.filter((m) => {
      const matchTipo = tipoFiltro === "todos" || m.tipo === tipoFiltro;
      const matchSearch = `${m.full_name} ${m.email} ${m.matricula} ${m.especialidad}`
        .toLowerCase().includes(search.toLowerCase());
      return matchTipo && matchSearch;
    }), [medicos, search, tipoFiltro]);

  const toggleAcceso = async (m: Medico) => {
    setLoadingId(m.id);
    try {
      await fetch(`${API}/auth/validar_medico/${m.id}`, { method: "POST" });
      fetchMedicos();
    } finally {
      setLoadingId(null);
    }
  };

  const eliminarMedico = async (m: Medico) => {
    if (!confirm(`¿Eliminar a ${m.full_name}?`)) return;
    try {
      const res = await fetch(`${API}/monitoreo/medicos/${m.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.detail || data?.error || "No se pudo eliminar el profesional");
      }
      fetchMedicos();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar el profesional");
    }
  };

  const guardarEdicion = async () => {
    if (!editarMedico) return;
    await fetch(`${API}/monitoreo/medicos/${editarMedico.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editarMedico),
    });
    setEditarMedico(null);
    fetchMedicos();
  };

  const totalMedicos = medicos.filter((m) => m.tipo === "medico").length;
  const totalEnfermeros = medicos.filter((m) => m.tipo === "enfermero").length;
  const totalOnline = medicos.filter((m) => isOnline(m.ultimo_ping)).length;
  const totalValidados = medicos.filter((m) => m.validado).length;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-base)" }}>
      <Sidebar />

      <main className="flex-1 p-5 md:p-7 pt-16 md:pt-7 space-y-6 overflow-y-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Médicos y Enfermeros</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Gestión de profesionales registrados</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Médicos", value: totalMedicos, icon: Stethoscope, color: "var(--brand-primary)" },
            { label: "Enfermeros", value: totalEnfermeros, icon: Users, color: "#3b82f6" },
            { label: "En línea ahora", value: totalOnline, icon: Wifi, color: "#22c55e" },
            { label: "Acceso habilitado", value: totalValidados, icon: ShieldCheck, color: "#f59e0b" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="kpi-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <div>
                  <p className="text-xs" style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                  <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters + Table */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b flex flex-wrap gap-3 items-center" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                placeholder="Buscar profesional..."
                className="field-input pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border-subtle)" }}>
              {(["todos", "medico", "enfermero"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipoFiltro(t)}
                  className="px-3 py-2 text-xs font-medium capitalize transition-colors"
                  style={{
                    background: tipoFiltro === t ? "var(--brand-primary)" : "transparent",
                    color: tipoFiltro === t ? "#040d12" : "var(--text-muted)",
                  }}
                >
                  {t === "todos" ? "Todos" : t === "medico" ? "Médicos" : "Enfermeros"}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {["Profesional", "Tipo", "Especialidad", "Localidad", "Matrícula", "Estado", "Ping", "Acciones"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {medicosFiltrados.map((m) => {
                  const online = isOnline(m.ultimo_ping);
                  return (
                    <Fragment key={m.id}>
                    <tr
                      className="cursor-pointer"
                      onClick={() =>
                        setExpandedMedicoId((current) =>
                          current === m.id ? null : m.id
                        )
                      }
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          {m.foto_perfil ? (
                            <img
                              src={m.foto_perfil}
                              className="w-8 h-8 rounded-full object-cover cursor-pointer"
                              style={{ border: "1px solid var(--border-subtle)" }}
                              onClick={() => setFotoGrande(m.foto_perfil!)}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ background: "rgba(20,184,166,0.15)", color: "var(--brand-primary)", border: "1px solid var(--border-subtle)" }}>
                              {m.full_name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{m.full_name}</p>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${m.tipo === "medico" ? "badge-teal" : "badge-blue"}`}>
                          {m.tipo === "medico" ? "Médico" : "Enfermero"}
                        </span>
                      </td>
                      <td className="text-sm">{m.especialidad || "—"}</td>
                      <td className="text-sm">{m.localidad ? `${m.localidad}, ${m.provincia}` : "—"}</td>
                      <td className="font-mono text-xs">{m.matricula || "—"}</td>
                      <td>
                        {m.validado
                          ? <span className="badge badge-green"><ShieldCheck size={10} /> Habilitado</span>
                          : <span className="badge badge-red"><ShieldOff size={10} /> Bloqueado</span>}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${online ? "bg-green-400" : "bg-gray-600"}`}
                            style={{ boxShadow: online ? "0 0 6px rgba(74,222,128,0.6)" : "none" }} />
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{online ? "Online" : "Offline"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            title="WhatsApp"
                            onClick={(e) => {
                              e.stopPropagation();
                              const tel = m.telefono?.replace(/\D/g, "");
                              if (tel) window.open(`https://wa.me/${tel}`, "_blank");
                            }}
                            className="p-1.5 rounded-md transition-colors hover:bg-green-500/10"
                            style={{ color: "#4ade80" }}
                          >
                            <MessageCircle size={14} />
                          </button>
                          <button
                            title="Ver fotos"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFotoMedico(m);
                            }}
                            className="p-1.5 rounded-md transition-colors"
                            style={{ color: "var(--text-muted)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--brand-primary)")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                          >
                            <ImageIcon size={14} />
                          </button>
                          <button
                            title="Editar"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditarMedico(m);
                            }}
                            className="p-1.5 rounded-md transition-colors"
                            style={{ color: "var(--text-muted)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#60a5fa")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            title={m.validado ? "Bloquear acceso" : "Habilitar acceso"}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAcceso(m);
                            }}
                            disabled={loadingId === m.id}
                            className="p-1.5 rounded-md transition-colors"
                            style={{ color: m.validado ? "#f87171" : "#4ade80" }}
                          >
                            {m.validado ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                          </button>
                          <button
                            title="Eliminar"
                            onClick={(e) => {
                              e.stopPropagation();
                              eliminarMedico(m);
                            }}
                            className="p-1.5 rounded-md transition-colors hover:bg-red-500/10"
                            style={{ color: "var(--text-muted)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedMedicoId === m.id && (
                      <tr key={`${m.id}-expanded`}>
                        <td colSpan={8} className="bg-white/5">
                          <div className="grid gap-4 p-4 md:grid-cols-3">
                            {[
                              ["Email", m.email || "—"],
                              ["Teléfono", m.telefono || "—"],
                              ["Tipo documento", m.tipo_documento || "—"],
                              ["Número documento", m.numero_documento || m.dni || "—"],
                              ["Matrícula", m.matricula || "—"],
                              ["Especialidad", m.especialidad || "—"],
                              ["Dirección", m.direccion || "—"],
                              ["Provincia", m.provincia || "—"],
                              ["Localidad", m.localidad || "—"],
                              ["Aceptó términos", m.acepta_terminos ? "Sí" : "No"],
                              ["Acceso", m.validado ? "Habilitado" : "Bloqueado"],
                              ["Matrícula validada", m.matricula_validada ? "Sí" : "No"],
                              [
                                "Registrado",
                                m.created_at
                                  ? new Date(m.created_at).toLocaleString("es-AR")
                                  : "—",
                              ],
                            ].map(([label, value]) => (
                              <div key={label}>
                                <p
                                  className="text-[11px] uppercase tracking-[0.08em]"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  {label}
                                </p>
                                <p
                                  className="mt-1 text-sm"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  {value}
                                </p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {medicosFiltrados.length === 0 && (
              <div className="py-12 text-center" style={{ color: "var(--text-muted)" }}>
                <Stethoscope size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No se encontraron profesionales</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal Fotos */}
      {fotoMedico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(4,13,18,0.92)", backdropFilter: "blur(8px)" }}
          onClick={() => setFotoMedico(null)}>
          <div className="rounded-2xl p-6 w-full max-w-2xl relative" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setFotoMedico(null)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5" style={{ color: "var(--text-muted)" }}>
              <X size={18} />
            </button>
            <h2 className="font-semibold text-lg mb-4" style={{ color: "var(--text-primary)" }}>Fotos — {fotoMedico.full_name}</h2>
            <div className="grid grid-cols-2 gap-3">
              {[fotoMedico.foto_perfil, fotoMedico.foto_dni_frente, fotoMedico.foto_dni_dorso, fotoMedico.selfie_dni].map((f, i) =>
                f ? (
                  <img key={i} src={f} onClick={() => setFotoGrande(f)}
                    className="rounded-xl object-contain cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ border: "1px solid var(--border-subtle)", maxHeight: 200 }} />
                ) : null
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Foto Grande */}
      {fotoGrande && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(4,13,18,0.97)" }}
          onClick={() => setFotoGrande(null)}>
          <button onClick={() => setFotoGrande(null)} className="absolute top-4 right-4 p-2 rounded-full" style={{ background: "rgba(255,255,255,0.1)", color: "white" }}>
            <X size={20} />
          </button>
          <img src={fotoGrande} className="max-h-[90vh] max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Modal Editar */}
      {editarMedico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(4,13,18,0.9)", backdropFilter: "blur(8px)" }}
          onClick={() => setEditarMedico(null)}>
          <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold text-lg mb-5" style={{ color: "var(--text-primary)" }}>Editar — {editarMedico.full_name}</h2>
            <div className="space-y-3">
              {[
                { key: "full_name", label: "Nombre completo" },
                { key: "email", label: "Email" },
                { key: "telefono", label: "Teléfono" },
                { key: "especialidad", label: "Especialidad" },
                { key: "provincia", label: "Provincia" },
                { key: "localidad", label: "Localidad" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
                  <input
                    className="field-input"
                    value={(editarMedico as any)[key] || ""}
                    onChange={(e) => setEditarMedico({ ...editarMedico, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditarMedico(null)} className="btn-ghost">Cancelar</button>
              <button onClick={guardarEdicion} className="btn-primary">Guardar cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
