"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import Sidebar from "@/components/sidebar";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Home,
  Moon,
  ReceiptText,
  RefreshCw,
  Search,
  Sun,
  TrendingUp,
  Video,
  Wallet,
  X,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE!;
const PAGE_SIZE = 10;

type Profesional = {
  id: number;
  nombre: string;
  tipo: string;
  alias_cbu: string;
  saldo: number;
  telefono?: string;
  domicilio_cantidad: number;
  domicilio_neto: number;
  domicilio_comision: number;
  domicilio_efectivo_cantidad?: number;
  domicilio_efectivo_bruto?: number;
  domicilio_efectivo_comision?: number;
  domicilio_app_cantidad?: number;
  domicilio_app_bruto?: number;
  domicilio_app_neto?: number;
  domicilio_app_comision?: number;
  domicilio_diurna_cantidad?: number;
  domicilio_nocturna_cantidad?: number;
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
type TipoFiltro = "todos" | "medico" | "enfermero";
type Operacion = "pago_profesional" | "comision_recibida";

function getWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    desde: monday.toISOString().slice(0, 10),
    hasta: sunday.toISOString().slice(0, 10),
  };
}

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
  return n < 0 ? `-${pesos(n)}` : pesos(n);
}
function pesosBalance(n: number) {
  if (n === 0) return "$0";
  return n < 0 ? `-${pesos(n)}` : pesos(n);
}
function fmtDate(s: string | null) {
  if (!s) return "-";
  return new Date(s).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
function tipoLabel(tipo: string) {
  return tipo?.toLowerCase() === "enfermero" ? "Enfermero" : "Médico";
}
function consultaLabel(tipo: string, plural = true) {
  return tipo?.toLowerCase() === "enfermero"
    ? plural ? "servicios" : "servicio"
    : plural ? "consultas" : "consulta";
}

function liquidacionDetalle(prof: Profesional, comisionPorcentaje = 20) {
  const efectivoBruto = prof.domicilio_efectivo_bruto ?? 0;
  const efectivoComision = prof.domicilio_efectivo_comision ?? efectivoBruto * (comisionPorcentaje / 100);
  const efectivoNeto = Math.max(efectivoBruto - efectivoComision, 0);
  const appBruto = prof.domicilio_app_bruto ?? 0;
  const appNeto = prof.domicilio_app_neto ?? 0;
  const appComision = prof.domicilio_app_comision ?? Math.max(appBruto - appNeto, 0);
  const teleNeto = prof.tele_neto ?? 0;
  const teleComision = prof.tele_comision ?? 0;
  const saldoDisponible = Math.max(prof.saldo, 0);
  const saldoRegularizar = Math.max(-prof.saldo, 0);
  const creditoDocya = appNeto + teleNeto;
  const deudaEfectivo = efectivoComision;
  const saldoPeriodo = creditoDocya - deudaEfectivo;
  const compensadoORegularizado = Math.max(efectivoComision - saldoRegularizar, 0);
  const totalProfesional = efectivoNeto + appNeto + teleNeto;
  const totalComision = efectivoComision + appComision + teleComision;

  return {
    efectivoBruto, efectivoComision, efectivoNeto,
    appBruto, appNeto, appComision,
    teleNeto, teleComision,
    saldoDisponible, saldoRegularizar,
    creditoDocya, deudaEfectivo, saldoPeriodo,
    compensadoORegularizado,
    totalProfesional, totalComision,
  };
}

function generarMensajeWsp(
  prof: Profesional,
  monto: string,
  periodoInicio: string,
  periodoFin: string,
  isComision: boolean,
  comisionPorcentaje: number
): string {
  const detalle = liquidacionDetalle(prof, comisionPorcentaje);
  const montoNum = Math.abs(Number(monto || 0));
  const fmt = (n: number) => "$" + Math.round(Math.abs(n)).toLocaleString("es-AR");
  const fmtD = (s: string) => {
    if (!s) return "";
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  };

  if (isComision) {
    return (
      `Hola ${prof.nombre.split(" ")[0]}! 👋\n\n` +
      `DocYa recibió tu regularización de comisión.\n\n` +
      `💰 Monto regularizado: ${fmt(montoNum)}\n` +
      `📅 Período: ${fmtD(periodoInicio)} al ${fmtD(periodoFin)}\n\n` +
      `¡Gracias por mantener la cuenta al día! ✅`
    );
  }

  let detalleTxt = "";
  if (detalle.efectivoBruto > 0) {
    detalleTxt += `🏠 Efectivo cobrado al paciente: ${fmt(detalle.efectivoBruto)}\n`;
    detalleTxt += `   Comisión DocYa ${comisionPorcentaje}%: -${fmt(detalle.efectivoComision)}\n`;
    detalleTxt += `   Neto por efectivo: ${fmt(detalle.efectivoNeto)}\n`;
  }
  if (detalle.appNeto > 0) {
    detalleTxt += `💳 Pagos por app (neto): ${fmt(detalle.appNeto)}\n`;
  }
  if (detalle.teleNeto > 0) {
    detalleTxt += `📹 Teleconsultas (neto): ${fmt(detalle.teleNeto)}\n`;
  }

  return (
    `Hola ${prof.nombre.split(" ")[0]}! 👋\n\n` +
    `DocYa te está transfiriendo el siguiente pago:\n\n` +
    `💰 *Monto transferido: ${fmt(montoNum)}*\n` +
    `📅 Período: ${fmtD(periodoInicio)} al ${fmtD(periodoFin)}\n\n` +
    (detalleTxt ? `📊 Desglose del período:\n${detalleTxt}\n` : "") +
    `✅ Resultado del período: ${fmt(detalle.saldoPeriodo)}\n` +
    `💸 Saldo que te transferimos: ${fmt(montoNum)}\n\n` +
    (prof.alias_cbu ? `🏦 CBU/Alias: ${prof.alias_cbu}\n\n` : "") +
    `¡Gracias por ser parte de DocYa! 🩺`
  );
}

function ModalRegistrarMovimiento({
  prof, operacion, comisionPorcentaje, onClose, onDone,
}: {
  prof: Profesional;
  operacion: Operacion;
  comisionPorcentaje: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const isComision = operacion === "comision_recibida";
  const saldoAbs = Math.abs(prof.saldo);
  const [periodoInicio, setPeriodoInicio] = useState(
    new Date(new Date().setDate(1)).toISOString().slice(0, 10)
  );
  const [periodoFin, setPeriodoFin] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [monto, setMonto] = useState(String(Math.round(saldoAbs)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const title = isComision ? "Marcar regularizacion recibida" : "Registrar pago al profesional";
  const description = isComision
    ? "Usa esta accion cuando el profesional ya transfirio a DocYa el saldo pendiente de regularizar."
    : "Usa esta accion cuando DocYa ya le transfirio al profesional lo disponible para cobrar.";
  const submitLabel = isComision ? "Regularizacion recibida" : "Marcar como pagado";
  const signedAmount = isComision
    ? -Math.abs(Number(monto || 0))
    : Math.abs(Number(monto || 0));

  const mensaje = generarMensajeWsp(prof, monto, periodoInicio, periodoFin, isComision, comisionPorcentaje);

  const telefonoLimpio = (prof.telefono ?? "").replace(/\D/g, "").replace(/^0/, "");
  const wspPhone = telefonoLimpio.startsWith("54")
    ? telefonoLimpio
    : telefonoLimpio.length >= 8 ? `54${telefonoLimpio}` : "";
  const wspUrl = `https://wa.me/${wspPhone}?text=${encodeURIComponent(mensaje)}`;

  const handleCopiar = () => {
    navigator.clipboard.writeText(mensaje).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
          monto_pagado: signedAmount,
          periodo_inicio: periodoInicio,
          periodo_fin: periodoFin,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail || "Error al registrar.");
      } else {
        onDone();
      }
    } catch {
      setError("Error de conexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-lg rounded-2xl p-6"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}>
            <X size={20} />
          </button>
        </div>
        <p className="mb-5 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {description}
        </p>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold" style={{ color: "var(--text-muted)" }}>
              Profesional
            </label>
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              {prof.nombre}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Periodo inicio", val: periodoInicio, set: setPeriodoInicio },
              { label: "Periodo fin", val: periodoFin, set: setPeriodoFin },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className="mb-1 block text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                  {label}
                </label>
                <input
                  type="date"
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--input-bg)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            ))}
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold" style={{ color: "var(--text-muted)" }}>
              Monto ($)
            </label>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Preview del mensaje WhatsApp */}
          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(37,211,102,0.07)", border: "1px solid rgba(37,211,102,0.2)" }}
          >
            <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: "#25d366" }}>
              Vista previa del mensaje
            </p>
            <pre
              className="whitespace-pre-wrap text-xs leading-relaxed"
              style={{ color: "var(--text-primary)", fontFamily: "inherit" }}
            >
              {mensaje}
            </pre>
          </div>

          {/* Botones WhatsApp + Copiar */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={wspUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: "#25d366" }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Enviar por WhatsApp
            </a>
            <button
              onClick={handleCopiar}
              className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition hover:opacity-80"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid var(--border-subtle)",
                color: copied ? "#4ade80" : "var(--text-primary)",
              }}
            >
              {copied ? "✓ Copiado!" : "Copiar mensaje"}
            </button>
          </div>

          {error && <p className="text-xs font-bold text-red-400">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-xl py-3 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: isComision ? "#f59e0b" : "var(--brand-primary)" }}
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
  comisionPorcentaje,
}: {
  prof: Profesional;
  onRegistrar: (prof: Profesional, operacion: Operacion) => void;
  comisionPorcentaje: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [historial, setHistorial] = useState<Liquidacion[]>([]);
  const [loadingH, setLoadingH] = useState(false);

  const detalle = liquidacionDetalle(prof, comisionPorcentaje);
  const isCobrarComision = prof.saldo < 0;
  const isPagarProfesional = prof.saldo > 0;
  const isCero = prof.saldo === 0;

  const appCantidad = prof.domicilio_app_cantidad ?? 0;
  const labelPlural = consultaLabel(prof.tipo);
  const esMedico = prof.tipo?.toLowerCase() !== "enfermero";

  const diurnaCantidad = prof.domicilio_diurna_cantidad ?? 0;
  const nocturnaCantidad = prof.domicilio_nocturna_cantidad ?? 0;
  const teleCantidad = prof.tele_cantidad ?? 0;

  const loadHistorial = async () => {
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
    setExpanded((p) => !p);
    if (!expanded) loadHistorial();
  };

  return (
    <article
      className="rounded-2xl p-4"
      style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold" style={{ color: "var(--text-primary)" }}>
              {prof.nombre}
            </h3>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-black"
              style={{
                background: esMedico ? "rgba(20,184,166,0.15)" : "rgba(139,92,246,0.15)",
                color: esMedico ? "var(--brand-primary-light)" : "#a78bfa",
              }}
            >
              {tipoLabel(prof.tipo)}
            </span>
            {isCobrarComision && <span className="badge badge-yellow">Debe comision</span>}
            {isPagarProfesional && <span className="badge badge-teal">DocYa debe pagar</span>}
            {isCero && <span className="badge badge-green">Al dia</span>}
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            ID #{prof.id}
            {prof.alias_cbu ? ` · Alias/CBU: ${prof.alias_cbu}` : " · Sin alias/CBU"}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="flex items-center gap-1">
              <Home size={11} />
              {prof.domicilio_cantidad} domicilio
              {diurnaCantidad + nocturnaCantidad > 0 && (
                <span className="ml-1">
                  (<Sun size={10} className="inline" /> {diurnaCantidad} ·{" "}
                  <Moon size={10} className="inline" /> {nocturnaCantidad})
                </span>
              )}
            </span>
            {teleCantidad > 0 && (
              <span className="flex items-center gap-1">
                <Video size={11} />
                {teleCantidad} teleconsulta{teleCantidad !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[760px]">
          <MiniMetric
            icon={Home}
            label="Efectivo cobrado"
            value={pesos(detalle.efectivoBruto)}
            detail={`Lo cobro el profesional`}
          />
          <MiniMetric
            icon={Wallet}
            label="A favor app/tele"
            value={pesos(detalle.creditoDocya)}
            detail="DocYa lo tiene que transferir"
            tone="blue"
          />
          <MiniMetric
            icon={ReceiptText}
            label="Debe por efectivo"
            value={pesos(detalle.deudaEfectivo)}
            detail="Comision que debe a DocYa"
            tone="yellow"
          />
          <MiniMetric
            icon={isPagarProfesional ? ArrowUpFromLine : isCobrarComision ? ArrowDownToLine : BadgeCheck}
            label={isPagarProfesional ? "Saldo actual a pagar" : isCobrarComision ? "Saldo a regularizar" : "Al dia"}
            value={pesos(isPagarProfesional ? detalle.saldoDisponible : detalle.saldoRegularizar)}
            detail={isPagarProfesional ? "Despues de movimientos" : isCobrarComision ? "Debe a DocYa" : "Saldo en cero"}
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
              Regularizar
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
            style={{ color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      <div
        className="mt-4 grid gap-3 rounded-xl p-3 md:grid-cols-4"
        style={{ background: "var(--input-bg)" }}
      >
        <InfoLine label="Cuenta del periodo" value={pesosBalance(detalle.saldoPeriodo)} />
        <InfoLine label="A favor profesional" value={pesos(detalle.creditoDocya)} />
        <InfoLine label="Menos deuda efectivo" value={`-${pesos(detalle.deudaEfectivo)}`} />
        <InfoLine
          label="Saldo actual registrado"
          value={
            isPagarProfesional
              ? `${pesos(detalle.saldoDisponible)} a pagar`
              : isCobrarComision
                ? `${pesos(detalle.saldoRegularizar)} a cobrar`
                : "Sin saldo"
          }
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Cuenta rapida: DocYa debe transferir app/tele ({pesos(detalle.creditoDocya)}) menos la comision del efectivo que cobro el profesional ({pesos(detalle.deudaEfectivo)}). El saldo actual puede cambiar por pagos o regularizaciones ya registrados.
      </p>

      <div className="mt-3 grid gap-3 lg:grid-cols-4">
        <BreakdownPanel
          title="Efectivo"
          subtitle="El profesional ya recibio este dinero del paciente."
          rows={[
            ["Cobrado al paciente", pesos(detalle.efectivoBruto)],
            [`Comision DocYa ${comisionPorcentaje.toLocaleString("es-AR")}%`, `-${pesos(detalle.efectivoComision)}`],
            ["Neto profesional", pesos(detalle.efectivoNeto)],
          ]}
          tone="green"
        />
        <BreakdownPanel
          title="Pagos por app"
          subtitle="DocYa recauda y luego transfiere el neto."
          rows={[
            [`${appCantidad} ${labelPlural}`, ""] as [string, string],
            ...(diurnaCantidad + nocturnaCantidad > 0
              ? [
                  [`☀ Diurnas`, String(diurnaCantidad)] as [string, string],
                  [`🌙 Nocturnas`, String(nocturnaCantidad)] as [string, string],
                ]
              : ([] as [string, string][])),
            ["Pagado por pacientes", pesos(detalle.appBruto)],
            [`Comision DocYa ${comisionPorcentaje.toLocaleString("es-AR")}%`, `-${pesos(detalle.appComision)}`],
            ["Neto a profesional", pesos(detalle.appNeto)],
          ]}
          tone="blue"
        />
        <BreakdownPanel
          title="Teleconsultas"
          subtitle="DocYa cobro estas consultas y debe transferir el neto."
          rows={[
            [`${teleCantidad} teleconsulta${teleCantidad !== 1 ? "s" : ""}`, ""],
            ["Neto profesional", pesos(detalle.teleNeto)],
            [`Comision DocYa ${comisionPorcentaje.toLocaleString("es-AR")}%`, detalle.teleComision > 0 ? `-${pesos(detalle.teleComision)}` : "$0"],
          ]}
          tone="purple"
        />
        <BreakdownPanel
          title="Cuenta clara"
          subtitle="Lo que se suma y resta para entender el pago."
          rows={[
            ["A favor por app + tele", pesos(detalle.creditoDocya)],
            ["Menos comision de efectivo", `-${pesos(detalle.deudaEfectivo)}`],
            ["Resultado del periodo", pesosBalance(detalle.saldoPeriodo)],
            ["Saldo actual registrado", pesosBalance(prof.saldo)],
            [
              "Ultimo movimiento",
              prof.ultima_liquidacion
                ? `${fmtDate(prof.ultima_liquidacion)} ${pesosConSigno(prof.ultimo_monto ?? 0)}`
                : "Sin movimientos",
            ],
            ["Total ganado profesional", pesos(detalle.totalProfesional)],
          ]}
          tone={isCobrarComision ? "red" : isPagarProfesional ? "teal" : "green"}
        />
      </div>

      {expanded && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Historial de movimientos
          </p>
          {loadingH ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Cargando...</p>
          ) : historial.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sin movimientos registrados.</p>
          ) : (
            <div className="space-y-2">
              {historial.map((liq) => (
                <div
                  key={liq.id}
                  className="grid gap-2 rounded-xl px-3 py-2 text-xs md:grid-cols-3"
                  style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)" }}
                >
                  <span style={{ color: "var(--text-muted)" }}>
                    {fmtDate(liq.periodo_inicio)} – {fmtDate(liq.periodo_fin)}
                  </span>
                  <span
                    className="font-bold"
                    style={{ color: liq.monto_pagado < 0 ? "#fbbf24" : "var(--brand-primary-light)" }}
                  >
                    {liq.monto_pagado < 0 ? "Regularizacion recibida " : "Pago realizado "}
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
  icon: Icon, label, value, detail, tone = "teal",
}: {
  icon: ElementType;
  label: string;
  value: string;
  detail: string;
  tone?: "teal" | "yellow" | "red" | "green" | "blue";
}) {
  const color =
    tone === "yellow" ? "#fbbf24"
    : tone === "red" ? "#f87171"
    : tone === "green" ? "#4ade80"
    : tone === "blue" ? "#60a5fa"
    : "var(--brand-primary-light)";
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: "rgba(255,255,255,0.035)", border: "1px solid var(--border-subtle)" }}
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon size={15} style={{ color }} />
        <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
      <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{detail}</p>
    </div>
  );
}

function BreakdownPanel({
  title, subtitle, rows, tone,
}: {
  title: string;
  subtitle: string;
  rows: [string, string][];
  tone: "teal" | "green" | "blue" | "red" | "purple";
}) {
  const color =
    tone === "green" ? "#4ade80"
    : tone === "blue" ? "#60a5fa"
    : tone === "red" ? "#f87171"
    : tone === "purple" ? "#a78bfa"
    : "var(--brand-primary-light)";
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--border-subtle)" }}
    >
      <div className="mb-3">
        <p className="text-sm font-black" style={{ color }}>{title}</p>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
      </div>
      <div className="space-y-2">
        {rows.filter(([l]) => l).map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-3">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

function SummaryCard({
  icon: Icon, label, value, color, helper,
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
      style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}
    >
      <div
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ background: "rgba(20,184,166,0.1)" }}
      >
        <Icon size={20} style={{ color }} />
      </div>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="mt-1 text-2xl font-black" style={{ color: "var(--text-primary)" }}>{value}</p>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{helper}</p>
    </div>
  );
}

export default function LiquidacionesPage() {
  const weekRange = getWeekRange();
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ prof: Profesional; operacion: Operacion; comisionPct: number } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("todos");
  const [desde, setDesde] = useState(weekRange.desde);
  const [hasta, setHasta] = useState(weekRange.hasta);
  const [page, setPage] = useState(0);
  const [comisionPorcentaje, setComisionPorcentaje] = useState(20);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setPage(0);
    try {
      const params = new URLSearchParams();
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      const res = await fetch(`${API}/admin/liquidaciones/resumen?${params}`, {
        headers: authHeaders(),
      });
      if (res.ok) setProfesionales(await res.json());
      else showToast("No se pudieron cargar liquidaciones", false);
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, showToast]);

  const fetchComision = useCallback(async () => {
    try {
      const res = await fetch(`${API}/configuracion/comision-docya`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      const porcentaje = Number(data.comision_porcentaje ?? 20);
      if (Number.isFinite(porcentaje)) setComisionPorcentaje(porcentaje);
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    fetchComision();
  }, [fetchData, fetchComision]);

  // reset page when filters change
  useEffect(() => { setPage(0); }, [query, filtro, tipoFiltro]);

  const filtered = useMemo(() => {
    return profesionales.filter((p) => {
      const text = `${p.nombre} ${p.tipo} ${p.alias_cbu ?? ""}`.toLowerCase();
      const matchesText = text.includes(query.trim().toLowerCase());
      const matchesFilter =
        filtro === "todos" ||
        (filtro === "pagar" && p.saldo > 0) ||
        (filtro === "cobrar" && p.saldo < 0) ||
        (filtro === "cero" && p.saldo === 0);
      const matchesTipo =
        tipoFiltro === "todos" ||
        (tipoFiltro === "medico" && p.tipo?.toLowerCase() !== "enfermero") ||
        (tipoFiltro === "enfermero" && p.tipo?.toLowerCase() === "enfermero");
      return matchesText && matchesFilter && matchesTipo;
    });
  }, [profesionales, query, filtro, tipoFiltro]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totalAPagar = profesionales.filter((p) => p.saldo > 0).reduce((a, p) => a + p.saldo, 0);
  const totalACobrar = profesionales.filter((p) => p.saldo < 0).reduce((a, p) => a + Math.abs(p.saldo), 0);
  const conComision = profesionales.filter((p) => p.saldo < 0).length;
  const conPago = profesionales.filter((p) => p.saldo > 0).length;
  const totalConsultas = profesionales.reduce((a, p) => a + p.domicilio_cantidad + p.tele_cantidad, 0);
  const totalTele = profesionales.reduce((a, p) => a + (p.tele_cantidad ?? 0), 0);
  const totalComisionGenerada = profesionales.reduce((a, p) => a + liquidacionDetalle(p, comisionPorcentaje).totalComision, 0);
  const totalEfectivoBruto = profesionales.reduce((a, p) => a + liquidacionDetalle(p, comisionPorcentaje).efectivoBruto, 0);
  const totalCreditoDocya = profesionales.reduce((a, p) => a + liquidacionDetalle(p, comisionPorcentaje).creditoDocya, 0);

  const filtrosSaldo: { id: Filtro; label: string }[] = [
    { id: "todos", label: "Todos" },
    { id: "cobrar", label: "Deben a DocYa" },
    { id: "pagar", label: "DocYa debe pagar" },
    { id: "cero", label: "Al dia" },
  ];

  const filtrosTipo: { id: TipoFiltro; label: string }[] = [
    { id: "todos", label: "Todos" },
    { id: "medico", label: "Médicos" },
    { id: "enfermero", label: "Enfermeros" },
  ];

  return (
    <div className="flex min-h-screen" style={{ background: "var(--main-bg)" }}>
      <Sidebar />

      <main className="flex-1 overflow-y-auto px-4 py-8 pt-20 md:px-8 md:pt-8">
        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="badge badge-teal">Administracion</span>
              <span className="badge badge-yellow">Comision {comisionPorcentaje.toLocaleString("es-AR")}%</span>
            </div>
            <h1 className="text-3xl font-black" style={{ color: "var(--text-primary)" }}>
              Liquidaciones y comisiones
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Administra que le debe DocYa al profesional y que comision debe regularizar el profesional cuando cobro en efectivo.
            </p>
          </div>
          <button
            onClick={fetchData}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition hover:opacity-90"
            style={{ background: "var(--brand-primary)", color: "#fff" }}
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>

        {/* SUMMARY CARDS */}
        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard icon={ArrowDownToLine} label="Comisiones a cobrar" value={pesos(totalACobrar)} color="#fbbf24"
            helper={`${conComision} profesionales deben transferir a DocYa`} />
          <SummaryCard icon={ArrowUpFromLine} label="Disponible para pagar" value={pesos(totalAPagar)} color="var(--brand-primary-light)"
            helper={`${conPago} profesionales con transferencia pendiente`} />
          <SummaryCard icon={TrendingUp} label="Ganancia DocYa" value={pesos(totalComisionGenerada)} color="#34d399"
            helper="Comision generada en el periodo" />
          <SummaryCard icon={ReceiptText} label="Cobrado en efectivo" value={pesos(totalEfectivoBruto)} color="#60a5fa"
            helper="Dinero que recibieron directo los profesionales" />
          <SummaryCard icon={BadgeCheck} label="A favor app/tele" value={pesos(totalCreditoDocya)} color="#a78bfa"
            helper={`${totalConsultas} total · ${totalTele} teleconsultas`} />
        </section>

        {/* FILTROS */}
        <section
          className="mb-5 rounded-2xl p-4"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}
        >
          {/* Rango de fechas */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Período
            </span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>hasta</span>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
              />
              <button
                onClick={() => { setDesde(weekRange.desde); setHasta(weekRange.hasta); }}
                className="rounded-xl px-3 py-2 text-xs font-bold transition hover:opacity-80"
                style={{ background: "rgba(20,184,166,0.12)", color: "var(--brand-primary-light)", border: "1px solid rgba(20,184,166,0.25)" }}
              >
                Esta semana
              </button>
            </div>
          </div>

          {/* Buscador + filtros */}
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)" }}
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
              {/* Filtro tipo */}
              {filtrosTipo.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTipoFiltro(f.id)}
                  className="rounded-xl px-3 py-2 text-xs font-bold transition"
                  style={{
                    background: tipoFiltro === f.id ? "rgba(167,139,250,0.16)" : "rgba(255,255,255,0.04)",
                    color: tipoFiltro === f.id ? "#a78bfa" : "var(--text-muted)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  {f.label}
                </button>
              ))}
              <div className="w-px self-stretch" style={{ background: "var(--border-subtle)" }} />
              {/* Filtro saldo */}
              {filtrosSaldo.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltro(f.id)}
                  className="rounded-xl px-3 py-2 text-xs font-bold transition"
                  style={{
                    background: filtro === f.id ? "rgba(20,184,166,0.16)" : "rgba(255,255,255,0.04)",
                    color: filtro === f.id ? "var(--brand-primary-light)" : "var(--text-muted)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* LISTA */}
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
            paginated.map((p) => (
              <ProfesionalCard
                key={p.id}
                prof={p}
                onRegistrar={(prof, operacion) => setModal({ prof, operacion, comisionPct: comisionPorcentaje })}
                comisionPorcentaje={comisionPorcentaje}
              />
            ))
          )}
        </section>

        {/* PAGINACION */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="mt-5 flex items-center justify-between rounded-2xl px-5 py-3"
            style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length} profesionales
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-xl p-2 transition hover:bg-white/5 disabled:opacity-30"
                style={{ border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-xl p-2 transition hover:bg-white/5 disabled:opacity-30"
                style={{ border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </main>

      {modal && (
        <ModalRegistrarMovimiento
          prof={modal.prof}
          operacion={modal.operacion}
          comisionPorcentaje={modal.comisionPct}
          onClose={() => setModal(null)}
          onDone={() => {
            const okMsg = modal.operacion === "comision_recibida"
              ? "Regularizacion marcada como recibida"
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
