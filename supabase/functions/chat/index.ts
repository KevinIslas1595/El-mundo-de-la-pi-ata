/* ============================================================
   CHAT DE LA TIENDA — el "cerebro" que contesta a los clientes
   ============================================================
   Vive en Supabase (Edge Functions), no en GitHub Pages, porque
   aquí se guarda la llave de Gemini sin que nadie la vea.

   Lo que hace cada vez que un cliente escribe:
   1. Junta el catálogo: los productos escritos a mano en las
      páginas de la tienda y los que subes desde el panel.
   2. Le pasa a Gemini la plática, el catálogo y las reglas.
   3. Si Gemini decide guardar o buscar un pedido, lo hace AQUÍ,
      con los precios del catálogo (no los que diga la IA).

   Se publica con:
     npx supabase functions deploy chat --project-ref fabdpahpdxdenvsnxlpp --no-verify-jwt --use-api
   Ver CONFIGURAR-CHAT.md
   ============================================================ */

import { createClient } from "npm:@supabase/supabase-js@2";

const SITIO = "https://kevinislas1595.github.io/El-mundo-de-la-pi-ata";
const MODELO = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash";
const LLAVE_GEMINI = Deno.env.get("GEMINI_API_KEY") || "";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/* ============================================================
   1. CATÁLOGO
   ============================================================ */
type Producto = { nombre: string; precio: number; categoria: string };

/* Páginas con productos escritos a mano, en botones
   onclick="addToCart('Piñata Barbie', 350)" */
const PAGINAS_A_MANO: [string, string][] = [
  ["index.html", "Piñatas"],
  ["Globos.html", "Globos"],
  ["Velas.html", "Velas"],
];

const NOMBRE_CATEGORIA: Record<string, string> = {
  "productos": "Piñatas",
  "productos-globos": "Globos",
  "productos-velas": "Velas",
  "productos-peluches": "Peluches",
  "productos-cortinas": "Cortinas",
  "productos-platos": "Platos",
  "productos-vasos": "Vasos",
};

/* Se guarda 10 minutos para no leer las páginas en cada mensaje */
let catalogo: Producto[] = [];
let catalogoHora = 0;

async function leerCatalogo(): Promise<Producto[]> {
  if (catalogo.length && Date.now() - catalogoHora < 10 * 60 * 1000) {
    return catalogo;
  }
  const lista: Producto[] = [];

  await Promise.all(
    PAGINAS_A_MANO.map(async ([pagina, categoria]) => {
      try {
        const html = await (await fetch(`${SITIO}/${pagina}`)).text();
        const patron = /addToCart\(\s*'([^']+)'\s*,\s*([\d.]+)\s*\)/g;
        for (const m of html.matchAll(patron)) {
          lista.push({
            nombre: m[1].replace(/\s+/g, " ").trim(),
            precio: Number(m[2]),
            categoria,
          });
        }
      } catch (e) {
        console.error("No se pudo leer", pagina, e);
      }
    })
  );

  const { data, error } = await db.from("productos").select("nombre, precio, categoria");
  if (error) console.error("No se pudieron leer los productos:", error.message);
  for (const p of data || []) {
    lista.push({
      nombre: String(p.nombre).replace(/\s+/g, " ").trim(),
      precio: Number(p.precio),
      categoria: NOMBRE_CATEGORIA[p.categoria] || p.categoria,
    });
  }

  if (lista.length) {
    catalogo = lista;
    catalogoHora = Date.now();
  }
  return lista;
}

/* "Piñata  BLUEY" y "piñata bluey" son el mismo producto */
function normalizar(texto: string) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buscarProducto(lista: Producto[], nombre: string) {
  const n = normalizar(nombre);
  return lista.find((p) => normalizar(p.nombre) === n);
}

/* ============================================================
   2. LAS REGLAS QUE SIGUE EL ASISTENTE
   ============================================================ */
