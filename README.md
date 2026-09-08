# 🎉 Piñatería Papelito Crepé

Tienda web de piñatas, globos, velas, peluches, cortinas, platos y vasos. Los clientes ven el catálogo, arman su
carrito y mandan el pedido por WhatsApp. La dueña o el dueño sube productos
nuevos desde un panel, sin tocar código.

**Ver la tienda:** https://kevinislas1595.github.io/El-mundo-de-la-pi-ata/

> El repositorio se llama `El-mundo-de-la-pi-ata` porque ese era el nombre
> anterior de la tienda. Cambiarlo rompería el enlace que ya está compartido,
> así que se dejó como está.

---

## Qué hace

| | |
|---|---|
| 🛍️ **Catálogo** | Piñatas, globos, velas, peluches, cortinas, platos y vasos, cada categoría en su página |
| ➕ **Panel de administración** | Subir, editar y borrar productos desde el navegador |
| 🛒 **Carrito** | Guarda lo elegido aunque se cierre la pestaña |
| 📲 **Pedido por WhatsApp** | Arma el mensaje solo, con productos, cantidades y total |
| 📍 **Ubicación** | Botón directo a Google Maps |
| 📱 **Se adapta al celular** | Probado a 390 px de ancho |

---

## Cómo está hecho

Es un sitio **estático**: solo HTML, CSS y JavaScript. No hay servidor propio.

