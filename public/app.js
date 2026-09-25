const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const money = v => `S/ ${Number(v || 0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const dateFmt = v => v ? new Date(v+'T00:00:00').toLocaleDateString('es-PE') : '-';
const esc = v => String(v ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let cuentas = [];
let currentUser = null;
let selectedAsiento = null;

async function api(url, options={}){
  const r = await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  if(r.status===401){ location.href='/login'; throw new Error('Sesión vencida'); }
  const data = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||'Ocurrió un error');
  return data;
}

async function boot(){
  try{ currentUser = await api('/api/auth/me'); }
  catch{ return; }
  $('#userName').textContent=currentUser.nombre||currentUser.username;
  $('#userRole').textContent=currentUser.rol;
  cuentas=await api('/api/cuentas');
  bindNav();
  showDashboard();
}

function bindNav(){
  $$('.nav-item[data-page]').forEach(b=>b.addEventListener('click',()=>navigatePage(b.dataset.page,b.textContent.trim(),b)));
  $$('.nav-item[data-report]').forEach(b=>b.addEventListener('click',()=>showReport(b.dataset.report,b.dataset.title,b)));
  $('#btnLogout').addEventListener('click',async()=>{ await api('/api/auth/logout',{method:'POST'}); location.href='/login'; });
  $('#btnMenu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
}
function markActive(btn,title){ $$('.nav-item').forEach(x=>x.classList.remove('active')); if(btn) btn.classList.add('active'); $('#pageTitle').textContent=title; }
function setContent(html){ $('#content').innerHTML=html; window.scrollTo({top:0,behavior:'smooth'}); }

async function navigatePage(page,title,btn){ markActive(btn,title); const map={
  dashboard:showDashboard, asientos:showAsientos, compras:()=>showMovimiento('compras'), ventas:()=>showMovimiento('ventas'), planillas:showPlanillas,
  costos:showCostos, 'hoja-costos':showHojaCostos, inventarios:()=>showCatalogoSingle('MERCADERIA','Inventarios y balances'), tablas:showTablas,
  ajuste:showAjuste, cierre:showCierre, backup:showBackup, estadisticas:showEstadisticas, manual:showManual
};
  if(map[page]) await map[page]();
}

async function showDashboard(){
  markActive($('.nav-item[data-page="dashboard"]'),'Panel general');
  const d=await api('/api/dashboard');
  const diff=Number(d.debe)-Number(d.haber);
  setContent(`
    <div class="hero"><h2>Bienvenido, ${esc(currentUser.nombre||currentUser.username)}</h2><p>Vista general del sistema contable y acceso a los principales módulos.</p></div>
    <div class="kpi-grid">
      ${kpi('Asientos registrados',d.asientos,'Movimientos contables acumulados')}
      ${kpi('Ventas del mes',money(d.ventas_mes),'Registro de ventas')}
      ${kpi('Compras del mes',money(d.compras_mes),'Registro de compras')}
      ${kpi('Diferencia Debe/Haber',money(diff),Math.abs(diff)<.01?'Contabilidad cuadrada':'Revisar descuadre')}
    </div>
    <div class="card"><div class="card-head"><h3>Módulos del sistema</h3><span class="muted">Estructura solicitada para el proyecto</span></div>
      <div class="module-grid">
        ${moduleCard('Operaciones','Registro y mantenimiento de asientos contables.','asientos')}
        ${moduleCard('Libros contables','Diario, mayor, inventarios, planillas, compras y ventas.','asientos')}
        ${moduleCard('Estados financieros','Balance general, resultados, flujo de efectivo y comprobación.','estadisticas')}
        ${moduleCard('Costos','Costos fijos/variables, libro de fábrica y costo de ventas.','costos')}
        ${moduleCard('Cierre','Ajustes contables y validación del cierre del ejercicio.','cierre')}
        ${moduleCard('Tablas y utilitarios','Maestros, backup, estadísticas y manual de usuario.','tablas')}
      </div>
    </div>`);
  $$('[data-open]').forEach(b=>b.addEventListener('click',()=>{ const target=$(`.nav-item[data-page="${b.dataset.open}"]`); target?.click(); }));
}
function kpi(label,value,note){ return `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-note">${note}</div></div>`; }
function moduleCard(t,p,page){return `<div class="module-card"><h4>${t}</h4><p>${p}</p><button class="btn btn-secondary" data-open="${page}">Abrir módulo</button></div>`}