function instrucciones(lista: Producto[], carrito: string) {
  const hoy = new Date().toLocaleDateString("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const porCategoria: Record<string, string[]> = {};
  for (const p of lista) {
    (porCategoria[p.categoria] ||= []).push(`- ${p.nombre}: $${p.precio}`);
  }
  const textoCatalogo = Object.entries(porCategoria)
    .map(([c, filas]) => `${c}:\n${filas.join("\n")}`)
    .join("\n\n");

  return `Eres el asistente virtual de "Piñatería Papelito Crepé", una tienda de piñatas y artículos de fiesta en el oriente de la Ciudad de México y Nezahualcóyotl. Atiendes el chat de la página web.

Hoy es ${hoy}.

CÓMO HABLAS
- Como una persona amable de la tienda: español de México, cálido, natural y breve (1 a 4 frases por mensaje). Algún emoji de fiesta de vez en cuando, sin exagerar.
- Haz una o dos preguntas a la vez, nunca un cuestionario completo.
- Si te preguntan si eres una persona, di con honestidad que eres el asistente virtual de la tienda y que una persona confirma los pedidos por WhatsApp.
- Solo hablas de la tienda, sus productos, entregas y pedidos. Si preguntan otra cosa, regresa con amabilidad al tema.

LO QUE VENDEMOS (precios en pesos; son los ÚNICOS precios que puedes dar)
${textoCatalogo || "(No se pudo cargar el catálogo; di que los precios los confirma la tienda por WhatsApp.)"}

- Nunca inventes precios, productos, medidas ni existencias. Si algo no está en la lista, dilo y ofrece apuntarlo "por cotizar": la tienda le pasa el precio por WhatsApp.
- Piñatas personalizadas: hacemos piñatas 100% personalizadas del personaje o tema que quieran. El precio se cotiza por WhatsApp (pueden mandar foto de referencia). Puedes tomar el pedido como "Piñata personalizada de ..." por cotizar.
- No sabes de formas de pago ni de apartados: la tienda lo confirma por WhatsApp.

TIENDAS
- Tienda 1: Mercado Nezahualcóyotl, Local 200. Av. San Ángel 160, Metropolitana 3ra Secc, 57750 Cd. Nezahualcóyotl, Edo. de Méx.
- Tienda 2: Plaza El Salado, Local H1. Calz. Ignacio Zaragoza 3254, Santa Martha Acatitla, Iztapalapa, 09140 CDMX.

ENTREGAS
- En cualquiera de las dos tiendas.
- En el Metro: Línea A, Línea 1 o Línea café (Línea 9), de 11:00 a 11:30 o de 7:30 a 8:00. Pregunta en qué estación le queda bien.
- Envío a domicilio por DiDi o Uber; el costo del envío lo paga el comprador. Pide colonia o dirección y ponla en las notas.

TOMAR UN PEDIDO
Necesitas: productos y cantidades, nombre, teléfono (10 dígitos), cómo se entrega (y dónde/horario) y para qué día.
1. Ve juntando los datos platicando.
2. Antes de guardar, muestra un resumen (productos, cantidades, precio de cada uno y total; lo que no tenga precio va "por cotizar") y pregunta si está todo bien.
3. SOLO cuando el cliente diga que sí, usa guardar_pedido. Guarda una sola vez.
4. Dale su folio y dile que toque el botón verde de WhatsApp que aparece en el chat para mandarlo: el pedido queda confirmado cuando la tienda le conteste por WhatsApp. Que guarde su folio para preguntar después.

PREGUNTAR POR UN PEDIDO
- Pide el folio (se ve así: PC-7K3M) y el teléfono con el que se hizo, y usa consultar_pedido. Sin los dos datos no des información.
- Estados: "nuevo" = recibido, falta que la tienda lo confirme por WhatsApp; "confirmado" = la tienda ya lo confirmó y lo está preparando; "listo" = ya está listo para entregarse; "entregado" = ya se entregó; "cancelado" = se canceló.
- Nunca des datos de otros pedidos ni de otros clientes.
${carrito ? `\nEL CLIENTE TIENE EN SU CARRITO DE LA PÁGINA:\n${carrito}\nSi quiere hacer pedido, ofrécele usar lo de su carrito.` : ""}`;
}

/* ============================================================
   3. LAS DOS COSAS QUE EL ASISTENTE PUEDE HACER
   ============================================================ */
const HERRAMIENTAS = [
  {
    functionDeclarations: [
      {
        name: "guardar_pedido",
        description:
          "Guarda el pedido del cliente y devuelve su folio. Úsala solo después de que el cliente confirmó el resumen.",
        parameters: {
          type: "OBJECT",
          properties: {
            nombre: { type: "STRING", description: "Nombre del cliente" },
            telefono: { type: "STRING", description: "Teléfono a 10 dígitos" },
            productos: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  nombre: {
                    type: "STRING",
                    description: "Nombre exacto como aparece en el catálogo, o descripción si es por cotizar",
                  },
                  cantidad: { type: "INTEGER" },
                },
                required: ["nombre", "cantidad"],
              },
            },
            entrega: {
              type: "STRING",
              description: "Dónde y cómo: tienda, Metro (línea, estación y horario) o DiDi/Uber",
            },
            fecha_entrega: { type: "STRING", description: "Día de la entrega, con fecha" },
            notas: { type: "STRING", description: "Dirección, detalles de la piñata, etc." },
          },
          required: ["nombre", "telefono", "productos", "entrega", "fecha_entrega"],
        },
      },
      {
        name: "consultar_pedido",
        description: "Busca un pedido por su folio y el teléfono con el que se hizo.",
        parameters: {
          type: "OBJECT",
          properties: {
            folio: { type: "STRING" },
            telefono: { type: "STRING" },
          },
          required: ["folio", "telefono"],
        },
      },
    ],
  },
];

