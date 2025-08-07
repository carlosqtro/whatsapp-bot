// whatsapp-server.js (Versión 14.2 - Producción Estable y Completa)

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const Brevo = require('@getbrevo/brevo');
const twilio = require('twilio');
const { categoriasUnicas, getCategoriasMenu, getItemsPorCategoria } = require('./menu');
const fs = require('fs');

// --- Inicialización de APIs ---
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilio(accountSid, authToken);

const brevoApiInstance = new Brevo.TransactionalEmailsApi();
try {
    brevoApiInstance.apiClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
    console.log('🔎 Enviando email con:');
console.log('📨 TO:', process.env.RESTAURANT_EMAIL_ADDRESS);
console.log('📤 SENDER:', process.env.SENDER_EMAIL_ADDRESS);
console.log('🔐 API KEY (parcial):', process.env.BREVO_API_KEY?.substring(0, 5) || '❌ NO SETEADA');


} catch (err) {
    console.error('❌ No se pudo inicializar la API Key de Brevo.');
}

// --- Gestión de usuarios y sesiones ---
const RUTA_USUARIOS = './usuarios.json';
const sessions = {};
function cargarUsuarios() { try { if (fs.existsSync(RUTA_USUARIOS)) { const data = fs.readFileSync(RUTA_USUARIOS, 'utf8'); return data ? JSON.parse(data) : {}; } else { fs.writeFileSync(RUTA_USUARIOS, JSON.stringify({}, null, 2)); return {}; } } catch { return {}; } }
function guardarUsuario(from, userData) { try { const usuarios = cargarUsuarios(); usuarios[from] = { ...(usuarios[from] || {}), ...userData }; fs.writeFileSync(RUTA_USUARIOS, JSON.stringify(usuarios, null, 2)); } catch { } }

// --- Formatos de notificación ---
function formatearResumenParaLocal(session, datosFinales) {
    let texto = `*¡NUEVO PEDIDO RECIBIDO!* - ${new Date().toLocaleTimeString('es-UY')}\n\n`;
    texto += `*Cliente:* ${datosFinales.nombre}\n`;
    texto += `*Teléfono:* ${datosFinales.telefono.replace('whatsapp:', '')}\n`;
    texto += `*Tipo de pago:* ${datosFinales.pago}\n\n`;
    if (datosFinales.tipo === 'mesa') {
        texto += `*Tipo:* Mesa\n*Número:* ${datosFinales.mesa}\n\n`;
    } else {
        texto += `*Tipo:* Domicilio\n*Dirección:* ${datosFinales.direccion}\n\n`;
    } texto += "--- *Detalle del Pedido* ---\n";
    let total = 0;
    session.pedido.forEach(item => {
        const subtotal = item.price * item.cantidad;
        texto += `• ${item.cantidad}x ${item.name} ($${item.price}) - $${subtotal}\n`;
        total += subtotal;
    }); texto += `\n*TOTAL: $${total}*`; return texto;
}

function formatearResumenParaEmail(session, datosFinales) { let html = `<h1>Nuevo Pedido</h1>`; html += `<p><strong>Cliente:</strong> ${datosFinales.nombre}</p>`; html += `<p><strong>Teléfono:</strong> ${datosFinales.telefono.replace('whatsapp:', '')}</p>`; html += `<p><strong>Tipo de pago:</strong> ${datosFinales.pago}</p>`; if (datosFinales.tipo === 'mesa') { html += `<p><strong>Tipo:</strong> Mesa</p><p><strong>Número:</strong> ${datosFinales.mesa}</p>`; } else { html += `<p><strong>Tipo:</strong> Domicilio</p><p><strong>Dirección:</strong> ${datosFinales.direccion}</p>`; } html += "<h2>Detalle</h2><ul>"; let total = 0; session.pedido.forEach(item => { const subtotal = item.price * item.cantidad; html += `<li>${item.cantidad}x ${item.name} - $${subtotal}</li>`; total += subtotal; }); html += `</ul><h3>Total: $${total}</h3>`; return html; }

