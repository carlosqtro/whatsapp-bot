// test-local.js (Versión 6.9 - Cantidades y Eliminación Inteligente)

const readline = require('readline');
// Asegúrate de tener tu archivo menu.js en la misma carpeta
const { menu, getMenu } = require('./menu');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// El estado ahora puede guardar el índice de un ítem para operaciones complejas.
let userState = { step: 'inicio', pedido: [], itemIndexParaEliminar: null };

// --- Funciones de Ayuda ---

/**
 * MEJORA: El resumen ahora muestra cantidades, precios unitarios y subtotales.
 * @returns {string} El resumen del pedido formateado.
 */
function mostrarResumen() {
  if (userState.pedido.length === 0) {
    return "Tu pedido está vacío.";
  }
  let resumen = "🧾 *Resumen de tu pedido actual:*\n";
  let total = 0;
  userState.pedido.forEach((p, index) => {
    const subtotal = p.price * p.cantidad;
    resumen += `${index + 1}️⃣ - ${p.cantidad}x ${p.name} ($${p.price} c/u) - $${subtotal}\n`;
    total += subtotal;
  });
  resumen += `\n*Total: $${total}*`;
  return resumen;
}

/**
 * MEJORA: Las instrucciones del menú ahora explican cómo agregar cantidades.
 */
function getMenuConInstrucciones() {
    let menuCompleto = getMenu();
    // Reemplazamos las viejas instrucciones por las nuevas.
    menuCompleto = menuCompleto.replace(
        "➡️ _Escribe el número de tu elección._",
        "➡️ _Escribe el número (ej: 1) o número y cantidad (ej: 1x3)._"
    );
    return menuCompleto;
}

/**
 * Muestra el resumen, el menú completo con nuevas instrucciones y las opciones.
 */
function mostrarResumenYopciones() {
    const resumen = mostrarResumen();
    console.log('\n' + resumen);

    console.log('\n' + getMenuConInstrucciones());

    console.log("\n👉 Elige otro ítem o escribe una letra:");
    console.log("E - Eliminar un producto");
    console.log("F - Finalizar pedido");
    console.log("S - Salir");
}

function solicitarConfirmacionSalida() {
  userState.step = 'confirmar_salida';
  console.log("\n¿Estás seguro de que quieres salir?");
  console.log("V - Volver al pedido");
  console.log("S - Salir completamente");
}

// --- Lógica Principal ---
console.log('--- Simulador de Chatbot Local (v6.9 - Cantidades) ---');
console.log('Escribe cualquier cosa para comenzar.\n');

