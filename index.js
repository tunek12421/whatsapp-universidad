// Sistema de WhatsApp con IA para redirección de consultas universitarias
// Requiere: npm install whatsapp-web.js openai qrcode-terminal dotenv

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const OpenAI = require('openai');
require('dotenv').config();

// Configuración de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// ========== CONFIGURACIÓN ANTI-BLOQUEO ==========
// Delays para parecer más humano
const DELAYS = {
    MIN_RESPONSE_TIME: 2000,  // 2 segundos mínimo
    MAX_RESPONSE_TIME: 4000,  // 4 segundos máximo
    TYPING_TIME: 2500,        // 2.5 segundos "escribiendo"
    READ_TIME: 800,           // 0.8 segundos para "leer"
};

// Límites diarios (ajustados para tu caso)
const LIMITES = {
    MAX_MESSAGES_PER_DAY: 60,      // Límite diario total (margen de seguridad)
    MAX_MESSAGES_PER_HOUR: 15,     // Máximo por hora
    MAX_MESSAGES_PER_NUMBER: 5,    // Máximo por usuario en 1 hora
};

// Control de límites
const rateLimiter = new Map();
let dailyMessageCount = 0;
let lastResetDate = new Date().toDateString();

// Mensajes variados para parecer más natural
const SALUDOS = [
    "Hola! 👋",
    "¡Hola! 😊",
    "¡Buen día!",
    "¡Hola, bienvenido/a!"
];

const TRANSICIONES = [
    "He analizado tu consulta y",
    "Según tu mensaje,",
    "Por lo que veo,",
    "De acuerdo a tu consulta,"
];

// ========== FUNCIONES ANTI-BLOQUEO ==========
function getRandomDelay(min = DELAYS.MIN_RESPONSE_TIME, max = DELAYS.MAX_RESPONSE_TIME) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function checkDailyLimit() {
    const today = new Date().toDateString();
    if (today !== lastResetDate) {
        dailyMessageCount = 0;
        lastResetDate = today;
        rateLimiter.clear();
    }
    return dailyMessageCount < LIMITES.MAX_MESSAGES_PER_DAY;
}

function checkRateLimit(phoneNumber) {
    const now = Date.now();
    const userRecord = rateLimiter.get(phoneNumber) || { messages: [], hourlyCount: 0 };
    
    // Limpiar mensajes antiguos (más de 1 hora)
    userRecord.messages = userRecord.messages.filter(time => now - time < 3600000);
    
    // Verificar límites
    if (userRecord.messages.length >= LIMITES.MAX_MESSAGES_PER_NUMBER) {
        console.log(`⚠️ Usuario ${phoneNumber} excedió límite por hora`);
        return false;
    }
    
    // Actualizar registro
    userRecord.messages.push(now);
    rateLimiter.set(phoneNumber, userRecord);
    return true;
}

function isBusinessHours() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // Lunes a Viernes, 8:00 - 18:00
    // Sábados, 8:00 - 12:00 (opcional)
    if (day >= 1 && day <= 5 && hour >= 8 && hour < 18) return true;
    if (day === 6 && hour >= 8 && hour < 12) return true; // Sábados medio día
    return false;
}

// Configuración de departamentos y sus números de WhatsApp
const DEPARTAMENTOS = {
    CAJAS: {
        nombre: "Departamento de Cajas",
        numero: "591XXXXXXXX", // Reemplazar con número real
        palabrasClave: ["pago", "cuota", "mensualidad", "deuda", "factura", "recibo", "cancelar", "mora"],
        descripcion: "Pagos, cuotas, mensualidades, facturas"
    },
    PLATAFORMA: {
        nombre: "Soporte de Plataforma",
        numero: "591XXXXXXXX", // Reemplazar con número real
        palabrasClave: ["plataforma", "aula virtual", "moodle", "contraseña", "usuario", "login", "acceso", "sistema"],
        descripcion: "Acceso a plataforma, aula virtual, problemas técnicos"
    },
    REGISTRO: {
        nombre: "Registro Académico",
        numero: "591XXXXXXXX", // Reemplazar con número real
        palabrasClave: ["inscripción", "matrícula", "certificado", "notas", "kardex", "historial", "documento"],
        descripcion: "Inscripciones, certificados, documentos académicos"
    },
    BIENESTAR: {
        nombre: "Bienestar Estudiantil",
        numero: "591XXXXXXXX", // Reemplazar con número real
        palabrasClave: ["beca", "ayuda", "apoyo", "psicología", "orientación", "problema personal"],
        descripcion: "Becas, apoyo estudiantil, orientación"
    },
    BIBLIOTECA: {
        nombre: "Biblioteca",
        numero: "591XXXXXXXX", // Reemplazar con número real
        palabrasClave: ["libro", "biblioteca", "préstamo", "tesis", "investigación", "bibliografía"],
        descripcion: "Préstamos de libros, recursos bibliográficos"
    }
};

