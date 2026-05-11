"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import Sidebar from "@/components/sidebar";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Home,
  ReceiptText,
  RefreshCw,
  Search,
  Video,
  Wallet,
  X,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE!;

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

type Filtro = "todos" | "pagar" | "cobrar" | "cero";
type Operacion = "pago_profesional" | "comision_recibida";

function authHeaders() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("docya_token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function pesos(n: number) {
  return "$" + Math.round(Math.abs(n)).toLocaleString("es-AR");
}

function pesosConSigno(n: number) {
  if (n < 0) return `-${pesos(n)}`;
  return pesos(n);
}

function fmtDate(s: string | null) {
  if (!s) return "-";
  return new Date(s).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function tipoLabel(tipo: string) {
  return tipo?.toLowerCase() === "enfermero" ? "Enfermero" : "Medico";
}

function consultaLabel(tipo: string, plural = true) {
  return tipo?.toLowerCase() === "enfermero"
    ? plural
      ? "servicios"
      : "servicio"
    : plural
      ? "consultas"
      : "consulta";
}

function ModalRegistrarMovimiento({
  prof,
  operacion,
  onClose,
  onDone,
}: {
  prof: Profesional;
  operacion: Operacion;
  onClose: () => void;
  onDone: () => void;
}) {
  const isComision = operacion === "comision_recibida";
  const saldoAbs = Math.abs(prof.saldo);
  const [periodoInicio, setPeriodoInicio] = useState(monthStartIso());
  const [periodoFin, setPeriodoFin] = useState(todayIso());
  const [monto, setMonto] = useState(String(Math.round(saldoAbs)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const title = isComision
    ? "Marcar comision recibida"
    : "Registrar pago al profesional";
  const description = isComision
    ? "Usa esta accion cuando el medico/enfermero ya transfirio a DocYa el 20% de lo cobrado en efectivo."
    : "Usa esta accion cuando DocYa ya le transfirio al profesional lo que estaba pendiente por pagos desde la app.";
  const submitLabel = isComision ? "Marcar como recibida" : "Marcar como pagada";
  const signedAmount = isComision
    ? -Math.abs(Number(monto || 0))
    : Math.abs(Number(monto || 0));

  const handleSubmit = async () => {
    const parsed = Number(monto);
    if (!periodoInicio || !periodoFin || !parsed || parsed <= 0) {
      setError("Completa periodo y monto.");
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
          monto_pagado: signedAmount,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.detail ?? "No se pudo registrar el movimiento.");
        return;
      }
      onDone();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-2xl p-6 shadow-2xl"
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span
                className="rounded-full px-3 py-1 text-xs font-bold"
                style={{
                  background: isComision
                    ? "rgba(245,158,11,0.14)"
                    : "rgba(20,184,166,0.14)",
                  color: isComision ? "#fbbf24" : "var(--brand-primary-light)",
                }}
              >
                {isComision ? "Comision DocYa" : "Pago profesional"}
              </span>
            </div>
            <h2
              className="text-xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {title}
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              {prof.nombre} - saldo actual{" "}
              <b style={{ color: isComision ? "#f87171" : "#2dd4bf" }}>
                {pesosConSigno(prof.saldo)}
              </b>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition hover:bg-white/5"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={18} />
          </button>
        </div>

        <p
          className="mb-5 rounded-xl px-4 py-3 text-sm leading-relaxed"
          style={{
            color: "var(--text-secondary)",
            background: "var(--input-bg)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {description}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Periodo desde
            </span>
            <input
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Periodo hasta
            </span>
            <input
              type="date"
              value={periodoFin}
              onChange={(e) => setPeriodoFin(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
              }}
            />
          </label>
        </div>

        <label className="mt-3 block space-y-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Monto ({isComision ? "transferido a DocYa" : "pagado"})
          </span>
          <input
            type="number"
            min={0}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          />
        </label>

        <div
          className="mt-4 rounded-xl px-4 py-3 text-xs"
          style={{
            color: "var(--text-muted)",
            background: isComision
              ? "rgba(245,158,11,0.08)"
              : "rgba(20,184,166,0.08)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          Se registrara en historial como{" "}
          <b style={{ color: "var(--text-primary)" }}>
            {pesosConSigno(signedAmount)}
          </b>
          . {isComision ? "Esto sube el saldo hacia cero." : "Esto baja el saldo hacia cero."}
        </div>

        {error && (
          <p className="mt-3 text-sm font-medium" style={{ color: "#f87171" }}>
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:bg-white/5"
            style={{
              border: "1px solid var(--border-subtle)",
              color: "var(--text-muted)",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-50"
            style={{
              background: isComision ? "#f59e0b" : "var(--brand-primary)",
              color: "#fff",
            }}
          >
            {loading ? "Guardando..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfesionalCard({
  prof,
  onRegistrar,
}: {
  prof: Profesional;
  onRegistrar: (p: Profesional, op: Operacion) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [historial, setHistorial] = useState<Liquidacion[]>([]);
  const [loadingH, setLoadingH] = useState(false);

  const isCobrarComision = prof.saldo < 0;
  const isPagarProfesional = prof.saldo > 0;
  const isCero = prof.saldo === 0;
  const totalNeto = prof.domicilio_neto + prof.tele_neto;
  const totalComision = prof.domicilio_comision + prof.tele_comision;
  const labelPlural = consultaLabel(prof.tipo);

  const loadHistorial = async () => {
    if (historial.length) return;
    setLoadingH(true);
    try {
      const res = await fetch(`${API}/admin/liquidaciones/historial/${prof.id}`, {
        headers: authHeaders(),
      });
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
    <article
      className="rounded-2xl p-4"
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className="truncate text-base font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {prof.nombre}
            </h3>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-bold"
              style={{
                background:
                  prof.tipo === "medico"
                    ? "rgba(20,184,166,0.13)"
                    : "rgba(139,92,246,0.13)",
                color:
                  prof.tipo === "medico"
                    ? "var(--brand-primary-light)"
                    : "#a78bfa",
              }}
            >
              {tipoLabel(prof.tipo)}
            </span>
            {isCobrarComision && (
              <span className="badge badge-yellow">Debe comision</span>
            )}
            {isPagarProfesional && (
              <span className="badge badge-teal">DocYa debe pagar</span>
            )}
            {isCero && <span className="badge badge-green">Al dia</span>}
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            ID #{prof.id}
            {prof.alias_cbu ? ` - Alias/CBU: ${prof.alias_cbu}` : " - Sin alias/CBU cargado"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[680px]">
          <MiniMetric
            icon={Home}
            label="Domicilio"
            value={pesos(prof.domicilio_neto)}
            detail={`${prof.domicilio_cantidad} ${labelPlural}`}
          />
          <MiniMetric
            icon={Video}
            label="Teleconsulta"
            value={prof.tele_cantidad > 0 ? pesos(prof.tele_neto) : "-"}
            detail={`${prof.tele_cantidad} teleconsultas`}
          />
          <MiniMetric
            icon={ReceiptText}
            label="Comision 20%"
            value={pesos(totalComision)}
            detail="DocYa generado"
            tone="yellow"
          />
          <MiniMetric
            icon={Wallet}
            label="Saldo actual"
            value={pesosConSigno(prof.saldo)}
            detail={isCobrarComision ? "A cobrar" : isPagarProfesional ? "A pagar" : "Cero"}
            tone={isCobrarComision ? "red" : isPagarProfesional ? "teal" : "green"}
          />
        </div>

        <div className="flex items-center gap-2 xl:w-[230px] xl:justify-end">
          {isCobrarComision ? (
            <button
              onClick={() => onRegistrar(prof, "comision_recibida")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition hover:opacity-90"
              style={{ background: "#f59e0b", color: "#fff" }}
            >
              <ArrowDownToLine size={16} />
              Marcar comision pagada
            </button>
          ) : (
            <button
              onClick={() => onRegistrar(prof, "pago_profesional")}
              disabled={!isPagarProfesional}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
              style={{ background: "var(--brand-primary)", color: "#fff" }}
            >
              <ArrowUpFromLine size={16} />
              Marcar pagado
            </button>
          )}
          <button
            onClick={handleExpand}
            className="rounded-xl p-2.5 transition hover:bg-white/5"
            style={{
              color: "var(--text-muted)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      <div
        className="mt-4 grid gap-3 rounded-xl p-3 md:grid-cols-3"
        style={{ background: "var(--input-bg)" }}
      >
        <InfoLine label="Total profesional neto" value={pesos(totalNeto)} />
        <InfoLine label="Comision DocYa generada" value={pesos(totalComision)} />
        <InfoLine
          label="Ultimo movimiento"
          value={
            prof.ultima_liquidacion
              ? `${fmtDate(prof.ultima_liquidacion)} - ${pesosConSigno(prof.ultimo_monto ?? 0)}`
              : "Sin movimientos"
          }
        />
      </div>

      {expanded && (
        <div className="mt-4">
          <p
            className="mb-2 text-xs font-bold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            Historial de movimientos
          </p>
          {loadingH ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Cargando...
            </p>
          ) : historial.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Sin movimientos registrados.
            </p>
          ) : (
            <div className="space-y-2">
              {historial.map((liq) => (
                <div
                  key={liq.id}
                  className="grid gap-2 rounded-xl px-3 py-2 text-xs md:grid-cols-3"
                  style={{
                    background: "var(--input-bg)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>
                    {fmtDate(liq.periodo_inicio)} - {fmtDate(liq.periodo_fin)}
                  </span>
                  <span
                    className="font-bold"
                    style={{
                      color:
                        liq.monto_pagado < 0
                          ? "#fbbf24"
                          : "var(--brand-primary-light)",
                    }}
                  >
                    {liq.monto_pagado < 0 ? "Comision recibida " : "Pago realizado "}
                    {pesosConSigno(liq.monto_pagado)}
                  </span>
                  <span className="md:text-right" style={{ color: "var(--text-muted)" }}>
                    {fmtDate(liq.fecha)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone = "teal",
}: {
  icon: ElementType;
  label: string;
  value: string;
  detail: string;
  tone?: "teal" | "yellow" | "red" | "green";
}) {
  const color =
    tone === "yellow"
      ? "#fbbf24"
      : tone === "red"
        ? "#f87171"
        : tone === "green"
          ? "#4ade80"
          : "var(--brand-primary-light)";
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: "rgba(255,255,255,0.035)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon size={15} style={{ color }} />
        <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
      </div>
      <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {detail}
      </p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
  helper,
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  color: string;
  helper: string;
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ background: "rgba(20,184,166,0.1)" }}
      >
        <Icon size={20} style={{ color }} />
      </div>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-black" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {helper}
      </p>
    </div>
  );
}

export default function LiquidacionesPage() {
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{
    prof: Profesional;
    operacion: Operacion;
  } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/liquidaciones/resumen`, {
        headers: authHeaders(),
      });
      if (res.ok) setProfesionales(await res.json());
      else showToast("No se pudieron cargar liquidaciones", false);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    return profesionales.filter((p) => {
      const text = `${p.nombre} ${p.tipo} ${p.alias_cbu ?? ""}`.toLowerCase();
      const matchesText = text.includes(query.trim().toLowerCase());
      const matchesFilter =
        filtro === "todos" ||
        (filtro === "pagar" && p.saldo > 0) ||
        (filtro === "cobrar" && p.saldo < 0) ||
        (filtro === "cero" && p.saldo === 0);
      return matchesText && matchesFilter;
    });
  }, [profesionales, query, filtro]);

  const totalAPagar = profesionales
    .filter((p) => p.saldo > 0)
    .reduce((a, p) => a + p.saldo, 0);
  const totalACobrar = profesionales
    .filter((p) => p.saldo < 0)
    .reduce((a, p) => a + Math.abs(p.saldo), 0);
  const conComision = profesionales.filter((p) => p.saldo < 0).length;
  const conPago = profesionales.filter((p) => p.saldo > 0).length;
  const totalConsultas = profesionales.reduce(
    (a, p) => a + p.domicilio_cantidad + p.tele_cantidad,
    0,
  );
  const totalComisionGenerada = profesionales.reduce(
    (a, p) => a + p.domicilio_comision + p.tele_comision,
    0,
  );

  const filtros: { id: Filtro; label: string }[] = [
    { id: "todos", label: "Todos" },
    { id: "cobrar", label: "Comisiones a cobrar" },
    { id: "pagar", label: "Pagos a profesionales" },
    { id: "cero", label: "Al dia" },
  ];

  return (
    <div className="flex min-h-screen" style={{ background: "var(--main-bg)" }}>
      <Sidebar />

      <main className="flex-1 overflow-y-auto px-4 py-8 pt-20 md:px-8 md:pt-8">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="badge badge-teal">Administracion</span>
              <span className="badge badge-yellow">80/20 DocYa</span>
            </div>
            <h1
              className="text-3xl font-black"
              style={{ color: "var(--text-primary)" }}
            >
              Liquidaciones y comisiones
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Administra desde aca lo que DocYa debe pagar por cobros desde la app y las comisiones del 20% que los profesionales ya transfirieron por consultas cobradas en efectivo.
            </p>
          </div>
          <button
            onClick={fetchData}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition hover:opacity-90"
            style={{
              background: "var(--brand-primary)",
              color: "#fff",
            }}
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={ArrowDownToLine}
            label="Comisiones a cobrar"
            value={pesos(totalACobrar)}
            color="#fbbf24"
            helper={`${conComision} profesionales deben transferir a DocYa`}
          />
          <SummaryCard
            icon={ArrowUpFromLine}
            label="Pagos a profesionales"
            value={pesos(totalAPagar)}
            color="var(--brand-primary-light)"
            helper={`${conPago} profesionales con saldo positivo`}
          />
          <SummaryCard
            icon={ReceiptText}
            label="Comision generada"
            value={pesos(totalComisionGenerada)}
            color="#60a5fa"
            helper="20% acumulado en consultas registradas"
          />
          <SummaryCard
            icon={BadgeCheck}
            label="Actividad total"
            value={totalConsultas}
            color="#a78bfa"
            helper="Consultas y servicios registrados"
          />
        </section>

        <section
          className="mb-5 rounded-2xl p-4"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <Search size={16} style={{ color: "var(--text-muted)" }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar profesional, tipo o alias..."
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: "var(--text-primary)" }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {filtros.map((f) => {
                const active = filtro === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFiltro(f.id)}
                    className="rounded-xl px-3 py-2 text-xs font-bold transition"
                    style={{
                      background: active
                        ? "rgba(20,184,166,0.16)"
                        : "rgba(255,255,255,0.04)",
                      color: active
                        ? "var(--brand-primary-light)"
                        : "var(--text-muted)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          {loading ? (
            <div className="rounded-2xl p-8 text-center" style={{ background: "var(--card-bg)", color: "var(--text-muted)" }}>
              Cargando liquidaciones...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl p-8 text-center" style={{ background: "var(--card-bg)", color: "var(--text-muted)" }}>
              No hay profesionales para este filtro.
            </div>
          ) : (
            filtered.map((p) => (
              <ProfesionalCard
                key={p.id}
                prof={p}
                onRegistrar={(prof, operacion) => setModal({ prof, operacion })}
              />
            ))
          )}
        </section>
      </main>

      {modal && (
        <ModalRegistrarMovimiento
          prof={modal.prof}
          operacion={modal.operacion}
          onClose={() => setModal(null)}
          onDone={() => {
            const okMsg =
              modal.operacion === "comision_recibida"
                ? "Comision marcada como recibida"
                : "Pago marcado como realizado";
            setModal(null);
            showToast(okMsg);
            fetchData();
          }}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-bold shadow-lg"
          style={{
            background: toast.ok
              ? "rgba(20,184,166,0.2)"
              : "rgba(239,68,68,0.2)",
            border: `1px solid ${
              toast.ok ? "rgba(20,184,166,0.4)" : "rgba(239,68,68,0.4)"
            }`,
            color: toast.ok ? "var(--brand-primary-light)" : "#f87171",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
