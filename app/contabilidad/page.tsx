"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import Sidebar from "@/components/sidebar";
import {
  AlertTriangle,
  Banknote,
  Bell,
  Calculator,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Landmark,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";

const CONTABILIDAD_API = process.env.NEXT_PUBLIC_CONTABILIDAD_API_BASE!;

type Periodicidad = "mensual" | "anual";
type Tab = "arca" | "consultas" | "comprobantes" | "gastos" | "caja" | "cierre" | "vencimientos";
type Tono = "red" | "yellow" | "teal" | "green";

type Obligacion = {
  id: number;
  nombre: string;
  organismo: string;
  periodicidad: Periodicidad;
  diaVencimiento: number;
  mesVencimiento?: number;
  notas?: string;
  activa: boolean;
  ultimoPeriodoCumplido?: string;
};

type ApiObligacion = {
  id: number;
  nombre: string;
  organismo: string;
  periodicidad: Periodicidad;
  dia_vencimiento: number;
  mes_vencimiento: number | null;
  notas: string | null;
  activa: boolean;
  ultimo_periodo_cumplido: string | null;
};

type RegistroConsulta = {
  id: number;
  fecha: string;
  medico: string;
  tipo: string;
  precio: string;
  comision_docya_pct: string;
  comision_mp_pct: string;
  iva_pct: string;
  comision_docya_importe: string;
  comision_mp_importe: string;
  neto_medico_importe: string;
  base_despues_mp: string;
  margen_docya_post_mp: string;
  iva_debito_docya: string;
  iva_credito_mp: string;
};

type Comprobante = {
  id: number;
  fecha: string;
  tipo_comprobante: string;
  letra: string;
  punto_venta: number;
  numero: number;
  receptor_nombre: string;
  receptor_documento: string | null;
  condicion_iva_receptor: string | null;
  concepto: string;
  importe_neto: string;
  iva_pct: string;
  iva_debito: string;
  importe_total: string;
  cae: string | null;
  cae_vencimiento: string | null;
  estado: "borrador" | "emitido" | "anulado";
  notas: string | null;
};

type Gasto = {
  id: number;
  fecha: string;
  proveedor_nombre: string;
  proveedor_cuit: string | null;
  tipo_comprobante: string;
  letra: string | null;
  punto_venta: number | null;
  numero: number | null;
  concepto: string;
  categoria: string | null;
  importe_neto: string;
  iva_pct: string;
  iva_credito: string;
  percepciones: string;
  importe_total: string;
  deducible_iva: boolean;
  notas: string | null;
};

type ResumenIva = {
  periodo: string;
  consultas_cantidad: number;
  comprobantes_cantidad: number;
  gastos_cantidad: number;
  total_consultas_paciente: string;
  neto_medicos_total: string;
  comision_docya_neta: string;
  margen_docya_post_mp: string;
  iva_debito_consultas: string;
  iva_debito_comprobantes: string;
  iva_debito_total: string;
  comision_mp_neta: string;
  iva_credito_mp: string;
  agip_base_imponible: string;
  agip_iibb_pct: string;
  agip_iibb_estimado: string;
  iva_credito_gastos: string;
  otros_creditos: string;
  percepciones: string;
  iva_credito_total: string;
  iva_saldo_tecnico: string;
  iva_a_pagar_estimado: string;
  saldo_a_favor_estimado: string;
  notas_ajuste: string | null;
};

type ChecklistArca = {
  periodo: string;
  listo_para_revisar: boolean;
  pendientes: string[];
  fuentes: string[];
};

type AjusteIva = {
  periodo: string;
  otros_creditos: string;
  notas: string | null;
};

type CierreMensual = {
  periodo: string;
  consultas_cargadas: boolean;
  facturas_emitidas: boolean;
  gastos_cargados: boolean;
  medicos_liquidados: boolean;
  iva_revisado: boolean;
  agip_revisado: boolean;
  caja_conciliada: boolean;
  cerrado: boolean;
  notas: string | null;
  cerrado_por: string | null;
  cerrado_en: string | null;
};

type MovimientoCaja = {
  id: number;
  fecha: string;
  tipo: "ingreso" | "egreso";
  categoria: string;
  descripcion: string;
  monto: string;
  medio: string | null;
  referencia: string | null;
  notas: string | null;
};

type ResumenCaja = {
  periodo: string;
  ingresos: string;
  egresos: string;
  saldo: string;
  movimientos_cantidad: number;
};

type ObligacionForm = Omit<Obligacion, "id">;
type ConsultaForm = { fecha: string; medico: string; tipo: string; precio: string };
type ComprobanteForm = Omit<Comprobante, "id" | "iva_debito" | "importe_total">;
type GastoForm = Omit<Gasto, "id" | "iva_credito" | "importe_total">;
type MovimientoCajaForm = Omit<MovimientoCaja, "id">;

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const tabs: { id: Tab; label: string; icon: ElementType }[] = [
  { id: "arca", label: "Resumen ARCA", icon: Landmark },
  { id: "consultas", label: "Consultas", icon: ReceiptText },
  { id: "comprobantes", label: "Comprobantes", icon: FileText },
  { id: "gastos", label: "Gastos", icon: WalletCards },
  { id: "caja", label: "Caja", icon: Banknote },
  { id: "cierre", label: "Cierre", icon: ClipboardCheck },
  { id: "vencimientos", label: "Vencimientos", icon: CalendarClock },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function currentPeriodo() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function periodoRange(periodo: string) {
  const [year, month] = periodo.split("-").map(Number);
  const desde = `${periodo}-01`;
  const hastaDate = new Date(year, month, 0);
  return { desde, hasta: hastaDate.toISOString().slice(0, 10) };
}

function money(value: string | number | null | undefined) {
  const n = Number(value ?? 0);
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("docya_token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fromApi(o: ApiObligacion): Obligacion {
  return {
    id: o.id,
    nombre: o.nombre,
    organismo: o.organismo,
    periodicidad: o.periodicidad,
    diaVencimiento: o.dia_vencimiento,
    mesVencimiento: o.mes_vencimiento ?? undefined,
    notas: o.notas ?? undefined,
    activa: o.activa,
    ultimoPeriodoCumplido: o.ultimo_periodo_cumplido ?? undefined,
  };
}

function toApiPayload(data: ObligacionForm) {
  return {
    nombre: data.nombre,
    organismo: data.organismo,
    periodicidad: data.periodicidad,
    dia_vencimiento: data.diaVencimiento,
    mes_vencimiento: data.periodicidad === "anual" ? data.mesVencimiento ?? 1 : null,
    notas: data.notas?.trim() ? data.notas.trim() : null,
    activa: data.activa,
  };
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function periodKey(date: Date, periodicidad: Periodicidad) {
  return periodicidad === "anual"
    ? String(date.getFullYear())
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function nextVencimiento(ob: Obligacion, today: Date): { fecha: Date; periodo: string } | null {
  const hoy = startOfDay(today);
  let probe = ob.periodicidad === "anual"
    ? new Date(hoy.getFullYear(), 0, 1)
    : new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  for (let i = 0; i < 36; i++) {
    const fecha = ob.periodicidad === "anual"
      ? new Date(probe.getFullYear(), (ob.mesVencimiento ?? 1) - 1, ob.diaVencimiento)
      : new Date(probe.getFullYear(), probe.getMonth(), ob.diaVencimiento);
    const periodo = periodKey(fecha, ob.periodicidad);
    const yaCumplido = !!ob.ultimoPeriodoCumplido && periodo <= ob.ultimoPeriodoCumplido;
    if (!yaCumplido && fecha >= hoy) return { fecha, periodo };
    probe = ob.periodicidad === "anual"
      ? new Date(probe.getFullYear() + 1, 0, 1)
      : new Date(probe.getFullYear(), probe.getMonth() + 1, 1);
  }
  return null;
}

function diasRestantes(fecha: Date, today: Date) {
  const ms = startOfDay(fecha).getTime() - startOfDay(today).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function estadoPorDias(dias: number): { label: string; tone: Tono } {
  if (dias < 0) return { label: `Vencido hace ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}`, tone: "red" };
  if (dias === 0) return { label: "Vence hoy", tone: "red" };
  if (dias <= 3) return { label: `En ${dias} dia${dias === 1 ? "" : "s"}`, tone: "yellow" };
  if (dias <= 10) return { label: `En ${dias} dias`, tone: "teal" };
  return { label: `En ${dias} dias`, tone: "green" };
}

function toneClass(tone: Tono) {
  return tone === "red" ? "badge-red" : tone === "yellow" ? "badge-yellow" : tone === "teal" ? "badge-teal" : "badge-green";
}

function fmtFecha(value: string | Date) {
  const d = typeof value === "string" ? new Date(`${value}T00:00:00`) : value;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function periodoLabel(periodo: string, periodicidad: Periodicidad) {
  if (periodicidad === "anual") return `Periodo ${periodo}`;
  const [anio, mes] = periodo.split("-");
  const idx = Number(mes) - 1;
  return `${MESES[idx] ?? mes} ${anio}`;
}

function emptyObligacion(): ObligacionForm {
  return {
    nombre: "",
    organismo: "ARCA (ex-AFIP)",
    periodicidad: "mensual",
    diaVencimiento: 15,
    mesVencimiento: 1,
    notas: "",
    activa: true,
  };
}

function emptyConsulta(): ConsultaForm {
  return { fecha: todayIso(), medico: "", tipo: "Teleconsulta", precio: "" };
}

function emptyComprobante(): ComprobanteForm {
  return {
    fecha: todayIso(),
    tipo_comprobante: "Factura",
    letra: "B",
    punto_venta: 1,
    numero: 1,
    receptor_nombre: "",
    receptor_documento: "",
    condicion_iva_receptor: "Consumidor final",
    concepto: "Servicios DocYa",
    importe_neto: "",
    iva_pct: "21",
    cae: "",
    cae_vencimiento: null,
    estado: "emitido",
    notas: "",
  };
}

function emptyGasto(): GastoForm {
  return {
    fecha: todayIso(),
    proveedor_nombre: "",
    proveedor_cuit: "",
    tipo_comprobante: "Factura",
    letra: "B",
    punto_venta: null,
    numero: null,
    concepto: "",
    categoria: "Operativo",
    importe_neto: "",
    iva_pct: "21",
    percepciones: "0",
    deducible_iva: true,
    notas: "",
  };
}

function emptyCierre(periodo: string): CierreMensual {
  return {
    periodo,
    consultas_cargadas: false,
    facturas_emitidas: false,
    gastos_cargados: false,
    medicos_liquidados: false,
    iva_revisado: false,
    agip_revisado: false,
    caja_conciliada: false,
    cerrado: false,
    notas: "",
    cerrado_por: null,
    cerrado_en: null,
  };
}

function emptyMovimientoCaja(): MovimientoCajaForm {
  return {
    fecha: todayIso(),
    tipo: "ingreso",
    categoria: "Mercado Pago",
    descripcion: "",
    monto: "",
    medio: "Mercado Pago",
    referencia: "",
    notas: "",
  };
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? "No se pudo completar la operacion");
  }
  return res.json() as Promise<T>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl ${className}`} style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}>
      {children}
    </section>
  );
}

function Metric({ icon: Icon, label, value, helper, color = "var(--brand-primary-light)" }: {
  icon: ElementType;
  label: string;
  value: string | number;
  helper: string;
  color?: string;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(20,184,166,0.1)" }}>
        <Icon size={19} style={{ color }} />
      </div>
      <p className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="mt-1 text-2xl font-black" style={{ color: "var(--text-primary)" }}>{value}</p>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{helper}</p>
    </Card>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${props.className ?? ""}`}
      style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", ...(props.style ?? {}) }}
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${props.className ?? ""}`}
      style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", ...(props.style ?? {}) }}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full resize-none rounded-lg px-3 py-2 text-sm outline-none ${props.className ?? ""}`}
      style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", ...(props.style ?? {}) }}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      {children}
    </label>
  );
}

function SmallButton({ children, onClick, tone = "muted", disabled = false, type = "button", title }: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "primary" | "danger" | "success" | "muted";
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
}) {
  const styles = {
    primary: { background: "var(--brand-primary)", color: "#fff", border: "1px solid var(--brand-primary)" },
    danger: { background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" },
    success: { background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" },
    muted: { background: "rgba(255,255,255,0.04)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" },
  }[tone];
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition hover:opacity-85 disabled:opacity-45"
      style={styles}
    >
      {children}
    </button>
  );
}

export default function ContabilidadPage() {
  const [tab, setTab] = useState<Tab>("arca");
  const [periodo, setPeriodo] = useState(currentPeriodo());
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [obligaciones, setObligaciones] = useState<Obligacion[]>([]);
  const [consultas, setConsultas] = useState<RegistroConsulta[]>([]);
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [resumen, setResumen] = useState<ResumenIva | null>(null);
  const [checklist, setChecklist] = useState<ChecklistArca | null>(null);
  const [ajuste, setAjuste] = useState<AjusteIva>({ periodo, otros_creditos: "0", notas: "" });
  const [cierre, setCierre] = useState<CierreMensual>(emptyCierre(periodo));
  const [movimientosCaja, setMovimientosCaja] = useState<MovimientoCaja[]>([]);
  const [resumenCaja, setResumenCaja] = useState<ResumenCaja | null>(null);

  const [obligacionForm, setObligacionForm] = useState<ObligacionForm>(emptyObligacion());
  const [editObligacion, setEditObligacion] = useState<Obligacion | null>(null);
  const [consultaForm, setConsultaForm] = useState<ConsultaForm>(emptyConsulta());
  const [comprobanteForm, setComprobanteForm] = useState<ComprobanteForm>(emptyComprobante());
  const [editComprobante, setEditComprobante] = useState<Comprobante | null>(null);
  const [gastoForm, setGastoForm] = useState<GastoForm>(emptyGasto());
  const [editGasto, setEditGasto] = useState<Gasto | null>(null);
  const [movimientoForm, setMovimientoForm] = useState<MovimientoCajaForm>(emptyMovimientoCaja());
  const [editMovimiento, setEditMovimiento] = useState<MovimientoCaja | null>(null);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const range = useMemo(() => periodoRange(periodo), [periodo]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [obs, regs, comps, gs, res, chk, aj, cie, movs, caja] = await Promise.all([
        apiJson<ApiObligacion[]>(`${CONTABILIDAD_API}/contabilidad/obligaciones`),
        apiJson<RegistroConsulta[]>(`${CONTABILIDAD_API}/contabilidad/registros-consultas?desde=${range.desde}&hasta=${range.hasta}`),
        apiJson<Comprobante[]>(`${CONTABILIDAD_API}/contabilidad/comprobantes-emitidos?desde=${range.desde}&hasta=${range.hasta}`),
        apiJson<Gasto[]>(`${CONTABILIDAD_API}/contabilidad/gastos-compras?desde=${range.desde}&hasta=${range.hasta}`),
        apiJson<ResumenIva>(`${CONTABILIDAD_API}/contabilidad/resumen-iva/${periodo}`),
        apiJson<ChecklistArca>(`${CONTABILIDAD_API}/contabilidad/arca/checklist/${periodo}`),
        apiJson<AjusteIva>(`${CONTABILIDAD_API}/contabilidad/ajustes-iva/${periodo}`),
        apiJson<CierreMensual>(`${CONTABILIDAD_API}/contabilidad/cierres/${periodo}`),
        apiJson<MovimientoCaja[]>(`${CONTABILIDAD_API}/contabilidad/movimientos-caja?desde=${range.desde}&hasta=${range.hasta}`),
        apiJson<ResumenCaja>(`${CONTABILIDAD_API}/contabilidad/resumen-caja/${periodo}`),
      ]);
      setObligaciones(obs.map(fromApi));
      setConsultas(regs);
      setComprobantes(comps);
      setGastos(gs);
      setResumen(res);
      setChecklist(chk);
      setAjuste(aj);
      setCierre(cie);
      setMovimientosCaja(movs);
      setResumenCaja(caja);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo conectar con contabilidad", false);
    } finally {
      setLoading(false);
    }
  }, [periodo, range.desde, range.hasta, showToast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const today = useMemo(() => new Date(), []);
  const filasVencimientos = useMemo(() => {
    return obligaciones
      .filter((o) => o.activa)
      .map((o) => {
        const proximo = nextVencimiento(o, today);
        if (!proximo) return null;
        const dias = diasRestantes(proximo.fecha, today);
        return { obligacion: o, fecha: proximo.fecha, periodo: proximo.periodo, dias, estado: estadoPorDias(dias) };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  }, [obligaciones, today]);

  const vencidos = filasVencimientos.filter((f) => f.dias < 0).length;
  const urgentes = filasVencimientos.filter((f) => f.dias >= 0 && f.dias <= 3).length;

  const resumenPorMedico = useMemo(() => {
    const map = new Map<string, {
      medico: string;
      cantidad: number;
      totalPaciente: number;
      medico80: number;
      docya20: number;
      mp6: number;
      margenDocya: number;
    }>();
    for (const consulta of consultas) {
      const key = consulta.medico.trim() || "Sin medico";
      const current = map.get(key) ?? {
        medico: key,
        cantidad: 0,
        totalPaciente: 0,
        medico80: 0,
        docya20: 0,
        mp6: 0,
        margenDocya: 0,
      };
      current.cantidad += 1;
      current.totalPaciente += Number(consulta.precio ?? 0);
      current.medico80 += Number(consulta.neto_medico_importe ?? 0);
      current.docya20 += Number(consulta.comision_docya_importe ?? 0);
      current.mp6 += Number(consulta.comision_mp_importe ?? 0);
      current.margenDocya += Number(consulta.margen_docya_post_mp ?? 0);
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.docya20 - a.docya20);
  }, [consultas]);

  const guardarObligacion = async (e: React.FormEvent) => {
    e.preventDefault();
    const editing = editObligacion;
    try {
      const saved = await apiJson<ApiObligacion>(
        editing ? `${CONTABILIDAD_API}/contabilidad/obligaciones/${editing.id}` : `${CONTABILIDAD_API}/contabilidad/obligaciones`,
        { method: editing ? "PUT" : "POST", body: JSON.stringify(toApiPayload(obligacionForm)) }
      );
      setObligaciones((prev) => editing ? prev.map((o) => (o.id === saved.id ? fromApi(saved) : o)) : [...prev, fromApi(saved)]);
      setEditObligacion(null);
      setObligacionForm(emptyObligacion());
      showToast(editing ? "Obligacion actualizada" : "Obligacion agregada");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo guardar", false);
    }
  };

  const marcarCumplido = async (ob: Obligacion, per: string) => {
    try {
      const saved = await apiJson<ApiObligacion>(`${CONTABILIDAD_API}/contabilidad/obligaciones/${ob.id}/marcar-presentada`, {
        method: "POST",
        body: JSON.stringify({ periodo: per }),
      });
      setObligaciones((prev) => prev.map((o) => (o.id === ob.id ? fromApi(saved) : o)));
      showToast("Obligacion marcada como presentada");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo marcar", false);
    }
  };

  const eliminarObligacion = async (ob: Obligacion) => {
    if (!window.confirm(`Eliminar ${ob.nombre}?`)) return;
    try {
      await fetch(`${CONTABILIDAD_API}/contabilidad/obligaciones/${ob.id}`, { method: "DELETE", headers: authHeaders() });
      setObligaciones((prev) => prev.filter((o) => o.id !== ob.id));
      showToast("Obligacion eliminada");
    } catch {
      showToast("No se pudo eliminar", false);
    }
  };

  const guardarConsulta = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const saved = await apiJson<RegistroConsulta>(`${CONTABILIDAD_API}/contabilidad/registros-consultas`, {
        method: "POST",
        body: JSON.stringify({ ...consultaForm, precio: Number(consultaForm.precio || 0) }),
      });
      setConsultas((prev) => [saved, ...prev]);
      setConsultaForm(emptyConsulta());
      showToast("Consulta cargada");
      fetchAll();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo cargar la consulta", false);
    }
  };

  const eliminarConsulta = async (id: number) => {
    if (!window.confirm("Eliminar esta consulta del libro?")) return;
    await fetch(`${CONTABILIDAD_API}/contabilidad/registros-consultas/${id}`, { method: "DELETE", headers: authHeaders() });
    setConsultas((prev) => prev.filter((r) => r.id !== id));
    fetchAll();
  };

  const guardarComprobante = async (e: React.FormEvent) => {
    e.preventDefault();
    const editing = editComprobante;
    const payload = {
      ...comprobanteForm,
      receptor_documento: comprobanteForm.receptor_documento || null,
      condicion_iva_receptor: comprobanteForm.condicion_iva_receptor || null,
      importe_neto: Number(comprobanteForm.importe_neto || 0),
      iva_pct: Number(comprobanteForm.iva_pct || 0),
      cae: comprobanteForm.cae || null,
      cae_vencimiento: comprobanteForm.cae_vencimiento || null,
      notas: comprobanteForm.notas || null,
    };
    try {
      await apiJson<Comprobante>(
        editing ? `${CONTABILIDAD_API}/contabilidad/comprobantes-emitidos/${editing.id}` : `${CONTABILIDAD_API}/contabilidad/comprobantes-emitidos`,
        { method: editing ? "PUT" : "POST", body: JSON.stringify(payload) }
      );
      setEditComprobante(null);
      setComprobanteForm(emptyComprobante());
      showToast(editing ? "Comprobante actualizado" : "Comprobante cargado");
      fetchAll();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo guardar el comprobante", false);
    }
  };

  const eliminarComprobante = async (id: number) => {
    if (!window.confirm("Eliminar comprobante?")) return;
    await fetch(`${CONTABILIDAD_API}/contabilidad/comprobantes-emitidos/${id}`, { method: "DELETE", headers: authHeaders() });
    fetchAll();
  };

  const guardarGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    const editing = editGasto;
    const payload = {
      ...gastoForm,
      proveedor_cuit: gastoForm.proveedor_cuit || null,
      letra: gastoForm.letra || null,
      punto_venta: gastoForm.punto_venta || null,
      numero: gastoForm.numero || null,
      categoria: gastoForm.categoria || null,
      importe_neto: Number(gastoForm.importe_neto || 0),
      iva_pct: Number(gastoForm.iva_pct || 0),
      percepciones: Number(gastoForm.percepciones || 0),
      notas: gastoForm.notas || null,
    };
    try {
      await apiJson<Gasto>(
        editing ? `${CONTABILIDAD_API}/contabilidad/gastos-compras/${editing.id}` : `${CONTABILIDAD_API}/contabilidad/gastos-compras`,
        { method: editing ? "PUT" : "POST", body: JSON.stringify(payload) }
      );
      setEditGasto(null);
      setGastoForm(emptyGasto());
      showToast(editing ? "Gasto actualizado" : "Gasto cargado");
      fetchAll();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo guardar el gasto", false);
    }
  };

  const eliminarGasto = async (id: number) => {
    if (!window.confirm("Eliminar gasto?")) return;
    await fetch(`${CONTABILIDAD_API}/contabilidad/gastos-compras/${id}`, { method: "DELETE", headers: authHeaders() });
    fetchAll();
  };

  const guardarMovimientoCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    const editing = editMovimiento;
    const payload = {
      ...movimientoForm,
      monto: Number(movimientoForm.monto || 0),
      medio: movimientoForm.medio || null,
      referencia: movimientoForm.referencia || null,
      notas: movimientoForm.notas || null,
    };
    try {
      await apiJson<MovimientoCaja>(
        editing ? `${CONTABILIDAD_API}/contabilidad/movimientos-caja/${editing.id}` : `${CONTABILIDAD_API}/contabilidad/movimientos-caja`,
        { method: editing ? "PUT" : "POST", body: JSON.stringify(payload) }
      );
      setEditMovimiento(null);
      setMovimientoForm(emptyMovimientoCaja());
      showToast(editing ? "Movimiento actualizado" : "Movimiento cargado");
      fetchAll();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo guardar el movimiento", false);
    }
  };

  const eliminarMovimientoCaja = async (id: number) => {
    if (!window.confirm("Eliminar movimiento de caja?")) return;
    await fetch(`${CONTABILIDAD_API}/contabilidad/movimientos-caja/${id}`, { method: "DELETE", headers: authHeaders() });
    fetchAll();
  };

  const guardarCierre = async (nuevo: CierreMensual) => {
    try {
      const saved = await apiJson<CierreMensual>(`${CONTABILIDAD_API}/contabilidad/cierres/${periodo}`, {
        method: "PUT",
        body: JSON.stringify({
          consultas_cargadas: nuevo.consultas_cargadas,
          facturas_emitidas: nuevo.facturas_emitidas,
          gastos_cargados: nuevo.gastos_cargados,
          medicos_liquidados: nuevo.medicos_liquidados,
          iva_revisado: nuevo.iva_revisado,
          agip_revisado: nuevo.agip_revisado,
          caja_conciliada: nuevo.caja_conciliada,
          cerrado: nuevo.cerrado,
          notas: nuevo.notas || null,
        }),
      });
      setCierre(saved);
      showToast("Cierre mensual guardado");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo guardar el cierre", false);
    }
  };

  const guardarAjuste = async () => {
    try {
      await apiJson<AjusteIva>(`${CONTABILIDAD_API}/contabilidad/ajustes-iva/${periodo}`, {
        method: "PUT",
        body: JSON.stringify({ otros_creditos: Number(ajuste.otros_creditos || 0), notas: ajuste.notas || null }),
      });
      showToast("Ajuste de IVA guardado");
      fetchAll();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo guardar ajuste", false);
    }
  };

  const exportCsv = async () => {
    const res = await fetch(`${CONTABILIDAD_API}/contabilidad/exportaciones/iva/${periodo}.csv`, { headers: authHeaders() });
    if (!res.ok) {
      showToast("No se pudo exportar CSV", false);
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `docya-iva-${periodo}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const startEditObligacion = (o: Obligacion) => {
    setEditObligacion(o);
    setObligacionForm({ ...o });
  };

  const startEditComprobante = (c: Comprobante) => {
    setEditComprobante(c);
    setComprobanteForm({
      fecha: c.fecha,
      tipo_comprobante: c.tipo_comprobante,
      letra: c.letra,
      punto_venta: c.punto_venta,
      numero: c.numero,
      receptor_nombre: c.receptor_nombre,
      receptor_documento: c.receptor_documento ?? "",
      condicion_iva_receptor: c.condicion_iva_receptor ?? "",
      concepto: c.concepto,
      importe_neto: c.importe_neto,
      iva_pct: c.iva_pct,
      cae: c.cae ?? "",
      cae_vencimiento: c.cae_vencimiento,
      estado: c.estado,
      notas: c.notas ?? "",
    });
  };

  const startEditGasto = (g: Gasto) => {
    setEditGasto(g);
    setGastoForm({
      fecha: g.fecha,
      proveedor_nombre: g.proveedor_nombre,
      proveedor_cuit: g.proveedor_cuit ?? "",
      tipo_comprobante: g.tipo_comprobante,
      letra: g.letra ?? "",
      punto_venta: g.punto_venta,
      numero: g.numero,
      concepto: g.concepto,
      categoria: g.categoria ?? "",
      importe_neto: g.importe_neto,
      iva_pct: g.iva_pct,
      percepciones: g.percepciones,
      deducible_iva: g.deducible_iva,
      notas: g.notas ?? "",
    });
  };

  const startEditMovimiento = (m: MovimientoCaja) => {
    setEditMovimiento(m);
    setMovimientoForm({
      fecha: m.fecha,
      tipo: m.tipo,
      categoria: m.categoria,
      descripcion: m.descripcion,
      monto: m.monto,
      medio: m.medio ?? "",
      referencia: m.referencia ?? "",
      notas: m.notas ?? "",
    });
  };

  const cargarComprobanteSugerido = (r: { medico: string; docya20: number }) => {
    setEditComprobante(null);
    setComprobanteForm({
      ...emptyComprobante(),
      fecha: range.hasta,
      receptor_nombre: r.medico,
      concepto: `Uso de plataforma DocYa - periodo ${periodo}`,
      importe_neto: String(r.docya20.toFixed(2)),
      notas: "Generado desde resumen mensual por medico. Completar CUIT, numero y CAE luego de emitir en ARCA.",
    });
    setTab("comprobantes");
    showToast("Comprobante sugerido precargado");
  };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--main-bg)" }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-4 py-8 pt-20 md:px-8 md:pt-8">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <span className="badge badge-teal">DocYa SAS</span>
            <h1 className="mt-3 text-3xl font-black" style={{ color: "var(--text-primary)" }}>
              Contabilidad
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Carga manual de consultas, comprobantes, gastos y vencimientos para armar el resumen mensual que revisa el contador antes de entrar a ARCA.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TextInput type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
            <SmallButton onClick={fetchAll} tone="muted"><RefreshCw size={15} className={loading ? "animate-spin" : ""} />Actualizar</SmallButton>
            <SmallButton onClick={exportCsv} tone="primary"><Download size={15} />CSV IVA</SmallButton>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition"
                style={{
                  background: active ? "rgba(20,184,166,0.16)" : "rgba(255,255,255,0.04)",
                  color: active ? "var(--brand-primary-light)" : "var(--text-muted)",
                  border: `1px solid ${active ? "rgba(20,184,166,0.35)" : "var(--border-subtle)"}`,
                }}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === "arca" && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Metric icon={ReceiptText} label="IVA debito" value={money(resumen?.iva_debito_total)} helper="Consultas manuales + comprobantes emitidos" />
              <Metric icon={WalletCards} label="MP absorbido" value={money(resumen?.comision_mp_neta)} helper="Costo DocYa por Mercado Pago 6%" color="#60a5fa" />
              <Metric icon={Calculator} label="Margen DocYa" value={money(resumen?.margen_docya_post_mp)} helper="Comision DocYa menos MP absorbido" color="#fbbf24" />
              <Metric icon={Landmark} label="AGIP IIBB" value={money(resumen?.agip_iibb_estimado)} helper={`Sobre DocYa 20% (${Number(resumen?.agip_iibb_pct ?? 0).toLocaleString("es-AR")}%)`} color="#f87171" />
            </div>

            <Card className="p-5">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>Resumen mensual {periodo}</h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Base para revisar y trasladar al servicio vigente de ARCA.</p>
                </div>
                {checklist && (
                  <span className={`badge ${checklist.listo_para_revisar ? "badge-green" : "badge-yellow"}`}>
                    {checklist.listo_para_revisar ? "Listo para revisar" : "Con pendientes"}
                  </span>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Metric icon={ReceiptText} label="Consultas cargadas" value={resumen?.consultas_cantidad ?? 0} helper={`Total pacientes ${money(resumen?.total_consultas_paciente)}`} />
                <Metric icon={CheckCircle2} label="Medicos 80%" value={money(resumen?.neto_medicos_total)} helper="Importe que corresponde liquidar a profesionales" color="#4ade80" />
                <Metric icon={Calculator} label="DocYa 20%" value={money(resumen?.comision_docya_neta)} helper="Base que DocYa factura por uso de plataforma" color="var(--brand-primary-light)" />
                <Metric icon={WalletCards} label="Mercado Pago 6%" value={money(resumen?.comision_mp_neta)} helper={`IVA credito MP ${money(resumen?.iva_credito_mp)}`} color="#60a5fa" />
                <Metric icon={Landmark} label="AGIP a pagar" value={money(resumen?.agip_iibb_estimado)} helper={`Base imponible ${money(resumen?.agip_base_imponible)}`} color="#f87171" />
                <Metric icon={FileText} label="Comprobantes" value={resumen?.comprobantes_cantidad ?? 0} helper={`Debito extra ${money(resumen?.iva_debito_comprobantes)}`} />
                <Metric icon={WalletCards} label="Gastos" value={resumen?.gastos_cantidad ?? 0} helper={`Credito gastos ${money(resumen?.iva_credito_gastos)}`} />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <Field label="Otros creditos IVA / notas de credito">
                  <TextInput value={ajuste.otros_creditos} onChange={(e) => setAjuste({ ...ajuste, otros_creditos: e.target.value })} type="number" min={0} step="0.01" />
                </Field>
                <Field label="Notas para el contador">
                  <TextInput value={ajuste.notas ?? ""} onChange={(e) => setAjuste({ ...ajuste, notas: e.target.value })} placeholder="Ej: honorarios contador, ajustes, saldos..." />
                </Field>
              </div>
              <div className="mt-3">
                <SmallButton onClick={guardarAjuste} tone="success"><Save size={15} />Guardar ajuste</SmallButton>
              </div>
              {checklist && checklist.pendientes.length > 0 && (
                <div className="mt-5 rounded-xl p-4" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.24)" }}>
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: "#fbbf24" }}>
                    <AlertTriangle size={16} /> Pendientes antes de ARCA
                  </div>
                  <ul className="space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    {checklist.pendientes.map((p) => <li key={p}>- {p}</li>)}
                  </ul>
                </div>
              )}
            </Card>
          </div>
        )}

        {tab === "consultas" && (
          <div className="space-y-5">
            <Card className="p-5">
              <h2 className="mb-4 text-lg font-black" style={{ color: "var(--text-primary)" }}>Cargar consulta facturada</h2>
              <form onSubmit={guardarConsulta} className="grid gap-3 md:grid-cols-5">
                <Field label="Fecha"><TextInput type="date" value={consultaForm.fecha} onChange={(e) => setConsultaForm({ ...consultaForm, fecha: e.target.value })} required /></Field>
                <Field label="Medico"><TextInput value={consultaForm.medico} onChange={(e) => setConsultaForm({ ...consultaForm, medico: e.target.value })} required /></Field>
                <Field label="Tipo"><TextInput value={consultaForm.tipo} onChange={(e) => setConsultaForm({ ...consultaForm, tipo: e.target.value })} required /></Field>
                <Field label="Precio paciente"><TextInput type="number" min={0} step="0.01" value={consultaForm.precio} onChange={(e) => setConsultaForm({ ...consultaForm, precio: e.target.value })} required /></Field>
                <div className="flex items-end"><SmallButton type="submit" tone="primary"><Plus size={15} />Agregar</SmallButton></div>
              </form>
            </Card>
            <DataTable
              headers={["Medico", "Consultas", "Total pacientes", "Facturar DocYa 20%", "Liquidar medico 80%", "MP absorbido", "Margen DocYa", ""]}
              rows={resumenPorMedico.map((r) => [
                r.medico,
                r.cantidad,
                money(r.totalPaciente),
                money(r.docya20),
                money(r.medico80),
                money(r.mp6),
                money(r.margenDocya),
                <SmallButton key={r.medico} onClick={() => cargarComprobanteSugerido(r)} tone="primary"><FileText size={14} />Comprobante</SmallButton>,
              ])}
              empty="No hay consultas para agrupar por medico en este periodo."
            />
            <DataTable
              headers={["Fecha", "Medico", "Precio", "Medico 80%", "DocYa 20%", "MP 6%", "Margen DocYa", ""]}
              rows={consultas.map((r) => [
                fmtFecha(r.fecha),
                r.medico,
                money(r.precio),
                money(r.neto_medico_importe),
                money(r.comision_docya_importe),
                money(r.comision_mp_importe),
                money(r.margen_docya_post_mp),
                <SmallButton key={r.id} onClick={() => eliminarConsulta(r.id)} tone="danger" title="Eliminar"><Trash2 size={14} /></SmallButton>,
              ])}
              empty="No hay consultas cargadas en este periodo."
            />
          </div>
        )}

        {tab === "comprobantes" && (
          <div className="space-y-5">
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>{editComprobante ? "Editar comprobante" : "Cargar comprobante emitido"}</h2>
                {editComprobante && <SmallButton onClick={() => { setEditComprobante(null); setComprobanteForm(emptyComprobante()); }}><X size={14} />Cancelar</SmallButton>}
              </div>
              <form onSubmit={guardarComprobante} className="grid gap-3 md:grid-cols-4">
                <Field label="Fecha"><TextInput type="date" value={comprobanteForm.fecha} onChange={(e) => setComprobanteForm({ ...comprobanteForm, fecha: e.target.value })} required /></Field>
                <Field label="Tipo"><TextInput value={comprobanteForm.tipo_comprobante} onChange={(e) => setComprobanteForm({ ...comprobanteForm, tipo_comprobante: e.target.value })} required /></Field>
                <Field label="Letra"><TextInput value={comprobanteForm.letra} onChange={(e) => setComprobanteForm({ ...comprobanteForm, letra: e.target.value })} required /></Field>
                <Field label="Estado">
                  <SelectInput value={comprobanteForm.estado} onChange={(e) => setComprobanteForm({ ...comprobanteForm, estado: e.target.value as Comprobante["estado"] })}>
                    <option value="emitido">Emitido</option>
                    <option value="borrador">Borrador</option>
                    <option value="anulado">Anulado</option>
                  </SelectInput>
                </Field>
                <Field label="Punto venta"><TextInput type="number" min={1} value={comprobanteForm.punto_venta} onChange={(e) => setComprobanteForm({ ...comprobanteForm, punto_venta: Number(e.target.value || 1) })} required /></Field>
                <Field label="Numero"><TextInput type="number" min={1} value={comprobanteForm.numero} onChange={(e) => setComprobanteForm({ ...comprobanteForm, numero: Number(e.target.value || 1) })} required /></Field>
                <Field label="Receptor"><TextInput value={comprobanteForm.receptor_nombre} onChange={(e) => setComprobanteForm({ ...comprobanteForm, receptor_nombre: e.target.value })} required /></Field>
                <Field label="CUIT/DNI"><TextInput value={comprobanteForm.receptor_documento ?? ""} onChange={(e) => setComprobanteForm({ ...comprobanteForm, receptor_documento: e.target.value })} /></Field>
                <Field label="Concepto"><TextInput value={comprobanteForm.concepto} onChange={(e) => setComprobanteForm({ ...comprobanteForm, concepto: e.target.value })} required /></Field>
                <Field label="Neto"><TextInput type="number" min={0} step="0.01" value={comprobanteForm.importe_neto} onChange={(e) => setComprobanteForm({ ...comprobanteForm, importe_neto: e.target.value })} required /></Field>
                <Field label="IVA %"><TextInput type="number" min={0} max={100} step="0.01" value={comprobanteForm.iva_pct} onChange={(e) => setComprobanteForm({ ...comprobanteForm, iva_pct: e.target.value })} required /></Field>
                <Field label="CAE"><TextInput value={comprobanteForm.cae ?? ""} onChange={(e) => setComprobanteForm({ ...comprobanteForm, cae: e.target.value })} /></Field>
                <div className="md:col-span-4"><SmallButton type="submit" tone="primary"><Save size={15} />Guardar comprobante</SmallButton></div>
              </form>
            </Card>
            <DataTable
              headers={["Fecha", "Comprobante", "Receptor", "Neto", "IVA debito", "Total", "Estado", ""]}
              rows={comprobantes.map((c) => [
                fmtFecha(c.fecha),
                `${c.tipo_comprobante} ${c.letra} ${c.punto_venta}-${c.numero}`,
                c.receptor_nombre,
                money(c.importe_neto),
                money(c.iva_debito),
                money(c.importe_total),
                c.estado,
                <div key={c.id} className="flex gap-2"><SmallButton onClick={() => startEditComprobante(c)}><Pencil size={14} /></SmallButton><SmallButton onClick={() => eliminarComprobante(c.id)} tone="danger"><Trash2 size={14} /></SmallButton></div>,
              ])}
              empty="No hay comprobantes cargados en este periodo."
            />
          </div>
        )}

        {tab === "gastos" && (
          <div className="space-y-5">
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>{editGasto ? "Editar gasto" : "Cargar gasto / compra"}</h2>
                {editGasto && <SmallButton onClick={() => { setEditGasto(null); setGastoForm(emptyGasto()); }}><X size={14} />Cancelar</SmallButton>}
              </div>
              <form onSubmit={guardarGasto} className="grid gap-3 md:grid-cols-4">
                <Field label="Fecha"><TextInput type="date" value={gastoForm.fecha} onChange={(e) => setGastoForm({ ...gastoForm, fecha: e.target.value })} required /></Field>
                <Field label="Proveedor"><TextInput value={gastoForm.proveedor_nombre} onChange={(e) => setGastoForm({ ...gastoForm, proveedor_nombre: e.target.value })} required /></Field>
                <Field label="CUIT"><TextInput value={gastoForm.proveedor_cuit ?? ""} onChange={(e) => setGastoForm({ ...gastoForm, proveedor_cuit: e.target.value })} /></Field>
                <Field label="Categoria"><TextInput value={gastoForm.categoria ?? ""} onChange={(e) => setGastoForm({ ...gastoForm, categoria: e.target.value })} /></Field>
                <Field label="Concepto"><TextInput value={gastoForm.concepto} onChange={(e) => setGastoForm({ ...gastoForm, concepto: e.target.value })} required /></Field>
                <Field label="Neto"><TextInput type="number" min={0} step="0.01" value={gastoForm.importe_neto} onChange={(e) => setGastoForm({ ...gastoForm, importe_neto: e.target.value })} required /></Field>
                <Field label="IVA %"><TextInput type="number" min={0} max={100} step="0.01" value={gastoForm.iva_pct} onChange={(e) => setGastoForm({ ...gastoForm, iva_pct: e.target.value })} required /></Field>
                <Field label="Percepciones"><TextInput type="number" min={0} step="0.01" value={gastoForm.percepciones} onChange={(e) => setGastoForm({ ...gastoForm, percepciones: e.target.value })} /></Field>
                <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
                  <input type="checkbox" checked={gastoForm.deducible_iva} onChange={(e) => setGastoForm({ ...gastoForm, deducible_iva: e.target.checked })} />
                  IVA computable
                </label>
                <div className="md:col-span-4"><SmallButton type="submit" tone="primary"><Save size={15} />Guardar gasto</SmallButton></div>
              </form>
            </Card>
            <DataTable
              headers={["Fecha", "Proveedor", "Concepto", "Neto", "IVA credito", "Percepciones", "Total", ""]}
              rows={gastos.map((g) => [
                fmtFecha(g.fecha),
                g.proveedor_nombre,
                g.concepto,
                money(g.importe_neto),
                money(g.iva_credito),
                money(g.percepciones),
                money(g.importe_total),
                <div key={g.id} className="flex gap-2"><SmallButton onClick={() => startEditGasto(g)}><Pencil size={14} /></SmallButton><SmallButton onClick={() => eliminarGasto(g.id)} tone="danger"><Trash2 size={14} /></SmallButton></div>,
              ])}
              empty="No hay gastos cargados en este periodo."
            />
          </div>
        )}

        {tab === "caja" && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <Metric icon={Banknote} label="Ingresos" value={money(resumenCaja?.ingresos)} helper="Entradas registradas en el mes" color="#4ade80" />
              <Metric icon={WalletCards} label="Egresos" value={money(resumenCaja?.egresos)} helper="Pagos, impuestos, gastos y liquidaciones" color="#f87171" />
              <Metric icon={Calculator} label="Saldo caja" value={money(resumenCaja?.saldo)} helper={`${resumenCaja?.movimientos_cantidad ?? 0} movimientos cargados`} color="var(--brand-primary-light)" />
            </div>

            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>{editMovimiento ? "Editar movimiento" : "Cargar movimiento de caja"}</h2>
                {editMovimiento && <SmallButton onClick={() => { setEditMovimiento(null); setMovimientoForm(emptyMovimientoCaja()); }}><X size={14} />Cancelar</SmallButton>}
              </div>
              <form onSubmit={guardarMovimientoCaja} className="grid gap-3 md:grid-cols-4">
                <Field label="Fecha"><TextInput type="date" value={movimientoForm.fecha} onChange={(e) => setMovimientoForm({ ...movimientoForm, fecha: e.target.value })} required /></Field>
                <Field label="Tipo">
                  <SelectInput value={movimientoForm.tipo} onChange={(e) => setMovimientoForm({ ...movimientoForm, tipo: e.target.value as MovimientoCaja["tipo"] })}>
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                  </SelectInput>
                </Field>
                <Field label="Categoria"><TextInput value={movimientoForm.categoria} onChange={(e) => setMovimientoForm({ ...movimientoForm, categoria: e.target.value })} required /></Field>
                <Field label="Monto"><TextInput type="number" min={0} step="0.01" value={movimientoForm.monto} onChange={(e) => setMovimientoForm({ ...movimientoForm, monto: e.target.value })} required /></Field>
                <Field label="Descripcion"><TextInput value={movimientoForm.descripcion} onChange={(e) => setMovimientoForm({ ...movimientoForm, descripcion: e.target.value })} required /></Field>
                <Field label="Medio"><TextInput value={movimientoForm.medio ?? ""} onChange={(e) => setMovimientoForm({ ...movimientoForm, medio: e.target.value })} placeholder="Banco, MP, efectivo..." /></Field>
                <Field label="Referencia"><TextInput value={movimientoForm.referencia ?? ""} onChange={(e) => setMovimientoForm({ ...movimientoForm, referencia: e.target.value })} /></Field>
                <div className="flex items-end"><SmallButton type="submit" tone="primary"><Save size={15} />Guardar</SmallButton></div>
              </form>
            </Card>

            <DataTable
              headers={["Fecha", "Tipo", "Categoria", "Descripcion", "Monto", "Medio", ""]}
              rows={movimientosCaja.map((m) => [
                fmtFecha(m.fecha),
                m.tipo,
                m.categoria,
                m.descripcion,
                money(m.monto),
                m.medio ?? "",
                <div key={m.id} className="flex gap-2"><SmallButton onClick={() => startEditMovimiento(m)}><Pencil size={14} /></SmallButton><SmallButton onClick={() => eliminarMovimientoCaja(m.id)} tone="danger"><Trash2 size={14} /></SmallButton></div>,
              ])}
              empty="No hay movimientos de caja cargados en este periodo."
            />
          </div>
        )}

        {tab === "cierre" && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <Metric icon={ClipboardCheck} label="Estado del mes" value={cierre.cerrado ? "Cerrado" : "Abierto"} helper={cierre.cerrado_en ? `Cerrado ${fmtFecha(cierre.cerrado_en.slice(0, 10))}` : "Checklist administrativo mensual"} color={cierre.cerrado ? "#4ade80" : "#fbbf24"} />
              <Metric icon={ReceiptText} label="Facturacion DocYa" value={money(resumen?.comision_docya_neta)} helper="Total sugerido a facturar a medicos" />
              <Metric icon={Banknote} label="Caja" value={money(resumenCaja?.saldo)} helper="Saldo manual conciliado del periodo" color="#60a5fa" />
            </div>

            <Card className="p-5">
              <div className="mb-4 flex flex-col gap-1">
                <h2 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>Cierre mensual {periodo}</h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Marcá cada paso cuando lo hayas revisado. Esto es tu control administrativo de la SAS.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["consultas_cargadas", "Consultas cargadas"],
                  ["facturas_emitidas", "Facturas a medicos emitidas"],
                  ["gastos_cargados", "Gastos y MP cargados"],
                  ["medicos_liquidados", "Medicos liquidados"],
                  ["iva_revisado", "IVA ARCA revisado"],
                  ["agip_revisado", "AGIP revisado"],
                  ["caja_conciliada", "Caja conciliada"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(cierre[key as keyof CierreMensual])}
                      onChange={(e) => {
                        const next = { ...cierre, [key]: e.target.checked };
                        setCierre(next);
                        guardarCierre(next);
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="mt-4">
                <Field label="Notas del cierre">
                  <TextArea rows={3} value={cierre.notas ?? ""} onChange={(e) => setCierre({ ...cierre, notas: e.target.value })} placeholder="Observaciones, pagos pendientes, diferencias de caja..." />
                </Field>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <SmallButton onClick={() => guardarCierre(cierre)} tone="success"><Save size={15} />Guardar notas</SmallButton>
                <SmallButton onClick={() => guardarCierre({ ...cierre, cerrado: !cierre.cerrado })} tone={cierre.cerrado ? "muted" : "primary"}>
                  <CheckCircle2 size={15} />{cierre.cerrado ? "Reabrir mes" : "Cerrar mes"}
                </SmallButton>
              </div>
            </Card>
          </div>
        )}

        {tab === "vencimientos" && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Metric icon={AlertTriangle} label="Vencidos" value={vencidos} helper="Sin marcar como presentados" color="#f87171" />
              <Metric icon={Bell} label="Urgentes" value={urgentes} helper="Vencen dentro de 3 dias" color="#fbbf24" />
              <Metric icon={CalendarClock} label="Proximos" value={filasVencimientos.length} helper="Obligaciones activas" />
              <Metric icon={Calculator} label="Inactivas" value={obligaciones.filter((o) => !o.activa).length} helper="No aparecen en calendario" color="#a78bfa" />
            </div>

            <Card className="p-5">
              <h2 className="mb-4 text-lg font-black" style={{ color: "var(--text-primary)" }}>{editObligacion ? "Editar obligacion" : "Nueva obligacion"}</h2>
              <form onSubmit={guardarObligacion} className="grid gap-3 md:grid-cols-5">
                <Field label="Nombre"><TextInput value={obligacionForm.nombre} onChange={(e) => setObligacionForm({ ...obligacionForm, nombre: e.target.value })} required /></Field>
                <Field label="Organismo"><TextInput value={obligacionForm.organismo} onChange={(e) => setObligacionForm({ ...obligacionForm, organismo: e.target.value })} required /></Field>
                <Field label="Periodicidad">
                  <SelectInput value={obligacionForm.periodicidad} onChange={(e) => setObligacionForm({ ...obligacionForm, periodicidad: e.target.value as Periodicidad })}>
                    <option value="mensual">Mensual</option>
                    <option value="anual">Anual</option>
                  </SelectInput>
                </Field>
                <Field label="Dia"><TextInput type="number" min={1} max={obligacionForm.periodicidad === "mensual" ? 28 : 31} value={obligacionForm.diaVencimiento} onChange={(e) => setObligacionForm({ ...obligacionForm, diaVencimiento: Number(e.target.value || 1) })} /></Field>
                <div className="flex items-end gap-2"><SmallButton type="submit" tone="primary"><Save size={15} />Guardar</SmallButton>{editObligacion && <SmallButton onClick={() => { setEditObligacion(null); setObligacionForm(emptyObligacion()); }}>Cancelar</SmallButton>}</div>
                <div className="md:col-span-5"><TextArea rows={2} value={obligacionForm.notas ?? ""} onChange={(e) => setObligacionForm({ ...obligacionForm, notas: e.target.value })} placeholder="Notas, cronograma, contador..." /></div>
              </form>
            </Card>

            <DataTable
              headers={["Obligacion", "Organismo", "Periodo", "Vence", "Estado", ""]}
              rows={filasVencimientos.map(({ obligacion, periodo: per, fecha, estado }) => [
                obligacion.nombre,
                obligacion.organismo,
                periodoLabel(per, obligacion.periodicidad),
                fmtFecha(fecha),
                <span key={`${obligacion.id}-estado`} className={`badge ${toneClass(estado.tone)}`}>{estado.label}</span>,
                <div key={obligacion.id} className="flex flex-wrap gap-2">
                  <SmallButton onClick={() => marcarCumplido(obligacion, per)} tone="success"><CheckCircle2 size={14} />Presentada</SmallButton>
                  <SmallButton onClick={() => startEditObligacion(obligacion)}><Pencil size={14} /></SmallButton>
                  <SmallButton onClick={() => eliminarObligacion(obligacion)} tone="danger"><Trash2 size={14} /></SmallButton>
                </div>,
              ])}
              empty="No hay vencimientos activos."
            />
          </div>
        )}
      </main>

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-bold shadow-lg"
          style={{
            background: toast.ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            color: toast.ok ? "#4ade80" : "#f87171",
            border: `1px solid ${toast.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function DataTable({ headers, rows, empty }: { headers: string[]; rows: React.ReactNode[][]; empty: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table min-w-full">
          <thead>
            <tr>
              {headers.map((h) => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={headers.length} className="text-center">{empty}</td></tr>
            ) : rows.map((row, idx) => (
              <tr key={idx}>
                {row.map((cell, i) => <td key={i}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
