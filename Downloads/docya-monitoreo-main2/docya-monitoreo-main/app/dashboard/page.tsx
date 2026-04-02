"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  Users,
  Stethoscope,
  UserRound,
  Clock,
  Timer,
  MapPinned,
  HeartPulse,
  TrendingUp,
  RefreshCw,
  WifiOff,
} from "lucide-react";

const Map = dynamic(() => import("./mapa-medicos"), { ssr: false });

const API = process.env.NEXT_PUBLIC_API_BASE!;

type Resumen = {
  total_medicos: number;
  total_enfermeros: number;
  consultas_en_curso: number;
  consultas_hoy: number;
  total_usuarios: number;
};

type Profesional = {
  id: number;
  nombre: string;
  tipo: "medico" | "enfermero";
  telefono: string;
  matricula?: string;
  disponible: boolean;
};

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
  trend,
}: {
  icon: any;
  label: string;
  value?: number | string;
  accent?: string;
  trend?: string;
}) {
  const color = accent || "var(--brand-primary)";
  return (
    <div className="kpi-card group">
      <div className="flex items-start justify-between mb-3">
        <div
          className="p-2.5 rounded-xl"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        {trend && (
          <span className="text-xs flex items-center gap-1" style={{ color: "var(--brand-primary)" }}>
            <TrendingUp size={11} /> {trend}
          </span>
        )}
      </div>
      <p className="text-xs mb-1" style={{ color: "var(--text-muted)", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </p>
      <p className="text-2xl font-bold" style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
        {value ?? <span className="skeleton inline-block w-12 h-7 rounded" />}
      </p>
    </div>
  );
}

function StatusBadge({ tipo }: { tipo: string }) {
  const isMedico = tipo === "medico";
  return (
    <span className={`badge ${isMedico ? "badge-teal" : "badge-blue"}`}>
      {isMedico ? "Médico" : "Enfermero"}
    </span>
  );
}

export default function DashboardHome() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [tiempoAtencion, setTiempoAtencion] = useState<number>(0);
  const [tiempoLlegada, setTiempoLlegada] = useState<number>(0);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const medicosConectados = profesionales.filter((p) => p.tipo === "medico").length;
  const enfermerosConectados = profesionales.filter((p) => p.tipo === "enfermero").length;

  const desconectar = async (p: Profesional) => {
    if (!confirm(`¿Desconectar a ${p.nombre}?`)) return;
    await fetch(`${API}/admin/medicos/${p.id}/desconectar`, { method: "POST" });
    loadProfesionales();
  };

  const loadAll = async () => {
    try {
      const [resumenData, tiempoData, llegadaData] = await Promise.all([
        fetch(`${API}/monitoreo/resumen`).then((r) => r.json()),
        fetch(`${API}/monitoreo/tiempo_promedio`).then((r) => r.json()),
        fetch(`${API}/monitoreo/tiempo_llegada_promedio`).then((r) => r.json()),
      ]);
      setResumen(resumenData);
      setTiempoAtencion(tiempoData.tiempo_promedio_min || 0);
      setTiempoLlegada(llegadaData.tiempo_llegada_promedio_min || 0);
    } catch {}
  };

  const loadProfesionales = async () => {
    try {
      const data = await fetch(`${API}/monitoreo/medicos_mapa`).then((r) => r.json());
      if (!data.ok) { setProfesionales([]); return; }
      setProfesionales(
        (data.profesionales || []).map((p: any) => ({
          id: p.id,
          nombre: p.nombre,
          tipo: p.tipo,
          telefono: p.telefono ?? "",
          matricula: p.matricula,
          disponible: p.disponible ?? true,
        }))
      );
      setLastUpdate(new Date());
    } catch {
      setProfesionales([]);
    }
  };

  useEffect(() => {
    loadAll();
    loadProfesionales();
    const i = setInterval(loadProfesionales, 15000);
    return () => clearInterval(i);
  }, []);

  const now = lastUpdate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            Panel de Monitoreo
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Estado operativo en tiempo real — DocYa
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <RefreshCw size={12} />
          <span>Actualizado {now}</span>
          <div className="pulse-dot ml-1" />
        </div>
      </div>

      {/* KPIs row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard icon={Stethoscope} label="Médicos conectados" value={medicosConectados} />
        <KpiCard icon={UserRound} label="Enfermeros" value={enfermerosConectados} accent="#3b82f6" />
        <KpiCard icon={Activity} label="Consultas en curso" value={resumen?.consultas_en_curso} accent="#f59e0b" />
        <KpiCard icon={Clock} label="Consultas hoy" value={resumen?.consultas_hoy} />
        <KpiCard icon={Users} label="Pacientes" value={resumen?.total_usuarios} accent="#8b5cf6" />
        <KpiCard icon={Timer} label="Llegada prom." value={tiempoLlegada ? `${tiempoLlegada} min` : "—"} />
      </div>

      {/* KPIs row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={HeartPulse} label="Total médicos registrados" value={resumen?.total_medicos} />
        <KpiCard icon={UserRound} label="Total enfermeros registrados" value={resumen?.total_enfermeros} accent="#3b82f6" />
        <KpiCard icon={Clock} label="Atención promedio" value={tiempoAtencion ? `${tiempoAtencion} min` : "—"} />
      </div>

      {/* Map section */}
      <div className="glass-card overflow-hidden">
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.2)" }}>
              <MapPinned size={16} style={{ color: "var(--brand-primary)" }} />
            </div>
            <div>
              <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                Profesionales activos con ubicación
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Actualización automática cada 15 segundos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-teal">{medicosConectados} médicos</span>
            <span className="badge badge-blue">{enfermerosConectados} enfermeros</span>
          </div>
        </div>

        <div className="p-4">
          <div className="h-72 md:h-96 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
            <Map />
          </div>
        </div>

        {/* Professionals table */}
        {profesionales.length > 0 && (
          <div className="border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Matrícula</th>
                    <th>Teléfono</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {profesionales.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium" style={{ color: "var(--text-primary)" }}>{p.nombre}</td>
                      <td><StatusBadge tipo={p.tipo} /></td>
                      <td>{p.matricula || "—"}</td>
                      <td>{p.telefono || "—"}</td>
                      <td>
                        <button
                          title="Desconectar"
                          onClick={() => desconectar(p)}
                          className="p-1.5 rounded-md transition-colors hover:bg-red-500/10"
                          style={{ color: "#f87171" }}
                        >
                          <WifiOff size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {profesionales.length === 0 && (
          <div className="px-6 pb-6">
            <div
              className="rounded-xl p-6 text-center"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed var(--border-subtle)" }}
            >
              <MapPinned size={24} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No hay profesionales activos con ubicación en este momento
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
