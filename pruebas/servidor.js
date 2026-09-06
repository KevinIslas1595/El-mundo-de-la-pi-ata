// Servidor estático mínimo para probar el sitio en http://localhost:8080
const http = require("http");
const fs = require("fs");
const path = require("path");

// La carpeta del proyecto, calculada sola: asi el servidor
// funciona aunque muevas o renombres la carpeta.
const RAIZ = path.resolve(__dirname, "..");
const PUERTO = 8080;

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split("?")[0]);
    if (rel === "/") rel = "/principal.html";

    const destino = path.join(RAIZ, rel);
    // No salir de la carpeta del proyecto
    if (!destino.startsWith(RAIZ)) {
      res.writeHead(403).end("Prohibido");
      return;
    }

    fs.readFile(destino, (err, datos) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("No encontrado: " + rel);
        return;
      }
      const tipo = TIPOS[path.extname(destino).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": tipo });
      res.end(datos);
    });
  })
  .listen(PUERTO, () => console.log("Servidor listo en http://localhost:" + PUERTO));
