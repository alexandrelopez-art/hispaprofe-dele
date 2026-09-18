"use client";
import { ErrorDePantalla } from "@/components/carcasa/error-de-pantalla";

export default function ErrorDeEstudiantes({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorDePantalla titulo="No hemos podido cargar los estudiantes" reset={reset} />;
}
