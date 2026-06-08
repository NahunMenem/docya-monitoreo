"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import {
  Download,
  Plus,
  Receipt,
  Settings2,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";

const CONTABILIDAD_API = process.env.NEXT_PUBLIC_CONTABILIDAD_API_BASE!;

type Registro = {
  id: number;
  fecha: string; // YYYY-MM-DD
  medico: string;
  tipo: string;
  precio: number;
  comisionDocyaPct: number;
  comisionMpPct: number;
  ivaPct: number;
};

type ApiRegistro = {
  id: number;
  fecha: string;
  medico: string;
  tipo: string;
  precio: number | string;
  comision_docya_pct: number | string;
  comision_mp_pct: number | string;
  iva_pct: number | string;
};

type Parametros = {
  comisionDocyaPct: number;
  comisionMpPct: number;
  ivaPct: number;
};

type ApiParametros = {
  comision_docya_pct: number | string;
  comision_mp_pct: number | string;
  iva_pct: number | string;
};

const TIPOS = ["Domiciliaria", "Tele"];

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("docya_token") : null;
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function num(v: number | string) {
  return typeof v === "string" ? parseFloat(v) : v;
}

function fromApiRegistro(r: ApiRegistro): Registro {
  return {
    id: r.id,
    fecha: r.fecha,
    medico: r.medico,
    tipo: r.tipo,
    precio: num(r.precio),
    comisionDocyaPct: num(r.comision_docya_pct),
    comisionMpPct: num(r.comision_mp_pct),
    ivaPct: num(r.iva_pct),
  };
}

function fromApiParametros(p: ApiParametros): Parametros {
  return {
    comisionDocyaPct: num(p.comision_docya_pct),
    comisionMpPct: num(p.comision_mp_pct),
    ivaPct: num(p.iva_pct),
  };
}

function pesos(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function detalle(r: Registro) {
  const comisionDocya = (r.precio * r.comisionDocyaPct) / 100;
  const comisionMp = (r.precio * r.comisionMpPct) / 100;
  const ivaDebito = (comisionDocya * r.ivaPct) / 100;
  const ivaCreditoMp = (comisionMp * r.ivaPct) / 100;
  const ivaNeto = ivaDebito - ivaCreditoMp;
  const netoMedico = r.precio - comisionDocya;
  const gananciaNeta = comisionDocya - comisionMp - ivaNeto;
  return { comisionDocya, comisionMp, ivaDebito, ivaCreditoMp, ivaNeto, netoMedico, gananciaNeta };
}

function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function rangoDelMes(periodo: string) {
  const [anio, mes] = periodo.split("-").map(Number);
  const desde = `${periodo}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const hasta = `${periodo}-${String(ultimoDia).padStart(2, "0")}`;
  return { desde, hasta };
}

function labelPeriodo(periodo: string) {
  const [anio, mes] = periodo.split("-").map(Number);
  return new Date(anio, mes - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "2-digit" });
}

function SummaryCard({ icon: Icon, label, value, helper, color }: { icon: ElementType; label: string; value: string; helper?: string; color: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${color}1a`, color }}>
          <Icon size={16} />
        </div>
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
      <p className="mt-3 text-2xl font-black" style={{ color: "var(--text-primary)" }}>{value}</p>
      {helper && <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{helper}</p>}
    </div>
  );
}

