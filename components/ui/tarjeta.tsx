import type { ReactNode } from "react";

export function Tarjeta({
  as: Etiqueta = "div",
  className = "",
  children,
}: {
  as?: "div" | "section" | "li" | "article";
  className?: string;
  children: ReactNode;
}) {
  return <Etiqueta className={`rounded-tarjeta bg-white p-5 shadow-tarjeta ${className}`.trim()}>{children}</Etiqueta>;
}