function soloDigitos(telefono: unknown) {
  /* Se quita la lada de país si la pusieron: +52 55 1234 5678 */
  return String(telefono || "").replace(/\D/g, "").slice(-10);
}

function recortar(texto: unknown, largo: number) {
  return String(texto || "").trim().slice(0, largo);
}

/* Folio corto y fácil de dictar: sin 0/O ni 1/I/L */
function nuevoFolio() {
  const letras = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let f = "PC-";
  for (let i = 0; i < 4; i++) f += letras[Math.floor(Math.random() * letras.length)];
  return f;
}

// deno-lint-ignore no-explicit-any
async function guardarPedido(args: any, lista: Producto[]) {
  const nombre = recortar(args.nombre, 80);
  const telefono = soloDigitos(args.telefono);
  const entrega = recortar(args.entrega, 200);
  const fecha = recortar(args.fecha_entrega, 100);
  const notas = recortar(args.notas, 500);

  if (!nombre) return { error: "Falta el nombre del cliente." };
  if (telefono.length !== 10) return { error: "El teléfono debe tener 10 dígitos." };
  if (!entrega) return { error: "Falta cómo se entrega." };
  if (!Array.isArray(args.productos) || args.productos.length === 0) {
    return { error: "El pedido no tiene productos." };
  }

  /* El precio sale del catálogo, nunca de lo que diga la IA */
  const productos = args.productos.slice(0, 30).map((p: { nombre: string; cantidad: number }) => {
    const cantidad = Math.min(Math.max(Math.round(Number(p.cantidad) || 1), 1), 500);
    const encontrado = buscarProducto(lista, p.nombre);
    return {
      nombre: encontrado ? encontrado.nombre : recortar(p.nombre, 120),
      cantidad,
      precio: encontrado ? encontrado.precio : null,
    };
  });
  const porCotizar = productos.some((p: { precio: number | null }) => p.precio === null);
  const total = porCotizar
    ? null
    : productos.reduce((s: number, p: { precio: number; cantidad: number }) => s + p.precio * p.cantidad, 0);

  /* Si la IA intenta guardar dos veces el mismo pedido (pasa), se
     devuelve el que ya estaba en vez de duplicarlo. */
  const hace10min = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recientes } = await db
    .from("pedidos")
    .select("folio, productos")
    .eq("telefono", telefono)
    .gte("creado_en", hace10min);
  const igual = (recientes || []).find(
    (r) => JSON.stringify(r.productos) === JSON.stringify(productos)
  );

  let folio = igual?.folio;
  for (let intento = 0; !folio && intento < 5; intento++) {
    const propuesto = nuevoFolio();
    const { error } = await db.from("pedidos").insert({
      folio: propuesto,
      nombre,
      telefono,
      productos,
      total,
      entrega,
      fecha_entrega: fecha,
      notas,
    });
    if (!error) folio = propuesto;
    else if (error.code !== "23505") {
      /* 23505 = el folio ya existía; cualquier otro error es de verdad */
      console.error("No se pudo guardar el pedido:", error.message);
      return { error: "No se pudo guardar el pedido. Pide al cliente que lo mande por WhatsApp." };
    }
  }
  if (!folio) return { error: "No se pudo guardar el pedido. Pide al cliente que lo mande por WhatsApp." };

  return {
    guardado: true,
    folio,
    nombre,
    productos,
    total,
    por_cotizar: porCotizar,
    entrega,
    fecha_entrega: fecha,
    notas,
  };
}

