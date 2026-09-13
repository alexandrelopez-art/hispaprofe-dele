import { describe, it, expect, vi } from "vitest";
import { subirAlAlmacen } from "@/lib/ficheros/subir-desde-navegador";

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });

function fichero() {
  return new File([new Uint8Array([1, 2, 3])], "pagina-1.jpg", { type: "image/jpeg" });
}

describe("subir un fichero al almacén desde el navegador", () => {
  // Mutación que la mata: devolver la ruta en vez del id de la confirmación.
  it("pide permiso, sube al almacén y confirma, y devuelve el id", async () => {
    const llamar = vi
      .fn()
      .mockResolvedValueOnce(json({ url: "https://almacen/firmada", ruta: "material/pagina-1-ab.jpg" }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(json({ id: "f1" }));
    expect(await subirAlAlmacen(fichero(), llamar)).toBe("f1");
    expect(llamar.mock.calls.map((c) => c[0])).toEqual(["/api/ficheros/permiso", "https://almacen/firmada", "/api/ficheros/confirmar"]);
    expect(JSON.parse(llamar.mock.calls[0][1].body)).toEqual({ nombre: "pagina-1.jpg", tipoMime: "image/jpeg", bytes: 3 });
    expect(JSON.parse(llamar.mock.calls[2][1].body)).toEqual({ ruta: "material/pagina-1-ab.jpg", nombreOriginal: "pagina-1.jpg" });
  });

  // Mutación que la mata: usar siempre el mensaje por defecto en vez del que devuelve mensajeDelError.
  it("si el permiso falla, el mensaje del servidor llega tal cual", async () => {
    const llamar = vi.fn().mockResolvedValueOnce(json({ error: "Solo se admiten imágenes o audio." }, 400));
    await expect(subirAlAlmacen(fichero(), llamar)).rejects.toThrow("Solo se admiten imágenes o audio.");
    expect(llamar).toHaveBeenCalledTimes(1);
  });

  // Mutación que la mata: quitar el `if (!subida.ok) throw ...` y confirmar siempre.
  it("si el almacén rechaza la subida, no se confirma", async () => {
    const llamar = vi
      .fn()
      .mockResolvedValueOnce(json({ url: "https://almacen/firmada", ruta: "material/x.jpg" }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(subirAlAlmacen(fichero(), llamar)).rejects.toThrow("El almacén rechazó la subida.");
    expect(llamar).toHaveBeenCalledTimes(2);
  });

  // Mutación que la mata: en mensajeDelError, no capturar el fallo de JSON.parse y dejar que se propague en vez de devolver porDefecto.
  it("si la confirmación falla sin JSON, sale el mensaje por defecto", async () => {
    const llamar = vi
      .fn()
      .mockResolvedValueOnce(json({ url: "https://almacen/firmada", ruta: "material/x.jpg" }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response("caído", { status: 500 }));
    await expect(subirAlAlmacen(fichero(), llamar)).rejects.toThrow("No se pudo confirmar la subida.");
  });
});