function handleInput(input) {
  const body = input.trim().toLowerCase();

  if (body === 'salir') {
    console.log("¡Gracias por tu preferencia! Hasta pronto. 👋");
    rl.close();
    return;
  }
  
  // Flujo por estados
  switch (userState.step) {
    case 'inicio':
      console.log(getMenuConInstrucciones());
      userState.step = 'pedido'; // Pasamos directamente al estado 'pedido'
      break;

    case 'pedido':
      // MEJORA: Se analiza la entrada para detectar formato simple (1) o con cantidad (1x3)
      const match = body.match(/^(\d+)(?:x(\d+))?$/);
      
      if (match) {
        const itemId = parseInt(match[1]);
        const cantidad = match[2] ? parseInt(match[2]) : 1;
        const itemDelMenu = menu.find((m) => m.id === itemId);

        if (itemDelMenu) {
            const itemEnPedido = userState.pedido.find(p => p.id === itemId);
            if (itemEnPedido) {
                // Si el ítem ya existe, solo actualizamos la cantidad
                itemEnPedido.cantidad += cantidad;
            } else {
                // Si es nuevo, lo agregamos con su cantidad
                userState.pedido.push({ ...itemDelMenu, cantidad: cantidad });
            }
            console.log(`✅ ${cantidad}x ${itemDelMenu.name} agregado(s).`);
            mostrarResumenYopciones();
        } else {
            console.log(`❌ No existe un ítem con el número ${itemId}.`);
        }
      } else { // Si no es un número o '1x3', es una letra de comando
        switch (body) {
          case 'e':
            if (userState.pedido.length === 0) {
                console.log("Tu pedido está vacío. No hay nada que eliminar.");
                break;
            }
            userState.step = 'eliminando';
            console.log(mostrarResumen());
            console.log("\nEscribe el número del ítem que deseas modificar (o 'V' para volver).");
            break;
          case 'f':
            if (userState.pedido.length === 0) {
                console.log("Tu pedido está vacío. Agrega un producto para finalizar.");
                break;
            }
            userState.step = 'confirmar';
            console.log(mostrarResumen());
            console.log("\n👉 ¿Confirmas tu pedido?");
            console.log("F - Confirmar y finalizar");
            console.log("V - Volver para seguir comprando");
            break;
          case 's':
            solicitarConfirmacionSalida();
            break;
          default:
            console.log("❌ Opción no válida. Elige un número del menú o una de las letras (E, F, S).");
        }
      }
      break;
    
    case 'confirmar_salida':
        if (body === 'v') {
            userState.step = 'pedido';
            console.log("\nVolviendo a tu pedido...");
            mostrarResumenYopciones();
        } else if (body === 's') {
            console.log("¡Gracias por tu preferencia! Hasta pronto. 👋");
            rl.close();
            return;
        } else {
            console.log("❌ Opción no válida. Por favor, elige V o S.");
        }
        break;
    
    case 'eliminando':
        if (body === 'v') {
            userState.step = 'pedido';
            console.log("Volviendo a tu pedido...");
            mostrarResumenYopciones();
            break;
        }
        const lineIndex = parseInt(body) - 1;
        const item_a_modificar = userState.pedido[lineIndex];

        if (item_a_modificar) {
            if (item_a_modificar.cantidad > 1) {
                // Si hay más de uno, preguntamos cuántos eliminar
                userState.step = 'eliminando_cantidad';
                userState.itemIndexParaEliminar = lineIndex;
                console.log(`Tienes ${item_a_modificar.cantidad}x ${item_a_modificar.name}. ¿Cuántas unidades deseas eliminar? (o 'T' para eliminarlas todas)`);
            } else {
                // Si solo hay uno, se elimina directamente
                const itemBorrado = userState.pedido.splice(lineIndex, 1);
                console.log(`✅ ${itemBorrado[0].name} eliminado completamente.`);
                userState.step = 'pedido';
                mostrarResumenYopciones();
            }
        } else {
            console.log("❌ Número de ítem no válido. Intenta de nuevo.");
        }
        break;

    // MEJORA: Nuevo estado para manejar la eliminación de una cantidad específica
    case 'eliminando_cantidad':
        const itemIndex = userState.itemIndexParaEliminar;
        const item = userState.pedido[itemIndex];
        const cantidad_a_eliminar = parseInt(body);

        if (body === 't') {
            const itemBorrado = userState.pedido.splice(itemIndex, 1);
            console.log(`✅ ${itemBorrado[0].name} eliminado completamente.`);
        } else if (!isNaN(cantidad_a_eliminar) && cantidad_a_eliminar > 0) {
            if (cantidad_a_eliminar >= item.cantidad) {
                const itemBorrado = userState.pedido.splice(itemIndex, 1);
                console.log(`✅ ${itemBorrado[0].name} eliminado completamente.`);
            } else {
                item.cantidad -= cantidad_a_eliminar;
                console.log(`✅ ${cantidad_a_eliminar} unidad(es) de ${item.name} eliminada(s).`);
            }
        } else {
            console.log("❌ Opción no válida. Debes escribir un número o 'T'.");
            // No cambiamos de estado, permitimos reintentar.
            rl.question('> ', handleInput);
            return;
        }

        userState.itemIndexParaEliminar = null; // Limpiamos el estado temporal
        userState.step = 'pedido';
        mostrarResumenYopciones();
        break;
    
    case 'confirmar':
      switch (body) {
        case 'f':
          console.log("✅ ¡Tu pedido ha sido confirmado! Gracias.\n");
          userState.step = 'post_pedido';
          console.log("¿Qué deseas hacer ahora?\n1️⃣ Realizar otro pedido\n2️⃣ Finalizar conversación\n");
          break;
        case 'v':
          userState.step = 'pedido';
          console.log("Volviendo a tu pedido...");
          mostrarResumenYopciones();
          break;
        default:
          console.log("❌ Opción no válida. Por favor, elige F o V.");
      }
      break;

    case 'post_pedido':
      if (body === '1') {
        userState = { step: 'inicio', pedido: [], itemIndexParaEliminar: null };
        console.log('Iniciando nuevo pedido...\n');
        console.log(getMenuConInstrucciones());
        userState.step = 'pedido';
      } else if (body === '2') {
        console.log("¡Gracias por tu preferencia! Hasta pronto. 👋");
        rl.close();
        return;
      } else {
        console.log("❌ Opción no válida. Por favor, elige 1 o 2.");
      }
      break;

    default:
        console.log("Ocurrió un error. Reiniciando...");
        userState = { step: 'inicio', pedido: [], itemIndexParaEliminar: null };
        console.log(getMenuConInstrucciones());
        userState.step = 'pedido';
        break;
  }
  
  if (!rl.closed) {
    rl.question('> ', handleInput);
  }
}

// Inicia la conversación
rl.question('> ', handleInput);