function cuentaOptions(selected=''){ return cuentas.map(c=>{const v=`${c.codigo} - ${c.nombre}`;return `<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`}).join(''); }

async function showAsientos(){
  const rows=await api('/api/asientos'); selectedAsiento=null;
  setContent(`
  <h2 class="section-title">Registro de Asiento Contable</h2><p class="section-sub">Registra, modifica y elimina movimientos. La información alimenta los libros y reportes.</p>
  <div class="card">
    <div class="form-grid">
      <div class="field"><label>Fecha</label><input id="aFecha" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="field"><label>N.° asiento</label><input id="aNumero" placeholder="Ej. AS-0001"></div>
      <div class="field span-2"><label>Cuenta contable</label><select id="aCuenta">${cuentaOptions()}</select></div>
      <div class="field span-2"><label>Glosa / descripción</label><input id="aGlosa" placeholder="Descripción del movimiento"></div>
      <div class="field"><label>Tipo de asiento</label><select id="aTipo"><option>Apertura</option><option selected>Operación</option><option>Ajuste</option><option>Reversión</option><option>Cierre</option></select></div>
      <div class="field"><label>Columna destino</label><select id="aDestino"><option>Debe</option><option>Haber</option></select></div>
      <div class="field"><label>Monto</label><input id="aMonto" type="number" min="0" step="0.01" value="0.00"></div>
      <div class="field"><label>Actividad</label><select id="aActividad"><option>Operativa</option><option>Inversión</option><option>Financiamiento</option></select></div>
      <div class="field"><label>Centro de costo</label><input id="aCentro" placeholder="Opcional"></div>
      <div class="field"><label>Documento</label><input id="aDocumento" placeholder="Factura / voucher / otro"></div>
    </div>
    <div class="actions"><button class="btn btn-primary" id="aGuardar">Grabar</button><button class="btn btn-warning" id="aModificar">Modificar</button><button class="btn btn-danger" id="aBorrar">Borrar</button><button class="btn btn-secondary" id="aLimpiar">Limpiar</button></div>
  </div>
  <div class="card"><div class="card-head"><h3>Historial de asientos</h3><span class="muted">Haz clic en una fila para editarla.</span></div>${asientosTable(rows)}</div>`);
  $('#aGuardar').onclick=saveAsiento; $('#aModificar').onclick=updateAsiento; $('#aBorrar').onclick=deleteAsiento; $('#aLimpiar').onclick=clearAsiento;
  $$('#tablaAsientos tbody tr').forEach(tr=>tr.addEventListener('click',()=>loadAsiento(rows.find(x=>String(x.id)===tr.dataset.id),tr)));
}
function asientoPayload(){ const m=Number($('#aMonto').value||0),dest=$('#aDestino').value; return {fecha:$('#aFecha').value,numero_asiento:$('#aNumero').value.trim(),cuenta:$('#aCuenta').value,glosa:$('#aGlosa').value.trim(),tipo_asiento:$('#aTipo').value,monto:m,debe:dest==='Debe'?m:0,haber:dest==='Haber'?m:0,actividad:$('#aActividad').value,centro_costo:$('#aCentro').value.trim(),documento:$('#aDocumento').value.trim()}; }
async function saveAsiento(){ const p=asientoPayload(); if(!p.glosa) return alert('Ingresa una glosa.'); await api('/api/asientos',{method:'POST',body:JSON.stringify(p)}); await showAsientos(); }
async function updateAsiento(){ if(!selectedAsiento) return alert('Selecciona un asiento.'); await api(`/api/asientos/${selectedAsiento.id}`,{method:'PUT',body:JSON.stringify(asientoPayload())}); await showAsientos(); }
async function deleteAsiento(){ if(!selectedAsiento) return alert('Selecciona un asiento.'); if(!confirm(`¿Eliminar el asiento #${selectedAsiento.id}?`)) return; await api(`/api/asientos/${selectedAsiento.id}`,{method:'DELETE'}); await showAsientos(); }
function clearAsiento(){ selectedAsiento=null; $('#aGlosa').value='';$('#aMonto').value='0.00';$('#aNumero').value='';$('#aCentro').value='';$('#aDocumento').value='';$$('#tablaAsientos tr').forEach(x=>x.classList.remove('row-selected')); }
function loadAsiento(a,tr){ selectedAsiento=a; $('#aFecha').value=(a.fecha||'').slice(0,10);$('#aNumero').value=a.numero_asiento||'';$('#aCuenta').value=a.cuenta;$('#aGlosa').value=a.glosa;$('#aTipo').value=a.tipo_asiento;$('#aDestino').value=Number(a.debe)>0?'Debe':'Haber';$('#aMonto').value=a.monto;$('#aActividad').value=a.actividad||'Operativa';$('#aCentro').value=a.centro_costo||'';$('#aDocumento').value=a.documento||'';$$('#tablaAsientos tr').forEach(x=>x.classList.remove('row-selected'));tr.classList.add('row-selected'); }
function asientosTable(rows){ return `<div class="table-wrap"><table id="tablaAsientos"><thead><tr><th>ID</th><th>Fecha</th><th>N.°</th><th>Cuenta</th><th>Glosa</th><th>Tipo</th><th>Debe</th><th>Haber</th><th>Actividad</th></tr></thead><tbody>${rows.map(a=>`<tr data-id="${a.id}"><td>${a.id}</td><td>${dateFmt((a.fecha||'').slice(0,10))}</td><td>${esc(a.numero_asiento||'-')}</td><td><b>${esc(a.cuenta)}</b></td><td>${esc(a.glosa)}</td><td>${esc(a.tipo_asiento)}</td><td class="money">${money(a.debe)}</td><td class="money">${money(a.haber)}</td><td>${esc(a.actividad||'-')}</td></tr>`).join('')||`<tr><td colspan="9" class="empty">No hay asientos registrados.</td></tr>`}</tbody></table></div>`; }