// --- Enviar notificaciones ---
async function enviarNotificaciones(resumenTexto, resumenHtml) {
    console.log('\n--- 📨 Enviando notificaciones ---');
    try {
        await twilioClient.messages.create(
            {
                from: process.env.TWILIO_WHATSAPP_NUMBER,
                to: process.env.RESTAURANT_WHATSAPP_NUMBER,
                body: resumenTexto
            });
        console.log('✅ WhatsApp enviado.');
    }
    catch (error) { console.error('❌ Error WhatsApp:', error.message); }
    try {
        let email = new Brevo.SendSmtpEmail();
        email.subject = "Nuevo Pedido"; 
        email.htmlContent = resumenHtml; 
        email.sender = { 
            name: "Bot Pedidos", 
            email: process.env.SENDER_EMAIL_ADDRESS }; 
            email.to = [{ email: process.env.RESTAURANT_EMAIL_ADDRESS }]; 
            await brevoApiInstance.sendTransacEmail(email); 
            console.log('✅ Email enviado.');
    } catch (error) { console.error('❌ Error Email:', error.message); }
}

// --- Utilidades del Bot ---
function mostrarResumen(s) { if (!s.pedido.length) return ""; let txt = "🧾 *Resumen:*\n"; let total = 0; s.pedido.forEach((p, i) => { const sub = p.price * p.cantidad; txt += `${i + 1}️⃣ ${p.cantidad}x ${p.name} - $${sub}\n`; total += sub; }); txt += `\n*Total:* $${total}`; return txt; }
function construirVistaDeProductos(s) { let txt = mostrarResumen(s); if (txt) txt += "\n\n---\n\n"; const items = getItemsPorCategoria(s.categoriaActual); items.forEach((it, i) => txt += `*${i + 1}* ${it.name} - $${it.price}\n`); txt += "\n*V* - Ver foto | *C* - Categorías"; if (s.pedido.length) txt += " | *E* - Eliminar | *F* - Finalizar"; txt += " | *S* - Salir"; return txt; }
function analizarEntradaPedido(input) { let t = input.trim().toLowerCase().replace(/[,;.\-*]/g, ' ').replace(/(\d)\s*x\s*(\d)/g, '$1x$2'); const tokens = t.split(/\s+/).filter(Boolean); const pedidos = []; let i = 0; while (i < tokens.length) { if (tokens[i].includes('x')) { const m = tokens[i].match(/^(\d+)x(\d+)$/); if (m) pedidos.push({ itemIndex: parseInt(m[1]) - 1, cantidad: parseInt(m[2]) }); i++; continue; } if (/^\d+$/.test(tokens[i])) { const next = tokens[i + 1]; if (next && /^\d+$/.test(next)) { pedidos.push({ itemIndex: parseInt(tokens[i]) - 1, cantidad: parseInt(next) }); i += 2; } else { pedidos.push({ itemIndex: parseInt(tokens[i]) - 1, cantidad: 1 }); i++; } } else i++; } return pedidos; }
function direccionValida(txt) { return txt.length >= 5 && /\d/.test(txt) && /[a-zA-Z]/.test(txt); }
function pagoValido(op) { return ['e', 't', 'mp'].includes(op.toLowerCase()); }

