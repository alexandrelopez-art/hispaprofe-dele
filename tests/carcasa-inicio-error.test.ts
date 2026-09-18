import { describe, it, expect, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";

const dobles = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: dobles.refresh, push: vi.fn() }) }));

import ErrorDelInicio from "@/app/(sitio)/(inicio)/error";
import { ErrorDePantalla } from "@/components/carcasa/error-de-pantalla";

/** El primer elemento del árbol que lleva onClick (el botón Reintentar). Se
 *  llama al componente como función —sin render de React debajo— porque sin
 *  jsdom no hay forma de pulsar nada: así se alcanza el manejador del clic. */
function primerOnClick(nodo: ReactNode): (() => void) | null {
  if (Array.isArray(nodo)) {
    for (const hijo of nodo) {
      const f = primerOnClick(hijo);
      if (f) return f;
    }
    return null;
  }
  if (!isValidElement(nodo)) return null;
  const props = nodo.props as { onClick?: () => void; children?: ReactNode };
  if (props.onClick) return props.onClick;
  return primerOnClick(props.children);
}

describe("el error del Inicio", () => {
  // Mutación que la mata: dejar el clic en `reset()` a secas. reset repinta
  // con los mismos datos del servidor que fallaron, así que «Reintentar» no
  // reintentaba nada: hace falta router.refresh() para volver a pedirlos.
  it("Reintentar vuelve a pedir los datos al servidor, y además repinta", () => {
    const reset = vi.fn();
    const arbol = ErrorDePantalla({ titulo: "x", reset });
    const alPulsar = primerOnClick(arbol);
    expect(alPulsar).not.toBeNull();
    alPulsar!();
    expect(dobles.refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  // Mutación que la mata: cambiar el título o dejar de usar ErrorDePantalla y
  // volver a escribir el aviso a mano en ErrorDelInicio.
  it("ErrorDelInicio devuelve un ErrorDePantalla con su título", () => {
    const reset = vi.fn();
    const arbol = ErrorDelInicio({ error: new Error("caída"), reset });
    expect(isValidElement(arbol)).toBe(true);
    expect(arbol!.type).toBe(ErrorDePantalla);
    expect((arbol!.props as { titulo: string }).titulo).toBe("No hemos podido cargar tu inicio");
  });
});