// deno-lint-ignore no-explicit-any
async function consultarPedido(args: any) {
  const folio = recortar(args.folio, 20).toUpperCase().replace(/^PC-?/, "PC-");
  const telefono = soloDigitos(args.telefono);
  const { data } = await db
    .from("pedidos")
    .select("folio, telefono, productos, total, entrega, fecha_entrega, estado, creado_en")
    .eq("folio", folio)
    .maybeSingle();

  /* Mismo aviso si no existe o si el teléfono no coincide: así no se
     puede adivinar qué folios existen. */
  if (!data || data.telefono !== telefono) {
    return { encontrado: false, aviso: "No hay ningún pedido con ese folio y ese teléfono." };
  }
  const { telefono: _t, ...resto } = data;
  return { encontrado: true, ...resto };
}

/* ============================================================
   4. PLATICAR CON GEMINI
   ============================================================ */
// deno-lint-ignore no-explicit-any
async function preguntarGemini(sistema: string, contenidos: any[]) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": LLAVE_GEMINI },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sistema }] },
        contents: contenidos,
        tools: HERRAMIENTAS,
      }),
    }
  );
  if (!r.ok) {
    const detalle = await r.text();
    throw Object.assign(new Error(`Gemini ${r.status}: ${detalle.slice(0, 300)}`), {
      estado: r.status,
    });
  }
  const datos = await r.json();
  return datos.candidates?.[0]?.content;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "Solo POST" }, 405);
  if (!LLAVE_GEMINI) return responder({ error: "sin_llave" }, 500);

  // deno-lint-ignore no-explicit-any
  let cuerpo: any;
  try {
    cuerpo = await req.json();
  } catch {
    return responder({ error: "JSON inválido" }, 400);
  }

  /* La plática la guarda el navegador del cliente y la manda
     completa cada vez. Se recorta para que nadie mande un libro. */
  const mensajes = (Array.isArray(cuerpo.mensajes) ? cuerpo.mensajes : [])
    .slice(-30)
    .filter((m: { rol: string; texto: string }) => m && typeof m.texto === "string" && m.texto.trim())
    .map((m: { rol: string; texto: string }) => ({
      role: m.rol === "bot" ? "model" : "user",
      parts: [{ text: m.texto.slice(0, 1000) }],
    }));
  /* Gemini pide que la plática empiece por el cliente */
  while (mensajes.length && mensajes[0].role === "model") mensajes.shift();
  if (!mensajes.length) return responder({ error: "Sin mensajes" }, 400);

  const carrito = (Array.isArray(cuerpo.carrito) ? cuerpo.carrito : [])
    .slice(0, 30)
    .map((p: { name: string; qty: number }) => `- ${Number(p.qty) || 1} x ${recortar(p.name, 120)}`)
    .join("\n");

  try {
    const lista = await leerCatalogo();
    const sistema = instrucciones(lista, carrito);
    let pedido = null;

    /* Hasta 4 vueltas: la IA pide guardar o buscar, se lo damos, y
       vuelve a contestar con el resultado. */
    for (let vuelta = 0; vuelta < 4; vuelta++) {
      const respuesta = await preguntarGemini(sistema, mensajes);
      const partes = respuesta?.parts || [];
      const llamadas = partes.filter((p: { functionCall?: unknown }) => p.functionCall);

      if (!llamadas.length) {
        const texto = partes
          .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
          .map((p: { text: string }) => p.text)
          .join("")
          .trim();
        return responder({
          respuesta: texto || "Perdón, no te entendí bien. ¿Me lo dices de otra forma? 🙏",
          pedido,
        });
      }

      /* La respuesta de la IA se devuelve tal cual (con su "firma"),
         seguida del resultado de cada herramienta. */
      mensajes.push(respuesta);
      const resultados = [];
      for (const { functionCall } of llamadas) {
        let resultado;
        if (functionCall.name === "guardar_pedido") {
          resultado = await guardarPedido(functionCall.args || {}, lista);
          if (resultado.guardado) pedido = resultado;
        } else if (functionCall.name === "consultar_pedido") {
          resultado = await consultarPedido(functionCall.args || {});
        } else {
          resultado = { error: "Esa herramienta no existe." };
        }
        resultados.push({ functionResponse: { name: functionCall.name, response: resultado } });
      }
      mensajes.push({ role: "user", parts: resultados });
    }
    return responder({ respuesta: "Perdón, me hice bolas. ¿Me repites lo último? 🙏", pedido });
  } catch (e) {
    console.error(e);
    const ocupado = (e as { estado?: number }).estado === 429;
    return responder({ error: ocupado ? "ocupado" : "falla" }, ocupado ? 429 : 500);
  }
});
