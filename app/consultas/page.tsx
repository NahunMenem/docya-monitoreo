"use client";

import Sidebar from "@/components/sidebar";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar,
  Activity,
  CheckCircle,
  Clock,
  Truck,
  Home,
  MessageCircle,
  Trash2,
  Search,
  Filter,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE!;

type Consulta = {
  id: number;
  creado_en: string;
  estado: string;
  motivo: string;
  metodo_pago: string;
  direccion: string;
  paciente: string;
  profesional: string;
  tipo: string;
  canal_atencion?: string | null;
  tiempo_llegada_min?: number | null;
  duracion_atencion_min?: number | null;
};

const estadoConfig: Record<string, { label: string; badgeClass: string }> = {
  pendiente: { label: "Pendiente", badgeClass: "badge-yellow" },
  aceptada: { label: "Aceptada", badgeClass: "badge-teal" },
  en_camino: { label: "En camino", badgeClass: "badge-blue" },
  en_domicilio: { label: "En domicilio", badgeClass: "badge-green" },
  finalizada: { label: "Finalizada", badgeClass: "badge-green" },
  cancelada: { label: "Cancelada", badgeClass: "badge-red" },
  buscando_medico: { label: "Buscando medico", badgeClass: "badge-yellow" },
  asignada: { label: "Asignada", badgeClass: "badge-teal" },
  en_videollamada: { label: "En videollamada", badgeClass: "badge-blue" },
  cancelada_sin_medico: { label: "Cancelada sin medico", badgeClass: "badge-red" },
  cancelada_paciente: { label: "Cancelada paciente", badgeClass: "badge-red" },
};

const estadosList = [
  { key: "pendiente", label: "Pendientes", icon: Clock },
  { key: "aceptada", label: "Aceptadas", icon: CheckCircle },
  { key: "en_camino", label: "En camino", icon: Truck },
  { key: "en_domicilio", label: "En domicilio", icon: Home },
  { key: "finalizada", label: "Finalizadas", icon: Activity },
];

