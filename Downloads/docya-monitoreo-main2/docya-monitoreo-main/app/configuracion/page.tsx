"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import { Pencil, Plus, Trash2, X, Check, MapPin, DollarSign, ToggleLeft, ToggleRight } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE!;

// ─── Types ───────────────────────────────────────────────────────────────────

type Tarifa = {
  id: number;
  tipo: string;
  monto: number;
  descripcion: string;
  activa: boolean;
};

type Zona = {
  id?: number;
  nombre: string;
  detalle: string;
  estado: "activa" | "proxima";
  orden: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  diurna: "Médico – Diurna (06:00–22:00)",
  nocturna: "Médico – Nocturna (22:00–06:00)",
  diurna_enfermero: "Enfermero – Diurna (06:00–22:00)",
  nocturna_enfermero: "Enfermero – Nocturna (22:00–06:00)",
};

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("docya_token") : null;
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ─── Tarifa Modal ─────────────────────────────────────────────────────────────

function TarifaModal({
  tarifa,
  onClose,
  onSave,
}: {
  tarifa: Partial<Tarifa>;
  onClose: () => void;
  onSave: (data: Partial<Tarifa>) => Promise<void>;
}) {
  const [form, setForm] = useState<Partial<Tarifa>>(tarifa);
  const [loading, setLoading] = useState(false);
  const isEdit = !!tarifa.tipo;

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(form);
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
          <h2 className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
            {isEdit ? "Editar tarifa" : "Nueva tarifa"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-white/5 transition-colors" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          {/* Tipo solo se elige al crear */}
          {!isEdit ? (
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Tipo</label>
              <select
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
                value={form.tipo ?? ""}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                <option value="">Seleccionar…</option>
                {Object.entries(TIPO_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Tipo</label>
              <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                {TIPO_LABELS[form.tipo ?? ""] ?? form.tipo}
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Monto ($)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
              value={form.monto ?? ""}
              onChange={(e) => setForm({ ...form, monto: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Descripción</label>
            <input
              type="text"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
              value={form.descripcion ?? ""}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="activa-tarifa"
              checked={form.activa ?? true}
              onChange={(e) => setForm({ ...form, activa: e.target.checked })}
            />
            <label htmlFor="activa-tarifa" className="text-sm" style={{ color: "var(--text-secondary)" }}>Activa</label>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
            style={{ border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading || (!isEdit && !form.tipo)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: "var(--brand-primary)", color: "#fff" }}
          >
            {loading ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Zona Modal ───────────────────────────────────────────────────────────────

function ZonaModal({
  zona,
  onClose,
  onSave,
}: {
  zona: Partial<Zona>;
  onClose: () => void;
  onSave: (data: Partial<Zona>) => Promise<void>;
}) {
  const [form, setForm] = useState<Partial<Zona>>(zona);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(form);
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
          <h2 className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
            {zona.id ? "Editar zona" : "Nueva zona"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-white/5 transition-colors" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Nombre</label>
            <input
              type="text"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
              value={form.nombre ?? ""}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Detalle</label>
            <input
              type="text"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
              value={form.detalle ?? ""}
              onChange={(e) => setForm({ ...form, detalle: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Estado</label>
            <select
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
              value={form.estado ?? "activa"}
              onChange={(e) => setForm({ ...form, estado: e.target.value as Zona["estado"] })}
            >
              <option value="activa">Activa</option>
              <option value="proxima">Próximamente</option>
            </select>
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Orden</label>
            <input
              type="number"
              min={0}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
              value={form.orden ?? 0}
              onChange={(e) => setForm({ ...form, orden: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
            style={{ border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !form.nombre}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: "var(--brand-primary)", color: "#fff" }}
          >
            {loading ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [loadingTarifas, setLoadingTarifas] = useState(true);
  const [loadingZonas, setLoadingZonas] = useState(true);
  const [tarifaModal, setTarifaModal] = useState<Partial<Tarifa> | null>(null);
  const [zonaModal, setZonaModal] = useState<Partial<Zona> | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  // ── fetch ──────────────────────────────────────────────────────────────────

  async function fetchTarifas() {
    setLoadingTarifas(true);
    try {
      const res = await fetch(`${API}/admin/tarifas`, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTarifas(Array.isArray(data) ? data : []);
    } catch {
      showToast("Error al cargar tarifas", false);
    } finally {
      setLoadingTarifas(false);
    }
  }

  async function fetchZonas() {
    setLoadingZonas(true);
    try {
      const res = await fetch(`${API}/zonas-cobertura`, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      // GET /zonas-cobertura returns { activas: [...], proximas: [...] }
      setZonas([...(data.activas ?? []), ...(data.proximas ?? [])]);
    } catch {
      showToast("Error al cargar zonas", false);
    } finally {
      setLoadingZonas(false);
    }
  }

  useEffect(() => {
    fetchTarifas();
    fetchZonas();
  }, []);

  // ── tarifas ────────────────────────────────────────────────────────────────

  async function saveTarifa(data: Partial<Tarifa>) {
    try {
      const isEdit = !!data.tipo && tarifas.some((t) => t.tipo === data.tipo);

      let res: Response;
      if (isEdit) {
        // PUT /admin/tarifas/{tipo}  — body: monto, descripcion, activa
        const { monto, descripcion, activa } = data;
        res = await fetch(`${API}/admin/tarifas/${data.tipo}`, {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ monto, descripcion, activa }),
        });
      } else {
        // POST /admin/tarifas  — body: tipo, monto, descripcion, activa
        res = await fetch(`${API}/admin/tarifas`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(data),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
        showToast(err.detail ?? "Error al guardar", false);
        return;
      }

      showToast(isEdit ? "Tarifa actualizada" : "Tarifa creada");
      setTarifaModal(null);
      fetchTarifas();
    } catch {
      showToast("Error de conexión", false);
    }
  }

  async function toggleTarifa(tipo: string) {
    try {
      const res = await fetch(`${API}/admin/tarifas/${tipo}/toggle`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      if (!res.ok) { showToast("Error al cambiar estado", false); return; }
      const data = await res.json();
      showToast(data.message ?? "Estado actualizado");
      fetchTarifas();
    } catch {
      showToast("Error de conexión", false);
    }
  }

  // ── zonas ──────────────────────────────────────────────────────────────────

  async function saveZona(data: Partial<Zona>) {
    try {
      let res: Response;
      if (data.id) {
        // PUT /admin/zonas-cobertura/{id}
        res = await fetch(`${API}/admin/zonas-cobertura/${data.id}`, {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify(data),
        });
      } else {
        // POST /admin/zonas-cobertura
        res = await fetch(`${API}/admin/zonas-cobertura`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(data),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
        showToast(err.detail ?? "Error al guardar", false);
        return;
      }

      showToast(data.id ? "Zona actualizada" : "Zona creada");
      setZonaModal(null);
      fetchZonas();
    } catch {
      showToast("Error de conexión", false);
    }
  }

  async function deleteZona(id: number, nombre: string) {
    if (!confirm(`¿Eliminar la zona "${nombre}"?`)) return;
    try {
      const res = await fetch(`${API}/admin/zonas-cobertura/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) { showToast("Error al eliminar", false); return; }
      showToast("Zona eliminada");
      fetchZonas();
    } catch {
      showToast("Error de conexión", false);
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen" style={{ background: "var(--main-bg)" }}>
      <Sidebar />

      <main className="flex-1 px-4 md:px-8 py-8 pt-20 md:pt-8 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Configuración</h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
          Gestioná tarifas de consulta y zonas de cobertura
        </p>

        {/* ── Tarifas ── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign size={18} style={{ color: "var(--brand-primary)" }} />
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Tarifas de consulta</h2>
            </div>
            <button
              onClick={() => setTarifaModal({ activa: true, monto: 0, descripcion: "" })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--brand-primary)", color: "#fff" }}
            >
              <Plus size={15} /> Nueva tarifa
            </button>
          </div>

          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--border-subtle)", background: "var(--card-bg)" }}
          >
            {loadingTarifas ? (
              <p className="p-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>Cargando…</p>
            ) : tarifas.length === 0 ? (
              <p className="p-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>Sin tarifas configuradas</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    {["Tipo", "Descripción", "Monto", "Estado", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tarifas.map((t) => (
                    <tr key={t.tipo} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>
                        {TIPO_LABELS[t.tipo] ?? t.tipo}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{t.descripcion}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: "var(--brand-primary-light)" }}>
                        ${t.monto.toLocaleString("es-AR")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            background: t.activa ? "rgba(20,184,166,0.15)" : "rgba(239,68,68,0.1)",
                            color: t.activa ? "var(--brand-primary-light)" : "#f87171",
                          }}
                        >
                          {t.activa ? <><Check size={10} className="inline mr-1" />Activa</> : "Inactiva"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {/* Editar */}
                          <button
                            onClick={() => setTarifaModal(t)}
                            title="Editar"
                            className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <Pencil size={14} />
                          </button>
                          {/* Toggle activa/inactiva */}
                          <button
                            onClick={() => toggleTarifa(t.tipo)}
                            title={t.activa ? "Desactivar" : "Activar"}
                            className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                            style={{ color: t.activa ? "var(--brand-primary)" : "var(--text-muted)" }}
                          >
                            {t.activa ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── Zonas ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin size={18} style={{ color: "var(--brand-primary)" }} />
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Zonas de cobertura</h2>
            </div>
            <button
              onClick={() => setZonaModal({ estado: "activa", orden: 99, nombre: "", detalle: "" })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--brand-primary)", color: "#fff" }}
            >
              <Plus size={15} /> Nueva zona
            </button>
          </div>

          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--border-subtle)", background: "var(--card-bg)" }}
          >
            {loadingZonas ? (
              <p className="p-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>Cargando…</p>
            ) : zonas.length === 0 ? (
              <p className="p-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>Sin zonas configuradas</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    {["Nombre", "Detalle", "Estado", "Orden", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {zonas.map((z) => (
                    <tr key={z.id ?? z.nombre} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{z.nombre}</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{z.detalle}</td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            background: z.estado === "activa" ? "rgba(20,184,166,0.15)" : "rgba(234,179,8,0.15)",
                            color: z.estado === "activa" ? "var(--brand-primary-light)" : "#facc15",
                          }}
                        >
                          {z.estado === "activa" ? "Activa" : "Próximamente"}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>{z.orden}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => setZonaModal(z)}
                            title={z.id ? "Editar" : "Sin ID — actualizá el SELECT en el backend para incluir id"}
                            disabled={!z.id}
                            className="p-1.5 rounded-md hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => z.id && deleteZona(z.id, z.nombre)}
                            title={z.id ? "Eliminar" : "Sin ID — actualizá el SELECT en el backend para incluir id"}
                            disabled={!z.id}
                            className="p-1.5 rounded-md hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{ color: "#f87171" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Aviso si faltan IDs */}
          {zonas.length > 0 && zonas.every((z) => !z.id) && (
            <p className="mt-3 text-xs px-1" style={{ color: "var(--text-muted)" }}>
              Los botones de editar/eliminar requieren que <code>GET /zonas-cobertura</code> incluya <code>id</code> en el SELECT.
            </p>
          )}
        </section>
      </main>

      {/* Modals */}
      {tarifaModal && (
        <TarifaModal
          tarifa={tarifaModal}
          onClose={() => setTarifaModal(null)}
          onSave={saveTarifa}
        />
      )}
      {zonaModal && (
        <ZonaModal
          zona={zonaModal}
          onClose={() => setZonaModal(null)}
          onSave={saveZona}
        />
      )}

      {/* Toast */}
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