// --- Lógica Principal del Bot Unificada ---
async function handleIncomingMessage(from, body) {
    const input = body.trim().toLowerCase();
    const client = twilioClient;

    if (!sessions[from]) {
        const matchMesa = input.match(/^mesa(\d+)-/);
        if (matchMesa) {
            sessions[from] = { step: 'viendo_categorias', pedido: [], tipoPedido: 'mesa', mesa: matchMesa[1], telefono: from };
            await client.messages.create({ to: from, from: process.env.TWILIO_WHATSAPP_NUMBER, body: `¡Hola! Bienvenido a la mesa *${matchMesa[1]}*.\n\n` + getCategoriasMenu() });
        } else {
            sessions[from] = { step: 'viendo_categorias', pedido: [], tipoPedido: 'domicilio', telefono: from };
            await client.messages.create({ to: from, from: process.env.TWILIO_WHATSAPP_NUMBER, body: getCategoriasMenu() });
        }
        return;
    }

    const s = sessions[from];
    let reply = '';
    let media = null;

    switch (s.step) {
        case 'viendo_categorias':
            if (/^\d+$/.test(input) && categoriasUnicas[input - 1]) {
                s.categoriaActual = categoriasUnicas[input - 1]; s.step = 'viendo_productos';
                reply = construirVistaDeProductos(s);
            } else if (input === 's') {
                s.previousStep = s.step; s.step = 'confirmar_salida';
                reply = s.pedido.length ? "⚠️ Si sales perderás tu pedido. ¿Seguro? (S/N)" : "¿Seguro que quieres salir? (S/N)";
            } else reply = "Opción no válida.\n" + getCategoriasMenu();
            break;

        case 'viendo_productos':
            const comandos = {
                'c': () => { s.step = 'viendo_categorias'; reply = getCategoriasMenu() + (s.pedido.length ? "\n\n" + mostrarResumen(s) : ""); },
                'v': () => { s.step = 'solicitar_foto'; reply = `Estás en *${s.categoriaActual}*.\n\n¿De qué número de producto deseas ver la foto?`; },
                'e': () => { if (s.pedido.length > 0) { s.step = 'eliminando'; reply = `${mostrarResumen(s)}\n\nEscribe el número del ítem y cantidad (ej: *1 2*).\nPara eliminar todo escribe *T*.\nV para volver`; } else { reply = "No tienes productos en el pedido."; } },
                's': () => { s.previousStep = s.step; s.step = 'confirmar_salida'; reply = s.pedido.length ? "⚠️ Si sales perderás tu pedido. ¿Seguro? (S/N)" : "¿Seguro que quieres salir? (S/N)"; },
                'f': () => {
                    if (!s.pedido.length) { reply = "No tienes productos en el pedido."; }
                    else if (s.tipoPedido === 'mesa') { s.step = 'solicitar_pago'; reply = "💰 ¿Cómo pagará?\nE - Efectivo\nT - Tarjeta\nMP - MercadoPago"; }
                    else { s.step = 'solicitar_nombre'; reply = "📝 Por favor, indica a nombre de quién es el pedido:"; }
                }
            };
            if (comandos[input]) {
                comandos[input]();
            } else {
                const pedidos = analizarEntradaPedido(input);
                if (!pedidos.length) { reply = `No entendí tu pedido.\n${construirVistaDeProductos(s)}`; }
                else {
                    s.pedidoTemporal = {}; let errores = []; const items = getItemsPorCategoria(s.categoriaActual);
                    let confirmacionText = "Entendido. Voy a agregar:\n";
                    pedidos.forEach(p => { if (items[p.itemIndex]) { const itemReal = items[p.itemIndex]; if (s.pedidoTemporal[itemReal.id]) { s.pedidoTemporal[itemReal.id].cantidad += p.cantidad; } else { s.pedidoTemporal[itemReal.id] = { ...itemReal, cantidad: p.cantidad }; } } else { errores.push(`El ítem ${p.itemIndex + 1} no es válido.`); } });
                    if (Object.keys(s.pedidoTemporal).length > 0) {
                        for (const id in s.pedidoTemporal) { const item = s.pedidoTemporal[id]; confirmacionText += `\n• ${item.cantidad}x ${item.name}`; }
                        if (errores.length) confirmacionText += `\n\n(Nota: ${errores.join(', ')})`;
                        reply = `${confirmacionText}\n\n¿Es correcto? (S/N)`;
                        s.step = 'confirmar_agregados';
                    } else {
                        reply = `No se encontraron productos válidos.\n${construirVistaDeProductos(s)}`;
                    }
                }
            }
            break;

        case 'confirmar_agregados':
            if (input === 's') { for (const id in s.pedidoTemporal) { const nuevo = s.pedidoTemporal[id]; const existente = s.pedido.find(p => p.id === nuevo.id); if (existente) { existente.cantidad += nuevo.cantidad; } else { s.pedido.push(nuevo); } } reply = `✅ ¡Listo! Productos agregados.\n\n${construirVistaDeProductos(s)}`; }
            else { reply = `🚫 Operación cancelada.\n\n${construirVistaDeProductos(s)}`; }
            delete s.pedidoTemporal; s.step = 'viendo_productos';
            break;

        case 'eliminando':
            if (input === 'v') { s.step = 'viendo_productos'; reply = construirVistaDeProductos(s); }
            else if (input === 't') { s.pedido = []; s.step = 'viendo_categorias'; reply = "🗑️ Pedido eliminado.\n" + getCategoriasMenu(); }
            else { const [idx, cant] = input.split(' ').map(Number); if (!isNaN(idx) && s.pedido[idx - 1]) { const cantAQuitar = isNaN(cant) ? s.pedido[idx - 1].cantidad : cant; s.pedido[idx - 1].cantidad -= cantAQuitar; if (s.pedido[idx - 1].cantidad <= 0) s.pedido.splice(idx - 1, 1); s.step = s.pedido.length ? 'viendo_productos' : 'viendo_categorias'; reply = `✅ Ítem(s) eliminado(s).\n\n` + (s.pedido.length ? construirVistaDeProductos(s) : getCategoriasMenu()); } else { reply = "Formato inválido."; } }
            break;

        case 'solicitar_foto':
            if (input === 'v') { s.step = 'viendo_productos'; reply = construirVistaDeProductos(s); }
            else { const idxFoto = parseInt(input) - 1; const itemsFoto = getItemsPorCategoria(s.categoriaActual); if (itemsFoto[idxFoto]?.imageUrl) { reply = `*${itemsFoto[idxFoto].name}* - $${itemsFoto[idxFoto].price}\n\nA para agregar | V para volver`; media = [itemsFoto[idxFoto].imageUrl]; s.itemFoto = itemsFoto[idxFoto]; s.step = 'foto_opciones'; } else { reply = "❌ Producto inválido o sin foto."; } }
            break;

        case 'foto_opciones':
            if (input.startsWith('a')) { const cantidad = parseInt(input.split(' ')[1] || "1"); if (!isNaN(cantidad) && cantidad > 0) { const existente = s.pedido.find(p => p.id === s.itemFoto.id); if (existente) existente.cantidad += cantidad; else s.pedido.push({ ...s.itemFoto, cantidad }); } }
            s.step = 'viendo_productos'; reply = construirVistaDeProductos(s); delete s.itemFoto;
            break;

        case 'solicitar_nombre':
            s.nombre = body; const usuariosDir = cargarUsuarios();
            if (usuariosDir[from]?.direccion) { s.step = 'usar_direccion_guardada'; reply = `Gracias, ${s.nombre}. ¿Usamos tu dirección guardada?\n*${usuariosDir[from].direccion}*\n(S/N)`; }
            else { s.step = 'solicitar_direccion'; reply = `Gracias, ${s.nombre}. Ingresa la dirección (calle y nro):`; }
            break;

        case 'usar_direccion_guardada':
            if (input === 's') { s.direccion = cargarUsuarios()[from].direccion; s.step = 'solicitar_pago'; reply = "💰 Pago: E/T/MP"; }
            else if (input === 'n') { s.step = 'solicitar_direccion'; reply = 'Ok, ingresa la nueva dirección:'; }
            else { reply = 'Opción no válida (S/N)'; }
            break;

        case 'solicitar_direccion':
            if (!direccionValida(body)) { reply = "❌ Dirección inválida. Ingresa calle y número."; }
            else { s.direccion = body.trim(); s.step = 'solicitar_pago'; reply = "💰 Pago: E/T/MP"; }
            break;

        case 'solicitar_pago':
            if (!pagoValido(input)) { reply = "❌ Opción inválida. Usa E, T o MP."; }
            else {
                const metodos = { e: 'Efectivo', t: 'Tarjeta', mp: 'MercadoPago' };
                s.pago = metodos[input]; s.step = 'confirmacion_final';
                const datos = { nombre: s.nombre || `Mesa ${s.mesa || ''}`, direccion: s.direccion, pago: s.pago, telefono: s.telefono, tipo: s.tipoPedido, mesa: s.mesa };
                // Esta linea la debo comentar o sacar
                reply = construirResumenParaCliente(s, datos);

            }
            break;

        case 'confirmacion_final':
            if (input === 's') {
                const datosFinales = {
                    nombre: s.nombre || `Mesa ${s.mesa}`,
                    direccion: s.direccion,
                    pago: s.pago,
                    telefono: s.telefono,
                    mesa: s.mesa,
                    tipo: s.tipoPedido
                };

                if (s.tipoPedido === 'domicilio') {
                    guardarUsuario(from, {
                        nombre: s.nombre,
                        direccion: s.direccion
                    });
                }

                // Construir el resumen final para mostrar al cliente (y no reenviarlo por WhatsApp)
                const now = new Date().toLocaleTimeString('es-UY');
                let resumen = `*¡RESUMEN DE SU PEDIDO!* - ${now}\n\n`;
                resumen += "--- *Detalle del Pedido* ---\n";
                let total = 0;
                s.pedido.forEach(item => {
                    const subtotal = item.price * item.cantidad;
                    resumen += `• ${item.cantidad}x ${item.name} ($${item.price}) - $${subtotal}\n`;
                    total += subtotal;
                });
                resumen += `\n*TOTAL: $${total}*\n\n`;

                if (s.tipoPedido === 'mesa') {
                    resumen += `🪑 *Tipo:* Mesa\n🔢 *Número:* ${s.mesa}\n`;
                } else {
                    resumen += `📦 *Tipo:* Domicilio\n📍 *Dirección:* ${s.direccion}\n`;
                }

                resumen += `💳 *Tipo de pago:* ${s.pago}\n`;

                // Enviar al restaurante
                await enviarNotificaciones(
                    formatearResumenParaLocal(s, datosFinales),
                    formatearResumenParaEmail(s, datosFinales)
                );

                // Mostrar al cliente
                reply = `${resumen}\n✅ ¡Pedido confirmado y enviado a la cocina!\nGracias por tu compra.`;
                delete sessions[from];

            } else {
                // Cancelar confirmación y volver a productos
                s.step = 'viendo_productos';
                reply = `🚫 Pedido no confirmado. Puedes seguir modificándolo.\n\n${construirVistaDeProductos(s)}`;
            }
            break;


        case 'confirmar_salida':
            if (input === 's') { delete sessions[from]; reply = "👋 ¡Hasta pronto!"; }
            else if (input === 'n') { s.step = s.previousStep || 'viendo_categorias'; reply = s.step === 'viendo_productos' ? construirVistaDeProductos(s) : getCategoriasMenu(); }
            else { reply = "Opción no válida (S/N)"; }
            break;
    }

    if (reply || media) {
        const messageData = { to: from, from: process.env.TWILIO_WHATSAPP_NUMBER, body: reply };
        if (media) messageData.mediaUrl = media;
        await client.messages.create(messageData);
    }
}

