"use client";

import Sidebar from "@/components/sidebar";
import type { ComponentType, CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Activity,
  Calendar,
  CheckCircle,
  Clock,
  Funnel,
  House,
  MessageCircle,
  Search,
  Star,
  Trash2,
  Truck,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE!;

type Consulta = {
  id: number;
  creado_en: string;
  estado: string;
  paciente?: string | null;
  profesional?: string | null;
  motivo?: string | null;
  direccion?: string | null;
  tipo?: string | null;
  canal_atencion?: string | null;
  metodo_pago?: string | null;
  tiempo_llegada_min?: number | null;
  duracion_atencion_min?: number | null;
  puntaje?: number | null;
};

const estadoMeta: Record<string, { label: string; badgeClass: string }> = {
  pendiente: { label: "Pendiente", badgeClass: "badge-yellow" },
  aceptada: { label: "Aceptada", badgeClass: "badge-teal" },
  en_camino: { label: "En camino", badgeClass: "badge-blue" },
  en_domicilio: { label: "En domicilio", badgeClass: "badge-green" },
  finalizada: { label: "Finalizada", badgeClass: "badge-green" },
  cancelada: { label: "Cancelada", badgeClass: "badge-red" },
  buscando_medico: { label: "Buscando medico", badgeClass: "badge-yellow" },
  asignada: { label: "Asignada", badgeClass: "badge-teal" },
  en_videollamada: { label: "En videollamada", badgeClass: "badge-blue" },
  cancelada_sin_medico: { label: "Sin medico", badgeClass: "badge-red" },
  cancelada_paciente: { label: "Cancelada paciente", badgeClass: "badge-red" },
  expirada: { label: "Expirada", badgeClass: "badge-red" },
};

const estadoCards = [
  { key: "pendiente", label: "Pendientes", icon: Clock },
  { key: "aceptada", label: "Aceptadas", icon: CheckCircle },
  { key: "en_camino", label: "En camino", icon: Truck },
  { key: "en_domicilio", label: "En domicilio", icon: House },
  { key: "buscando_medico", label: "Tele buscando", icon: Clock },
  { key: "en_videollamada", label: "En video", icon: Activity },
  { key: "finalizada", label: "Finalizadas", icon: Activity },
];

export default function ConsultasPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [desdeInput, setDesdeInput] = useState("");
  const [hastaInput, setHastaInput] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchConsultas = async (nextPage = 1, desdeFiltro = desde, hastaFiltro = hasta) => {
    setLoading(true);
    try {
      let d = desdeFiltro;
      let h = hastaFiltro;
      if (d && h && new Date(d) > new Date(h)) [d, h] = [h, d];

      const params = new URLSearchParams({ page: String(nextPage), limit: "10" });
      if (d) params.set("desde", d);
      if (h) params.set("hasta", h);

      const res = await fetch(`${API}/monitoreo/consultas/?${params.toString()}`);
      const data = await res.json();
      setConsultas(data.consultas || []);
      setPage(data.page || nextPage);
      setPages(Math.max(data.pages || 1, 1));
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchConsultas(1, "", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscar = async () => {
    let d = desdeInput;
    let h = hastaInput;
    if (d && h && new Date(d) > new Date(h)) [d, h] = [h, d];
    setDesde(d);
    setHasta(h);
    await fetchConsultas(1, d, h);
  };

  const eliminar = async (id: number) => {
    try {
      const res = await fetch(`${API}/monitoreo/consultas/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setConsultas((items) => items.filter((item) => item.id !== id));
    } catch {
      alert("No se pudo eliminar la consulta");
    } finally {
      setDeleteId(null);
    }
  };

  const armarMensajeWhatsapp = (consulta: Consulta) => {
    const esEnfermeria = (consulta.tipo || "").toLowerCase().includes("enfer");
    const esTeleconsulta = consulta.canal_atencion === "teleconsulta" || consulta.tipo === "teleconsulta";
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
      `Estado: ${estadoMeta[consulta.estado]?.label || consulta.estado}`,
      "",
      `Puede tomar esta consulta? Avisame por WhatsApp.`
    ].join("\n");
  };

  const enviarWhatsappConsulta = async (consulta: Consulta) => {
    const mensaje = armarMensajeWhatsapp(consulta);
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiedId(consulta.id);
      window.setTimeout(() => setCopiedId((current) => (current === consulta.id ? null : current)), 1800);
    } catch {
      alert("No se pudo copiar el mensaje");
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener,noreferrer");
  };

  const estadoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    consultas.forEach((consulta) => {
      counts[consulta.estado] = (counts[consulta.estado] || 0) + 1;
    });
    return counts;
  }, [consultas]);

  const llegadaPromedio = useMemo(() => {
    const values = consultas
      .map((consulta) => consulta.tiempo_llegada_min)
      .filter((value): value is number => typeof value === "number");
    return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : "-";
  }, [consultas]);

  const atencionPromedio = useMemo(() => {
    const values = consultas
      .map((consulta) => consulta.duracion_atencion_min)
      .filter((value): value is number => typeof value === "number");
    return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : "-";
  }, [consultas]);

  const consultasFiltradas = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return consultas;
    return consultas.filter((consulta) =>
      `${consulta.paciente || ""} ${consulta.profesional || ""} ${consulta.motivo || ""} ${consulta.estado} ${consulta.canal_atencion || ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [consultas, search]);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-base)" }}>
      <Sidebar />
      <main className="flex-1 p-5 md:p-7 pt-16 md:pt-7 space-y-6 overflow-y-auto">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Consultas</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Historial y monitoreo de consultas</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Funnel size={15} style={{ color: "var(--brand-primary)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Filtrar por fecha</span>
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <DateInput label="Desde" value={desdeInput} max={today} onChange={setDesdeInput} />
            <DateInput label="Hasta" value={hastaInput} max={today} onChange={setHastaInput} />
            <button onClick={buscar} disabled={loading} className="btn-primary">
              {loading ? "Cargando..." : "Buscar"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <KpiCard label="Total" value={total} highlight />
          {estadoCards.map(({ key, label, icon: Icon }) => (
            <KpiCard key={key} label={label} value={estadoCounts[key] || 0} icon={Icon} />
          ))}
          <KpiCard label="Llegada prom." value={`${llegadaPromedio} min`} />
          <KpiCard label="Atencion prom." value={`${atencionPromedio} min`} />
        </div>

        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                placeholder="Buscar por paciente, profesional, motivo..."
                className="field-input pl-9 w-full"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {["ID", "Fecha", "Estado", "Paciente", "Motivo", "Profesional", "Canal", "Tipo consulta", "Pago", "Direccion", "Llegada", "Duracion", ""].map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {consultasFiltradas.map((consulta) => {
                  const meta = estadoMeta[consulta.estado] || { label: consulta.estado, badgeClass: "badge-teal" };
                  const esEnfermeria = (consulta.tipo || "").toLowerCase().includes("enfer");
                  const esTeleconsulta = consulta.canal_atencion === "teleconsulta" || consulta.tipo === "teleconsulta";

                  return (
                    <tr key={consulta.id}>
                      <td className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>#{consulta.id}</td>
                      <td className="whitespace-nowrap text-xs">{format(new Date(consulta.creado_en), "dd/MM/yy HH:mm", { locale: es })}</td>
                      <td><span className={`badge ${meta.badgeClass}`}>{meta.label}</span></td>
                      <td className="font-medium" style={{ color: "var(--text-primary)" }}>{consulta.paciente || "-"}</td>
                      <td className="max-w-[220px] min-w-[180px] text-xs" title={consulta.motivo || "Sin motivo informado"}>
                        <span className="line-clamp-2">{consulta.motivo || "Sin motivo informado"}</span>
                      </td>
                      <td>
                        <div className="flex flex-col gap-0.5">
                          <span>{consulta.profesional || "-"}</span>
                          {consulta.puntaje != null && <ConsultaStars puntaje={consulta.puntaje} />}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${esTeleconsulta ? "badge-blue" : "badge-teal"}`}>
                          {esTeleconsulta ? "Teleconsulta" : "Domicilio"}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${esEnfermeria ? "badge-blue" : "badge-teal"}`}>
                          {esEnfermeria ? "Enfermeria" : "Medica"}
                        </span>
                      </td>
                      <td className="capitalize">{consulta.metodo_pago || "-"}</td>
                      <td className="max-w-[180px] truncate text-xs" title={consulta.direccion || ""}>{consulta.direccion || "-"}</td>
                      <td className="text-center">{consulta.tiempo_llegada_min != null ? `${consulta.tiempo_llegada_min}m` : "-"}</td>
                      <td className="text-center">{consulta.duracion_atencion_min != null ? `${consulta.duracion_atencion_min}m` : "-"}</td>
                      <td>
                        {deleteId === consulta.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => eliminar(consulta.id)}
                              className="px-2 py-1 rounded text-xs font-medium"
                              style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
                            >
                              Confirmar
                            </button>
                            <button onClick={() => setDeleteId(null)} className="btn-ghost px-2 py-1 text-xs">Cancelar</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              title={copiedId === consulta.id ? "Mensaje copiado" : "Copiar mensaje y abrir WhatsApp"}
                              onClick={() => enviarWhatsappConsulta(consulta)}
                              className="p-1.5 rounded-md transition-colors"
                              style={{ color: copiedId === consulta.id ? "var(--brand-primary)" : "#4ade80" }}
                              onMouseEnter={(event) => { event.currentTarget.style.background = "rgba(34,197,94,0.1)"; }}
                              onMouseLeave={(event) => { event.currentTarget.style.background = "transparent"; }}
                            >
                              <MessageCircle size={14} />
                            </button>
                            <button
                              title="Eliminar consulta"
                              onClick={() => setDeleteId(consulta.id)}
                              className="p-1.5 rounded-md transition-colors"
                              style={{ color: "var(--text-muted)" }}
                              onMouseEnter={(event) => { event.currentTarget.style.color = "#f87171"; }}
                              onMouseLeave={(event) => { event.currentTarget.style.color = "var(--text-muted)"; }}
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

            {consultasFiltradas.length === 0 && (
              <div className="py-12 text-center" style={{ color: "var(--text-muted)" }}>
                <Activity size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No hay consultas para mostrar</p>
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t flex items-center justify-between gap-3" style={{ borderColor: "var(--border-subtle)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Pagina {page} de {pages} - {total} consultas
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => fetchConsultas(page - 1)} disabled={loading || page <= 1} className="btn-ghost px-3 py-1.5 text-sm disabled:opacity-50">Anterior</button>
              <button onClick={() => fetchConsultas(page + 1)} disabled={loading || page >= pages} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">Siguiente</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function DateInput({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: string;
  max: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
      <div className="relative">
        <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
        <input type="date" value={value} max={max} onChange={(event) => onChange(event.target.value)} className="field-input pl-8" />
      </div>
    </div>
  );
}

function ConsultaStars({ puntaje }: { puntaje?: number | null }) {
  if (puntaje == null) return <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={11}
          strokeWidth={1.5}
          style={{ color: n <= puntaje ? "#fbbf24" : "var(--border-subtle)", fill: n <= puntaje ? "#fbbf24" : "transparent" }}
        />
      ))}
      <span className="ml-1 text-xs font-medium" style={{ color: "#fbbf24" }}>{puntaje}</span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  highlight = false,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  icon?: ComponentType<{ size?: number; style?: CSSProperties }>;
}) {
  return (
    <div className="kpi-card">
      <div className="flex items-center gap-1 mb-1">
        {Icon && <Icon size={11} style={{ color: "var(--text-muted)" }} />}
        <p className="text-xs" style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </p>
      </div>
      <p className={typeof value === "number" ? "text-2xl font-bold" : "text-xl font-bold"} style={{ color: highlight ? "var(--brand-primary)" : "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}
