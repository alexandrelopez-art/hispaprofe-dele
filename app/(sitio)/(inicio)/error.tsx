"use client";

import { ErrorDePantalla } from "@/components/carcasa/error-de-pantalla";

export default function ErrorDelInicio({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorDePantalla titulo="No hemos podido cargar tu inicio" reset={reset} />;
}
