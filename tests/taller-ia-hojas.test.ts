import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/ficheros/vercel", () => ({ enlaceDeLectura: vi.fn(async () => "https://almacen.invalid/firmado") }));

import { descargarHoja } from "@/lib/taller/ia/hojas";

describe("descargar una hoja del almacén", () => {
  // Mutación que la mata: devolver los bytes sin pasar a base64.
  it("devuelve los bytes en base64 con su tipo", async () => {
    const llamar = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    expect(await descargarHoja("material/h.jpg", "image/jpeg", llamar as unknown as typeof fetch)).toEqual({ datos: "AQID", tipo: "image/jpeg" });
    expect(llamar).toHaveBeenCalledWith("https://almacen.invalid/firmado");
  });

  // Mutación que la mata: no mirar r.ok.
  it("si el almacén no la da, lanza", async () => {
    const llamar = vi.fn(async () => new Response("no", { status: 404 }));
    await expect(descargarHoja("material/h.jpg", "image/jpeg", llamar as unknown as typeof fetch)).rejects.toThrow();
  });

  // Mutación que la mata: aceptar cualquier tipo.
  it("un tipo que la API no admite lanza sin descargar", async () => {
    const llamar = vi.fn();
    await expect(descargarHoja("material/h.pdf", "application/pdf", llamar as unknown as typeof fetch)).rejects.toThrow();
    expect(llamar).not.toHaveBeenCalled();
  });
});
