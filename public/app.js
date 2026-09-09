document.addEventListener('DOMContentLoaded', cargarAsientos);

const form = document.getElementById('asientoForm');
const btnGrabar = document.getElementById('btnGrabar');
const btnModificar = document.getElementById('btnModificar');
const btnBorrar = document.getElementById('btnBorrar');
const btnLimpiar = document.getElementById('btnLimpiar');

function obtenerDatosFormulario() {
  const monto = parseFloat(document.getElementById('monto').value) || 0;
  const destino = document.getElementById('columna_destino').value;

  return {
    cuenta: document.getElementById('cuenta').value,
    glosa: document.getElementById('glosa').value,
    tipo_asiento: document.getElementById('tipo_asiento').value,
    monto: monto,
    debe: destino === 'Debe' ? monto : 0,
    haber: destino === 'Haber' ? monto : 0,
    actividad: document.getElementById('actividad').value
  };
}

// 1. GRABAR
btnGrabar.addEventListener('click', async () => {
  const datos = obtenerDatosFormulario();
  if (!datos.glosa) return alert('Por favor ingresa una glosa');

  const res = await fetch('/api/asientos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });

  if (res.ok) {
    limpiar();
    cargarAsientos();
  }
});

// 2. MODIFICAR
btnModificar.addEventListener('click', async () => {
  const id = document.getElementById('id_asiento').value;
  if (!id) return alert('Selecciona un asiento de la lista para modificar');

  const datos = obtenerDatosFormulario();

  const res = await fetch(`/api/asientos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });

  if (res.ok) {
    limpiar();
    cargarAsientos();
  }
});

// 3. BORRAR
btnBorrar.addEventListener('click', async () => {
  const id = document.getElementById('id_asiento').value;
  if (!id) return alert('Selecciona un asiento de la lista para borrar');

  if (confirm(`¿Estás seguro de eliminar el asiento #${id}?`)) {
    const res = await fetch(`/api/asientos/${id}`, { method: 'DELETE' });
    if (res.ok) {
      limpiar();
      cargarAsientos();
    }
  }
});

btnLimpiar.addEventListener('click', limpiar);

function limpiar() {
  document.getElementById('id_asiento').value = '';
  form.reset();
}

async function cargarAsientos() {
  const response = await fetch('/api/asientos');
  const asientos = await response.json();
  
  const tabla = document.getElementById('tablaAsientos');
  tabla.innerHTML = '';

  asientos.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${a.id}</td>
      <td><strong>${a.cuenta || '-'}</strong></td>
      <td>${a.glosa}</td>
      <td>${a.tipo_asiento}</td>
      <td>$ ${parseFloat(a.monto).toFixed(2)}</td>
      <td>$ ${parseFloat(a.debe).toFixed(2)}</td>
      <td>$ ${parseFloat(a.haber).toFixed(2)}</td>
      <td>${a.actividad}</td>
    `;

    tr.addEventListener('click', () => {
      document.getElementById('id_asiento').value = a.id;
      document.getElementById('cuenta').value = a.cuenta || '10 - Caja y Bancos';
      document.getElementById('glosa').value = a.glosa;
      document.getElementById('tipo_asiento').value = a.tipo_asiento;
      document.getElementById('monto').value = a.monto;
      document.getElementById('columna_destino').value = parseFloat(a.debe) > 0 ? 'Debe' : 'Haber';
      document.getElementById('actividad').value = a.actividad;

      document.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
    });

    tabla.appendChild(tr);
  });
}