export default function LibroConsultas() {
  const [periodo, setPeriodo] = useState(mesActual());
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [parametros, setParametros] = useState<Parametros>({ comisionDocyaPct: 20, comisionMpPct: 6, ivaPct: 21 });
  const [otrosCreditos, setOtrosCreditos] = useState(0);
  const [otrosCreditosInput, setOtrosCreditosInput] = useState("0");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Registro | null>(null);
  const [showAjustes, setShowAjustes] = useState(false);
  const [paramsForm, setParamsForm] = useState(parametros);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [form, setForm] = useState({ fecha: today, medico: "", tipo: TIPOS[0], precio: "" });

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { desde, hasta } = rangoDelMes(periodo);
      const [resRegistros, resParametros, resAjuste] = await Promise.all([
        fetch(`${CONTABILIDAD_API}/contabilidad/registros-consultas?desde=${desde}&hasta=${hasta}`, { headers: authHeaders() }),
        fetch(`${CONTABILIDAD_API}/contabilidad/parametros-facturacion`, { headers: authHeaders() }),
        fetch(`${CONTABILIDAD_API}/contabilidad/ajustes-iva/${periodo}`, { headers: authHeaders() }),
      ]);

      if (resRegistros.ok) {
        const data: ApiRegistro[] = await resRegistros.json();
        setRegistros(data.map(fromApiRegistro));
      } else {
        showToast("No se pudieron cargar las consultas del periodo", false);
      }

      if (resParametros.ok) {
        const data: ApiParametros = await resParametros.json();
        const p = fromApiParametros(data);
        setParametros(p);
        setParamsForm(p);
      }

      if (resAjuste.ok) {
        const data: { otros_creditos: number | string } = await resAjuste.json();
        const v = num(data.otros_creditos);
        setOtrosCreditos(v);
        setOtrosCreditosInput(String(v));
      }
    } catch {
      showToast("No se pudo conectar con el servicio de contabilidad", false);
    } finally {
      setLoading(false);
    }
  }, [periodo, showToast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filas = useMemo(
    () => registros.map((r) => ({ registro: r, ...detalle(r) })).sort((a, b) => a.registro.fecha.localeCompare(b.registro.fecha)),
    [registros]
  );

  const resumen = useMemo(() => {
    const ingresosDocya = filas.reduce((acc, f) => acc + f.comisionDocya, 0);
    const totalComisionMp = filas.reduce((acc, f) => acc + f.comisionMp, 0);
    const ivaDebito = filas.reduce((acc, f) => acc + f.ivaDebito, 0);
    const ivaCreditoMp = filas.reduce((acc, f) => acc + f.ivaCreditoMp, 0);
    const ivaNeto = ivaDebito - ivaCreditoMp - otrosCreditos;
    const gananciaNeta = ingresosDocya - totalComisionMp - ivaNeto;
    return { ingresosDocya, totalComisionMp, ivaDebito, ivaCreditoMp, ivaNeto, gananciaNeta };
  }, [filas, otrosCreditos]);

  const agregar = async () => {
    const precio = Number(form.precio);
    if (!form.medico.trim()) return showToast("Ingresa el nombre del medico", false);
    if (!precio || precio <= 0) return showToast("Ingresa un precio valido", false);

    try {
      const res = await fetch(`${CONTABILIDAD_API}/contabilidad/registros-consultas`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ fecha: form.fecha, medico: form.medico.trim(), tipo: form.tipo, precio }),
      });
      if (!res.ok) {
        const detalle = await res.json().catch(() => null);
        showToast(detalle?.detail ?? "No se pudo agregar la consulta", false);
        return;
      }
      const saved: ApiRegistro = await res.json();
      const nuevo = fromApiRegistro(saved);
      const [anio, mes] = nuevo.fecha.split("-");
      if (`${anio}-${mes}` === periodo) {
        setRegistros((prev) => [...prev, nuevo]);
      }
      setForm({ fecha: today, medico: "", tipo: TIPOS[0], precio: "" });
      showToast("Consulta agregada al libro");
    } catch {
      showToast("No se pudo conectar con el servicio de contabilidad", false);
    }
  };

  const eliminar = async (r: Registro) => {
    try {
      const res = await fetch(`${CONTABILIDAD_API}/contabilidad/registros-consultas/${r.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok && res.status !== 204) {
        showToast("No se pudo eliminar el registro", false);
        return;
      }
      setRegistros((prev) => prev.filter((x) => x.id !== r.id));
      showToast("Registro eliminado");
    } catch {
      showToast("No se pudo conectar con el servicio de contabilidad", false);
    } finally {
      setConfirmDelete(null);
    }
  };

  const guardarAjuste = async () => {
    const valor = Number(otrosCreditosInput);
    if (Number.isNaN(valor) || valor < 0) return showToast("Ingresa un monto valido", false);
    try {
      const res = await fetch(`${CONTABILIDAD_API}/contabilidad/ajustes-iva/${periodo}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ otros_creditos: valor }),
      });
      if (!res.ok) {
        showToast("No se pudo guardar el ajuste", false);
        return;
      }
      setOtrosCreditos(valor);
      showToast("Ajuste de IVA guardado");
    } catch {
      showToast("No se pudo conectar con el servicio de contabilidad", false);
    }
  };

  const guardarParametros = async () => {
    try {
      const res = await fetch(`${CONTABILIDAD_API}/contabilidad/parametros-facturacion`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          comision_docya_pct: paramsForm.comisionDocyaPct,
          comision_mp_pct: paramsForm.comisionMpPct,
          iva_pct: paramsForm.ivaPct,
        }),
      });
      if (!res.ok) {
        showToast("No se pudieron guardar los porcentajes", false);
        return;
      }
      const data: ApiParametros = await res.json();
      setParametros(fromApiParametros(data));
      showToast("Porcentajes actualizados (se aplican a las consultas nuevas)");
      setShowAjustes(false);
    } catch {
      showToast("No se pudo conectar con el servicio de contabilidad", false);
    }
  };

  const exportarCsv = () => {
    const encabezado = ["Fecha", "Medico", "Tipo", "Precio", "Comision DocYa", "Comision MP", "IVA debito", "IVA credito MP", "IVA neto", "Neto al medico"];
    const filasCsv = filas.map((f) => [
      f.registro.fecha,
      f.registro.medico,
      f.registro.tipo,
      f.registro.precio,
      f.comisionDocya.toFixed(2),
      f.comisionMp.toFixed(2),
      f.ivaDebito.toFixed(2),
      f.ivaCreditoMp.toFixed(2),
      f.ivaNeto.toFixed(2),
      f.netoMedico.toFixed(2),
    ]);
    const csv = [encabezado, ...filasCsv].map((fila) => fila.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `libro-consultas-${periodo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* CONTROLES: periodo + parametros */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Periodo</label>
          <input
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value || mesActual())}
            className="rounded-lg px-3 py-1.5 text-sm"
            style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportarCsv}
            disabled={filas.length === 0}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition hover:opacity-90 disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}
          >
            <Download size={14} />
            Exportar CSV
          </button>
          <button
            onClick={() => { setParamsForm(parametros); setShowAjustes((v) => !v); }}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition hover:opacity-90"
            style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}
          >
            <Settings2 size={14} />
            Porcentajes
          </button>
        </div>
      </div>

      {showAjustes && (
        <div className="mb-4 rounded-2xl p-4 space-y-3" style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Estos porcentajes se aplican a las consultas que cargues de ahora en adelante. Las ya cargadas
            conservan el porcentaje vigente al momento de la carga, para no alterar periodos ya declarados.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              ["comisionDocyaPct", "Comision DocYa (%)"],
              ["comisionMpPct", "Comision Mercado Pago (%)"],
              ["ivaPct", "Aliquota de IVA (%)"],
            ] as const).map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{label}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.001"
                  value={paramsForm[key]}
                  onChange={(e) => setParamsForm({ ...paramsForm, [key]: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
                />
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAjustes(false)} className="rounded-lg px-3 py-1.5 text-xs font-bold transition hover:opacity-80" style={{ color: "var(--text-muted)" }}>
              Cancelar
            </button>
            <button onClick={guardarParametros} className="rounded-lg px-3 py-1.5 text-xs font-bold transition hover:opacity-90" style={{ background: "var(--brand-primary)", color: "#fff" }}>
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* FORM ALTA */}
      <div className="mb-6 rounded-2xl p-4" style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}>
        <h2 className="mb-3 text-sm font-black" style={{ color: "var(--text-primary)" }}>Registrar consulta</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <label className="block">
            <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Fecha</span>
            <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
          </label>
          <label className="block">
            <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Medico</span>
            <input type="text" placeholder="Dr. Garcia" value={form.medico} onChange={(e) => setForm({ ...form, medico: e.target.value })}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
          </label>
          <label className="block">
            <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Tipo</span>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Precio consulta ($)</span>
            <input type="number" min={0} placeholder="40000" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
          </label>
          <button onClick={agregar} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition hover:opacity-90"
            style={{ background: "var(--brand-primary)", color: "#fff" }}>
            <Plus size={16} />
            Agregar
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Receipt} label="Consultas del mes" value={String(filas.length)} color="#60a5fa"
          helper={labelPeriodo(periodo)} />
        <SummaryCard icon={TrendingUp} label={`Ingresos DocYa (${parametros.comisionDocyaPct}%)`} value={pesos(resumen.ingresosDocya)} color="#34d399"
          helper="Base imponible de IVA debito" />
        <SummaryCard icon={Wallet} label={`Comision MP (${parametros.comisionMpPct}%)`} value={`-${pesos(resumen.totalComisionMp)}`} color="#fbbf24"
          helper="Costo de procesamiento de pagos" />
        <SummaryCard icon={Receipt} label="IVA a pagar (neto)" value={pesos(resumen.ivaNeto)} color={resumen.ivaNeto >= 0 ? "#f87171" : "#4ade80"}
          helper="Debito - credito MP - otros creditos" />
      </section>

      {/* LISTADO */}
      <section className="mb-6 rounded-2xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>Consultas registradas</h2>
        </div>
        {loading ? (
          <div className="px-5 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>Cargando...</div>
        ) : filas.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            No hay consultas cargadas para {labelPeriodo(periodo)}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  {["Fecha", "Medico", "Tipo", "Precio", "Comision", `MP ${parametros.comisionMpPct}%`, "IVA debito", "IVA MP", "IVA neto", "Al medico", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-2 text-left font-bold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                {filas.map((f) => (
                  <tr key={f.registro.id}>
                    <td className="whitespace-nowrap px-4 py-2.5" style={{ color: "var(--text-primary)" }}>{f.registro.fecha}</td>
                    <td className="whitespace-nowrap px-4 py-2.5" style={{ color: "var(--text-primary)" }}>{f.registro.medico}</td>
                    <td className="whitespace-nowrap px-4 py-2.5"><span className="badge badge-teal">{f.registro.tipo}</span></td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-bold" style={{ color: "var(--text-primary)" }}>{pesos(f.registro.precio)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5" style={{ color: "var(--text-primary)" }}>{pesos(f.comisionDocya)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5" style={{ color: "#f87171" }}>-{pesos(f.comisionMp)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5" style={{ color: "#fbbf24" }}>+{pesos(f.ivaDebito)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5" style={{ color: "#4ade80" }}>-{pesos(f.ivaCreditoMp)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-bold" style={{ color: f.ivaNeto >= 0 ? "#f87171" : "#4ade80" }}>{pesos(f.ivaNeto)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5" style={{ color: "var(--text-primary)" }}>{pesos(f.netoMedico)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <button onClick={() => setConfirmDelete(f.registro)} title="Eliminar"
                        className="rounded-lg p-1.5 transition hover:opacity-80"
                        style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* POSICION IVA DEL MES */}
      <section className="rounded-2xl p-5 space-y-3" style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}>
        <h2 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>Posicion de IVA del mes</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--text-muted)" }}>IVA debito ({parametros.ivaPct}% sobre comision DocYa)</span>
            <span className="font-bold" style={{ color: "var(--text-primary)" }}>{pesos(resumen.ivaDebito)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--text-muted)" }}>IVA credito Mercado Pago</span>
            <span className="font-bold" style={{ color: "#4ade80" }}>-{pesos(resumen.ivaCreditoMp)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span style={{ color: "var(--text-muted)" }}>Otros creditos (contador, servicios locales) — ingresa manualmente</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={otrosCreditosInput}
                onChange={(e) => setOtrosCreditosInput(e.target.value)}
                onBlur={guardarAjuste}
                className="w-28 rounded-lg px-2 py-1 text-right text-sm"
                style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
              />
            </div>
          </div>
          <div className="my-1 h-px" style={{ background: "var(--border-subtle)" }} />
          <div className="flex items-center justify-between text-base">
            <span className="font-black" style={{ color: "var(--text-primary)" }}>IVA neto a declarar</span>
            <span className="font-black" style={{ color: resumen.ivaNeto >= 0 ? "#f87171" : "#4ade80" }}>{pesos(resumen.ivaNeto)}</span>
          </div>
          <div className="flex items-center justify-between text-sm pt-1">
            <span style={{ color: "var(--text-muted)" }}>Ganancia neta de DocYa en el periodo</span>
            <span className="font-bold" style={{ color: "#34d399" }}>{pesos(resumen.gananciaNeta)}</span>
          </div>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Estimacion para uso interno. La cifra de IVA a ingresar a ARCA y de Ingresos Brutos a AGIP debe
          confirmarla tu contador, que tiene en cuenta otros creditos/debitos (compras, gastos, retenciones,
          percepciones) que no figuran en este libro.
        </p>
      </section>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl p-6 space-y-4" style={{ background: "var(--card-bg)", border: "1px solid var(--border-subtle)" }}>
            <h2 className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>Eliminar registro</h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              ¿Eliminar la consulta de &quot;{confirmDelete.medico}&quot; del {confirmDelete.fecha}? Esta accion no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="rounded-xl px-4 py-2 text-sm font-bold transition hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
                Cancelar
              </button>
              <button onClick={() => eliminar(confirmDelete)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition hover:opacity-90"
                style={{ background: "#ef4444", color: "#fff" }}>
                <Trash2 size={16} />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-bold shadow-lg"
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
