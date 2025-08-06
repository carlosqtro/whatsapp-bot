// local-runner.js (Versión 14.2 - Mejoras V, S y Confirmación con N)

require('dotenv').config();
const readline = require('readline');
const fs = require('fs');
const Brevo = require('@getbrevo/brevo');
const twilio = require('twilio');
const { categoriasUnicas, getCategoriasMenu, getItemsPorCategoria } = require('./menu');

console.log('--- 🏃‍♂️ Entorno de Pruebas Local (v14.2) ---');
console.log('--- ⚠️ ENVÍA EMAILS Y WHATSAPP REALES ⚠️ ---');
console.log('Escribe "mesa10-abc" para simular un pedido en mesa.');
console.log('Escribe "hola" para simular un pedido a domicilio.');
console.log('----------------------------------------------');

// --- Inicialización Twilio ---
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilio(accountSid, authToken);

// --- Inicialización Brevo ---
const brevoApiInstance = new Brevo.TransactionalEmailsApi();
if (typeof brevoApiInstance.setApiKey === 'function') {
    brevoApiInstance.setApiKey(
        Brevo.TransactionalEmailsApiApiKeys.apiKey,
        process.env.BREVO_API_KEY
    );
} else if (brevoApiInstance.authentications && brevoApiInstance.authentications['apiKey']) {
    brevoApiInstance.authentications['apiKey'].apiKey = process.env.BREVO_API_KEY;
} else if (brevoApiInstance.apiClient && brevoApiInstance.apiClient.authentications) {
    brevoApiInstance.apiClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
} else {
    console.error('❌ No se pudo inicializar la API Key de Brevo.');
    process.exit(1);
}

// --- Gestión de usuarios ---
const RUTA_USUARIOS = './usuarios.json';
function cargarUsuarios() { try { if (fs.existsSync(RUTA_USUARIOS)) { const data = fs.readFileSync(RUTA_USUARIOS, 'utf8'); return data ? JSON.parse(data) : {}; } else { fs.writeFileSync(RUTA_USUARIOS, JSON.stringify({}, null, 2)); return {}; } } catch { return {}; } }
function guardarUsuario(from, userData) { const usuarios = cargarUsuarios(); usuarios[from] = { ...(usuarios[from] || {}), ...userData }; fs.writeFileSync(RUTA_USUARIOS, JSON.stringify(usuarios, null, 2)); }

// --- Simulación de cliente ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const sessions = {};
const mockUser = 'whatsapp:+59800000000';
const mockClient = { messages: { create: async ({ body, mediaUrl }) => { console.log('\n\n--- 🤖 Bot ---'); if (mediaUrl) console.log(`🖼️ Imagen: ${mediaUrl[0]}`); console.log(body); console.log('--------------\n'); } } };

// --- Formatos de notificación ---
function formatearResumenParaLocal(session, datos) { let texto = `*¡NUEVO PEDIDO!* - ${new Date().toLocaleTimeString('es-UY')}\n\n`; texto += `*Cliente:* ${datos.nombre}\n*Teléfono:* ${datos.telefono.replace('whatsapp:', '')}\n*Pago:* ${datos.pago}\n\n`; if (datos.tipo === 'mesa') texto += `*Mesa:* ${datos.mesa}\n\n`; else texto += `*Dirección:* ${datos.direccion}\n\n`; texto += "--- *Detalle* ---\n"; let total = 0; session.pedido.forEach(it => { const sub = it.price * it.cantidad; texto += `• ${it.cantidad}x ${it.name} - $${sub}\n`; total += sub; }); texto += `\n*TOTAL:* $${total}`; return texto; }
function formatearResumenParaEmail(session, datos) { let html = `<h1>Nuevo Pedido</h1>`; html += `<p><b>Cliente:</b> ${datos.nombre}</p>`; html += `<p><b>Teléfono:</b> ${datos.telefono.replace('whatsapp:', '')}</p>`; html += `<p><b>Pago:</b> ${datos.pago}</p>`; if (datos.tipo === 'mesa') html += `<p><b>Mesa:</b> ${datos.mesa}</p>`; else html += `<p><b>Dirección:</b> ${datos.direccion}</p>`; html += `<h2>Detalle</h2><ul>`; let total = 0; session.pedido.forEach(it => { const sub = it.price * it.cantidad; html += `<li>${it.cantidad}x ${it.name} - $${sub}</li>`; total += sub; }); html += `</ul><h3>Total: $${total}</h3>`; return html; }

