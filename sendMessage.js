// Cargar variables de entorno
require('dotenv').config();

// Importar Twilio
const twilio = require('twilio');

// Crear cliente Twilio
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Función para enviar un mensaje por WhatsApp
async function sendWhatsAppMessage() {
  try {
    const message = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM, // Número de Twilio para WhatsApp
      to: process.env.WHATSAPP_TO,             // Tu número de WhatsApp
      body: '¡Hola! Bienvenido al menú del restaurante 🍽️'
    });

    console.log(`✅ Mensaje enviado. SID: ${message.sid}`);
  } catch (error) {
    console.error('❌ Error enviando mensaje:', error);
  }
}

// Ejecutar
sendWhatsAppMessage();
