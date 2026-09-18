import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las direcciones cambiaron de nombre para coincidir con el menú (carcasa,
  // Entrega A). Las viejas siguen llevando a las nuevas; no permanentes, para
  // que ningún navegador se las quede grabadas si algún día cambian otra vez.
  async redirects() {
    return [
      { source: "/personas", destination: "/estudiantes", permanent: false },
      { source: "/corregir", destination: "/pendientes", permanent: false },
      { source: "/corregir/:intentoId", destination: "/pendientes/:intentoId", permanent: false },
    ];
  },
};

export default nextConfig;