async function showMovimiento(tipo){
  const isCompra=tipo==='compras', rows=await api(`/api/${tipo}`), title=isCompra?'Registro de Compras':'Registro de Ventas';
  setContent(`<h2 class="section-title">${title}</h2><p class="section-sub">Registro auxiliar para control y análisis.</p>
    <div class="card"><div class="form-grid">
      <div class="field"><label>Fecha</label><input id="mFecha" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="field"><label>Documento</label><input id="mDoc" placeholder="F001-0001"></div>
      <div class="field"><label>${isCompra?'Proveedor':'Cliente'}</label><input id="mTercero"></div>
      <div class="field"><label>${isCompra?'RUC':'RUC / DNI'}</label><input id="mRuc"></div>
      <div class="field span-2"><label>Descripción</label><input id="mDesc"></div>
      <div class="field"><label>Subtotal</label><input id="mSub" type="number" step="0.01" value="0"></div>
      <div class="field"><label>IGV</label><input id="mIgv" type="number" step="0.01" value="0"></div>
      <div class="field"><label>Total</label><input id="mTotal" type="number" step="0.01" value="0"></div>
    </div><div class="actions"><button class="btn btn-primary" id="mSave">Guardar</button></div></div>
    <div class="card">${simpleTable(rows,[['fecha','Fecha'],['documento','Documento'],[isCompra?'proveedor':'cliente',isCompra?'Proveedor':'Cliente'],[isCompra?'ruc':'ruc_dni',isCompra?'RUC':'RUC/DNI'],['descripcion','Descripción'],['subtotal','Subtotal','money'],['igv','IGV','money'],['total','Total','money']],tipo)}</div>`);
  $('#mSub').addEventListener('input',calcTotal); $('#mIgv').addEventListener('input',calcTotal);
  $('#mSave').onclick=async()=>{const p={fecha:$('#mFecha').value,documento:$('#mDoc').value.trim(),[isCompra?'proveedor':'cliente']:$('#mTercero').value.trim(),[isCompra?'ruc':'ruc_dni']:$('#mRuc').value.trim(),descripcion:$('#mDesc').value.trim(),subtotal:Number($('#mSub').value||0),igv:Number($('#mIgv').value||0),total:Number($('#mTotal').value||0)}; if(!p[isCompra?'proveedor':'cliente'])return alert('Completa el tercero.');await api(`/api/${tipo}`,{method:'POST',body:JSON.stringify(p)});await showMovimiento(tipo)};
  bindDeletes(tipo,()=>showMovimiento(tipo));
}
function calcTotal(){ $('#mTotal').value=(Number($('#mSub').value||0)+Number($('#mIgv').value||0)).toFixed(2); }

