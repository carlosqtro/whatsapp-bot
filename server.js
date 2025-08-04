// whatsapp-server.js (Versión 10.0 - Final y Completa)

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const { menu, categoriasUnicas, getCategoriasMenu, getItemsPorCategoria } = require('./menu');

// --- Configuración ---
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
const twilioPhoneNumber = 'whatsapp:+14155238886'; // Número del Sandbox de Twilio

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const sessions = {}; // Objeto para gestionar las sesiones de cada usuario

// --- Funciones de Ayuda ---

function mostrarResumen(session) {
    if (!session.pedido || session.pedido.length === 0) {
        return "";
    }
    let resumen = "🧾 *Resumen de tu pedido actual:*\n";
    let total = 0;
    session.pedido.forEach((p, index) => {
        const subtotal = p.price * p.cantidad;
        resumen += `${index + 1}️⃣ - ${p.cantidad}x ${p.name} ($${p.price} c/u) - $${subtotal}\n`;
        total += subtotal;
    });
    resumen += `\n*Total: $${total}*`;
    return resumen;
}

function construirVistaDeProductos(session) {
    let textoRespuesta = "";
    const resumen = mostrarResumen(session);
    if (resumen) {
        textoRespuesta += resumen + "\n\n---\n\n";
    }

    const itemsCategoria = getItemsPorCategoria(session.categoriaActual);
    const iconoCategoria = session.categoriaActual === 'Platos Principales' ? '🥘' : (session.categoriaActual === 'Bebidas' ? '🥤' : '🍰');
    textoRespuesta += `${iconoCategoria} *${session.categoriaActual}:*\n`;
    
    itemsCategoria.forEach((item, index) => {
        textoRespuesta += `*${index + 1}️⃣* ${item.name} - $${item.price}\n`;
    });
    textoRespuesta += "\n➡️ _Escribe el número (ej: 1) o número y cantidad (ej: 1x2)._";

    textoRespuesta += "\n\n👉 Elige una opción:\n*V* - Ver foto de un producto\n*C* - Volver a las categorías";
    if (session.pedido && session.pedido.length > 0) {
        textoRespuesta += "\n*E* - Eliminar un producto\n*F* - Finalizar pedido";
    }
    textoRespuesta += "\n*S* - Salir";
    return textoRespuesta;
}


// --- Lógica Principal del Chatbot ---