// Prompt del sistema mejorado para clasificación
const SYSTEM_PROMPT = `Eres un asistente de clasificación para una universidad boliviana. Tu tarea es analizar consultas de estudiantes y determinar a qué departamento deben ser redirigidas.

Departamentos disponibles:
- CAJAS: Pagos, cuotas, mensualidades, facturas, deudas, moras, comprobantes, tesorería
- PLATAFORMA: Aula virtual, Moodle, contraseñas, acceso al sistema, problemas técnicos online
- REGISTRO: Inscripciones, matrículas, certificados, notas, kardex, historial académico
- BIENESTAR: Becas, apoyo estudiantil, psicología, orientación, problemas personales
- BIBLIOTECA: Préstamos de libros, tesis, investigación, recursos bibliográficos

REGLAS IMPORTANTES:
- Si el mensaje es un saludo simple (hola, buenos días, buenas tardes) responde: GENERAL
- Si el mensaje está vacío, tiene solo emojis o no es claro, responde: GENERAL  
- Si no puedes determinar claramente el departamento, responde: GENERAL
- Responde ÚNICAMENTE con el código del departamento en MAYÚSCULAS

Ejemplos:
"Hola" -> GENERAL
"Buenos días" -> GENERAL
"😊" -> GENERAL
"cuánto debo?" -> CAJAS
"no puedo entrar a moodle" -> PLATAFORMA
"necesito mi certificado" -> REGISTRO`;

// Importar monitor si existe
let monitor;
try {
    const WhatsAppMonitor = require('./monitor');
    monitor = new WhatsAppMonitor();
    monitor.start();
} catch (e) {
    console.log('ℹ️  Monitor no configurado (opcional)');
}

// Importar función de registro si existe el dashboard
let registrarMensaje;
try {
    const dashboard = require('./admin-dashboard');
    registrarMensaje = dashboard.registrarMensaje;
} catch (e) {
    console.log('ℹ️  Dashboard no configurado (opcional)');
}

// Cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Mostrar código QR para autenticación
client.on('qr', (qr) => {
    console.log('Escanea este código QR con WhatsApp:');
    qrcode.generate(qr, { small: true });
});

// Cliente listo
client.on('ready', () => {
    console.log('✅ Cliente de WhatsApp conectado y listo!');
    console.log('📱 Esperando mensajes...\n');
});

// Función para clasificar mensaje con IA
async function clasificarMensaje(mensaje) {
    try {
        // Primero intentar clasificación por palabras clave
        const mensajeLower = mensaje.toLowerCase();
        for (const [key, dept] of Object.entries(DEPARTAMENTOS)) {
            const coincide = dept.palabrasClave.some(palabra => 
                mensajeLower.includes(palabra.toLowerCase())
            );
            if (coincide) {
                console.log(`🔍 Clasificado por palabra clave: ${key}`);
                return key;
            }
        }

        // Si no hay coincidencia clara, usar IA
        console.log('🤖 Usando IA para clasificación...');
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: mensaje }
            ],
            temperature: 0.3,
            max_tokens: 10
        });

        const departamento = completion.choices[0].message.content.trim();
        return departamento;

    } catch (error) {
        console.error('❌ Error en clasificación:', error);
        return 'GENERAL';
    }
}