async function showPlanillas(){
 const rows=await api('/api/planillas');
 setContent(`<h2 class="section-title">Planillas</h2><p class="section-sub">Incluye sueldo bruto y deducciones configurables de AFP/ONP, SUNAT y otros conceptos.</p>
 <div class="card"><div class="form-grid"><div class="field"><label>Periodo</label><input id="pPeriodo" type="month" value="${new Date().toISOString().slice(0,7)}"></div><div class="field span-2"><label>Trabajador</label><input id="pTrab"></div><div class="field"><label>Sueldo bruto</label><input id="pSueldo" type="number" step=".01" value="0"></div><div class="field"><label>Sistema</label><select id="pSis"><option>AFP</option><option>ONP</option></select></div><div class="field"><label>AFP / ONP</label><input id="pPen" type="number" step=".01" value="0"></div><div class="field"><label>Retención SUNAT</label><input id="pSunat" type="number" step=".01" value="0"></div><div class="field"><label>Otros descuentos</label><input id="pOtros" type="number" step=".01" value="0"></div><div class="field"><label>Neto</label><input id="pNeto" type="number" step=".01" value="0" readonly></div></div><div class="actions"><button class="btn btn-primary" id="pSave">Guardar planilla</button></div></div>
 <div class="card">${simpleTable(rows,[['periodo','Periodo'],['trabajador','Trabajador'],['sueldo_bruto','Sueldo bruto','money'],['sistema_pension','Sistema'],['descuento_pension','AFP/ONP','money'],['retencion_sunat','SUNAT','money'],['otros_descuentos','Otros','money'],['neto','Neto','money']],'planillas')}</div>`);
 const calc=()=>$('#pNeto').value=Math.max(0,Number($('#pSueldo').value||0)-Number($('#pPen').value||0)-Number($('#pSunat').value||0)-Number($('#pOtros').value||0)).toFixed(2); ['#pSueldo','#pPen','#pSunat','#pOtros'].forEach(x=>$(x).oninput=calc);
 $('#pSave').onclick=async()=>{const p={periodo:$('#pPeriodo').value,trabajador:$('#pTrab').value.trim(),sueldo_bruto:Number($('#pSueldo').value||0),sistema_pension:$('#pSis').value,descuento_pension:Number($('#pPen').value||0),retencion_sunat:Number($('#pSunat').value||0),otros_descuentos:Number($('#pOtros').value||0),neto:Number($('#pNeto').value||0)};if(!p.trabajador)return alert('Ingresa el trabajador.');await api('/api/planillas',{method:'POST',body:JSON.stringify(p)});await showPlanillas()};bindDeletes('planillas',showPlanillas);
}

async function showCostos(){
 const rows=await api('/api/costos');
 setContent(`<h2 class="section-title">Costos</h2><p class="section-sub">Libro mayor de fábrica y clasificación de costos fijos y variables.</p>
 <div class="card"><div class="form-grid"><div class="field"><label>Fecha</label><input id="cFecha" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field span-2"><label>Concepto</label><input id="cConcepto"></div><div class="field"><label>Tipo</label><select id="cTipo"><option value="FIJO">Fijo</option><option value="VARIABLE">Variable</option></select></div><div class="field"><label>Categoría</label><input id="cCat" placeholder="Materia prima, MOD, CIF..."></div><div class="field"><label>Centro de costo</label><input id="cCentro"></div><div class="field"><label>Monto</label><input id="cMonto" type="number" step=".01" value="0"></div></div><div class="actions"><button class="btn btn-primary" id="cSave">Registrar costo</button></div></div>
 <div class="card">${simpleTable(rows,[['fecha','Fecha'],['concepto','Concepto'],['tipo','Tipo'],['categoria','Categoría'],['centro_costo','Centro de costo'],['monto','Monto','money']],'costos')}</div>`);
 $('#cSave').onclick=async()=>{const p={fecha:$('#cFecha').value,concepto:$('#cConcepto').value.trim(),tipo:$('#cTipo').value,categoria:$('#cCat').value.trim(),centro_costo:$('#cCentro').value.trim(),monto:Number($('#cMonto').value||0)};if(!p.concepto)return alert('Ingresa el concepto.');await api('/api/costos',{method:'POST',body:JSON.stringify(p)});await showCostos()};bindDeletes('costos',showCostos);
}

