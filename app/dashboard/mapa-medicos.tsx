"use client";
// @ts-nocheck

import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API = process.env.NEXT_PUBLIC_API_BASE!;

type ProfesionalMapa = {
  id: number;
  nombre: string;
  tipo: "medico" | "enfermero";
  lat: number;
  lng: number;
  telefono?: string;
  matricula?: string;
  disponible: boolean;
  activo_hoy: boolean;
  ultimo_ping?: string | null;
};

type ApiProfesionalMapa = {
  id: number;
  nombre: string;
  tipo: "medico" | "enfermero";
  latitud?: number | null;
  longitud?: number | null;
  telefono?: string;
  matricula?: string;
  disponible?: boolean;
  activo_hoy?: boolean;
  ultimo_ping?: string | null;
};

// ─── Icono encendido (pulse) ──────────────────────────────────────────────────
function makePulseIcon(tipo: "medico" | "enfermero") {
  const isMedico = tipo === "medico";
  const color = isMedico ? "#14b8a6" : "#3b82f6";
  const colorRgb = isMedico ? "20,184,166" : "59,130,246";
  const initial = isMedico ? "M" : "E";

  const html = `
    <div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
      <span style="position:absolute;width:40px;height:40px;border-radius:50%;background:rgba(${colorRgb},0.15);animation:pulse-ring 2s ease-out infinite;"></span>
      <span style="position:absolute;width:40px;height:40px;border-radius:50%;background:rgba(${colorRgb},0.1);animation:pulse-ring 2s ease-out infinite 0.6s;"></span>
      <span style="position:absolute;width:40px;height:40px;border-radius:50%;background:rgba(${colorRgb},0.06);animation:pulse-ring 2s ease-out infinite 1.2s;"></span>
      <div style="position:relative;width:18px;height:18px;border-radius:50%;background:${color};box-shadow:0 0 0 2px rgba(${colorRgb},0.4),0 0 12px rgba(${colorRgb},0.6);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#040d12;font-family:sans-serif;z-index:1;">${initial}</div>
    </div>
    <style>
      @keyframes pulse-ring {
        0%   { transform: scale(0.4); opacity: 1; }
        100% { transform: scale(2.2); opacity: 0; }
      }
    </style>
  `;

  return L.divIcon({ html, className: "", iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -22] });
}

// ─── Icono apagado (gris, sin pulse) ─────────────────────────────────────────
function makeGrayIcon(tipo: "medico" | "enfermero") {
  const initial = tipo === "medico" ? "M" : "E";
  const html = `
    <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
      <div style="width:18px;height:18px;border-radius:50%;background:#2a3a42;border:2px solid #3a4a52;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#5a6e78;font-family:sans-serif;">${initial}</div>
    </div>
  `;
  return L.divIcon({ html, className: "", iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -16] });
}

