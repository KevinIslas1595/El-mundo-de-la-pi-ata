let productos = JSON.parse(localStorage.getItem("productos")) || [];
let editIndex = null;

function guardarProducto() {
  const nombre = document.getElementById("nombre").value;
  const precio = document.getElementById("precio").value;
  const archivo = document.getElementById("imagen").files[0];

  if (!nombre || !precio || !archivo) {
    alert("Faltan datos");
    return;
  }

  const reader = new FileReader();
  reader.onload = function () {
    const imagenBase64 = reader.result;

    const nuevoProducto = { nombre, precio, imagen: imagenBase64 };

    if (editIndex !== null) {
      productos[editIndex] = nuevoProducto;
      editIndex = null;
    } else {
      productos.push(nuevoProducto);
    }

    localStorage.setItem("productos", JSON.stringify(productos));
    limpiarFormulario();
    mostrarAdmin();
  };

  reader.readAsDataURL(archivo);
}

function limpiarFormulario() {
  document.getElementById("nombre").value = "";
  document.getElementById("precio").value = "";
  document.getElementById("imagen").value = "";
}

function mostrarProductos() {
  const contenedor = document.getElementById("lista-productos");
  if (!contenedor) return;
  contenedor.innerHTML = "";
  productos.forEach(prod => {
    contenedor.innerHTML += `
      <div class="producto">
        <img src="${prod.imagen}" alt="${prod.nombre}" />
        <h3>${prod.nombre}</h3>
        <p>$${prod.precio}</p>
      </div>
    `;
  });
}

function mostrarAdmin() {
  const contenedor = document.getElementById("lista-admin");
  if (!contenedor) return;
  contenedor.innerHTML = "";
  productos.forEach((prod, i) => {
    contenedor.innerHTML += `
      <div class="producto">
        <img src="${prod.imagen}" width="100" /><br/>
        <b>${prod.nombre}</b><br/>
        $${prod.precio}<br/>
        <button onclick="editarProducto(${i})">✏️ Editar</button>
      </div>
    `;
  });
}

function editarProducto(index) {
  const prod = productos[index];
  document.getElementById("nombre").value = prod.nombre;
  document.getElementById("precio").value = prod.precio;
  editIndex = index;
}