async function showHojaCostos(){
 const rows=await api('/api/costos'); const total=rows.reduce((s,x)=>s+Number(x.monto||0),0), fijo=rows.filter(x=>x.tipo==='FIJO').reduce((s,x)=>s+Number(x.monto||0),0), variable=total-fijo;
 setContent(`<h2 class="section-title">Hoja de costos</h2><p class="section-sub">Resumen de costos registrados para fines académicos y de análisis.</p><div class="kpi-grid">${kpi('Costo total',money(total),'Acumulado')}${kpi('Costos fijos',money(fijo),'Clasificación FIJO')}${kpi('Costos variables',money(variable),'Clasificación VARIABLE')}${kpi('Registros',rows.length,'Movimientos de costos')}</div><div class="card">${simpleTable(rows,[['fecha','Fecha'],['concepto','Concepto'],['tipo','Tipo'],['categoria','Categoría'],['centro_costo','Centro de costo'],['monto','Monto','money']])}</div>`);
}

async function showReport(type,title,btn){ markActive(btn,title); const rows=await api(`/api/reportes/${type}`); setContent(`<h2 class="section-title">${esc(title)}</h2><p class="section-sub">Reporte generado con la información registrada en el sistema.</p><div class="card"><div class="card-head"><h3>${esc(title)}</h3><div class="report-tools"><button class="btn btn-secondary" onclick="window.print()">Imprimir</button></div></div><div class="report-box">${reportTable(type,rows)}</div></div>`); }
function reportTable(type,rows){
 const schemas={
  diario:[['fecha','Fecha'],['id','ID'],['numero_asiento','N.°'],['cuenta','Cuenta'],['glosa','Glosa'],['documento','Documento'],['debe','Debe','money'],['haber','Haber','money']],
  mayor:[['cuenta','Cuenta'],['movimientos','Movimientos'],['debe','Debe','money'],['haber','Haber','money'],['saldo','Saldo','money']],
  'balance-comprobacion':[['cuenta','Cuenta'],['debe','Debe','money'],['haber','Haber','money'],['saldo_deudor','Saldo deudor','money'],['saldo_acreedor','Saldo acreedor','money']],
  'flujo-efectivo':[['actividad','Actividad'],['entradas','Entradas','money'],['salidas','Salidas','money'],['flujo_neto','Flujo neto','money']],
  resultados:[['concepto','Concepto'],['monto','Monto','money']],
  'balance-general':[['tipo','Clasificación'],['saldo','Saldo','money']],
  'costo-ventas':[['tipo','Tipo'],['monto','Monto','money']]
 }; return simpleTable(rows,schemas[type]||Object.keys(rows[0]||{}).map(k=>[k,k]));
}

async function showCatalogoSingle(tipo,title){
 const rows=await api(`/api/catalogos/${tipo}`); setContent(`<h2 class="section-title">${title}</h2><p class="section-sub">Catálogo para el control de existencias y saldos auxiliares.</p><div class="card"><div class="form-grid"><div class="field"><label>Código</label><input id="gCodigo"></div><div class="field span-2"><label>Nombre</label><input id="gNombre"></div><div class="field"><label>Descripción</label><input id="gDesc"></div></div><div class="actions"><button class="btn btn-primary" id="gSave">Agregar</button></div></div><div class="card">${simpleTable(rows,[['codigo','Código'],['nombre','Nombre'],['descripcion','Descripción']],`catalogos/${tipo}`)}</div>`); $('#gSave').onclick=async()=>{if(!$('#gNombre').value.trim())return alert('Ingresa el nombre.');await api(`/api/catalogos/${tipo}`,{method:'POST',body:JSON.stringify({codigo:$('#gCodigo').value.trim(),nombre:$('#gNombre').value.trim(),descripcion:$('#gDesc').value.trim()})});await showCatalogoSingle(tipo,title)}; bindDeletes(`catalogos/${tipo}`,()=>showCatalogoSingle(tipo,title));
}

