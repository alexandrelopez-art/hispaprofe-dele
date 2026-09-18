import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { clasesDeBoton, type Variante } from "@/components/ui/boton";

const DE_TEXTO =
  "font-bold text-hp-600 underline underline-offset-2 hover:text-hp-700 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-600 rounded";

/** Un enlace de Next. Con `comoBoton` se ve como un botón: para ir a algún
 *  sitio, nunca para cambiar nada (Next precarga los enlaces al pintarlos). */
export function Enlace({
  href,
  children,
  comoBoton,
  className = "",
  ...resto
}: { href: string; children: ReactNode; comoBoton?: Variante; className?: string } & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>) {
  const clases = comoBoton ? clasesDeBoton(comoBoton) : DE_TEXTO;
  return (
    <Link {...resto} href={href} className={`${clases} ${className}`.trim()}>
      {children}
    </Link>
  );
}
