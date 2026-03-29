"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import {
  Wallet,
  TrendingUp,
  X,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Users,
  AlertCircle,
  ChevronRight,
  Send,
  RefreshCw,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE!;

type PreviewMedico = {
  medico_id: number;
  medico: string;
  resumen: {
    cantidad_consultas: number;
    total_efectivo: number;
    total_digital: number;
    docya_comision_total: number;
    a_pagar_medico: number;
  };
};

type Liquidacion = {
  id: number;
  medico: string;
  semana_inicio: string;
  semana_fin: string;
  neto_mp: number;
  comision_efectivo: number;
  monto_final: number;
  estado: string;
};

function fmt(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

// ─── Balance badge ────────────────────────────────────────────────────────────
function BalanceBadge({ valor }: { valor: number }) {
  if (valor > 0)
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
        style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" }}
      >
        <ArrowDownLeft size={11} />
        DocYa paga ${fmt(valor)}
      </span>
    );
  if (valor < 0)
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
        style={{ background: "rgba(251,113,133,0.12)", color: "#f87171", border: "1px solid rgba(251,113,133,0.25)" }}
      >
        <ArrowUpRight size={11} />
        Debe a DocYa ${fmt(Math.abs(valor))}
      </span>
    );
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: "rgba(148,163,184,0.1)", color: "#94a3b8", border: "1px solid rgba(148,163,184,0.2)" }}
    >
      Sin saldo
    </span>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function ModalLiquidacion({
  liq,
  onClose,
}: {
  liq: Liquidacion;
  onClose: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const enviar = async () => {
    setEnviando(true);
    try {
      await fetch(`${API}/monitoreo/liquidaciones/${liq.id}/enviar`, { method: "POST" });
      setEnviado(true);
      setTimeout(onClose, 1200);
    } finally {
      setEnviando(false);
    }
  };

  const balancePositivo = liq.monto_final >= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(4,13,18,0.92)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-full max-w-md overflow-hidden"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{ background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.2)" }}
            >
              <Wallet size={15} style={{ color: "var(--brand-primary)" }} />
            </div>
            <div>
              <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                Detalle de liquidación
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {liq.semana_inicio} → {liq.semana_fin}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Profesional */}
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)" }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: "rgba(20,184,166,0.15)", color: "var(--brand-primary)" }}
            >
              {liq.medico.charAt(0).toUpperCase()}
            </div>
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>
              {liq.medico}
            </span>
          </div>

          {/* Desglose */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--border-subtle)" }}
          >
            {/* Digital row */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: "var(--border-subtle)", background: "rgba(34,197,94,0.04)" }}
            >
              <div className="flex items-center gap-2">
                <ArrowDownLeft size={14} style={{ color: "#4ade80" }} />
                <div>
                  <p className="text-xs font-medium" style={{ color: "#4ade80" }}>
                    Cobros digitales (App / MP)
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    DocYa le debe el 80%
                  </p>
                </div>
              </div>
              <span className="font-bold text-sm" style={{ color: "#4ade80" }}>
                +${fmt(liq.neto_mp)}
              </span>
            </div>

            {/* Efectivo row */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ background: "rgba(251,113,133,0.04)" }}
            >
              <div className="flex items-center gap-2">
                <ArrowUpRight size={14} style={{ color: "#f87171" }} />
                <div>
                  <p className="text-xs font-medium" style={{ color: "#f87171" }}>
                    Cobros en efectivo
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    20% que debe a DocYa
                  </p>
                </div>
              </div>
              <span className="font-bold text-sm" style={{ color: "#f87171" }}>
                -${fmt(liq.comision_efectivo)}
              </span>
            </div>
          </div>

          {/* Net balance */}
          <div
            className="rounded-xl px-4 py-4 flex items-center justify-between"
            style={{
              background: balancePositivo ? "rgba(34,197,94,0.08)" : "rgba(251,113,133,0.08)",
              border: `1px solid ${balancePositivo ? "rgba(34,197,94,0.25)" : "rgba(251,113,133,0.25)"}`,
            }}
          >
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Balance neto
              </p>
              <p
                className="text-xl font-bold mt-0.5"
                style={{ color: balancePositivo ? "#4ade80" : "#f87171" }}
              >
                {balancePositivo ? "" : "-"}${fmt(Math.abs(liq.monto_final))}
              </p>
            </div>
            <BalanceBadge valor={liq.monto_final} />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex gap-2 px-6 py-4 border-t"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">
            Cerrar
          </button>
          <button
            onClick={enviar}
            disabled={enviando || enviado}
            className="btn-primary flex-1 justify-center"
          >
            {enviado ? (
              <>
                <CheckCircle2 size={14} /> Enviado
              </>
            ) : enviando ? (
              "Enviando..."
            ) : (
              <>
                <Send size={14} /> Notificar al profesional
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LiquidacionesPage() {
  const [preview, setPreview] = useState<PreviewMedico[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [liquidacionActiva, setLiquidacionActiva] = useState<Liquidacion | null>(null);

  const loadPreview = () =>
    fetch(`${API}/monitoreo/liquidaciones/preview_semana_actual`)
      .then((r) => r.json())
      .then((d) => setPreview(d.medicos || []));

  const loadLiquidaciones = () =>
    fetch(`${API}/monitoreo/liquidaciones`)
      .then((r) => r.json())
      .then((d) => setLiquidaciones(d.liquidaciones || []));

  useEffect(() => {
    loadPreview();
    loadLiquidaciones();
  }, []);

  const generarSemanaAnterior = async () => {
    setLoading(true);
    try {
      await fetch(`${API}/monitoreo/liquidaciones/generar_semana_anterior`, { method: "POST" });
      await loadLiquidaciones();
    } finally {
      setLoading(false);
    }
  };

  // KPI aggregates
  const totalConsultas = preview.reduce((a, m) => a + m.resumen.cantidad_consultas, 0);
  const totalDigital = preview.reduce((a, m) => a + m.resumen.total_digital, 0);
  const totalEfectivo = preview.reduce((a, m) => a + m.resumen.total_efectivo, 0);
  const totalDocyaPaga = preview.filter((m) => m.resumen.a_pagar_medico > 0).reduce((a, m) => a + m.resumen.a_pagar_medico, 0);
  const totalDocyaCobra = preview.filter((m) => m.resumen.a_pagar_medico < 0).reduce((a, m) => a + Math.abs(m.resumen.a_pagar_medico), 0);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-base)" }}>
      <Sidebar />

      <main className="flex-1 p-5 md:p-7 pt-16 md:pt-7 space-y-7 overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              Liquidaciones
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Gestión de pagos y deudas con profesionales
            </p>
          </div>
          <button onClick={generarSemanaAnterior} disabled={loading} className="btn-primary">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {loading ? "Generando..." : "Cerrar semana anterior"}
          </button>
        </div>

        {/* Reglas de negocio */}
        <div
          className="rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="p-2 rounded-lg flex-shrink-0 mt-0.5"
              style={{ background: "rgba(251,113,133,0.12)", border: "1px solid rgba(251,113,133,0.2)" }}
            >
              <ArrowUpRight size={14} style={{ color: "#f87171" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#f87171" }}>
                Cobros en efectivo
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                El profesional cobra el 100% en mano. <strong style={{ color: "var(--text-secondary)" }}>Debe a DocYa el 20%</strong> de esas consultas.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div
              className="p-2 rounded-lg flex-shrink-0 mt-0.5"
              style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.2)" }}
            >
              <ArrowDownLeft size={14} style={{ color: "#4ade80" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#4ade80" }}>
                Cobros digitales (App / MP)
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                DocYa recibe el pago. <strong style={{ color: "var(--text-secondary)" }}>Le debe al profesional el 80%</strong> neto de esas consultas.
              </p>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg" style={{ background: "rgba(20,184,166,0.1)" }}>
                <Users size={14} style={{ color: "var(--brand-primary)" }} />
              </div>
              <span className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
                Profesionales
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {preview.length}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>activos esta semana</p>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg" style={{ background: "rgba(139,92,246,0.1)" }}>
                <DollarSign size={14} style={{ color: "#a78bfa" }} />
              </div>
              <span className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
                Consultas
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {totalConsultas}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              ${fmt(totalDigital)} digital · ${fmt(totalEfectivo)} efectivo
            </p>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg" style={{ background: "rgba(34,197,94,0.1)" }}>
                <ArrowDownLeft size={14} style={{ color: "#4ade80" }} />
              </div>
              <span className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
                DocYa paga
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: "#4ade80" }}>
              ${fmt(totalDocyaPaga)}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>a profesionales con saldo positivo</p>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg" style={{ background: "rgba(251,113,133,0.1)" }}>
                <ArrowUpRight size={14} style={{ color: "#f87171" }} />
              </div>
              <span className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
                DocYa cobra
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: "#f87171" }}>
              ${fmt(totalDocyaCobra)}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>deuda acumulada de profesionales</p>
          </div>
        </div>

        {/* Preview tabla */}
        <div className="glass-card overflow-hidden">
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-lg"
                style={{ background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.2)" }}
              >
                <TrendingUp size={14} style={{ color: "var(--brand-primary)" }} />
              </div>
              <div>
                <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                  Semana actual — preview
                </h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Datos acumulados hasta ahora
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Profesional</th>
                  <th className="text-center">Consultas</th>
                  <th className="text-center">
                    <span className="flex items-center justify-center gap-1">
                      <ArrowUpRight size={11} style={{ color: "#f87171" }} />
                      Efectivo cobrado
                    </span>
                  </th>
                  <th className="text-center" style={{ color: "#f87171" }}>
                    Debe a DocYa (20%)
                  </th>
                  <th className="text-center">
                    <span className="flex items-center justify-center gap-1">
                      <ArrowDownLeft size={11} style={{ color: "#4ade80" }} />
                      Digital cobrado
                    </span>
                  </th>
                  <th className="text-center" style={{ color: "#4ade80" }}>
                    DocYa le debe (80%)
                  </th>
                  <th className="text-center">Balance neto</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((m) => {
                  const debeADocya = m.resumen.docya_comision_total;
                  const docyaLeDebe = m.resumen.total_digital * 0.8;
                  return (
                    <tr key={m.medico_id}>
                      <td className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {m.medico}
                      </td>
                      <td className="text-center">{m.resumen.cantidad_consultas}</td>

                      {/* Efectivo */}
                      <td className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                        {m.resumen.total_efectivo > 0 ? `$${fmt(m.resumen.total_efectivo)}` : "—"}
                      </td>
                      <td className="text-center">
                        {debeADocya > 0 ? (
                          <span className="text-sm font-semibold" style={{ color: "#f87171" }}>
                            -${fmt(debeADocya)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>

                      {/* Digital */}
                      <td className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                        {m.resumen.total_digital > 0 ? `$${fmt(m.resumen.total_digital)}` : "—"}
                      </td>
                      <td className="text-center">
                        {docyaLeDebe > 0 ? (
                          <span className="text-sm font-semibold" style={{ color: "#4ade80" }}>
                            +${fmt(docyaLeDebe)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>

                      {/* Balance neto */}
                      <td className="text-center">
                        <BalanceBadge valor={m.resumen.a_pagar_medico} />
                      </td>
                    </tr>
                  );
                })}
                {preview.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10" style={{ color: "var(--text-muted)" }}>
                      <AlertCircle size={20} className="mx-auto mb-2 opacity-40" />
                      No hay consultas registradas esta semana aún
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Histórico */}
        <div className="glass-card overflow-hidden">
          <div
            className="flex items-center gap-3 px-5 py-4 border-b"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <div
              className="p-2 rounded-lg"
              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}
            >
              <Clock size={14} style={{ color: "#f59e0b" }} />
            </div>
            <div>
              <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                Historial de liquidaciones
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Semanas cerradas anteriores
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Profesional</th>
                  <th>Período</th>
                  <th className="text-center" style={{ color: "#4ade80" }}>DocYa debía (digital 80%)</th>
                  <th className="text-center" style={{ color: "#f87171" }}>Cobros efectivo (20%)</th>
                  <th className="text-center">Balance</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {liquidaciones.map((l) => (
                  <tr key={l.id}>
                    <td className="font-medium" style={{ color: "var(--text-primary)" }}>
                      {l.medico}
                    </td>
                    <td>
                      <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                        {l.semana_inicio} → {l.semana_fin}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="text-sm font-semibold" style={{ color: "#4ade80" }}>
                        +${fmt(l.neto_mp)}
                      </span>
                    </td>
                    <td className="text-center">
                      {l.comision_efectivo > 0 ? (
                        <span className="text-sm font-semibold" style={{ color: "#f87171" }}>
                          -${fmt(l.comision_efectivo)}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td className="text-center">
                      <BalanceBadge valor={l.monto_final} />
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          l.estado === "pagado"
                            ? "badge-teal"
                            : l.estado === "pendiente"
                            ? "badge-yellow"
                            : "badge-blue"
                        }`}
                      >
                        {l.estado === "pagado" ? "✓ Pagado" : l.estado === "pendiente" ? "Pendiente" : l.estado}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => setLiquidacionActiva(l)}
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors"
                        style={{
                          background: "rgba(20,184,166,0.07)",
                          color: "var(--brand-primary)",
                          border: "1px solid rgba(20,184,166,0.18)",
                        }}
                      >
                        Ver <ChevronRight size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
                {liquidaciones.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10" style={{ color: "var(--text-muted)" }}>
                      <AlertCircle size={20} className="mx-auto mb-2 opacity-40" />
                      No hay liquidaciones cerradas aún
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {liquidacionActiva && (
        <ModalLiquidacion liq={liquidacionActiva} onClose={() => setLiquidacionActiva(null)} />
      )}
    </div>
  );
}