const catalogTypes=[['CUENTA','Cuentas contables'],['PRODUCTO_TERMINADO','Productos terminados'],['MERCADERIA','Mercaderías'],['ACTIVO_FIJO','Activo fijo'],['CENTRO_COSTO','Centros de costo'],['INDUCTOR','Inductores'],['REPUESTO','Repuestos']];
async function showTablas(){
 setContent(`<h2 class="section-title">Tablas maestras</h2><p class="section-sub">Mantén los catálogos principales del sistema.</p><div class="catalog-grid"><div class="card"><div class="catalog-menu">${catalogTypes.map((x,i)=>`<button class="${i===0?'active':''}" data-cat="${x[0]}">${x[1]}</button>`).join('')}</div></div><div id="catalogBody"></div></div>`);
 $$('.catalog-menu button').forEach(b=>b.onclick=()=>loadCatalogPanel(b.dataset.cat,b)); await loadCatalogPanel('CUENTA',$('.catalog-menu button'));
}
async function loadCatalogPanel(tipo,btn){ $$('.catalog-menu button').forEach(x=>x.classList.remove('active'));btn?.classList.add('active'); const title=(catalogTypes.find(x=>x[0]===tipo)||[])[1]||tipo; if(tipo==='CUENTA'){ const rows=await api('/api/cuentas'); $('#catalogBody').innerHTML=`<div class="card"><h3>${title}</h3><div class="form-grid"><div class="field"><label>Código</label><input id="tcCod"></div><div class="field span-2"><label>Nombre</label><input id="tcNom"></div><div class="field"><label>Tipo</label><select id="tcTipo"><option>Activo</option><option>Pasivo</option><option>Patrimonio</option><option>Ingreso</option><option>Gasto</option></select></div><div class="field"><label>Naturaleza</label><select id="tcNat"><option value="DEBE">Debe</option><option value="HABER">Haber</option></select></div></div><div class="actions"><button class="btn btn-primary" id="tcSave">Agregar cuenta</button></div>${simpleTable(rows,[['codigo','Código'],['nombre','Nombre'],['tipo','Tipo'],['naturaleza','Naturaleza']])}</div>`; $('#tcSave').onclick=async()=>{await api('/api/cuentas',{method:'POST',body:JSON.stringify({codigo:$('#tcCod').value.trim(),nombre:$('#tcNom').value.trim(),tipo:$('#tcTipo').value,naturaleza:$('#tcNat').value})});cuentas=await api('/api/cuentas');await loadCatalogPanel('CUENTA',btn)}; return; }
 const rows=await api(`/api/catalogos/${tipo}`); $('#catalogBody').innerHTML=`<div class="card"><h3>${title}</h3><div class="form-grid"><div class="field"><label>Código</label><input id="tcCod"></div><div class="field span-2"><label>Nombre</label><input id="tcNom"></div><div class="field"><label>Descripción</label><input id="tcDesc"></div></div><div class="actions"><button class="btn btn-primary" id="tcSave">Agregar registro</button></div>${simpleTable(rows,[['codigo','Código'],['nombre','Nombre'],['descripcion','Descripción']],`catalogos/${tipo}`)}</div>`; $('#tcSave').onclick=async()=>{await api(`/api/catalogos/${tipo}`,{method:'POST',body:JSON.stringify({codigo:$('#tcCod').value.trim(),nombre:$('#tcNom').value.trim(),descripcion:$('#tcDesc').value.trim()})});await loadCatalogPanel(tipo,btn)}; bindDeletes(`catalogos/${tipo}`,()=>loadCatalogPanel(tipo,btn));
}

