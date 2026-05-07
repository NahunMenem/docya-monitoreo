import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "Comunidaddocya-main/**",
      "DocYA landing/**",
      "DOCYA-MAC-IOS-master/**",
      "DOCYA-PRO-MAC-IOS-master/**",
      "DOCYA-RAILWAY-main/**",
      "docya-monitoreo-main/**",
      "docyarecetario-main/**",
      "diseño/**",
      "medicamentos/**",
      "tmp_mp_sdk/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
