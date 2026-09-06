# Pruebas automáticas

Abren la web en un Chrome de verdad y comprueban que todo funciona, sin que
tengas que ir clicando página por página. Tardan menos de un minuto.

Sirven sobre todo para **cuando cambies algo**: si rompes sin querer el
carrito o el menú, te enteras al momento y no cuando te lo diga un cliente.

---

## Cómo ejecutarlas

La primera vez, instala lo necesario (solo una vez):

```bash
npm install
```

> Usa el Chrome que ya tienes instalado, no descarga ningún navegador.

Y crea el archivo `pruebas/credenciales.json` con tu usuario y contraseña
del panel:

```json
{
  "usuario": "tu-usuario",
  "clave": "tu-contraseña"
}
```

> Ese archivo está en `.gitignore`, así que **no se sube a GitHub**. Nunca
> escribas la contraseña dentro de `pruebas.js`: ese sí se sube.
>
> Si el archivo no existe, las pruebas de acceso se saltan y el resto
> funcionan igual.

Después, cada vez que quieras probar, abre **dos terminales** en la carpeta
del proyecto.

**Terminal 1** — levanta la web:

```bash
node pruebas/servidor.js
```

**Terminal 2** — lanza las pruebas:

```bash
node pruebas/pruebas.js
```

También puedes probar el sitio que ya está publicado, sin levantar nada:

```bash
node pruebas/pruebas.js https://kevinislas1595.github.io/El-mundo-de-la-pi-ata
```

Al terminar verás algo así:

```
RESULTADO:  57 correctas,  0 fallidas
```

Si alguna falla, te dice cuál y por qué.

---

## Ojo: escriben en la base de datos real

Las pruebas del panel crean un producto llamado **"Piñata D'Prueba"** en
tu Supabase de verdad, comprueban que un cliente lo ve, y lo borran al
terminar (y también al empezar, por si quedó de una vez anterior).

No hay una base de datos aparte para pruebas. Si algún día tocas
`pruebas.js`, conserva esa limpieza para no dejar basura en tu tienda.

---

## Qué comprueban

| Bloque | Qué verifica |
|---|---|
| 1. Consola | Ninguna página lanza errores de JavaScript |
| 2. Estructura | Un solo `<html>`, `<head>`, `<body>` y un solo modal por página |
| 3. Menú | Abre al pulsar y cierra al tocar fuera |
| 4. Carrito | Suma cantidades, no duplica líneas, acepta apóstrofos |
| 5. Página del carrito | El total cuadra y el enlace de WhatsApp lleva el pedido |
| 6. Acceso | El panel redirige al login y rechaza claves malas |
| 7. Panel | Guardar un producto y que salga en la tienda |
| 8. Móvil | En 390 px el logo no tapa el menú ni el carrito |
| 9. Imágenes | Ninguna foto rota en toda la web |

---

## La prueba más importante

Dentro del bloque 7 hay una que abre la web **como si fueras un cliente
cualquiera** (navegador limpio, sin sesión) y mira si ve tus productos.

Desde que Supabase está configurado, pasa así:

```
OK   UN CLIENTE VE TU PRODUCTO (con nube)
```

Esa es la señal de que la tienda funciona de verdad: lo que subes desde el
panel lo ve cualquier cliente, no solo tu navegador.

Si algún día vuelve a salir `sin nube, el cliente NO lo ve`, es que se
rompió la conexión con la nube. Revisa `js/config.js` y los pasos de
`CONFIGURAR-SUPABASE.md`.

---

## Si algo falla

- **`ECONNREFUSED`** → te falta arrancar el servidor en la otra terminal.
- **`Could not find Chrome`** → tienes Chrome en otra ruta. Cámbiala en la
  línea `const CHROME = ...` de `pruebas.js`.
- **Se saltan las del bloque 6 y 7** → falta `pruebas/credenciales.json`.
- **Fallan las del bloque 6** → cambiaste el usuario o la contraseña del
  panel. Actualiza `pruebas/credenciales.json`.
