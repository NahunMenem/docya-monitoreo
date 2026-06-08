"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import Sidebar from "@/components/sidebar";
import LibroConsultas from "./LibroConsultas";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Calculator,
  CalendarClock,
  Check,
  CheckCircle2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

const CONTABILIDAD_API = process.env.NEXT_PUBLIC_CONTABILIDAD_API_BASE!;

type Periodicidad = "mensual" | "anual";
type Tono = "red" | "yellow" | "teal" | "green";

type Obligacion = {
  id: number;
  nombre: string;
  organismo: string;
  periodicidad: Periodicidad;
  diaVencimiento: number; // 1-28 (mensual) o 1-31 (anual)
  mesVencimiento?: number; // 1-12, solo para periodicidad "anual"
  notas?: string;
  activa: boolean;
  ultimoPeriodoCumplido?: string; // "YYYY-MM" (mensual) o "YYYY" (anual)
};

// Forma en la que viaja la obligacion desde/hacia la API de contabilidad
// (en snake_case, como el resto del backend de DocYa).
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

function toApiPayload(data: Omit<Obligacion, "id">) {
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

function authHeaders() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("docya_token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

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
    if (!yaCumplido && fecha >= hoy) {
      return { fecha, periodo };
    }
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

function fmtFecha(d: Date) {
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function periodoLabel(periodo: string, periodicidad: Periodicidad) {
  if (periodicidad === "anual") return `Periodo ${periodo}`;
  const [anio, mes] = periodo.split("-");
  const idx = Number(mes) - 1;
  return `${MESES[idx] ?? mes} ${anio}`;
}

function emptyForm(): Omit<Obligacion, "id"> {
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
    <div className="rounded-2xl p-5" style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}>
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "rgba(20,184,166,0.1)" }}>
        <Icon size={20} style={{ color }} />
      </div>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="mt-1 text-2xl font-black" style={{ color: "var(--text-primary)" }}>{value}</p>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{helper}</p>
    </div>
  );
}

function ObligacionModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Obligacion | null;
  onClose: () => void;
  onSave: (data: Omit<Obligacion, "id">) => void;
}) {
  const [form, setForm] = useState<Omit<Obligacion, "id">>(initial ?? emptyForm());
  const isEdit = !!initial;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl p-6 space-y-4" style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
            {isEdit ? "Editar obligacion" : "Nueva obligacion"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-white/5 transition-colors" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Nombre</label>
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: IVA - Posicion mensual (F. 2002)"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Organismo</label>
              <input
                value={form.organismo}
                onChange={(e) => setForm({ ...form, organismo: e.target.value })}
                placeholder="ARCA, AGIP, Contador..."
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Periodicidad</label>
              <select
                value={form.periodicidad}
                onChange={(e) => {
                  const periodicidad = e.target.value as Periodicidad;
                  const diaVencimiento = periodicidad === "mensual" ? Math.min(28, form.diaVencimiento) : form.diaVencimiento;
                  setForm({ ...form, periodicidad, diaVencimiento });
                }}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
              >
                <option value="mensual">Mensual</option>
                <option value="anual">Anual</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Dia del vencimiento</label>
              <input
                type="number"
                min={1}
                max={form.periodicidad === "anual" ? 31 : 28}
                value={form.diaVencimiento}
                onChange={(e) => {
                  const tope = form.periodicidad === "anual" ? 31 : 28;
                  setForm({ ...form, diaVencimiento: Math.min(tope, Math.max(1, Number(e.target.value) || 1)) });
                }}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
              />
              {form.periodicidad === "mensual" && (
                <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>Maximo 28 para que aplique a todos los meses (incluido febrero).</p>
              )}
            </div>
            {form.periodicidad === "anual" && (
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Mes del vencimiento</label>
                <select
                  value={form.mesVencimiento ?? 1}
                  onChange={(e) => setForm({ ...form, mesVencimiento: Number(e.target.value) })}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
                >
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Notas</label>
            <textarea
              value={form.notas ?? ""}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              rows={2}
              placeholder="Aclaraciones, links al cronograma oficial, etc."
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
            />
          </div>

          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
            <input
              type="checkbox"
              checked={form.activa}
              onChange={(e) => setForm({ ...form, activa: e.target.checked })}
            />
            Obligacion activa (mostrar en el calendario y avisar)
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-bold transition hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}
          >
            Cancelar
          </button>
          <button
            onClick={() => form.nombre.trim() && onSave(form)}
            disabled={!form.nombre.trim()}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--brand-primary)", color: "#fff" }}
          >
            <Check size={16} />
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

type Tab = "vencimientos" | "libro";

export default function ContabilidadPage() {
  const [tab, setTab] = useState<Tab>("vencimientos");
  const [obligaciones, setObligaciones] = useState<Obligacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ obligacion: Obligacion | null } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Obligacion | null>(null);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchObligaciones = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${CONTABILIDAD_API}/contabilidad/obligaciones`, {
        headers: authHeaders(),
      });
      if (!res.ok) {
        showToast("No se pudieron cargar las obligaciones", false);
        return;
      }
      const data: ApiObligacion[] = await res.json();
      setObligaciones(data.map(fromApi));
    } catch {
      showToast("No se pudo conectar con el servicio de contabilidad", false);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchObligaciones();
  }, [fetchObligaciones]);

  const today = useMemo(() => new Date(), []);

  const filas = useMemo(() => {
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

  const inactivas = useMemo(() => obligaciones.filter((o) => !o.activa), [obligaciones]);

  const vencidos = filas.filter((f) => f.dias < 0).length;
  const urgentes = filas.filter((f) => f.dias >= 0 && f.dias <= 3).length;
  const proximos = filas.filter((f) => f.dias > 3 && f.dias <= 10).length;
  const activas = filas.length;

  const marcarCumplido = async (ob: Obligacion, periodo: string) => {
    try {
      const res = await fetch(`${CONTABILIDAD_API}/contabilidad/obligaciones/${ob.id}/marcar-presentada`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ periodo }),
      });
      if (!res.ok) {
        showToast("No se pudo marcar la obligacion como presentada", false);
        return;
      }
      const data: ApiObligacion = await res.json();
      setObligaciones((prev) => prev.map((o) => (o.id === ob.id ? fromApi(data) : o)));
      showToast("Obligacion marcada como presentada para ese periodo");
    } catch {
      showToast("No se pudo conectar con el servicio de contabilidad", false);
    }
  };

  const guardarObligacion = async (data: Omit<Obligacion, "id">) => {
    const editando = modal?.obligacion ?? null;
    try {
      const res = await fetch(
        editando
          ? `${CONTABILIDAD_API}/contabilidad/obligaciones/${editando.id}`
          : `${CONTABILIDAD_API}/contabilidad/obligaciones`,
        {
          method: editando ? "PUT" : "POST",
          headers: authHeaders(),
          body: JSON.stringify(toApiPayload(data)),
        }
      );
      if (!res.ok) {
        const detalle = await res.json().catch(() => null);
        showToast(detalle?.detail ?? "No se pudo guardar la obligacion", false);
        return;
      }
      const saved: ApiObligacion = await res.json();
      setObligaciones((prev) =>
        editando ? prev.map((o) => (o.id === saved.id ? fromApi(saved) : o)) : [...prev, fromApi(saved)]
      );
      showToast(editando ? "Obligacion actualizada" : "Obligacion agregada");
      setModal(null);
    } catch {
      showToast("No se pudo conectar con el servicio de contabilidad", false);
    }
  };

  const eliminarObligacion = async (ob: Obligacion) => {
    try {
      const res = await fetch(`${CONTABILIDAD_API}/contabilidad/obligaciones/${ob.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok && res.status !== 204) {
        showToast("No se pudo eliminar la obligacion", false);
        return;
      }
      setObligaciones((prev) => prev.filter((o) => o.id !== ob.id));
      showToast("Obligacion eliminada");
    } catch {
      showToast("No se pudo conectar con el servicio de contabilidad", false);
    } finally {
      setConfirmDelete(null);
    }
  };

  const toggleActiva = async (ob: Obligacion) => {
    try {
      const res = await fetch(`${CONTABILIDAD_API}/contabilidad/obligaciones/${ob.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(toApiPayload({ ...ob, activa: !ob.activa })),
      });
      if (!res.ok) {
        showToast("No se pudo actualizar la obligacion", false);
        return;
      }
      const saved: ApiObligacion = await res.json();
      setObligaciones((prev) => prev.map((o) => (o.id === saved.id ? fromApi(saved) : o)));
    } catch {
      showToast("No se pudo conectar con el servicio de contabilidad", false);
    }
  };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--main-bg)" }}>
      <Sidebar />

      <main className="flex-1 overflow-y-auto px-4 py-8 pt-20 md:px-8 md:pt-8">
        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="badge badge-teal">Contabilidad</span>
            </div>
            <h1 className="text-3xl font-black" style={{ color: "var(--text-primary)" }}>
              {tab === "vencimientos" ? "Calendario de vencimientos" : "Libro de consultas"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {tab === "vencimientos"
                ? "Seguimiento de los vencimientos impositivos y contables de DocYa SAS (IVA, cargas sociales, Ingresos Brutos, Ganancias, balance anual). Pensado como recordatorio interno: la presentacion ante ARCA / AGIP la sigue haciendo el contador."
                : "Registro de consultas facturadas, con el calculo automatico de comision DocYa, comision de Mercado Pago e IVA (debito y credito) para estimar cuanto corresponde declarar a ARCA."}
            </p>
          </div>
          {tab === "vencimientos" && (
            <div className="flex items-center gap-2">
              <button
                onClick={fetchObligaciones}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition hover:opacity-90"
                style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Actualizar
              </button>
              <button
                onClick={() => setModal({ obligacion: null })}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition hover:opacity-90"
                style={{ background: "var(--brand-primary)", color: "#fff" }}
              >
                <Plus size={16} />
                Nueva obligacion
              </button>
            </div>
          )}
        </div>

        {/* TABS */}
        <div className="mb-6 inline-flex rounded-xl p-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)" }}>
          <button
            onClick={() => setTab("vencimientos")}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition"
            style={tab === "vencimientos"
              ? { background: "var(--brand-primary)", color: "#fff" }
              : { color: "var(--text-muted)" }}
          >
            <CalendarClock size={15} />
            Calendario de vencimientos
          </button>
          <button
            onClick={() => setTab("libro")}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition"
            style={tab === "libro"
              ? { background: "var(--brand-primary)", color: "#fff" }
              : { color: "var(--text-muted)" }}
          >
            <BookOpen size={15} />
            Libro de consultas
          </button>
        </div>

        {tab === "libro" && <LibroConsultas />}

        {tab === "vencimientos" && (
        <>
        {/* DISCLAIMER */}
        <div
          className="mb-6 flex items-start gap-3 rounded-2xl p-4"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}
        >
          <AlertTriangle size={18} style={{ color: "#fbbf24" }} className="mt-0.5 shrink-0" />
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Las fechas de vencimiento de ARCA y AGIP cambian cada año segun la terminacion del CUIT y el
            cronograma oficial vigente. Los dias precargados son orientativos: revisalos con tu contador y
            ajustalos en cada obligacion (boton <Pencil size={12} className="inline" />) para que el aviso sea exacto.
          </p>
        </div>

        {/* SUMMARY CARDS */}
        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={AlertTriangle} label="Vencidos" value={vencidos} color="#f87171"
            helper="Obligaciones con fecha ya pasada sin marcar como presentadas" />
          <SummaryCard icon={Bell} label="Urgentes" value={urgentes} color="#fbbf24"
            helper="Vencen dentro de los proximos 3 dias" />
          <SummaryCard icon={CalendarClock} label="Proximos" value={proximos} color="var(--brand-primary-light)"
            helper="Vencen entre 4 y 10 dias" />
          <SummaryCard icon={Calculator} label="Obligaciones activas" value={activas} color="#a78bfa"
            helper={`${inactivas.length} inactivas / sin aplicar todavia`} />
        </section>

        {/* LISTADO */}
        <section className="mb-6 rounded-2xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <h2 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>Proximos vencimientos</h2>
          </div>

          {loading ? (
            <div className="px-5 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              Cargando obligaciones...
            </div>
          ) : filas.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              No hay obligaciones activas. Agrega una con &quot;Nueva obligacion&quot;.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
              {filas.map(({ obligacion, fecha, periodo, estado }) => (
                <div key={obligacion.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border-subtle)" }}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{obligacion.nombre}</p>
                      <span className="badge badge-blue">{obligacion.organismo}</span>
                      <span className={`badge ${toneClass(estado.tone)}`}>{estado.label}</span>
                    </div>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      {periodoLabel(periodo, obligacion.periodicidad)} · vence el {fmtFecha(fecha)}
                      {obligacion.notas ? ` · ${obligacion.notas}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => marcarCumplido(obligacion, periodo)}
                      title="Marcar como presentada/pagada para este periodo"
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition hover:opacity-80"
                      style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" }}
                    >
                      <CheckCircle2 size={14} />
                      Presentada
                    </button>
                    <button
                      onClick={() => setModal({ obligacion })}
                      title="Editar"
                      className="rounded-lg p-1.5 transition hover:opacity-80"
                      style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(obligacion)}
                      title="Eliminar"
                      className="rounded-lg p-1.5 transition hover:opacity-80"
                      style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* INACTIVAS */}
        {inactivas.length > 0 && (
          <section className="rounded-2xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <h2 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>Inactivas / sin aplicar todavia</h2>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                No aparecen en el calendario ni generan avisos. Activalas cuando correspondan (por ejemplo,
                anticipos de Ganancias luego de la primera DDJJ anual).
              </p>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
              {inactivas.map((o) => (
                <div key={o.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{o.nombre}</p>
                      <span className="badge badge-blue">{o.organismo}</span>
                    </div>
                    {o.notas && <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{o.notas}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => toggleActiva(o)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition hover:opacity-80"
                      style={{ background: "rgba(20,184,166,0.12)", color: "var(--brand-primary-light)", border: "1px solid rgba(20,184,166,0.25)" }}
                    >
                      Activar
                    </button>
                    <button
                      onClick={() => setModal({ obligacion: o })}
                      title="Editar"
                      className="rounded-lg p-1.5 transition hover:opacity-80"
                      style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(o)}
                      title="Eliminar"
                      className="rounded-lg p-1.5 transition hover:opacity-80"
                      style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        </>
        )}
      </main>

      {modal && (
        <ObligacionModal
          initial={modal.obligacion}
          onClose={() => setModal(null)}
          onSave={guardarObligacion}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl p-6 space-y-4" style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}>
            <h2 className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>Eliminar obligacion</h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              ¿Eliminar &quot;{confirmDelete.nombre}&quot;? Esta accion no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-xl px-4 py-2 text-sm font-bold transition hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => eliminarObligacion(confirmDelete)}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition hover:opacity-90"
                style={{ background: "#ef4444", color: "#fff" }}
              >
                <Trash2 size={16} />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

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
