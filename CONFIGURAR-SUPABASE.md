# Configurar Supabase — Piñatería Papelito Crepé

Esto hace que los productos que subes en el panel **los vean tus clientes**.
Hoy se guardan solo en tu navegador y nadie más los ve.

Es gratis y no piden tarjeta. Tardarás unos 15 minutos.

---

## Paso 1 — Crear la cuenta y el proyecto

1. Entra en <https://supabase.com> y pulsa **Start your project**.
2. Regístrate (puedes usar tu cuenta de GitHub).
3. Pulsa **New project** y rellena:
   - **Name**: `mundo-pinata`
   - **Database Password**: pon una larga y **guárdala en un papel**. No la
     vas a necesitar para la web, pero si la pierdes no hay forma de recuperarla.
   - **Region**: elige la más cercana a México (`East US` suele ir bien).
4. Dale a **Create new project** y espera 1-2 minutos.

---

## Paso 2 — Crear la tabla y las reglas

En el menú de la izquierda entra en **SQL Editor** → **New query**, pega esto
tal cual y pulsa **Run**:

```sql
-- Tabla de productos
create table productos (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  nombre text not null,
  precio numeric not null,
  imagen text,
  creado_en timestamptz default now()
);

-- Buscar por categoría rápido
create index productos_categoria_idx on productos (categoria, creado_en desc);

-- Activar la seguridad por filas
alter table productos enable row level security;

-- Cualquiera puede VER los productos (es una tienda, tiene que ser público)
create policy "ver productos"
  on productos for select
  to anon, authenticated
  using (true);

-- Solo tú, con tu usuario, puedes crear / editar / borrar
create policy "gestionar productos"
  on productos for all
  to authenticated
  using (true)
  with check (true);
```

> **Qué acabas de hacer:** la última regla es la importante. Aunque la clave
> de tu web sea pública, nadie que no haya iniciado sesión puede tocar tus
> productos. Esa comprobación ocurre en el servidor de Supabase, no en el
> navegador, así que no se puede saltar editando el código.

---

## Paso 3 — Crear el almacén de imágenes

1. Menú izquierdo → **Storage** → **New bucket**.
2. Nombre: `productos`
3. Marca la casilla **Public bucket** (las fotos de la tienda deben verse
   sin iniciar sesión).
4. **Save**.

Ahora vuelve al **SQL Editor** y ejecuta esto para permitir subir fotos:

```sql
-- Cualquiera puede ver las fotos
create policy "ver fotos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'productos');

-- Solo tú puedes subirlas, cambiarlas o borrarlas
create policy "gestionar fotos"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'productos')
  with check (bucket_id = 'productos');
```

---

## Paso 4 — Crear tu usuario

1. Menú izquierdo → **Authentication** → **Users** → **Add user** →
   **Create new user**.
2. Pon tu correo y una contraseña **larga**: 4-5 palabras sueltas, tipo
   `globo-verde-martes-42`. Son más seguras y más fáciles de recordar que
   una corta con números.

   > No reutilices la contraseña que usabas antes en el panel: estuvo
   > publicada en el historial de este repositorio.
3. Marca **Auto Confirm User** para no tener que validar el correo.
4. **Create user**.

Este será el usuario con el que entres al panel.

---

## Paso 5 — Conectar tu web

1. Menú izquierdo → **Project Settings** (el engranaje) → **API**.
2. Copia estos dos valores:
   - **Project URL**
   - **anon public** (la clave larga, la que pone `anon`, **no** la `service_role`)
3. Ábrelos en `js/config.js` y pégalos:

```js
const SUPABASE_URL = "https://xxxxxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

> ⚠️ **Nunca copies la clave `service_role`.** Esa sí da control total y
> jamás debe ir en una página web.

Guarda el archivo y recarga la página. Ya está.

---

## Cómo saber si funciona

1. Abre `login.html` y entra con el correo y contraseña del Paso 4.
2. Sube un producto de prueba en el panel.
3. Ábrelo en otro navegador, o en el móvil con datos, **sin iniciar sesión**.
4. Si ves el producto → funciona. Antes esto era imposible.

---

## Qué cambia respecto a antes

| | Antes | Ahora |
|---|---|---|
| Quién ve tus productos | Solo tú, en tu navegador | Todo el mundo |
| Límite | ~5 MB y se rompía | 500 MB de datos + 1 GB de fotos |
| Si borras el historial | Perdías todo | No pasa nada |
| Login | Falso, se saltaba editando el código | De verdad, comprobado en el servidor |
| Desde otro dispositivo | No veías tus productos | Los ves desde cualquier sitio |

---

## Si algo falla

- **"Invalid login credentials"** → el usuario del Paso 4 no está creado o la
  contraseña no coincide. Créalo de nuevo con **Auto Confirm User** marcado.
- **Los productos no aparecen** → abre la consola del navegador (F12) y mira
  el error. Casi siempre es que falta ejecutar el SQL del Paso 2.
- **No se suben las fotos** → revisa que el bucket se llame exactamente
  `productos` y esté marcado como público.
- **Sigue funcionando como antes** → `js/config.js` está vacío o mal pegado.
  Los dos valores tienen que estar entre comillas.