function formatUltimoPing(ping?: string | null): string {
  if (!ping) return "Sin datos";
  const d = new Date(ping);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MapaMedicos() {
  const [profesionales, setProfesionales] = useState<ProfesionalMapa[]>([]);

  useEffect(() => {
    const load = () =>
      fetch(`${API}/monitoreo/medicos_mapa`)
        .then((r) => r.json())
        .then((d) => {
          if (!d.ok) return;
          setProfesionales(
            ((d.profesionales || []) as ApiProfesionalMapa[])
              .filter((p) => p.latitud && p.longitud)
              .map((p) => ({
                id: p.id,
                nombre: p.nombre,
                tipo: p.tipo,
                lat: p.latitud as number,
                lng: p.longitud as number,
                telefono: p.telefono,
                matricula: p.matricula,
                disponible: p.disponible ?? false,
                activo_hoy: p.activo_hoy ?? false,
                ultimo_ping: p.ultimo_ping,
              }))
          );
        })
        .catch(() => {});

    load();
    const i = setInterval(load, 15000);
    return () => clearInterval(i);
  }, []);

  const activosHoy   = profesionales.filter((p) => p.activo_hoy);
  const inactivosHoy = profesionales.filter((p) => !p.activo_hoy);

  const center: [number, number] = activosHoy.length
    ? [activosHoy[0].lat, activosHoy[0].lng]
    : profesionales.length
    ? [profesionales[0].lat, profesionales[0].lng]
    : [-34.6037, -58.3816];

  const mapProps = {
    center,
    zoom: 12,
    style: { height: "100%", width: "100%" },
    className: "z-0",
  } as unknown as ComponentProps<typeof MapContainer>;

  const tileLayerProps = {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  } as unknown as ComponentProps<typeof TileLayer>;

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      {/* Leyenda */}
      <div style={{
        position: "absolute", top: 10, right: 10, zIndex: 1000,
        background: "rgba(7,27,34,0.92)", backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12,
        padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8,
        fontSize: 12, color: "#94a3b8",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#14b8a6", boxShadow: "0 0 6px #14b8a6" }} />
          <span>Conectó hoy ({activosHoy.length})</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#2a3a42", border: "2px solid #3a4a52" }} />
          <span>Sin actividad hoy ({inactivosHoy.length})</span>
        </div>
      </div>

      <MapContainer {...mapProps}>
        <TileLayer {...tileLayerProps} />

        {/* Inactivos primero (debajo de los activos) */}
        {inactivosHoy.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} {...{ icon: makeGrayIcon(p.tipo) }}>
            <Popup>
              <div style={{ minWidth: 180, background: "#0d1f2d", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px", color: "#e2e8f0", fontFamily: "sans-serif", fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#2a3a42", border: "1px solid #3a4a52", flexShrink: 0 }} />
                  <strong style={{ color: "#64748b", fontSize: 14 }}>{p.nombre}</strong>
                </div>
                <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.7 }}>
                  <div>{p.tipo === "medico" ? "Médico" : "Enfermero"}</div>
                  {p.matricula && <div>Mat: <span style={{ color: "#64748b" }}>{p.matricula}</span></div>}
                  {p.telefono && <div>Tel: <span style={{ color: "#64748b" }}>{p.telefono}</span></div>}
                  <div style={{ marginTop: 6, fontSize: 11 }}>Último acceso: {formatUltimoPing(p.ultimo_ping)}</div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Activos hoy encima */}
        {activosHoy.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} {...{ icon: makePulseIcon(p.tipo) }}>
            <Popup>
              <div style={{ minWidth: 180, background: "#0d1f2d", border: `1px solid rgba(${p.tipo === "medico" ? "20,184,166" : "59,130,246"},0.25)`, borderRadius: 10, padding: "10px 14px", color: "#e2e8f0", fontFamily: "sans-serif", fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.tipo === "medico" ? "#14b8a6" : "#3b82f6", boxShadow: `0 0 6px ${p.tipo === "medico" ? "#14b8a6" : "#3b82f6"}`, flexShrink: 0 }} />
                  <strong style={{ color: "#f1f5f9", fontSize: 14 }}>{p.nombre}</strong>
                </div>
                <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.7 }}>
                  <div>{p.tipo === "medico" ? "Médico" : "Enfermero"}</div>
                  <div>Estado: <span style={{ color: p.disponible ? "#14b8a6" : "#f59e0b", fontWeight: 700 }}>{p.disponible ? "Disponible ahora" : "Conectó hoy"}</span></div>
                  {p.matricula && <div>Mat: <span style={{ color: "#cbd5e1" }}>{p.matricula}</span></div>}
                  {p.telefono && <div>Tel: <span style={{ color: "#cbd5e1" }}>{p.telefono}</span></div>}
                  <div style={{ marginTop: 6, color: "#64748b", fontSize: 11 }}>Último acceso: {formatUltimoPing(p.ultimo_ping)}</div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
