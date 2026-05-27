"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/sidebar";
import {
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Pencil,
  MessageCircle,
  Mail,
  Clock,
  ImageIcon,
  X,
  Stethoscope,
  Wifi,
  Users,
  Star,
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
  perfil_completo?: boolean;
  perfil_recordatorio_step?: number;
  perfil_recordatorio_ultimo_at?: string | null;
  perfil_recordatorio_manual_count?: number;
  ultimo_ping?: string | null;
  created_at?: string;
  foto_perfil?: string;
  foto_dni_frente?: string;
  foto_dni_dorso?: string;
  selfie_dni?: string;
  reputacion_promedio?: number;
  reputacion_total?: number;
  platform?: string | null;
};

function isOnline(ping?: string | null): boolean {
  if (!ping) return false;
  return Date.now() - new Date(ping).getTime() < 5 * 60 * 1000;
}

function isMatriculaProvisoria(matricula?: string | null): boolean {
  const value = (matricula || "").toUpperCase();
  return value.startsWith("GOOGLE-") || value.startsWith("APPLE-");
}

function matriculaDisplay(m: Medico): string {
  if (!m.matricula) return "—";
  if (!m.perfil_completo && isMatriculaProvisoria(m.matricula)) return "Pendiente";
  return m.matricula;
}

function estadoProfesional(m: Medico) {
  if (!m.perfil_completo && !m.matricula_validada) {
    return {
      label: "Registro incompleto",
      badge: "badge-yellow",
      icon: Clock,
      detail: "Debe completar datos, documentación y términos",
    };
  }
  if (!m.matricula_validada) {
    return {
      label: "Pendiente validación",
      badge: "badge-yellow",
      icon: ShieldOff,
      detail: "Perfil completo, falta validar matrícula",
    };
  }
  if (!m.validado) {
    return {
      label: "Bloqueado",
      badge: "badge-red",
      icon: ShieldOff,
      detail: "Acceso deshabilitado manualmente",
    };
  }
  return {
    label: "Habilitado",
    badge: "badge-green",
    icon: ShieldCheck,
    detail: "Puede operar en DocYa Pro",
  };
}

function estaHabilitado(m: Medico): boolean {
  return estadoProfesional(m).label === "Habilitado";
}

function ReputationStars({
  promedio = 0,
  total = 0,
}: {
  promedio?: number;
  total?: number;
}) {
  const rating = Math.max(0, Math.min(5, Number(promedio) || 0));
  const roundedRating = Math.round(rating);

  if (!total) {
    return (
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        Sin reseñas
      </div>
    );
  }

  return (
    <div className="flex min-w-[108px] flex-col gap-1">
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            size={12}
            style={{
              color: index < roundedRating ? "#fbbf24" : "rgba(148,163,184,0.35)",
              fill: index < roundedRating ? "#fbbf24" : "transparent",
            }}
          />
        ))}
      </div>
      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        {rating.toFixed(1)} / 5 ({total})
      </span>
    </div>
  );
}

