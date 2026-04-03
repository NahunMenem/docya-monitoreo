"use client";
// @ts-nocheck

import { useEffect, useState } from "react";
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
};

// ─── Pulse icon ───────────────────────────────────────────────────────────────

function makePulseIcon(tipo: "medico" | "enfermero") {
  const isMedico = tipo === "medico";
  const color = isMedico ? "#14b8a6" : "#3b82f6";
  const colorRgb = isMedico ? "20,184,166" : "59,130,246";
  const initial = isMedico ? "M" : "E";

  const html = `
    <div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
      <!-- ring 1 -->
      <span style="
        position:absolute;
        width:40px;height:40px;
        border-radius:50%;
        background:rgba(${colorRgb},0.15);
        animation:pulse-ring 2s ease-out infinite;
      "></span>
      <!-- ring 2 -->
      <span style="
        position:absolute;
        width:40px;height:40px;
        border-radius:50%;
        background:rgba(${colorRgb},0.1);
        animation:pulse-ring 2s ease-out infinite 0.6s;
      "></span>
      <!-- ring 3 -->
      <span style="
        position:absolute;
        width:40px;height:40px;
        border-radius:50%;
        background:rgba(${colorRgb},0.06);
        animation:pulse-ring 2s ease-out infinite 1.2s;
      "></span>
      <!-- dot -->
      <div style="
        position:relative;
        width:18px;height:18px;
        border-radius:50%;
        background:${color};
        box-shadow:0 0 0 2px rgba(${colorRgb},0.4), 0 0 12px rgba(${colorRgb},0.6);
        display:flex;align-items:center;justify-content:center;
        font-size:8px;font-weight:700;color:#040d12;font-family:sans-serif;
        z-index:1;
      ">${initial}</div>
    </div>
    <style>
      @keyframes pulse-ring {
        0%   { transform: scale(0.4); opacity: 1; }
        100% { transform: scale(2.2); opacity: 0; }
      }
    </style>
  `;

  return L.divIcon({
    html,
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
  });
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
            (d.profesionales || [])
              .filter((p: any) => p.latitud && p.longitud)
              .map((p: any) => ({
                id: p.id,
                nombre: p.nombre,
                tipo: p.tipo,
                lat: p.latitud,
                lng: p.longitud,
                telefono: p.telefono,
                matricula: p.matricula,
              }))
          );
        })
        .catch(() => {});

    load();
    const i = setInterval(load, 15000);
    return () => clearInterval(i);
  }, []);

  const center: [number, number] = profesionales.length
    ? [profesionales[0].lat, profesionales[0].lng]
    : [-34.6037, -58.3816];

  return (
    <MapContainer
      center={center as [number, number]}
      zoom={12}
      style={{ height: "100%", width: "100%" }}
      className="z-0"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...({} as any)}
    >
      <TileLayer
        {...({
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        } as any)}
      />
      {profesionales.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} {...{ icon: makePulseIcon(p.tipo) }}>
          <Popup>
            <div style={{
              minWidth: 170,
              background: "#0d1f2d",
              border: "1px solid rgba(20,184,166,0.25)",
              borderRadius: 10,
              padding: "10px 14px",
              color: "#e2e8f0",
              fontFamily: "sans-serif",
              fontSize: 13,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: p.tipo === "medico" ? "#14b8a6" : "#3b82f6",
                  boxShadow: `0 0 6px ${p.tipo === "medico" ? "#14b8a6" : "#3b82f6"}`,
                  flexShrink: 0,
                }} />
                <strong style={{ color: "#f1f5f9", fontSize: 14 }}>{p.nombre}</strong>
              </div>
              <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.7 }}>
                <div style={{ textTransform: "capitalize" }}>
                  {p.tipo === "medico" ? "Médico" : "Enfermero"}
                </div>
                {p.matricula && <div>Mat: <span style={{ color: "#cbd5e1" }}>{p.matricula}</span></div>}
                {p.telefono && <div>Tel: <span style={{ color: "#cbd5e1" }}>{p.telefono}</span></div>}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