- **[Tailwind CSS](https://tailwindcss.com/)** (por CDN) para la maquetación.
- **`css/estilos.css`** para todo lo que Tailwind no cubre: el encabezado
  animado, los carteles, los botones y el carrito. Está comentado en español.
- **[Supabase](https://supabase.com/)** guarda los productos y las fotos, y
  comprueba quién entra al panel.
- **[SweetAlert2](https://sweetalert2.github.io/)** para los avisos.
- **[Puppeteer](https://pptr.dev/)** para las pruebas automáticas.
- **GitHub Pages** publica el sitio.

---

## Los archivos

```
├── principal.html          Página de inicio
├── index.html              Piñatas
├── Globos.html             Globos
├── Velas.html              Velas
├── Peluches.html           Peluches
├── Cortinas.html           Cortinas
├── Platos.html             Platos
├── Vasos.html              Vasos
├── carrito.html            El carrito y el pedido por WhatsApp
├── Contacto.html           Redes sociales y teléfono
├── login.html              Entrada al panel
├── admin.html              Panel: subir, editar y borrar productos
│
├── css/estilos.css         Todos los adornos y animaciones
├── js/
│   ├── config.js           Conexión con Supabase y las categorías
│   ├── datos.js            Leer y guardar productos; encoge las fotos
│   ├── auth.js             Candado antiguo (respaldo si no hay Supabase)
│   └── comunes.js          Menú, carrito y modal de imagen
│
├── img/                    Fotos de los productos escritos en la página
├── pruebas/                Pruebas automáticas (ver pruebas/LEEME.md)
├── herramientas/           Generador de clave para el candado antiguo
└── CONFIGURAR-SUPABASE.md  Pasos para conectar la base de datos
```

---

## De dónde salen los productos

Cada página de categoría muestra **dos grupos**:

1. **Los escritos a mano en el HTML**, con sus fotos en `img/`. Son los que
   estaban desde el principio.
2. **Los subidos desde el panel**, que viven en Supabase. Caen en el
   contenedor correspondiente y se pintan solos al abrir la página:

   | Página | Contenedor | Categoría |
   |---|---|---|
   | `index.html` | `#productos-admin` | Piñatas |
   | `Globos.html` | `#productos-globos` | Globos |
   | `Velas.html` | `#productos-velas` | Velas |
   | `Peluches.html` | `#productos-peluches` | Peluches |
   | `Cortinas.html` | `#productos-cortinas` | Cortinas |
   | `Platos.html` | `#productos-platos` | Platos |
   | `Vasos.html` | `#productos-vasos` | Vasos |

   Peluches, Cortinas, Platos y Vasos **solo** tienen el segundo grupo:
   todo su catálogo se sube desde el panel. Mientras no haya nada, la
   página muestra el aviso que lleva el contenedor en `data-vacio`, para
   que no se quede un hueco en blanco.

> ⚠️ Esos contenedores tienen que ir **fuera** de `#productos-grid`. Si se
> meten dentro, cada ficha queda encajada en una sola casilla de la cuadrícula
> y sale aplastada.

Las fotos se **encogen en el navegador antes de subirse** (máximo 1200 px,
calidad 0.82). Una foto de celular de 2 MB acaba pesando unos 200 KB: así el
GB gratuito de Supabase dura mucho más y la página carga rápido.

---

## El panel de administración

`login.html` → `admin.html`.

Se entra con el **correo y la contraseña del usuario de Supabase**. La
comprobación la hace Supabase en su servidor, no el navegador.

`js/auth.js` guarda un candado antiguo, basado en un hash guardado en el
propio código. **Solo se usa como respaldo** si Supabase no está configurado, y
no es seguridad de verdad: en un sitio estático cualquiera puede saltárselo
editando el JavaScript. Lo que protege los datos son las reglas **RLS** de
Supabase: cualquiera puede leer los productos, pero solo el usuario con sesión
puede crear, editar o borrar.

Las claves de `js/config.js` (`SUPABASE_URL` y `SUPABASE_ANON_KEY`) son
**públicas a propósito**: van dentro de la página y se ven desde el navegador.
No es un descuido.

---

## Trabajar en el proyecto

Hace falta [Node.js](https://nodejs.org/) y Google Chrome.

```bash
# Solo la primera vez
npm install

# Levantar la web en http://localhost:8080
node pruebas/servidor.js
```

En VS Code, la tecla **F5** arranca el servidor y abre el navegador de una vez.

> No abras los `.html` con doble clic: sin `http://` el navegador bloquea el
> cifrado del login y algunas cosas dejan de funcionar.

### Pruebas automáticas

Abren un Chrome de verdad y recorren la web entera en menos de un minuto:

```bash
# Terminal 1
node pruebas/servidor.js

# Terminal 2
node pruebas/pruebas.js

# O contra el sitio ya publicado
node pruebas/pruebas.js https://kevinislas1595.github.io/El-mundo-de-la-pi-ata
```

```
RESULTADO:  57 correctas,  0 fallidas
```

Comprueban errores de consola, estructura del HTML, menú, carrito, acceso al
panel, subida de un producto, la vista en celular y que no haya fotos rotas.
Los detalles están en **[`pruebas/LEEME.md`](pruebas/LEEME.md)**.

> Las pruebas del panel **escriben en la base de datos real**: crean un
> producto llamado "Piñata D'Prueba" y lo borran al empezar y al terminar. Si
> las modificas, conserva esa limpieza.
>
> Necesitan `pruebas/credenciales.json` con el usuario y la contraseña del
> panel. Ese archivo está en `.gitignore` y **no se sube**. Sin él, las pruebas
> de acceso se saltan y las demás funcionan igual.

---

## Publicar

GitHub Pages publica la rama `main`. Cada `git push` sale en línea en
aproximadamente un minuto.

```bash
git add -A
git commit -m "Lo que cambiaste"
git push origin main
```

Si al entrar sigue viéndose la versión anterior, es el caché del navegador:
recarga la página.

---

## Detalles a tener en cuenta

- Los archivos usan saltos de línea de **Windows (CRLF)**. Al parchearlos con
  scripts hay que devolverlos como estaban. `sed -i` en Git Bash los convierte
  a LF sin avisar y el `git diff` no lo enseña.
- `favicon.ico` da 404. Es solo el icono de la pestaña.
- `img/index.html` y `script.js` son restos de versiones anteriores. Ninguna
  página los carga; se pueden borrar sin que nada deje de funcionar.
- Los enlaces de Instagram y Facebook de `Contacto.html` todavía apuntan a `#`.

---

## Configurar Supabase desde cero

Los pasos completos, con capturas de qué tocar en cada pantalla, están en
**[`CONFIGURAR-SUPABASE.md`](CONFIGURAR-SUPABASE.md)**.

Mientras `js/config.js` esté sin rellenar, la web sigue funcionando: los
productos se guardan en el navegador de quien los sube. El problema es que
entonces **solo los ve esa persona**, no los clientes.