// --- Enviar notificaciones ---
async function enviarNotificaciones(txt, html) { try { await twilioClient.messages.create({ from: process.env.TWILIO_WHATSAPP_NUMBER, to: process.env.RESTAURANT_WHATSAPP_NUMBER, body: txt }); console.log('✅ WhatsApp enviado.'); } catch (e) { console.error('❌ WhatsApp:', e.message); } try { const email = new Brevo.SendSmtpEmail(); email.subject = "Nuevo Pedido"; email.htmlContent = html; email.sender = { name: "Bot Pedidos", email: process.env.SENDER_EMAIL_ADDRESS }; email.to = [{ email: process.env.RESTAURANT_EMAIL_ADDRESS }]; await brevoApiInstance.sendTransacEmail(email); console.log('✅ Email enviado.'); } catch (e) { console.error('❌ Email:', e.message); } }

// --- Utilidades del Bot ---
function mostrarResumen(s) { if (!s.pedido.length) return ""; let txt = "🧾 *Resumen:*\n"; let total = 0; s.pedido.forEach((p, i) => { const sub = p.price * p.cantidad; txt += `${i + 1}️⃣ ${p.cantidad}x ${p.name} - $${sub}\n`; total += sub; }); txt += `\n*Total:* $${total}`; return txt; }
function construirVistaDeProductos(s) { let txt = mostrarResumen(s); if (txt) txt += "\n\n---\n\n"; const items = getItemsPorCategoria(s.categoriaActual); items.forEach((it, i) => txt += `*${i + 1}* ${it.name} - $${it.price}\n`); txt += "\n*V* - Ver foto | *C* - Categorías"; if (s.pedido.length) txt += " | *E* - Eliminar | *F* - Finalizar"; txt += " | *S* - Salir"; return txt; }
function analizarEntradaPedido(input) { let t = input.replace(/[,;.\-*]/g, ' ').replace(/(\d)\s*x\s*(\d)/g, '$1x$2'); const tokens = t.split(/\s+/).filter(Boolean); const pedidos = []; let i = 0; while (i < tokens.length) { if (tokens[i].includes('x')) { const m = tokens[i].match(/^(\d+)x(\d+)$/); if (m) pedidos.push({ itemIndex: parseInt(m[1]) - 1, cantidad: parseInt(m[2]) }); i++; continue; } if (/^\d+$/.test(tokens[i])) { const next = tokens[i + 1]; if (next && /^\d+$/.test(next)) { pedidos.push({ itemIndex: parseInt(tokens[i]) - 1, cantidad: parseInt(next) }); i += 2; } else { pedidos.push({ itemIndex: parseInt(tokens[i]) - 1, cantidad: 1 }); i++; } } else i++; } return pedidos; }
function direccionValida(txt) { return txt.length >= 5 && /\d/.test(txt) && /[a-zA-Z]/.test(txt); }
function pagoValido(op) { return ['e', 't', 'mp'].includes(op.toLowerCase()); }

