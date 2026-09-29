-- ============================================================
-- Tabla de PEDIDOS — la llena el chat de la tienda
-- ============================================================
-- Se pega tal cual en Supabase → SQL Editor → New query → Run.
-- Ver CONFIGURAR-CHAT.md

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  folio text unique not null,            -- ej. PC-7K3M, el que ve el cliente
  nombre text not null,
  telefono text not null,                -- 10 dígitos
  productos jsonb not null,              -- [{nombre, cantidad, precio}]
  total numeric,                         -- vacío si algo es por cotizar
  entrega text not null,                 -- tienda, Metro o DiDi/Uber
  fecha_entrega text,
  notas text,
  estado text not null default 'nuevo'
    check (estado in ('nuevo', 'confirmado', 'listo', 'entregado', 'cancelado')),
  creado_en timestamptz default now()
);

create index pedidos_creado_idx on pedidos (creado_en desc);

-- Seguridad por filas: sin ninguna regla para "anon", los visitantes
-- de la página NO pueden leer ni tocar los pedidos. El chat los guarda
-- y los consulta desde el servidor (la función "chat"), que pide el
-- folio Y el teléfono antes de contar nada.
alter table pedidos enable row level security;

-- Solo tú, con tu usuario del panel, ves y cambias los pedidos
create policy "gestionar pedidos"
  on pedidos for all
  to authenticated
  using (true)
  with check (true);