export default function MedicosPage() {
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "medico" | "enfermero">("todos");
  const [fotoMedico, setFotoMedico] = useState<Medico | null>(null);
  const [fotoGrande, setFotoGrande] = useState<string | null>(null);
  const [editarMedico, setEditarMedico] = useState<Medico | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [recordatorioId, setRecordatorioId] = useState<number | null>(null);
  const [expandedMedicoId, setExpandedMedicoId] = useState<number | null>(null);

  const fetchMedicos = async () => {
    const res = await fetch(`${API}/monitoreo/medicos_registrados`);
    const data = await res.json();
    setMedicos(data.medicos || []);
  };

  useEffect(() => {
    fetchMedicos();
  }, []);

  const medicosFiltrados = useMemo(
    () =>
      medicos.filter((m) => {
        const matchTipo = tipoFiltro === "todos" || m.tipo === tipoFiltro;
        const matchSearch = `${m.full_name} ${m.email} ${m.matricula} ${m.especialidad}`
          .toLowerCase()
          .includes(search.toLowerCase());
        return matchTipo && matchSearch;
      }),
    [medicos, search, tipoFiltro],
  );

  const toggleAcceso = async (m: Medico) => {
    setLoadingId(m.id);
    try {
      const res = await fetch(`${API}/auth/validar_medico/${m.id}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.detail || data?.error || "No se pudo actualizar el acceso del profesional");
      }
      if (data?.mensaje) {
        alert(data.mensaje);
      }
      fetchMedicos();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo actualizar el acceso del profesional");
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

  const enviarRecordatorioPerfil = async (m: Medico) => {
    if (m.perfil_completo) return;
    if (!confirm(`¿Enviar email para que ${m.full_name} complete su cuenta?`)) return;
    setRecordatorioId(m.id);
    try {
      const res = await fetch(`${API}/monitoreo/medicos/${m.id}/recordatorio_perfil`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.detail || data?.error || "No se pudo enviar el recordatorio");
      }
      alert(data?.mensaje || "Recordatorio enviado");
      fetchMedicos();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo enviar el recordatorio");
    } finally {
      setRecordatorioId(null);
    }
  };

  const totalMedicos = medicos.filter((m) => m.tipo === "medico").length;
  const totalEnfermeros = medicos.filter((m) => m.tipo === "enfermero").length;
  const totalOnline = medicos.filter((m) => isOnline(m.ultimo_ping)).length;
  const totalValidados = medicos.filter(estaHabilitado).length;
  const totalIncompletos = medicos.filter((m) => !m.perfil_completo).length;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-base)" }}>
      <Sidebar />

      <main className="flex-1 space-y-6 overflow-y-auto p-5 pt-16 md:p-7 md:pt-7">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Médicos y Enfermeros
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
            Gestión de profesionales registrados
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Médicos", value: totalMedicos, icon: Stethoscope, color: "var(--brand-primary)" },
            { label: "Enfermeros", value: totalEnfermeros, icon: Users, color: "#3b82f6" },
            { label: "En línea ahora", value: totalOnline, icon: Wifi, color: "#22c55e" },
            { label: "Incompletos", value: totalIncompletos, icon: Clock, color: "#f59e0b" },
            { label: "Habilitados", value: totalValidados, icon: ShieldCheck, color: "#22c55e" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="kpi-card">
              <div className="flex items-center gap-3">
                <div
                  className="rounded-lg p-2"
                  style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                >
                  <Icon size={16} style={{ color }} />
                </div>
                <div>
                  <p
                    className="text-xs"
                    style={{
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {label}
                  </p>
                  <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                    {value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="glass-card overflow-hidden">
          <div
            className="flex flex-wrap items-center gap-3 border-b p-4"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <div className="relative min-w-48 flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                placeholder="Buscar profesional..."
                className="field-input pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div
              className="flex overflow-hidden rounded-lg border"
              style={{ borderColor: "var(--border-subtle)" }}
            >
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
                  {[
                    "Profesional",
                    "Tipo",
                    "Especialidad",
                    "Localidad",
                    "Matrícula",
                    "Estado",
                    "Reputación",
                    "Ping",
                    "SO",
                    "Acciones",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {medicosFiltrados.map((m) => {
                  const online = isOnline(m.ultimo_ping);
                  const estado = estadoProfesional(m);
                  const EstadoIcon = estado.icon;
                  return (
                    <Fragment key={m.id}>
                      <tr
                        className="cursor-pointer"
                        onClick={() =>
                          setExpandedMedicoId((current) => (current === m.id ? null : m.id))
                        }
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            {m.foto_perfil ? (
                              <img
                                src={m.foto_perfil}
                                alt={`Foto de ${m.full_name}`}
                                className="h-8 w-8 cursor-pointer rounded-full object-cover"
                                style={{ border: "1px solid var(--border-subtle)" }}
                                onClick={() => setFotoGrande(m.foto_perfil!)}
                              />
                            ) : (
                              <div
                                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                                style={{
                                  background: "rgba(20,184,166,0.15)",
                                  color: "var(--brand-primary)",
                                  border: "1px solid var(--border-subtle)",
                                }}
                              >
                                {m.full_name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                {m.full_name}
                              </p>
                              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {m.email}
                              </p>
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
                        <td className="font-mono text-xs">{matriculaDisplay(m)}</td>
                        <td>
                          <span className={`badge ${estado.badge}`} title={estado.detail}>
                            <EstadoIcon size={10} /> {estado.label}
                          </span>
                        </td>
                        <td>
                          <ReputationStars
                            promedio={m.reputacion_promedio}
                            total={m.reputacion_total}
                          />
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`h-2 w-2 rounded-full ${online ? "bg-green-400" : "bg-gray-600"}`}
                              style={{ boxShadow: online ? "0 0 6px rgba(74,222,128,0.6)" : "none" }}
                            />
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {online ? "Online" : "Offline"}
                            </span>
                          </div>
                        </td>
                        <td>
                          {m.platform === "ios" && (
                            <span className="badge" style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }}>
                              iOS
                            </span>
                          )}
                          {m.platform === "android" && (
                            <span className="badge" style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}>
                              Android
                            </span>
                          )}
                          {!m.platform && (
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            {!m.perfil_completo && (
                              <button
                                title="Enviar email para completar cuenta"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  enviarRecordatorioPerfil(m);
                                }}
                                disabled={recordatorioId === m.id}
                                className="rounded-md p-1.5 transition-colors hover:bg-yellow-500/10"
                                style={{ color: "#facc15" }}
                              >
                                <Mail size={14} />
                              </button>
                            )}
                            <button
                              title="WhatsApp"
                              onClick={(e) => {
                                e.stopPropagation();
                                const tel = m.telefono?.replace(/\D/g, "");
                                if (tel) window.open(`https://wa.me/${tel}`, "_blank");
                              }}
                              className="rounded-md p-1.5 transition-colors hover:bg-green-500/10"
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
                              className="rounded-md p-1.5 transition-colors"
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
                              className="rounded-md p-1.5 transition-colors"
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
                              className="rounded-md p-1.5 transition-colors"
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
                              className="rounded-md p-1.5 transition-colors hover:bg-red-500/10"
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
                          <td colSpan={10} className="bg-white/5">
                            <div className="grid gap-4 p-4 md:grid-cols-3">
                              {[
                                ["Email", m.email || "—"],
                                ["Teléfono", m.telefono || "—"],
                                ["Tipo documento", m.tipo_documento || "—"],
                                ["Número documento", m.numero_documento || m.dni || "—"],
                                ["Matrícula", matriculaDisplay(m)],
                                ["Especialidad", m.especialidad || "—"],
                                ["Dirección", m.direccion || "—"],
                                ["Provincia", m.provincia || "—"],
                                ["Localidad", m.localidad || "—"],
                                ["Aceptó términos", m.acepta_terminos ? "Sí" : "No"],
                                ["Estado", estado.label],
                                ["Acceso", m.validado ? "Habilitado" : "Bloqueado"],
                                ["Matrícula validada", m.matricula_validada ? "Sí" : "No"],
                                ["Perfil completo", m.perfil_completo ? "Sí" : "No"],
                                [
                                  "Recordatorios",
                                  m.perfil_recordatorio_ultimo_at
                                    ? `${m.perfil_recordatorio_step || 0}/3 · último ${new Date(m.perfil_recordatorio_ultimo_at).toLocaleString("es-AR")}`
                                    : `${m.perfil_recordatorio_step || 0}/3 · sin envíos`,
                                ],
                                [
                                  "Reputación",
                                  m.reputacion_total
                                    ? `${Number(m.reputacion_promedio || 0).toFixed(1)} / 5 (${m.reputacion_total} reseñas)`
                                    : "Sin reseñas",
                                ],
                                [
                                  "Plataforma",
                                  m.platform === "ios" ? "iOS" : m.platform === "android" ? "Android" : "—",
                                ],
                                [
                                  "Registrado",
                                  m.created_at ? new Date(m.created_at).toLocaleString("es-AR") : "—",
                                ],
                              ].map(([label, value]) => (
                                <div key={label}>
                                  <p
                                    className="text-[11px] uppercase tracking-[0.08em]"
                                    style={{ color: "var(--text-muted)" }}
                                  >
                                    {label}
                                  </p>
                                  <p className="mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
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

      {fotoMedico && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(4,13,18,0.92)", backdropFilter: "blur(8px)" }}
          onClick={() => setFotoMedico(null)}
        >
          <div
            className="relative w-full max-w-2xl rounded-2xl p-6"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setFotoMedico(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 hover:bg-white/5"
              style={{ color: "var(--text-muted)" }}
            >
              <X size={18} />
            </button>
            <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Fotos — {fotoMedico.full_name}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                fotoMedico.foto_perfil,
                fotoMedico.foto_dni_frente,
                fotoMedico.foto_dni_dorso,
                fotoMedico.selfie_dni,
              ].map((f, i) =>
                f ? (
                  <img
                    key={i}
                    src={f}
                    alt={`Documento ${i + 1} de ${fotoMedico.full_name}`}
                    onClick={() => setFotoGrande(f)}
                    className="cursor-pointer rounded-xl object-contain transition-opacity hover:opacity-80"
                    style={{ border: "1px solid var(--border-subtle)", maxHeight: 200 }}
                  />
                ) : null,
              )}
            </div>
          </div>
        </div>
      )}

      {fotoGrande && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(4,13,18,0.97)" }}
          onClick={() => setFotoGrande(null)}
        >
          <button
            onClick={() => setFotoGrande(null)}
            className="absolute right-4 top-4 rounded-full p-2"
            style={{ background: "rgba(255,255,255,0.1)", color: "white" }}
          >
            <X size={20} />
          </button>
          <img
            src={fotoGrande}
            alt="Documento ampliado"
            className="max-h-[90vh] max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {editarMedico && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(4,13,18,0.9)", backdropFilter: "blur(8px)" }}
          onClick={() => setEditarMedico(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-5 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Editar — {editarMedico.full_name}
            </h2>
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
                  <label className="mb-1 block text-xs" style={{ color: "var(--text-muted)" }}>
                    {label}
                  </label>
                  <input
                    className="field-input"
                    value={(editarMedico[key as keyof Medico] as string) || ""}
                    onChange={(e) => setEditarMedico({ ...editarMedico, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditarMedico(null)} className="btn-ghost">
                Cancelar
              </button>
              <button onClick={guardarEdicion} className="btn-primary">
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
