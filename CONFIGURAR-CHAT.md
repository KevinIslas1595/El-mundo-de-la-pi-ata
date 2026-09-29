# Configurar el chat de la tienda

El chat (el botón **💬 ¿Te ayudo?**) platica con los clientes, toma pedidos y
les dice cómo va su pedido. Contesta con **Gemini** (la inteligencia
artificial de Google, plan gratis) y guarda los pedidos en **Supabase**.

Los pedidos te aparecen en el panel (`admin.html`), en la tarjeta
**🧾 Pedidos del chat**. Ahí les cambias el estado: Nuevo → Confirmado →
Listo → Entregado (o Cancelado). El cliente ve ese estado cuando le
pregunta al chat con su folio y su teléfono.

---

## Paso 1 — Crear la tabla de pedidos

1. Entra a <https://supabase.com/dashboard> y abre tu proyecto.
2. Menú izquierdo → **SQL Editor** → **New query**.
3. Pega todo lo que hay en `supabase/pedidos.sql` y pulsa **Run**.
4. Debe salir **Success. No rows returned**.

## Paso 2 — Poner la llave de Gemini

1. Saca una llave en <https://aistudio.google.com/apikey> (Dashboard → API Keys
   → **Create API key**). Es gratis.
2. En Supabase: menú izquierdo → **Edge Functions** → **Secrets**.
3. Agrega una nueva:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: la llave que copiaste
4. **Save**.

> La llave no se pega en ningún archivo ni en el chat con Claude: solo aquí.

## Paso 3 — Publicar el "cerebro" del chat

Desde la carpeta de la página:

```
npx supabase login
npx supabase functions deploy chat --project-ref fabdpahpdxdenvsnxlpp --no-verify-jwt --use-api
```

El `--no-verify-jwt` es a propósito: el chat lo usan clientes sin cuenta.
Los pedidos siguen protegidos, porque solo se consultan con folio **y**
teléfono.

---

## Cosas que conviene saber

- **Precios**: el chat solo da los precios que están en la página (los
  escritos en `index.html`, `Globos.html`, `Velas.html` y los que subes en el
  panel). Si cambias un precio, el chat lo aprende solo en unos 10 minutos.
- **Lo que no está en la página** (piñatas personalizadas, por ejemplo) lo
  apunta como **"por cotizar"** y tú le pasas el precio por WhatsApp.
- **Límite gratis**: Gemini gratis tiene un tope de mensajes al día. Si se
  llega, el chat le dice al cliente que escriba por WhatsApp.
- **Plan gratis de Google**: Google puede usar las pláticas para mejorar
  Gemini. No pongas en las reglas del chat nada que no quieras que vean.
- Las reglas que sigue el chat (cómo habla, horarios, tiendas) están en
  `supabase/functions/chat/index.ts`, en la parte **2. LAS REGLAS**. Si
  cambias algo ahí, hay que volver a hacer el paso 3.