// Función mejorada para generar mensaje de redirección con variaciones
function generarMensajeRedireccion(departamento, mensajeOriginal) {
    const saludo = getRandomElement(SALUDOS);
    const transicion = getRandomElement(TRANSICIONES);
    
    if (!DEPARTAMENTOS[departamento]) {
        const mensajesGenerales = [
            `${saludo} Gracias por contactarnos. Para poder ayudarte mejor, ¿podrías especificar qué necesitas?

Puedo ayudarte con:
• 💰 Pagos y cuotas
• 💻 Problemas con la plataforma
• 📋 Inscripciones y certificados
• 🎓 Becas y apoyo estudiantil
• 📚 Biblioteca

¿En qué área necesitas ayuda?`,
            
            `${saludo} ¡Bienvenido/a! Estoy aquí para dirigirte al área correcta.

Por favor, indícame si necesitas ayuda con:
• Pagos o mensualidades → Cajas
• Acceso a plataforma virtual → Soporte técnico
• Documentos académicos → Registro
• Apoyo estudiantil → Bienestar
• Recursos bibliográficos → Biblioteca

¿Cuál es tu consulta?`
        ];
        
        return {
            respuesta: getRandomElement(mensajesGenerales),
            redirigir: false
        };
    }

    const dept = DEPARTAMENTOS[departamento];
    const mensajesRedireccion = [
        `${saludo} ${transicion} te voy a conectar con ${dept.nombre}.

📱 *Número directo:* ${dept.numero}
📝 *Tu consulta:* "${mensajeOriginal}"

Un representante te atenderá a la brevedad.

⏰ *Horario:* Lun-Vie 8:00-18:00 | Sáb 8:00-12:00`,

        `${saludo} ${transicion} necesitas comunicarte con ${dept.nombre}.

Te comparto el contacto:
📱 *WhatsApp:* ${dept.numero}
💬 *Motivo:* "${mensajeOriginal}"

Ellos podrán ayudarte con tu consulta.

*Atención:* L-V 8am-6pm | S 8am-12pm`
    ];
    
    return {
        respuesta: getRandomElement(mensajesRedireccion),
        redirigir: true,
        numeroDestino: dept.numero
    };
}

