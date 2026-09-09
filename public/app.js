document.addEventListener('DOMContentLoaded', cargarAsientos);

document.getElementById('asientoForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const nuevoAsiento = {
    glosa: document.getElementById('glosa').value,
    tipo_asiento: document.getElementById('tipo_asiento').value,
    monto: parseFloat(document.getElementById('monto').value) || 0,
    debe: parseFloat(document.getElementById('debe').value) || 0,
    haber: parseFloat(document.getElementById('haber').value) || 0,
    actividad: document.getElementById('actividad').value
  };

  const response = await fetch('/api/asientos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(nuevoAsiento)
  });

  if (response.ok) {
    document.getElementById('asientoForm').reset();
    cargarAsientos();
  } else {
    alert('Error al guardar en la base de datos');
  }
});

async function cargarAsientos() {
  const response = await fetch('/api/asientos');
  const asientos = await response.json();
  
  const tabla = document.getElementById('tablaAsientos');
  tabla.innerHTML = '';

  asientos.forEach(a => {
    tabla.innerHTML += `
      <tr>
        <td>${a.id}</td>
        <td>${a.glosa}</td>
        <td>${a.tipo_asiento}</td>
        <td>$ ${parseFloat(a.monto).toFixed(2)}</td>
        <td>$ ${parseFloat(a.debe).toFixed(2)}</td>
        <td>$ ${parseFloat(a.haber).toFixed(2)}</td>
        <td>${a.actividad}</td>
      </tr>
    `;
  });
}
