"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import {
  Wallet,
  Home,
  Video,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE!;

// ─── Types ───────────────────────────────────────────────────────────────────

type Profesional = {
  id: number;
  nombre: string;
  tipo: string;
  alias_cbu: string;
  saldo: number;
  domicilio_cantidad: number;
  domicilio_neto: number;
  domicilio_comision: number;
  tele_cantidad: number;
  tele_neto: number;
  tele_comision: number;
  ultima_liquidacion: string | null;
  ultimo_monto: number | null;
};

type Liquidacion = {
  id: number;
  periodo_inicio: string;
  periodo_fin: string;
  monto_pagado: number;
  fecha: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("docya_token") : null;
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function pesos(n: number) {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Modal liquidar ───────────────────────────────────────────────────────────

function ModalLiquidar({
  prof,
  onClose,
  onDone,
}: {
  prof: Profesional;
  onClose: () => void;
  onDone: () => void;
}) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFin, setPeriodoFin] = useState(hoy);
  const [monto, setMonto] = useState(String(Math.max(0, Math.round(prof.saldo))));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!periodoInicio || !periodoFin || !monto) {
      setError("Completá todos los campos.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/medicos/${prof.id}/liquidar`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          periodo_inicio: periodoInicio,
          periodo_fin: periodoFin,
          monto_pagado: parseFloat(monto),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.detail ?? "Error al registrar.");
        return;
      }
      onDone();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-md rounded-xl p-6 space-y-4"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
              Registrar liquidación
            </h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {prof.nombre} — Saldo actual: <span style={{ color: "var(--brand-primary-light)" }}>{pesos(prof.saldo)}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-white/5" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Período desde</label>
            <input
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Período hasta</label>
            <input
              type="date"
              value={periodoFin}
              onChange={(e) => setPeriodoFin(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Monto a pagar ($)</label>
            <input
              type="number"
              min={0}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
            />
          </div>
          {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm hover:bg-white/5"
            style={{ border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--brand-primary)", color: "#fff" }}
          >
            {loading ? "Guardando…" : "Confirmar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fila con historial expandible ───────────────────────────────────────────

function FilaProfesional({
  prof,
  onLiquidar,
}: {
  prof: Profesional;
  onLiquidar: (p: Profesional) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [historial, setHistorial] = useState<Liquidacion[]>([]);
  const [loadingH, setLoadingH] = useState(false);

  const totalConsultas = prof.domicilio_cantidad + prof.tele_cantidad;
  const totalNeto = prof.domicilio_neto + prof.tele_neto;
  const saldoPositivo = prof.saldo > 0;

  const loadHistorial = async () => {
    if (historial.length) return;
    setLoadingH(true);
    try {
      const res = await fetch(`${API}/admin/liquidaciones/historial/${prof.id}`, { headers: authHeaders() });
      if (res.ok) setHistorial(await res.json());
    } finally {
      setLoadingH(false);
    }
  };

  const handleExpand = () => {
    setExpanded((v) => !v);
    if (!expanded) loadHistorial();
  };

  return (
    <>
      <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        {/* Nombre */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{prof.nombre}</p>
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  background: prof.tipo === "medico" ? "rgba(20,184,166,0.12)" : "rgba(139,92,246,0.12)",
                  color: prof.tipo === "medico" ? "var(--brand-primary-light)" : "#a78bfa",
                }}
              >
                {prof.tipo === "medico" ? "Médico" : "Enfermero"}
              </span>
            </div>
          </div>
          {prof.alias_cbu && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>CBU: {prof.alias_cbu}</p>
          )}
        </td>

        {/* Domicilio */}
        <td className="px-4 py-3">
          {prof.domicilio_cantidad > 0 ? (
            <div className="flex items-center gap-1.5">
              <Home size={13} style={{ color: "var(--text-muted)" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{pesos(prof.domicilio_neto)}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{prof.domicilio_cantidad} consulta{prof.domicilio_cantidad !== 1 ? "s" : ""}</p>
              </div>
            </div>
          ) : (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
          )}
        </td>

        {/* Teleconsulta */}
        <td className="px-4 py-3">
          {prof.tele_cantidad > 0 ? (
            <div className="flex items-center gap-1.5">
              <Video size={13} style={{ color: "var(--brand-primary)" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {prof.tele_neto > 0 ? pesos(prof.tele_neto) : "—"}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{prof.tele_cantidad} teleconsulta{prof.tele_cantidad !== 1 ? "s" : ""}</p>
              </div>
            </div>
          ) : (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
          )}
        </td>

        {/* Saldo */}
        <td className="px-4 py-3">
          <span
            className="text-sm font-bold"
            style={{ color: saldoPositivo ? "var(--brand-primary-light)" : "#f87171" }}
          >
            {pesos(prof.saldo)}
          </span>
          {prof.ultima_liquidacion && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Últ. liq: {fmtDate(prof.ultima_liquidacion)}
            </p>
          )}
        </td>

        {/* Acciones */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={() => onLiquidar(prof)}
              disabled={prof.saldo <= 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: "var(--brand-primary)", color: "#fff" }}
            >
              <Check size={12} /> Liquidar
            </button>
            <button
              onClick={handleExpand}
              className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </td>
      </tr>

      {/* Historial expandible */}
      {expanded && (
        <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <td colSpan={5} className="px-6 pb-4 pt-1">
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Historial de liquidaciones</p>
            {loadingH ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Cargando…</p>
            ) : historial.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Sin liquidaciones registradas.</p>
            ) : (
              <div className="space-y-1.5">
                {historial.map((liq) => (
                  <div
                    key={liq.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
                    style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>
                      {fmtDate(liq.periodo_inicio)} → {fmtDate(liq.periodo_fin)}
                    </span>
                    <span className="font-semibold" style={{ color: "var(--brand-primary-light)" }}>
                      {pesos(liq.monto_pagado)}
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>{fmtDate(liq.fecha)}</span>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LiquidacionesPage() {
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalProf, setModalProf] = useState<Profesional | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/liquidaciones/resumen`, { headers: authHeaders() });
      if (res.ok) setProfesionales(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const totalAPagar = profesionales.filter((p) => p.saldo > 0).reduce((a, p) => a + p.saldo, 0);
  const conSaldo = profesionales.filter((p) => p.saldo > 0).length;
  const totalTele = profesionales.reduce((a, p) => a + p.tele_cantidad, 0);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--main-bg)" }}>
      <Sidebar />

      <main className="flex-1 px-4 md:px-8 py-8 pt-20 md:pt-8 overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Liquidaciones</h1>
          <button
            onClick={fetchData}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <RefreshCw size={16} />
          </button>
        </div>
        <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
          Saldos y pagos a profesionales — domicilio y teleconsultas
        </p>

        {/* ── Resumen ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total a pagar", value: pesos(totalAPagar), icon: Wallet, color: "var(--brand-primary-light)" },
            { label: "Profesionales con saldo", value: conSaldo, icon: Check, color: "var(--brand-primary-light)" },
            { label: "Teleconsultas totales", value: totalTele, icon: Video, color: "#a78bfa" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="rounded-xl px-5 py-4 flex items-center gap-4"
              style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(20,184,166,0.1)" }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tabla ── */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)", background: "var(--card-bg)" }}>
          {loading ? (
            <p className="p-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>Cargando…</p>
          ) : profesionales.length === 0 ? (
            <p className="p-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>
              Sin profesionales con saldo pendiente.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {["Profesional", "Domicilio", "Teleconsulta", "Saldo actual", ""].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profesionales.map((p) => (
                  <FilaProfesional
                    key={p.id}
                    prof={p}
                    onLiquidar={setModalProf}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {modalProf && (
        <ModalLiquidar
          prof={modalProf}
          onClose={() => setModalProf(null)}
          onDone={() => {
            setModalProf(null);
            showToast("Liquidación registrada correctamente");
            fetchData();
          }}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg"
          style={{
            background: toast.ok ? "rgba(20,184,166,0.2)" : "rgba(239,68,68,0.2)",
            border: `1px solid ${toast.ok ? "rgba(20,184,166,0.4)" : "rgba(239,68,68,0.4)"}`,
            color: toast.ok ? "var(--brand-primary-light)" : "#f87171",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