// Manejo de mensajes con medidas anti-bloqueo
client.on('message', async (message) => {
    // Ignorar mensajes propios y de grupos
    if (message.fromMe || message.from.includes('@g.us')) return;
    
    // Ignorar mensajes vacíos
    if (!message.body || message.body.trim() === '') {
        console.log('⚠️ Mensaje vacío ignorado');
        return;
    }

    console.log(`\n📨 Nuevo mensaje de ${message.from}:`);
    console.log(`   Mensaje: "${message.body}"`);
    
    // Verificar límite diario
    if (!checkDailyLimit()) {
        console.log('⚠️ Límite diario alcanzado (seguridad)');
        return;
    }
    
    // Verificar límite por usuario
    if (!checkRateLimit(message.from)) {
        // Esperar un poco y enviar mensaje de límite
        await new Promise(resolve => setTimeout(resolve, 2000));
        await message.reply('Por favor, espera unos minutos antes de enviar otro mensaje. Gracias por tu comprensión. 🙏');
        return;
    }
    
    // Verificar horario de atención
    if (!isBusinessHours()) {
        await new Promise(resolve => setTimeout(resolve, getRandomDelay(1500, 3000)));
        await message.reply(`${getRandomElement(SALUDOS)} Nuestro horario de atención es:
        
📅 Lunes a Viernes: 8:00 - 18:00
📅 Sábados: 8:00 - 12:00

Tu mensaje será atendido en el próximo horario hábil. ¡Gracias! 😊`);
        return;
    }

    try {
        const chat = await message.getChat();
        
        // Simular tiempo de lectura del mensaje
        const readTime = Math.min(message.body.length * 50, 2000); // 50ms por carácter, max 2s
        await new Promise(resolve => setTimeout(resolve, readTime));
        
        // Mostrar "escribiendo..." con delay natural
        await chat.sendStateTyping();
        
        // Simular tiempo de escritura
        const typingTime = getRandomDelay(DELAYS.TYPING_TIME - 500, DELAYS.TYPING_TIME + 500);
        await new Promise(resolve => setTimeout(resolve, typingTime));

        // Clasificar el mensaje
        const departamento = await clasificarMensaje(message.body);
        console.log(`   Departamento asignado: ${departamento}`);
        
        // Pequeño delay adicional aleatorio
        await new Promise(resolve => setTimeout(resolve, getRandomDelay(500, 1000)));

        // Generar respuesta
        const { respuesta, redirigir, numeroDestino } = generarMensajeRedireccion(departamento, message.body);

        // Enviar respuesta
        await message.reply(respuesta);
        console.log('   ✅ Respuesta enviada');
        
        // Registrar en monitor si existe
        if (monitor) {
            monitor.logActivity('message_sent', {
                from: message.from,
                department: departamento,
                responseTime: Date.now() - message.timestamp * 1000
            });
        }
        // Incrementar contador diario
        dailyMessageCount++;
        console.log(`   📊 Mensajes hoy: ${dailyMessageCount}/${LIMITES.MAX_MESSAGES_PER_DAY}`);

        // Si es necesario redirigir, preparar notificación al departamento
        if (redirigir && numeroDestino) {
            console.log(`   🔄 Preparando redirección a ${departamento}`);
            
            // Esperar un momento antes de notificar al departamento
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const mensajeParaDepartamento = `*🔔 Nueva consulta estudiantil*
            
👤 *Estudiante:* ${message.from}
📅 *Fecha/Hora:* ${new Date().toLocaleString('es-BO')}
💬 *Consulta:* "${message.body}"
🏷️ *Clasificación:* ${departamento}

_Por favor atender a la brevedad._`;

            // Opcional: Enviar notificación al departamento
            // await client.sendMessage(numeroDestino + '@c.us', mensajeParaDepartamento);
            
            // Guardar en base de datos si está configurado
            if (typeof registrarMensaje === 'function') {
                registrarMensaje(message.from, message.body, departamento);
            }
        }

    } catch (error) {
        console.error('❌ Error procesando mensaje:', error);
        
        // Registrar error en monitor
        if (monitor) {
            monitor.logActivity('message_failed', {
                from: message.from,
                error: error.message
            });
        }
        
        // Esperar antes de enviar mensaje de error
        await new Promise(resolve => setTimeout(resolve, 2000));
        await message.reply('Disculpa, tuve un problema procesando tu mensaje. Por favor, intenta nuevamente en unos momentos o contacta directamente al departamento que necesitas.');
    }
});

// Manejo de errores y desconexión
client.on('auth_failure', (msg) => {
    console.error('❌ Error de autenticación:', msg);
    if (monitor) {
        monitor.createAlert('VERIFICATION_REQUEST', { message: msg });
    }
});

client.on('disconnected', (reason) => {
    console.log('📱 Cliente desconectado:', reason);
    if (monitor && reason === 'CONFLICT') {
        monitor.createAlert('CONNECTION_LOST', { reason });
    }
});

// Inicializar cliente
console.log('🚀 Iniciando sistema de WhatsApp con IA...');
console.log('⚙️  Medidas anti-bloqueo activadas');
console.log(`📊 Límites: ${LIMITES.MAX_MESSAGES_PER_DAY} mensajes/día, ${LIMITES.MAX_MESSAGES_PER_HOUR} mensajes/hora`);
client.initialize();

// Mostrar estadísticas cada hora
setInterval(() => {
    console.log(`\n📊 === ESTADÍSTICAS ===`);
    console.log(`Mensajes hoy: ${dailyMessageCount}/${LIMITES.MAX_MESSAGES_PER_DAY}`);
    console.log(`Usuarios activos: ${rateLimiter.size}`);
    console.log(`Hora: ${new Date().toLocaleTimeString('es-BO')}`);
    console.log(`===================\n`);
}, 3600000); // Cada hora

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n👋 Cerrando aplicación...');
    console.log(`📊 Total mensajes procesados hoy: ${dailyMessageCount}`);
    await client.destroy();
    process.exit();
});