export default function ConsultasPage() {
  const hoy = new Date().toISOString().slice(0, 10);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [appliedDesde, setAppliedDesde] = useState("");
  const [appliedHasta, setAppliedHasta] = useState("");
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [eliminarId, setEliminarId] = useState<number | null>(null);
  const [copiadoId, setCopiadoId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchConsultas = async (
    targetPage = 1,
    customDesde = appliedDesde,
    customHasta = appliedHasta
  ) => {
    setLoading(true);
    try {
      let d = customDesde, h = customHasta;
      if (d && h && new Date(d) > new Date(h)) [d, h] = [h, d];

      const params = new URLSearchParams({
        page: String(targetPage),
        limit: "10",
      });
      if (d) params.set("desde", d);
      if (h) params.set("hasta", h);

      const res = await fetch(`${API}/monitoreo/consultas/?${params.toString()}`);
      const data = await res.json();
      setConsultas(data.consultas || []);
      setPage(data.page || targetPage);
      setPages(Math.max(data.pages || 1, 1));
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConsultas(1, "", ""); }, []);

  const buscarConsultas = async () => {
    let d = desde;
    let h = hasta;
    if (d && h && new Date(d) > new Date(h)) [d, h] = [h, d];
    setAppliedDesde(d);
    setAppliedHasta(h);
    await fetchConsultas(1, d, h);
  };

  const eliminarConsulta = async (id: number) => {
    try {
      const res = await fetch(`${API}/monitoreo/consultas/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setConsultas((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert("No se pudo eliminar la consulta");
    } finally {
      setEliminarId(null);
    }
  };

  const armarMensajeWhatsapp = (consulta: Consulta) => {
    const tipoLower = (consulta.tipo || "").toLowerCase();
    const canalLower = (consulta.canal_atencion || "domicilio").toLowerCase();
    const esEnfermeria = tipoLower.includes("enfer");
    const esTeleconsulta = canalLower === "teleconsulta";
    const tipoLabel = esEnfermeria ? "Enfermero/a" : "Medico";
    const canalLabel = esTeleconsulta ? "Teleconsulta" : "Domicilio";
    const fecha = consulta.creado_en
      ? format(new Date(consulta.creado_en), "dd/MM/yy HH:mm", { locale: es })
      : "-";
    const mapsUrl = consulta.direccion
      ? `https://maps.google.com/?q=${encodeURIComponent(consulta.direccion)}`
      : "Sin direccion";

    return [
      "Nueva consulta disponible - DocYa",
      "",
      `Consulta #${consulta.id} | ${tipoLabel} | ${canalLabel}`,
      `Paciente: ${consulta.paciente || "N/D"}`,
      `Fecha: ${fecha}`,
      `Direccion: ${consulta.direccion || "N/D"}`,
      `Mapa: ${mapsUrl}`,
      `Motivo: ${consulta.motivo || "Sin motivo informado"}`,
      `Pago: ${consulta.metodo_pago || "N/D"}`,
      `Estado: ${estadoConfig[consulta.estado]?.label || consulta.estado}`,
      "",
      "Puede tomar esta consulta? Avisame por WhatsApp."
    ].join("\n");
  };

  const enviarWhatsappConsulta = async (consulta: Consulta) => {
    const mensaje = armarMensajeWhatsapp(consulta);
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiadoId(consulta.id);
      window.setTimeout(() => {
        setCopiadoId((actual) => (actual === consulta.id ? null : actual));
      }, 1800);
    } catch {
      alert("No se pudo copiar el mensaje");
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener,noreferrer");
  };

  const kpiMap = useMemo(() => {
    const map: Record<string, number> = {};
    consultas.forEach((c) => { map[c.estado] = (map[c.estado] || 0) + 1; });
    return map;
  }, [consultas]);

  const promedioLlegada = useMemo(() => {
    const vals = consultas.map((c) => c.tiempo_llegada_min).filter((v): v is number => typeof v === "number");
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "-";
  }, [consultas]);

  const promedioDuracion = useMemo(() => {
    const vals = consultas.map((c) => c.duracion_atencion_min).filter((v): v is number => typeof v === "number");
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "-";
  }, [consultas]);

  const filtradas = useMemo(() =>
    consultas.filter((c) =>
      `${c.paciente} ${c.profesional} ${c.motivo} ${c.estado} ${c.canal_atencion || ""}`.toLowerCase().includes(search.toLowerCase())
    ), [consultas, search]);

  const totalTeleconsultas = useMemo(
    () => consultas.filter((c) => (c.canal_atencion || "").toLowerCase() === "teleconsulta").length,
    [consultas]
  );

  const totalDomicilio = useMemo(
    () => consultas.filter((c) => (c.canal_atencion || "domicilio").toLowerCase() !== "teleconsulta").length,
    [consultas]
  );

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-base)" }}>
      <Sidebar />

      <main className="flex-1 p-5 md:p-7 pt-16 md:pt-7 space-y-6 overflow-y-auto">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Consultas</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Historial y monitoreo de consultas</p>
        </div>

        {/* Filtros */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={15} style={{ color: "var(--brand-primary)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Filtrar por fecha</span>
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Desde</label>
              <div className="relative">
                <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input type="date" value={desde} max={hoy} onChange={(e) => setDesde(e.target.value)} className="field-input pl-8" />
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Hasta</label>
              <div className="relative">
                <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input type="date" value={hasta} max={hoy} onChange={(e) => setHasta(e.target.value)} className="field-input pl-8" />
              </div>
            </div>
            <button onClick={buscarConsultas} disabled={loading} className="btn-primary">
              {loading ? "Cargando..." : "Buscar"}
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="kpi-card col-span-1">
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total</p>
            <p className="text-2xl font-bold" style={{ color: "var(--brand-primary)" }}>{total}</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Domicilio</p>
            <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{totalDomicilio}</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Teleconsultas</p>
            <p className="text-2xl font-bold" style={{ color: "#06b6d4" }}>{totalTeleconsultas}</p>
          </div>
          {estadosList.map(({ key, label, icon: Icon }) => (
            <div key={key} className="kpi-card">
              <div className="flex items-center gap-1 mb-1">
                <Icon size={11} style={{ color: "var(--text-muted)" }} />
                <p className="text-xs" style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{kpiMap[key] || 0}</p>
            </div>
          ))}
          <div className="kpi-card">
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Llegada prom.</p>
            <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{promedioLlegada} <span className="text-sm font-normal">min</span></p>
          </div>
          <div className="kpi-card">
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Atención prom.</p>
            <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{promedioDuracion} <span className="text-sm font-normal">min</span></p>
          </div>
        </div>

        {/* Search + Table */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                placeholder="Buscar por paciente, profesional, motivo..."
                className="field-input pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y" style={{ borderColor: "var(--border-subtle)" }}>
            {filtradas.map((c) => {
              const est = estadoConfig[c.estado] || { label: c.estado, badgeClass: "badge-teal" };
              const esEnfermeria = (c.tipo || "").toLowerCase().includes("enfer");
              const esTeleconsulta = (c.canal_atencion || "").toLowerCase() === "teleconsulta";
              return (
                <div key={c.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>#{c.id}</span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {format(new Date(c.creado_en), "dd/MM/yy HH:mm", { locale: es })}
                      </span>
                    </div>
                    <span className={`badge ${est.badgeClass}`}>{est.label}</span>
                  </div>

                  <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{c.paciente}</p>

                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {c.profesional || "Sin profesional"}
                  </p>

                  {c.motivo && (
                    <p className="text-xs line-clamp-2" style={{ color: "var(--text-muted)" }}>{c.motivo}</p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    <span className={`badge ${esTeleconsulta ? "badge-blue" : "badge-teal"}`}>
                      {esTeleconsulta ? "Teleconsulta" : "Domicilio"}
                    </span>
                    <span className={`badge ${esEnfermeria ? "badge-blue" : "badge-teal"}`}>
                      {esEnfermeria ? "Enfermería" : "Médica"}
                    </span>
                    {c.metodo_pago && (
                      <span className="badge badge-yellow capitalize">{c.metodo_pago}</span>
                    )}
                  </div>

                  {c.direccion && (
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{c.direccion}</p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      {c.tiempo_llegada_min != null && <span>Llegada: {c.tiempo_llegada_min}m</span>}
                      {c.duracion_atencion_min != null && <span>Duración: {c.duracion_atencion_min}m</span>}
                    </div>
                    {eliminarId === c.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => eliminarConsulta(c.id)}
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
                        >
                          Confirmar
                        </button>
                        <button onClick={() => setEliminarId(null)} className="btn-ghost px-2 py-1 text-xs">
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          title={copiadoId === c.id ? "Mensaje copiado" : "Copiar mensaje y abrir WhatsApp"}
                          onClick={() => enviarWhatsappConsulta(c)}
                          className="p-1.5 rounded-md transition-colors"
                          style={{ color: copiadoId === c.id ? "var(--brand-primary)" : "#4ade80" }}
                        >
                          <MessageCircle size={14} />
                        </button>
                        <button
                          onClick={() => setEliminarId(c.id)}
                          className="p-1.5 rounded-md transition-colors"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {filtradas.length === 0 && (
              <div className="py-12 text-center" style={{ color: "var(--text-muted)" }}>
                <Activity size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No hay consultas para mostrar</p>
              </div>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {["ID", "Fecha", "Estado", "Paciente", "Motivo", "Profesional", "Canal", "Tipo consulta", "Pago", "Dirección", "Llegada", "Duración", ""].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((c) => {
                  const est = estadoConfig[c.estado] || { label: c.estado, badgeClass: "badge-teal" };
                  const tipoLower = (c.tipo || "").toLowerCase();
                  const esEnfermeria = tipoLower.includes("enfer");
                  const esTeleconsulta = (c.canal_atencion || "").toLowerCase() === "teleconsulta";
                  return (
                    <tr key={c.id}>
                      <td className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>#{c.id}</td>
                      <td className="whitespace-nowrap text-xs">{format(new Date(c.creado_en), "dd/MM/yy HH:mm", { locale: es })}</td>
                      <td><span className={`badge ${est.badgeClass}`}>{est.label}</span></td>
                      <td className="font-medium" style={{ color: "var(--text-primary)" }}>{c.paciente}</td>
                      <td className="max-w-[220px] min-w-[180px] text-xs" title={c.motivo || "Sin motivo informado"}>
                        <span className="line-clamp-2">{c.motivo || "Sin motivo informado"}</span>
                      </td>
                      <td>{c.profesional}</td>
                      <td>
                        <span className={`badge ${esTeleconsulta ? "badge-blue" : "badge-teal"}`}>
                          {esTeleconsulta ? "Teleconsulta" : "Domicilio"}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${esEnfermeria ? "badge-blue" : "badge-teal"}`}>
                          {esEnfermeria ? "Enfermería" : "Médica"}
                        </span>
                      </td>
                      <td className="capitalize">{c.metodo_pago}</td>
                      <td className="max-w-[180px] truncate text-xs">{c.direccion}</td>
                      <td className="text-center">{c.tiempo_llegada_min != null ? `${c.tiempo_llegada_min}m` : "—"}</td>
                      <td className="text-center">{c.duracion_atencion_min != null ? `${c.duracion_atencion_min}m` : "—"}</td>
                      <td>
                        {eliminarId === c.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => eliminarConsulta(c.id)}
                              className="px-2 py-1 rounded text-xs font-medium"
                              style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
                            >
                              Confirmar
                            </button>
                            <button onClick={() => setEliminarId(null)} className="btn-ghost px-2 py-1 text-xs">
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              title={copiadoId === c.id ? "Mensaje copiado" : "Copiar mensaje y abrir WhatsApp"}
                              onClick={() => enviarWhatsappConsulta(c)}
                              className="p-1.5 rounded-md transition-colors"
                              style={{ color: copiadoId === c.id ? "var(--brand-primary)" : "#4ade80" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(34,197,94,0.1)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <MessageCircle size={14} />
                            </button>
                            <button
                              title="Eliminar consulta"
                              onClick={() => setEliminarId(c.id)}
                              className="p-1.5 rounded-md transition-colors"
                              style={{ color: "var(--text-muted)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtradas.length === 0 && (
              <div className="py-12 text-center" style={{ color: "var(--text-muted)" }}>
                <Activity size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No hay consultas para mostrar</p>
              </div>
            )}
          </div>

          <div
            className="px-4 py-3 border-t flex items-center justify-between gap-3"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Página {page} de {pages} · {total} consultas
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchConsultas(page - 1)}
                disabled={loading || page <= 1}
                className="btn-ghost px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => fetchConsultas(page + 1)}
                disabled={loading || page >= pages}
                className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
