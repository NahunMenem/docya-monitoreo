"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import {
  Link2, Users, DollarSign, Copy, Check, ToggleLeft, ToggleRight,
  X, ExternalLink, CreditCard, Clock, CheckCircle2, AlertCircle,
  ChevronRight,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE!;

// ─── Types ────────────────────────────────────────────────────────────────────

type Referente = {
  id: string;
  full_name: string;
  email: string;
  telefono: string;
  dni: string;
  tipo: "influencer" | "embajador" | "paciente" | "partner";
  codigo_referido: string;
  link_referido: string;
  cbu_alias: string;
  activo: boolean;
  creado_en: string;
};


type Recompensa = {
  id: number;
  referente_id: string;
  referente_nombre: string;
  referente_cbu: string;
  paciente_nombre: string;
  monto_referente: number;
  estado: "pendiente" | "pagado";
  creado_en: string;
  consulta_id?: number;
};

type ReferidoAdmin = {
  id: string;
  full_name: string;
  email: string;
  localidad: string;
  fecha_registro: string;
  monto_total: number;
  total_consultas: number;
  ultima_consulta: string | null;
  estado: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIPO_COLORS: Record<string, { bg: string; color: string }> = {
  influencer: { bg: "rgba(168,85,247,0.15)",  color: "#c084fc" },
  embajador:  { bg: "rgba(20,184,166,0.15)",  color: "#2dd4bf" },
  paciente:   { bg: "rgba(59,130,246,0.15)",  color: "#60a5fa" },
  partner:    { bg: "rgba(245,158,11,0.15)",  color: "#fbbf24" },
};

const ESTADO_COLORS: Record<string, { bg: string; color: string }> = {
  pendiente:    { bg: "rgba(245,158,11,0.15)",  color: "#fbbf24" },
  pagado:       { bg: "rgba(20,184,166,0.15)",  color: "#2dd4bf" },
  sin_consulta: { bg: "rgba(100,116,139,0.15)", color: "#94a3b8" },
};

function adminHeaders() {
  const key = process.env.NEXT_PUBLIC_ADMIN_API_KEY ?? "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── CopyButton ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1 rounded transition-colors hover:bg-white/5"
      style={{ color: copied ? "#2dd4bf" : "var(--text-muted)" }}
      title="Copiar"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

// ─── Referidos Modal ──────────────────────────────────────────────────────────

function ReferidosModal({ referente, onClose }: { referente: Referente; onClose: () => void }) {
  const [referidos, setReferidos] = useState<ReferidoAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/referidos/admin/referentes/${referente.id}/referidos`, { headers: adminHeaders() })
      .then((r) => r.json())
      .then((data) => setReferidos(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [referente.id]);

  const totalConsultas = referidos.reduce((s, r) => s + r.total_consultas, 0);
  const montoTotal     = referidos.reduce((s, r) => s + Number(r.monto_total), 0);
  const montoPendiente = referidos.filter((r) => r.estado === "pendiente").reduce((s, r) => s + Number(r.monto_total), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl flex flex-col max-h-[90vh]"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
          <div>
            <h2 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>{referente.full_name}</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Código: <span style={{ color: "var(--brand-primary)" }}>{referente.codigo_referido}</span>
              &nbsp;·&nbsp;{referente.email}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/5 transition-colors" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {loading ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>Cargando…</p>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Consultas generadas",  value: totalConsultas,                                         color: "#60a5fa" },
                  { label: "Total acumulado",       value: `$${montoTotal.toLocaleString("es-AR")}`,              color: "#4ade80" },
                  { label: "Pendiente de cobro",    value: `$${montoPendiente.toLocaleString("es-AR")}`,          color: "#fbbf24" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl p-4 text-center"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)" }}>
                    <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                    <p className="text-xl font-bold" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Pacientes referidos */}
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                  Pacientes referidos ({referidos.length})
                </h3>
                {referidos.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>Sin referidos aún</p>
                ) : (
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          {["Paciente", "Email", "Registro", "Consultas", "Monto total", "Estado"].map((h) => (
                            <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide"
                              style={{ color: "var(--text-muted)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {referidos.map((r) => {
                          const estadoKey = r.estado ?? "sin_consulta";
                          const estadoStyle = ESTADO_COLORS[estadoKey] ?? ESTADO_COLORS.sin_consulta;
                          return (
                            <tr key={r.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                              <td className="px-3 py-2.5 font-medium" style={{ color: "var(--text-primary)" }}>{r.full_name}</td>
                              <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>{r.email}</td>
                              <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>{fmt(r.fecha_registro)}</td>
                              <td className="px-3 py-2.5 text-xs text-center" style={{ color: "var(--text-muted)" }}>{r.total_consultas}</td>
                              <td className="px-3 py-2.5 font-semibold text-xs" style={{ color: r.monto_total > 0 ? "#4ade80" : "var(--text-muted)" }}>
                                {r.monto_total > 0 ? `$${Number(r.monto_total).toLocaleString("es-AR")}` : "—"}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{ background: estadoStyle.bg, color: estadoStyle.color }}>
                                  {estadoKey === "sin_consulta" ? "Sin consulta" : estadoKey}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab Pagos ────────────────────────────────────────────────────────────────

type PagoGroup = {
  referente_id: string;
  referente_nombre: string;
  referente_cbu: string;
  recompensas: Recompensa[];
  monto_pendiente: number;
  monto_pagado: number;
};

function TabPagos({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [recompensas, setRecompensas] = useState<Recompensa[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | "pendiente" | "pagado">("todos");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState<Set<number>>(new Set());

  async function fetchRecompensas() {
    setLoading(true);
    try {
      const url = filtro === "todos"
        ? `${API}/referidos/admin/recompensas`
        : `${API}/admin/recompensas?estado=${filtro}`;
      const res = await fetch(url, { headers: adminHeaders() });
      const data = await res.json();
      setRecompensas(Array.isArray(data) ? data : (data.recompensas ?? []));
    } catch {
      showToast("Error al cargar recompensas", false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRecompensas(); }, [filtro]);

  async function pagarRecompensa(id: number) {
    setPaying((p) => new Set(p).add(id));
    try {
      const res = await fetch(`${API}/referidos/admin/recompensas/${id}/pagar`, {
        method: "PATCH",
        headers: adminHeaders(),
      });
      if (!res.ok) { showToast("Error al marcar como pagado", false); return; }
      showToast("Marcado como pagado");
      fetchRecompensas();
    } finally {
      setPaying((p) => { const n = new Set(p); n.delete(id); return n; });
    }
  }

  async function pagarTodos(referente_id: string, nombre: string) {
    if (!confirm(`¿Marcar todos los pendientes de ${nombre} como pagados?`)) return;
    const res = await fetch(`${API}/referidos/admin/referentes/${referente_id}/pagar-pendientes`, {
      method: "PATCH",
      headers: adminHeaders(),
    });
    if (!res.ok) { showToast("Error al procesar pagos", false); return; }
    const data = await res.json();
    showToast(`${data.pagados ?? 0} recompensas marcadas como pagadas`);
    fetchRecompensas();
  }

  // Agrupar por referente
  const groups: PagoGroup[] = Object.values(
    recompensas.reduce<Record<string, PagoGroup>>((acc, r) => {
      if (!acc[r.referente_id]) {
        acc[r.referente_id] = {
          referente_id: r.referente_id,
          referente_nombre: r.referente_nombre,
          referente_cbu: r.referente_cbu,
          recompensas: [],
          monto_pendiente: 0,
          monto_pagado: 0,
        };
      }
      acc[r.referente_id].recompensas.push(r);
      if (r.estado === "pendiente") acc[r.referente_id].monto_pendiente += r.monto_referente;
      else acc[r.referente_id].monto_pagado += r.monto_referente;
      return acc;
    }, {})
  );

  const totalPendiente = groups.reduce((s, g) => s + g.monto_pendiente, 0);
  const totalPagado    = groups.reduce((s, g) => s + g.monto_pagado, 0);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Clock,         label: "Total pendiente",  value: `$${totalPendiente.toLocaleString("es-AR")}`,  color: "#fbbf24" },
          { icon: CheckCircle2,  label: "Total pagado",     value: `$${totalPagado.toLocaleString("es-AR")}`,     color: "#4ade80" },
          { icon: CreditCard,    label: "Referentes con deuda", value: groups.filter((g) => g.monto_pendiente > 0).length, color: "#c084fc" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-xl p-5" style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                <Icon size={16} style={{ color }} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Filtrar:</span>
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border-subtle)" }}>
          {(["todos", "pendiente", "pagado"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className="px-3 py-1.5 text-xs font-medium capitalize transition-colors"
              style={{
                background: filtro === f ? "var(--brand-primary)" : "transparent",
                color: filtro === f ? "#040d12" : "var(--text-muted)",
              }}
            >
              {f === "todos" ? "Todos" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Grupos por referente */}
      {loading ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>Cargando…</p>
      ) : groups.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ border: "1px dashed var(--border-subtle)" }}>
          <CreditCard size={28} className="mx-auto mb-3 opacity-30" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No hay recompensas registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const isOpen = expanded.has(g.referente_id);
            const tienePendientes = g.monto_pendiente > 0;
            return (
              <div key={g.referente_id} className="rounded-xl overflow-hidden"
                style={{ border: "1px solid var(--border-subtle)", background: "var(--card-bg)" }}>

                {/* Cabecera del grupo */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => toggleExpand(g.referente_id)}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{g.referente_nombre}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{g.referente_cbu}</span>
                        <CopyButton text={g.referente_cbu} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {tienePendientes && (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                          style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.25)" }}>
                          Pendiente: ${g.monto_pendiente.toLocaleString("es-AR")}
                        </span>
                      )}
                      {g.monto_pagado > 0 && (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                          style={{ background: "rgba(20,184,166,0.1)", color: "#2dd4bf", border: "1px solid rgba(20,184,166,0.2)" }}>
                          Pagado: ${g.monto_pagado.toLocaleString("es-AR")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {tienePendientes && (
                      <button
                        onClick={(e) => { e.stopPropagation(); pagarTodos(g.referente_id, g.referente_nombre); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                        style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}
                      >
                        <CheckCircle2 size={13} />
                        Pagar todo pendiente
                      </button>
                    )}
                    <ChevronRight size={16} className="transition-transform"
                      style={{ color: "var(--text-muted)", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }} />
                  </div>
                </div>

                {/* Detalle de recompensas */}
                {isOpen && (
                  <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          {["Paciente", "Fecha consulta", "Monto", "Estado", ""].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide"
                              style={{ color: "var(--text-muted)", background: "rgba(0,0,0,0.15)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {g.recompensas.map((rec) => (
                          <tr key={rec.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                            <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>
                              {rec.paciente_nombre}
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                              {fmt(rec.creado_en)}
                            </td>
                            <td className="px-4 py-3 font-semibold text-sm" style={{ color: "#4ade80" }}>
                              ${rec.monto_referente.toLocaleString("es-AR")}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{
                                  background: ESTADO_COLORS[rec.estado]?.bg,
                                  color: ESTADO_COLORS[rec.estado]?.color,
                                }}>
                                {rec.estado === "pendiente" ? "Pendiente" : "Pagado"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {rec.estado === "pendiente" && (
                                <button
                                  onClick={() => pagarRecompensa(rec.id)}
                                  disabled={paying.has(rec.id)}
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-opacity disabled:opacity-50 hover:opacity-80 ml-auto"
                                  style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}
                                >
                                  <Check size={11} />
                                  {paying.has(rec.id) ? "…" : "Marcar pagado"}
                                </button>
                              )}
                              {rec.estado === "pagado" && (
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>✓ Acreditado</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReferidosPage() {
  const [tab, setTab] = useState<"referentes" | "pagos">("referentes");
  const [referentes, setReferentes] = useState<Referente[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Referente | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function fetchReferentes() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/referidos/admin/referentes`, { headers: adminHeaders() });
      const data = await res.json();
      setReferentes(Array.isArray(data) ? data : []);
    } catch {
      showToast("Error al cargar referentes", false);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActivo(r: Referente) {
    const res = await fetch(`${API}/referidos/admin/referentes/${r.id}/toggle`, { method: "PATCH", headers: adminHeaders() });
    if (!res.ok) { showToast("Error al cambiar estado", false); return; }
    showToast(r.activo ? "Referente desactivado" : "Referente activado");
    fetchReferentes();
  }

  useEffect(() => { fetchReferentes(); }, []);

  const totalActivos = referentes.filter((r) => r.activo).length;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--main-bg)" }}>
      <Sidebar />

      <main className="flex-1 px-4 md:px-8 py-8 pt-20 md:pt-8 overflow-y-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Programa de Referidos</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Referentes, referidos y gestión de pagos
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)" }}>
          {([
            { key: "referentes", label: "Referentes",    icon: Link2     },
            { key: "pagos",      label: "Gestión pagos", icon: CreditCard },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: tab === key ? "var(--brand-primary)" : "transparent",
                color:      tab === key ? "#040d12"              : "var(--text-muted)",
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab Referentes ── */}
        {tab === "referentes" && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { icon: Link2,       label: "Total referentes", value: referentes.length, color: "var(--brand-primary)" },
                { icon: Users,       label: "Activos",          value: totalActivos,      color: "#4ade80"              },
                { icon: DollarSign,  label: "Tipos distintos",  value: [...new Set(referentes.map((r) => r.tipo))].length, color: "#fbbf24" },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="rounded-xl p-5" style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                      <Icon size={16} style={{ color }} />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</p>
                      <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tabla */}
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)", background: "var(--card-bg)" }}>
              {loading ? (
                <p className="p-8 text-sm text-center" style={{ color: "var(--text-muted)" }}>Cargando…</p>
              ) : referentes.length === 0 ? (
                <div className="p-12 text-center">
                  <Link2 size={28} className="mx-auto mb-3 opacity-30" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>No hay referentes registrados</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        {["Referente", "Tipo", "Código / Link", "CBU / Alias", "Registro", "Estado", ""].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                            style={{ color: "var(--text-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {referentes.map((r) => {
                        const tipoStyle = TIPO_COLORS[r.tipo] ?? TIPO_COLORS.embajador;
                        return (
                          <tr key={r.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                            <td className="px-4 py-3">
                              <p className="font-medium" style={{ color: "var(--text-primary)" }}>{r.full_name}</p>
                              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{r.email}</p>
                              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{r.telefono}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                                style={{ background: tipoStyle.bg, color: tipoStyle.color }}>
                                {r.tipo}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 mb-1">
                                <span className="font-mono text-xs font-semibold" style={{ color: "var(--brand-primary)" }}>{r.codigo_referido}</span>
                                <CopyButton text={r.codigo_referido} />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs truncate max-w-[160px]" style={{ color: "var(--text-muted)" }}>{r.link_referido}</span>
                                <CopyButton text={r.link_referido} />
                                <a href={r.link_referido} target="_blank" rel="noreferrer"
                                  className="p-1 rounded hover:bg-white/5 transition-colors" style={{ color: "var(--text-muted)" }}>
                                  <ExternalLink size={11} />
                                </a>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{r.cbu_alias}</span>
                                <CopyButton text={r.cbu_alias} />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{fmt(r.creado_en)}</td>
                            <td className="px-4 py-3">
                              <button onClick={() => toggleActivo(r)}
                                className="flex items-center gap-1.5 text-xs transition-colors"
                                style={{ color: r.activo ? "#4ade80" : "var(--text-muted)" }}>
                                {r.activo ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                <span>{r.activo ? "Activo" : "Inactivo"}</span>
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <button onClick={() => setSelected(r)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                                style={{ background: "rgba(20,184,166,0.1)", color: "var(--brand-primary)", border: "1px solid rgba(20,184,166,0.2)" }}>
                                Ver referidos
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab Pagos ── */}
        {tab === "pagos" && <TabPagos showToast={showToast} />}
      </main>

      {selected && <ReferidosModal referente={selected} onClose={() => setSelected(null)} />}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg"
          style={{
            background: toast.ok ? "rgba(20,184,166,0.2)" : "rgba(239,68,68,0.2)",
            border: `1px solid ${toast.ok ? "rgba(20,184,166,0.4)" : "rgba(239,68,68,0.4)"}`,
            color: toast.ok ? "var(--brand-primary-light)" : "#f87171",
          }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
