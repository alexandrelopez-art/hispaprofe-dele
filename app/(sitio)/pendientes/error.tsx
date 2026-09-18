"use client";
import { ErrorDePantalla } from "@/components/carcasa/error-de-pantalla";

export default function ErrorDePendientes({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorDePantalla titulo="No hemos podido cargar Pendientes" reset={reset} />;
}