async function handleIncomingMessage(from, body) {
    const input = body.trim().toLowerCase();
    
    if (!sessions[from] || input === 'hola') {
        sessions[from] = { step: 'viendo_categorias', pedido: [], itemIndexParaEliminar: null };
    }
    const session = sessions[from];
    let replyText = '';

    switch (session.step) {
        case 'viendo_categorias':
            if (input === 's') {
                replyText = "¡Gracias por tu preferencia! Hasta pronto. 👋";
                delete sessions[from];
                break;
            }
            const catIndex = parseInt(input) - 1;
            if (categoriasUnicas[catIndex]) {
                session.categoriaActual = categoriasUnicas[catIndex];
                session.step = 'viendo_productos';
                replyText = construirVistaDeProductos(session);
            } else {
                replyText = "Opción no válida. Por favor, elige un número de la lista de categorías.\n\n" + getCategoriasMenu();
            }
            break;

        case 'viendo_productos':
            const match = input.match(/^(\d+)(?:x(\d+))?$/);
            if (match) {
                const itemIndex = parseInt(match[1]) - 1;
                const cantidad = match[2] ? parseInt(match[2]) : 1;
                const itemsDeCategoriaActual = getItemsPorCategoria(session.categoriaActual);
                const itemSeleccionado = itemsDeCategoriaActual[itemIndex];

                if (itemSeleccionado) {
                    const itemEnPedido = session.pedido.find(p => p.id === itemSeleccionado.id);
                    if (itemEnPedido) {
                        itemEnPedido.cantidad += cantidad;
                    } else {
                        session.pedido.push({ ...itemSeleccionado, cantidad: cantidad });
                    }
                    replyText = `✅ ${cantidad}x ${itemSeleccionado.name} agregado(s).\n\n${construirVistaDeProductos(session)}`;
                } else {
                    replyText = `❌ Número no válido para esta categoría.\n\n${construirVistaDeProductos(session)}`;
                }
            } else {
                switch (input) {
                    case 'c':
                        session.step = 'viendo_categorias';
                        replyText = getCategoriasMenu();
                        break;
                    case 'v':
                        session.step = 'solicitar_foto';
                        replyText = `Estás en la categoría *${session.categoriaActual}*.\n\n¿De qué número de producto deseas ver la foto?`;
                        break;
                    case 'e':
                        if (session.pedido.length > 0) {
                            session.step = 'eliminando';
                            replyText = `${mostrarResumen(session)}\n\nEscribe el número del ítem que deseas modificar (o 'V' para volver).`;
                        } else {
                            replyText = `No tienes productos en el pedido.\n\n${construirVistaDeProductos(session)}`;
                        }
                        break;
                    case 'f':
                        if (session.pedido.length > 0) {
                            session.step = 'confirmar';
                            replyText = `${mostrarResumen(session)}\n\n👉 ¿Confirmas tu pedido?\n*F* - Confirmar y finalizar\n*V* - Volver`;
                        } else {
                            replyText = `No tienes productos en el pedido.\n\n${construirVistaDeProductos(session)}`;
                        }
                        break;
                    case 's':
                        session.step = 'confirmar_salida';
                        replyText = "¿Estás seguro de que quieres salir y borrar tu pedido?\n\n*V* - Volver al pedido\n*S* - Salir completamente";
                        break;
                    default:
                        replyText = `❌ Opción no válida.\n\n${construirVistaDeProductos(session)}`;
                }
            }
            break;

        case 'solicitar_foto':
            if (input === 'v' || input === 'c' || input === 'm') {
                session.step = 'viendo_productos';
                replyText = construirVistaDeProductos(session);
                break;
            }
            const itemIndexFoto = parseInt(input) - 1;
            const itemsCategoriaFoto = getItemsPorCategoria(session.categoriaActual);
            const itemMenuFoto = itemsCategoriaFoto[itemIndexFoto];

            if (itemMenuFoto && itemMenuFoto.imageUrl) {
                const descripcion = `*${itemIndexFoto + 1}️⃣* ${itemMenuFoto.name} - $${itemMenuFoto.price}`;
                const Cta = `\n\nPara añadirlo, escribe ${itemIndexFoto + 1}x1. Para volver, escribe V.`;
                await client.messages.create({ body: `${descripcion}${Cta}`, from: twilioPhoneNumber, to: from, mediaUrl: [itemMenuFoto.imageUrl] });
                
                session.step = 'viendo_productos'; // Corrección para volver al estado correcto
                return;
            } else {
                replyText = "Lo siento, no encontré ese producto o no tiene foto. Escribe otro número o 'V' para volver.";
            }
            break;

        case 'eliminando':
            if (input === 'v') {
                session.step = 'viendo_productos';
                replyText = construirVistaDeProductos(session);
                break;
            }
            const lineIndex = parseInt(input) - 1;
            const item_a_modificar = session.pedido[lineIndex];

            if (item_a_modificar) {
                if (item_a_modificar.cantidad > 1) {
                    session.step = 'eliminando_cantidad';
                    session.itemIndexParaEliminar = lineIndex;
                    replyText = `Tienes ${item_a_modificar.cantidad}x ${item_a_modificar.name}. ¿Cuántas unidades deseas eliminar? (o 'T' para eliminarlas todas)`;
                } else {
                    const itemBorrado = session.pedido.splice(lineIndex, 1);
                    session.step = 'viendo_productos';
                    replyText = `✅ ${itemBorrado[0].name} eliminado completamente.\n\n${construirVistaDeProductos(session)}`;
                }
            } else {
                replyText = "❌ Número de ítem no válido. Intenta de nuevo o escribe 'V' para volver.";
            }
            break;

        case 'eliminando_cantidad':
            const itemIndex = session.itemIndexParaEliminar;
            const item = session.pedido[itemIndex];
            const cantidad_a_eliminar = parseInt(input);

            if (input === 't') {
                const itemBorrado = session.pedido.splice(itemIndex, 1);
                replyText = `✅ ${itemBorrado[0].name} eliminado completamente.`;
            } else if (!isNaN(cantidad_a_eliminar) && cantidad_a_eliminar > 0) {
                if (cantidad_a_eliminar >= item.cantidad) {
                    const itemBorrado = session.pedido.splice(itemIndex, 1);
                    replyText = `✅ ${itemBorrado[0].name} eliminado completamente.`;
                } else {
                    item.cantidad -= cantidad_a_eliminar;
                    replyText = `✅ ${cantidad_a_eliminar} unidad(es) de ${item.name} eliminada(s).`;
                }
            } else {
                replyText = "❌ Opción no válida. Debes escribir un número o 'T'.";
                return replyText; 
            }
            session.itemIndexParaEliminar = null;
            session.step = 'viendo_productos';
            replyText += `\n\n${construirVistaDeProductos(session)}`;
            break;

        case 'confirmar':
            switch (input) {
                case 'f':
                    replyText = "✅ ¡Tu pedido ha sido confirmado! Gracias.\n\n¿Qué deseas hacer ahora?\n*1️⃣* - Realizar otro pedido\n*2️⃣* - Finalizar conversación";
                    session.step = 'post_pedido';
                    break;
                case 'v':
                    session.step = 'viendo_productos';
                    replyText = construirVistaDeProductos(session);
                    break;
                default:
                    replyText = "❌ Opción no válida. Por favor, elige F o V.";
            }
            break;

        case 'post_pedido':
             if (input === '1') {
                sessions[from] = { step: 'viendo_categorias', pedido: [] };
                replyText = getCategoriasMenu();
            } else if (input === '2') {
                replyText = "¡Gracias por tu preferencia! Hasta pronto. 👋";
                delete sessions[from];
            } else {
                replyText = "❌ Opción no válida. Por favor, elige 1 o 2.";
            }
            break;

        case 'confirmar_salida':
            if (input === 'v') {
                session.step = 'viendo_productos';
                replyText = construirVistaDeProductos(session);
            } else if (input === 's') {
                replyText = "¡Gracias por tu preferencia! Hasta pronto. 👋";
                delete sessions[from];
            } else {
                replyText = "❌ Opción no válida. Por favor, elige V o S.";
            }
            break;
    }
    
    if (replyText) {
        await client.messages.create({ body: replyText, from: twilioPhoneNumber, to: from });
    }
}


// --- Ruta del Servidor y Ejecución ---
app.post('/whatsapp', async (req, res) => {
  const from = req.body.From;
  const body = req.body.Body;
  console.log(`Mensaje de ${from}: ${body}`);
  await handleIncomingMessage(from, body);
  res.status(200).send('OK');
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});