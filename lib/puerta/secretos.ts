import { createHash, randomBytes } from "node:crypto";

/** El secreto viaja en el enlace; de él solo se guarda la huella, como una contraseña. */
export function crearSecreto(): { secreto: string; huella: string } {
  const secreto = randomBytes(32).toString("base64url");
  return { secreto, huella: huellaDe(secreto) };
}

export function huellaDe(secreto: string): string {
  return createHash("sha256").update(secreto).digest("hex");
}