async function showAjuste(){
 setContent(`<h2 class="section-title">Ajuste contable</h2><p class="section-sub">Registra un asiento de tipo “Ajuste” antes del cierre.</p><div class="card"><div class="note">Los ajustes se guardan dentro del libro de asientos y quedan identificados con tipo de asiento “Ajuste”.</div><div class="actions"><button class="btn btn-primary" id="goAjuste">Crear ajuste</button></div></div>`); $('#goAjuste').onclick=async()=>{await showAsientos();$('#aTipo').value='Ajuste';$('#pageTitle').textContent='Ajuste contable'};
}
async function showCierre(){ const d=await api('/api/cierre/resumen'); setContent(`<h2 class="section-title">Cierre del ejercicio</h2><p class="section-sub">Validación previa al cierre contable.</p><div class="card"><div class="big-status">${d.cuadrado?'CUADRADO':'REVISAR'}</div><div class="status-line"><span>Total Debe</span><b>${money(d.debe)}</b></div><div class="status-line"><span>Total Haber</span><b>${money(d.haber)}</b></div><div class="status-line"><span>Diferencia</span><b>${money(d.diferencia)}</b></div><div class="status-line"><span>Asientos</span><b>${d.asientos}</b></div><div class="note" style="margin-top:15px">Esta pantalla valida el equilibrio Debe/Haber. El cierre definitivo no elimina ni modifica información automáticamente.</div></div>`); }
async function showBackup(){ setContent(`<h2 class="section-title">Backup</h2><p class="section-sub">Descarga una copia JSON de los datos contables y maestros.</p><div class="card"><h3>Copia de seguridad</h3><p class="muted">Incluye asientos, cuentas, catálogos, compras, ventas, planillas y costos.</p><div class="actions"><a class="btn btn-primary" href="/api/backup">Descargar backup</a></div></div>`); }
async function showEstadisticas(){ const d=await api('/api/dashboard'), mayor=await api('/api/reportes/mayor'); setContent(`<h2 class="section-title">Estadísticas</h2><p class="section-sub">Indicadores generales de la operación contable.</p><div class="kpi-grid">${kpi('Asientos',d.asientos,'Total acumulado')}${kpi('Debe',money(d.debe),'Acumulado')}${kpi('Haber',money(d.haber),'Acumulado')}${kpi('Cuentas con movimiento',mayor.length,'Libro mayor')}</div><div class="card"><h3>Movimiento por cuenta</h3>${simpleTable(mayor,[['cuenta','Cuenta'],['movimientos','Movimientos'],['debe','Debe','money'],['haber','Haber','money'],['saldo','Saldo','money']])}</div>`); }
function showManual(){ setContent(`<h2 class="section-title">Manual de usuario</h2><p class="section-sub">Guía rápida del sistema.</p><div class="card"><h3>Flujo recomendado</h3><ol style="line-height:1.8;color:#4b5563"><li>Configura las tablas maestras: cuentas, productos, mercaderías, activos, centros de costo, inductores y repuestos.</li><li>Registra las operaciones mediante asientos contables y, cuando corresponda, usa los auxiliares de compras, ventas, planillas y costos.</li><li>Consulta Libro Diario, Libro Mayor y Balance de Comprobación para validar movimientos.</li><li>Revisa los estados financieros y el flujo de efectivo.</li><li>Antes de cerrar, registra ajustes y verifica que Debe y Haber estén cuadrados.</li><li>Descarga un backup periódico desde Utilitarios.</li></ol><div class="note">Para un uso real empresarial deben configurarse el PCGE, reglas tributarias, periodos contables, correlativos y perfiles de usuario según las políticas de la organización.</div></div>`); }

function simpleTable(rows, cols, deleteEndpoint=''){
 const th=cols.map(c=>`<th>${c[1]}</th>`).join('')+(deleteEndpoint?'<th></th>':'');
 const body=rows.map(r=>`<tr>${cols.map(c=>{let v=r[c[0]];if(c[2]==='money')v=money(v);else if(c[0]==='fecha')v=dateFmt(String(v||'').slice(0,10));else v=esc(v??'-');return `<td class="${c[2]==='money'?'money':''}">${v}</td>`}).join('')}${deleteEndpoint?`<td><button class="btn btn-danger btn-del" data-id="${r.id}" data-endpoint="${deleteEndpoint}">Eliminar</button></td>`:''}</tr>`).join('')||`<tr><td colspan="${cols.length+(deleteEndpoint?1:0)}" class="empty">Sin registros.</td></tr>`;
 return `<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function bindDeletes(endpoint,cb){ $$('.btn-del').forEach(b=>b.onclick=async()=>{if(!confirm('¿Eliminar este registro?'))return;await api(`/api/${endpoint}/${b.dataset.id}`,{method:'DELETE'});await cb();}); }

boot();