function construirResumenParaCliente(session, datosFinales) {
    const now = new Date().toLocaleTimeString('es-UY');
    let resumen = `*¡RESUMEN DE SU PEDIDO!* - ${now}\n\n`;
    resumen += "--- *Detalle del Pedido* ---\n";
    let total = 0;
    session.pedido.forEach(item => {
        const subtotal = item.price * item.cantidad;
        resumen += `• ${item.cantidad}x ${item.name} ($${item.price}) - $${subtotal}\n`;
        total += subtotal;
    });
    resumen += `\n*TOTAL: $${total}*\n\n`;

    if (datosFinales.tipo === 'mesa') {
        resumen += `🪑 *Tipo:* Mesa\n🔢 *Número:* ${datosFinales.mesa}\n`;
    } else {
        resumen += `📦 *Tipo:* Domicilio\n📍 *Dirección:* ${datosFinales.direccion}\n`;
    }

    resumen += `💳 *Tipo de pago:* ${datosFinales.pago}\n`;
    return `${resumen}\n*¿Confirmas el pedido? (S/N)*`;
}


// --- Servidor Express ---
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/whatsapp', async (req, res) => {
    const from = req.body.From;
    const body = req.body.Body;
    console.log(`Mensaje de ${from}: ${body}`);
    await handleIncomingMessage(from, body);
    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});