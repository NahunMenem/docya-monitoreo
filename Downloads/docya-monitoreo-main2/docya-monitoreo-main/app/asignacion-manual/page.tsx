"use client";

import Sidebar from "@/components/sidebar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar,
  CheckCircle2,
  ClipboardPlus,
  RefreshCw,
  Search,
  Stethoscope,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE!;

type Consulta = {
  id: number;
  creado_en: string;
  estado: string;
  motivo: string;
  direccion: string;
  paciente: string;
  profesional?: string | null;
  tipo?: string | null;
};

type Medico = {
  id: number;
  full_name: string;
  email: string;
  especialidad: string;
  localidad: string;
  provincia: string;
  tipo: "medico" | "enfermero";
  validado: boolean;
  ultimo_ping?: string | null;
};

const estadoBadgeClass: Record<string, string> = {
  pendiente: "badge-yellow",
  aceptada: "badge-teal",
  en_camino: "badge-blue",
  en_domicilio: "badge-green",
  finalizada: "badge-green",
  cancelada: "badge-red",
};

function isOnline(ping?: string | null): boolean {
  if (!ping) return false;
  return Date.now() - new Date(ping).getTime() < 5 * 60 * 1000;
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function AsignacionManualPage() {
  const hoy = new Date();
  const [desde, setDesde] = useState(formatDateInput(subDays(hoy, 7)));
  const [hasta, setHasta] = useState(formatDateInput(hoy));
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [consultaSearch, setConsultaSearch] = useState("");
  const [medicoSearch, setMedicoSearch] = useState("");
  const [consultaIdSeleccionada, setConsultaIdSeleccionada] = useState<number | null>(null);
  const [medicoIdSeleccionado, setMedicoIdSeleccionado] = useState<number | null>(null);
  const [forzarEnCamino, setForzarEnCamino] = useState(false);
  const [loadingConsultas, setLoadingConsultas] = useState(false);
  const [loadingMedicos, setLoadingMedicos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchConsultas = useCallback(async () => {
    setLoadingConsultas(true);
    try {
      let fechaDesde = desde;
      let fechaHasta = hasta;
      if (new Date(fechaDesde) > new Date(fechaHasta)) {
        [fechaDesde, fechaHasta] = [fechaHasta, fechaDesde];
      }

      const res = await fetch(`${API}/monitoreo/consultas/?desde=${fechaDesde}&hasta=${fechaHasta}`);
      const data = await res.json();
      setConsultas(data.consultas || []);
    } finally {
      setLoadingConsultas(false);
    }
  }, [desde, hasta]);

  const fetchMedicos = useCallback(async () => {
    setLoadingMedicos(true);
    try {
      const res = await fetch(`${API}/monitoreo/medicos_registrados`);
      const data = await res.json();
      setMedicos((data.medicos || []).filter((medico: Medico) => medico.tipo === "medico"));
    } finally {
      setLoadingMedicos(false);
    }
  }, []);

  useEffect(() => {
    void fetchConsultas();
    void fetchMedicos();
  }, [fetchConsultas, fetchMedicos]);

  const consultasFiltradas = useMemo(() => {
    const query = consultaSearch.trim().toLowerCase();
    if (!query) return consultas;

    return consultas.filter((consulta) =>
      `${consulta.id} ${consulta.paciente} ${consulta.motivo} ${consulta.estado} ${consulta.profesional || ""} ${consulta.direccion || ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [consultaSearch, consultas]);

  const medicosFiltrados = useMemo(() => {
    const query = medicoSearch.trim().toLowerCase();
    if (!query) return medicos;

    return medicos.filter((medico) =>
      `${medico.full_name} ${medico.email} ${medico.especialidad} ${medico.localidad} ${medico.provincia}`
        .toLowerCase()
        .includes(query)
    );
  }, [medicoSearch, medicos]);

  const consultaSeleccionada = useMemo(
    () => consultas.find((consulta) => consulta.id === consultaIdSeleccionada) || null,
    [consultaIdSeleccionada, consultas]
  );

  const medicoSeleccionado = useMemo(
    () => medicos.find((medico) => medico.id === medicoIdSeleccionado) || null,
    [medicoIdSeleccionado, medicos]
  );

  const handleRefresh = async () => {
    setFeedback(null);
    await Promise.all([fetchConsultas(), fetchMedicos()]);
  };

  const handleSubmit = async () => {
    if (!consultaSeleccionada || !medicoSeleccionado) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch(
        `${API}/monitoreo/consultas/${consultaSeleccionada.id}/asignar_manual`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            medico_id: medicoSeleccionado.id,
            forzar_en_camino: forzarEnCamino,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || data?.message || "No se pudo completar la asignación manual");
      }

      setFeedback({
        type: "success",
        message: `La consulta #${consultaSeleccionada.id} fue asignada a ${medicoSeleccionado.full_name}.`,
      });
      await fetchConsultas();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo completar la asignación manual";
      setFeedback({ type: "error", message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-base)" }}>
      <Sidebar />

      <main className="flex-1 p-5 md:p-7 pt-16 md:pt-7 space-y-6 overflow-y-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Asignación manual</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Seleccioná una consulta y asignala manualmente a un médico.
            </p>
          </div>

          <button onClick={handleRefresh} disabled={loadingConsultas || loadingMedicos} className="btn-ghost">
            <RefreshCw size={15} className={loadingConsultas || loadingMedicos ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.2)" }}>
                <ClipboardPlus size={16} style={{ color: "var(--brand-primary)" }} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>Consultas</p>
                <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{consultas.length}</p>
              </div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)" }}>
                <Stethoscope size={16} style={{ color: "#60a5fa" }} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>Médicos</p>
                <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{medicos.length}</p>
              </div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}>
                <CheckCircle2 size={16} style={{ color: "#4ade80" }} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>Selección</p>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {consultaSeleccionada && medicoSeleccionado ? "Lista para confirmar" : "Pendiente"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={15} style={{ color: "var(--brand-primary)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Rango de consultas</span>
          </div>

          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Desde</label>
              <input type="date" value={desde} onChange={(event) => setDesde(event.target.value)} className="field-input" />
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Hasta</label>
              <input type="date" value={hasta} onChange={(event) => setHasta(event.target.value)} className="field-input" />
            </div>

            <button onClick={fetchConsultas} disabled={loadingConsultas} className="btn-primary">
              {loadingConsultas ? "Cargando..." : "Buscar consultas"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="glass-card overflow-hidden">
            <div className="p-4 border-b space-y-3" style={{ borderColor: "var(--border-subtle)" }}>
              <div>
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>1. Elegí la consulta</h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Buscá por paciente, motivo, estado o ID.</p>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  value={consultaSearch}
                  onChange={(event) => setConsultaSearch(event.target.value)}
                  className="field-input pl-9"
                  placeholder="Buscar consulta..."
                />
              </div>
            </div>

            <div className="max-h-[540px] overflow-y-auto p-3 space-y-3">
              {consultasFiltradas.map((consulta) => {
                const selected = consulta.id === consultaIdSeleccionada;
                const badgeClass = estadoBadgeClass[consulta.estado] || "badge-teal";
                return (
                  <button
                    key={consulta.id}
                    type="button"
                    onClick={() => setConsultaIdSeleccionada(consulta.id)}
                    className="w-full text-left rounded-2xl p-4 transition-colors border"
                    style={{
                      background: selected ? "rgba(20,184,166,0.12)" : "rgba(255,255,255,0.02)",
                      borderColor: selected ? "var(--border-strong)" : "rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          #{consulta.id} · {consulta.paciente || "Paciente sin nombre"}
                        </p>
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                          {format(new Date(consulta.creado_en), "dd/MM/yyyy HH:mm", { locale: es })}
                        </p>
                      </div>

                      <span className={`badge ${badgeClass}`}>{consulta.estado}</span>
                    </div>

                    <div className="mt-3 space-y-2">
                      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{consulta.motivo || "Sin motivo informado"}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {consulta.direccion || "Sin dirección"} {consulta.tipo ? `· ${consulta.tipo}` : ""}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Profesional actual: {consulta.profesional || "Sin asignar"}
                      </p>
                    </div>
                  </button>
                );
              })}

              {!loadingConsultas && consultasFiltradas.length === 0 && (
                <div className="py-12 text-center" style={{ color: "var(--text-muted)" }}>
                  <ClipboardPlus size={24} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No hay consultas para mostrar</p>
                </div>
              )}
            </div>
          </section>

          <section className="glass-card overflow-hidden">
            <div className="p-4 border-b space-y-3" style={{ borderColor: "var(--border-subtle)" }}>
              <div>
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>2. Elegí el médico</h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Filtrá por nombre, especialidad o zona.</p>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  value={medicoSearch}
                  onChange={(event) => setMedicoSearch(event.target.value)}
                  className="field-input pl-9"
                  placeholder="Buscar médico..."
                />
              </div>
            </div>

            <div className="max-h-[540px] overflow-y-auto p-3 space-y-3">
              {medicosFiltrados.map((medico) => {
                const selected = medico.id === medicoIdSeleccionado;
                const online = isOnline(medico.ultimo_ping);

                return (
                  <button
                    key={medico.id}
                    type="button"
                    onClick={() => setMedicoIdSeleccionado(medico.id)}
                    className="w-full text-left rounded-2xl p-4 transition-colors border"
                    style={{
                      background: selected ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.02)",
                      borderColor: selected ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ background: "rgba(59,130,246,0.14)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.25)" }}
                        >
                          {medico.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{medico.full_name}</p>
                          <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{medico.email}</p>
                        </div>
                      </div>

                      <span className={`badge ${medico.validado ? "badge-green" : "badge-red"}`}>
                        {medico.validado ? "Habilitado" : "Bloqueado"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {medico.especialidad && <span className="badge badge-blue">{medico.especialidad}</span>}
                      <span className="badge badge-teal">{medico.localidad || "Sin localidad"}</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                      <span style={{ color: "var(--text-muted)" }}>
                        {medico.localidad || "Sin localidad"}{medico.provincia ? `, ${medico.provincia}` : ""}
                      </span>
                      <span className="inline-flex items-center gap-1.5" style={{ color: online ? "#4ade80" : "var(--text-muted)" }}>
                        {online ? <Wifi size={13} /> : <WifiOff size={13} />}
                        {online ? "Online" : "Offline"}
                      </span>
                    </div>
                  </button>
                );
              })}

              {!loadingMedicos && medicosFiltrados.length === 0 && (
                <div className="py-12 text-center" style={{ color: "var(--text-muted)" }}>
                  <Stethoscope size={24} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No hay médicos para mostrar</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="glass-card p-5 space-y-5">
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>3. Confirmá la asignación</h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Revisá la consulta seleccionada, el médico elegido y definí si querés forzar el estado en camino.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl p-4 border" style={{ borderColor: "var(--border-subtle)", background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2 mb-3">
                <UserRound size={15} style={{ color: "var(--brand-primary)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Consulta / paciente</span>
              </div>

              {consultaSeleccionada ? (
                <div className="space-y-2 text-sm">
                  <p style={{ color: "var(--text-primary)" }}>
                    <strong>#{consultaSeleccionada.id}</strong> · {consultaSeleccionada.paciente}
                  </p>
                  <p style={{ color: "var(--text-secondary)" }}>{consultaSeleccionada.motivo || "Sin motivo informado"}</p>
                  <p style={{ color: "var(--text-muted)" }}>{consultaSeleccionada.direccion || "Sin dirección"}</p>
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Todavía no seleccionaste una consulta.</p>
              )}
            </div>

            <div className="rounded-2xl p-4 border" style={{ borderColor: "var(--border-subtle)", background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Stethoscope size={15} style={{ color: "#60a5fa" }} />
                <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Médico</span>
              </div>

              {medicoSeleccionado ? (
                <div className="space-y-2 text-sm">
                  <p style={{ color: "var(--text-primary)" }}>
                    <strong>{medicoSeleccionado.full_name}</strong>
                  </p>
                  <p style={{ color: "var(--text-secondary)" }}>{medicoSeleccionado.especialidad || "Sin especialidad"}</p>
                  <p style={{ color: "var(--text-muted)" }}>{medicoSeleccionado.email}</p>
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Todavía no seleccionaste un médico.</p>
              )}
            </div>
          </div>

          <label
            className="flex items-center justify-between gap-4 rounded-2xl p-4 border cursor-pointer"
            style={{ borderColor: "var(--border-subtle)", background: "rgba(255,255,255,0.02)" }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Forzar en camino</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Si está activo, el backend recibirá `forzar_en_camino: true`.
              </p>
            </div>

            <input
              type="checkbox"
              checked={forzarEnCamino}
              onChange={(event) => setForzarEnCamino(event.target.checked)}
              className="h-4 w-4 accent-[var(--brand-primary)]"
            />
          </label>

          {feedback && (
            <div
              className="rounded-xl px-4 py-3 text-sm border"
              style={{
                color: feedback.type === "success" ? "#86efac" : "#fca5a5",
                background: feedback.type === "success" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                borderColor: feedback.type === "success" ? "rgba(34,197,94,0.22)" : "rgba(239,68,68,0.22)",
              }}
            >
              {feedback.message}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={!consultaSeleccionada || !medicoSeleccionado || submitting}
              className="btn-primary"
            >
              {submitting ? "Asignando..." : "Confirmar asignación"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
