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
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [eliminarId, setEliminarId] = useState<number | null>(null);

  const fetchConsultas = async () => {
    setLoading(true);
    try {
      let d = desde, h = hasta;
      if (new Date(d) > new Date(h)) [d, h] = [h, d];
      const res = await fetch(`${API}/monitoreo/consultas/?desde=${d}&hasta=${h}`);
      const data = await res.json();
      setConsultas(data.consultas || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConsultas(); }, []);

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
      `${c.paciente} ${c.profesional} ${c.motivo} ${c.estado}`.toLowerCase().includes(search.toLowerCase())
    ), [consultas, search]);

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
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="field-input pl-8" />
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Hasta</label>
              <div className="relative">
                <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="field-input pl-8" />
              </div>
            </div>
            <button onClick={fetchConsultas} disabled={loading} className="btn-primary">
              {loading ? "Cargando..." : "Buscar"}
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="kpi-card col-span-1">
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total</p>
            <p className="text-2xl font-bold" style={{ color: "var(--brand-primary)" }}>{consultas.length}</p>
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

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {["ID", "Fecha", "Estado", "Paciente", "Profesional", "Tipo", "Pago", "Dirección", "Llegada", "Duración", ""].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((c) => {
                  const est = estadoConfig[c.estado] || { label: c.estado, badgeClass: "badge-teal" };
                  return (
                    <tr key={c.id}>
                      <td className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>#{c.id}</td>
                      <td className="whitespace-nowrap text-xs">{format(new Date(c.creado_en), "dd/MM/yy HH:mm", { locale: es })}</td>
                      <td><span className={`badge ${est.badgeClass}`}>{est.label}</span></td>
                      <td className="font-medium" style={{ color: "var(--text-primary)" }}>{c.paciente}</td>
                      <td>{c.profesional}</td>
                      <td className="capitalize">{c.tipo}</td>
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
                          <button
                            onClick={() => setEliminarId(c.id)}
                            className="p-1.5 rounded-md transition-colors"
                            style={{ color: "var(--text-muted)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                          >
                            <Trash2 size={14} />
                          </button>
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
        </div>
      </main>
    </div>
  );
}