// --- Lógica Principal del Bot ---
async function handleIncomingMessage(from, body) {
    const input = body.trim().toLowerCase();
    if (!sessions[from]) {
        const matchMesa = input.match(/^mesa(\d+)-/);
        if (matchMesa) {
            sessions[from] = { step: 'viendo_categorias', pedido: [], tipoPedido: 'mesa', mesa: matchMesa[1], telefono: from };
            await mockClient.messages.create({ body: `¡Hola! Bienvenido a la mesa *${matchMesa[1]}*.\n\n` + getCategoriasMenu() });
        } else {
            sessions[from] = { step: 'viendo_categorias', pedido: [], tipoPedido: 'domicilio', telefono: from };
            await mockClient.messages.create({ body: getCategoriasMenu() });
        }
        return;
    }
    const s = sessions[from];
    let reply = "";

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
                'c': () => { s.step = 'viendo_categorias'; reply = getCategoriasMenu() + "\n\n" + mostrarResumen(s); },
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
                    pedidos.forEach(p => { const item = getItemsPorCategoria(s.categoriaActual)[p.itemIndex]; if (item) { const ex = s.pedido.find(i => i.id === item.id); if (ex) ex.cantidad += p.cantidad; else s.pedido.push({ ...item, cantidad: p.cantidad }); } });
                    reply = construirVistaDeProductos(s);
                }
            }
            break;

        case 'solicitar_foto':
            if (input === 'v') { s.step = 'viendo_productos'; reply = construirVistaDeProductos(s); } 
            else if (/^\d+$/.test(input)) {
                const item = getItemsPorCategoria(s.categoriaActual)[parseInt(input) - 1];
                if (item?.imageUrl) {
                    await mockClient.messages.create({
                        body: `*${item.name}* - $${item.price}\n\n*A* para agregar (ej: A 2)\n*V* para volver`,
                        mediaUrl: [item.imageUrl]
                    });
                    s.itemFoto = item; s.step = 'foto_opciones'; return;
                }
            }
            reply = "❌ Producto inválido o sin foto. Vuelve a intentar o escribe 'V' para volver.";
            break;

        case 'foto_opciones':
            if (input.startsWith('a')) {
                const cantidad = parseInt(input.split(' ')[1] || "1");
                if (!isNaN(cantidad) && cantidad > 0) {
                    const existente = s.pedido.find(p => p.id === s.itemFoto.id);
                    if (existente) existente.cantidad += cantidad;
                    else s.pedido.push({ ...s.itemFoto, cantidad });
                }
                s.step = 'viendo_productos';
                reply = construirVistaDeProductos(s);
            } else if (input === 'v') {
                s.step = 'viendo_productos';
                reply = construirVistaDeProductos(s);
            } else {
                reply = "Opción no válida. Usa 'A' para agregar o 'V' para volver.";
            }
            delete s.itemFoto;
            break;

        case 'eliminando':
            if (input === 'v') { s.step = 'viendo_productos'; reply = construirVistaDeProductos(s); }
            else if (input === 't') { s.pedido = []; s.step = 'viendo_categorias'; reply = "🗑️ Pedido eliminado.\n" + getCategoriasMenu(); } 
            else {
                const [idx, cant] = input.split(' ').map(Number);
                if (!isNaN(idx) && s.pedido[idx - 1]) {
                    const cantAQuitar = isNaN(cant) ? s.pedido[idx - 1].cantidad : cant;
                    s.pedido[idx - 1].cantidad -= cantAQuitar;
                    if (s.pedido[idx - 1].cantidad <= 0) s.pedido.splice(idx - 1, 1);
                    s.step = s.pedido.length ? 'viendo_productos' : 'viendo_categorias';
                    reply = `✅ Producto(s) eliminado(s).\n\n` + (s.pedido.length ? construirVistaDeProductos(s) : getCategoriasMenu());
                } else {
                    reply = "Formato inválido.";
                }
            }
            break;
            
        case 'solicitar_nombre':
            s.nombre = body;
            const usuariosDir = cargarUsuarios();
            if (usuariosDir[from]?.direccion) {
                s.step = 'usar_direccion_guardada';
                reply = `Gracias, ${s.nombre}. ¿Usamos tu dirección guardada?\n*${usuariosDir[from].direccion}*\n(S/N)`;
            } else {
                s.step = 'solicitar_direccion';
                reply = `Gracias, ${s.nombre}. Ahora, ingresa la dirección (calle y nro):`;
            }
            break;

        case 'usar_direccion_guardada':
            if (input === 's') { s.direccion = cargarUsuarios()[from].direccion; s.step = 'solicitar_pago'; reply = "💰 Pago: E/T/MP"; }
            else if(input === 'n') { s.step = 'solicitar_direccion'; reply = 'Ok, ingresa la nueva dirección:'; }
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
                reply = `${formatearResumenParaLocal(s, datos)}\n\n---\n\n*¿Confirmas el pedido? (S/N)*`;
            }
            break;
        
        case 'confirmacion_final':
            if (input === 's') {
                const datosFinales = { nombre: s.nombre || `Mesa ${s.mesa}`, direccion: s.direccion, pago: s.pago, telefono: s.telefono, mesa: s.mesa, tipo: s.tipoPedido };
                if (s.tipoPedido === 'domicilio') guardarUsuario(from, { nombre: s.nombre, direccion: s.direccion });
                await enviarNotificaciones(formatearResumenParaLocal(s, datosFinales), formatearResumenParaEmail(s, datosFinales));
                reply = "✅ ¡Pedido confirmado y enviado!\nGracias por tu compra.";
                delete sessions[from];
            } else { // Si responde N
                s.step = 'viendo_productos';
                reply = `🚫 Pedido no confirmado. Puedes seguir modificándolo.\n\n${construirVistaDeProductos(s)}`;
            }
            break;

        case 'confirmar_salida':
            if (input === 's') {
                delete sessions[from];
                reply = "👋 ¡Hasta pronto!";
                rl.close();
            } else if (input === 'n') {
                s.step = s.previousStep || 'viendo_categorias'; // Volver al estado anterior
                reply = s.step === 'viendo_productos' ? construirVistaDeProductos(s) : getCategoriasMenu();
            } else {
                reply = "Opción no válida (S/N)";
            }
            break;
    }

    if (reply) await mockClient.messages.create({ body: reply });
}

// --- Bucle de ejecución ---
rl.on('line', async (input) => { if (input.toLowerCase() === 'salir') return rl.close(); await handleIncomingMessage(mockUser, input); rl.prompt(); });
rl.prompt();