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
// Delays naturales correlativos al contenido
const DELAYS = {
    MIN_RESPONSE_TIME: 2000,  // 2 segundos mínimo
    MAX_RESPONSE_TIME: 8000,  // 8 segundos máximo
    READ_TIME_PER_CHAR: 60,   // 60ms por carácter (más rápido)
    MIN_READ_TIME: 1000,      // Mínimo 1 segundo leyendo
    MAX_READ_TIME: 4000,      // Máximo 4 segundos leyendo
    TYPING_BASE: 2000,        // Base de escritura: 2 segundos
    TYPING_PER_CHAR: 30,      // 30ms por carácter de respuesta
    MIN_TYPING_TIME: 2000,    // Mínimo 2 segundos escribiendo
    MAX_TYPING_TIME: 6000,    // Máximo 6 segundos escribiendo
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

// Sistema de recopilación de datos del estudiante
const studentDataCollection = new Map();

// Sistema de control de mensajes duplicados
const processedMessages = new Map();

// Sistema de control de procesamiento concurrente
const processingUsers = new Set();

// Función para generar ID único del mensaje
function getMessageId(message) {
    return `${message.from}_${message.timestamp || Date.now()}_${message.body.slice(0, 20)}_${message.id?._serialized || 'no-id'}`;
}

// Función para verificar y marcar mensaje como procesado
function isMessageProcessed(messageId) {
    const now = Date.now();
    const expirationTime = 5 * 60 * 1000; // 5 minutos
    
    // Limpiar mensajes antiguos
    for (const [id, timestamp] of processedMessages.entries()) {
        if (now - timestamp > expirationTime) {
            processedMessages.delete(id);
        }
    }
    
    // Verificar si ya fue procesado
    if (processedMessages.has(messageId)) {
        return true;
    }
    
    // Marcar como procesado
    processedMessages.set(messageId, now);
    return false;
}

// Estados de conversación
const CONVERSATION_STATES = {
    INITIAL: 'initial',
    WAITING_CI: 'waiting_ci',
    WAITING_NAME: 'waiting_name',
    WAITING_CAREER: 'waiting_career',
    READY_TO_REDIRECT: 'ready_to_redirect'
};

// Lista de carreras disponibles
const CARRERAS_DISPONIBLES = [
    "Ingeniería de Sistemas",
    "Ingeniería Industrial",
    "Ingeniería Civil",
    "Administración de Empresas",
    "Contaduría Pública",
    "Derecho",
    "Medicina",
    "Psicología",
    "Arquitectura",
    "Comunicación Social"
];

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

// Calcular tiempo de lectura natural basado en el contenido
function calculateReadTime(message) {
    const baseTime = Math.max(
        message.length * DELAYS.READ_TIME_PER_CHAR,
        DELAYS.MIN_READ_TIME
    );
    
    // Añadir tiempo extra por complejidad
    let complexityBonus = 0;
    if (message.includes('\n')) complexityBonus += 500; // Múltiples líneas
    if (/\d{7,8}/.test(message)) complexityBonus += 300; // Contiene CI
    if (message.split(' ').length > 5) complexityBonus += 200; // Mensaje largo
    
    const totalTime = Math.min(baseTime + complexityBonus, DELAYS.MAX_READ_TIME);
    return totalTime + Math.random() * 500; // Variación aleatoria
}

// Calcular tiempo de escritura natural basado en la respuesta
function calculateTypingTime(responseLength) {
    const baseTime = Math.max(
        DELAYS.TYPING_BASE + (responseLength * DELAYS.TYPING_PER_CHAR),
        DELAYS.MIN_TYPING_TIME
    );
    
    const totalTime = Math.min(baseTime, DELAYS.MAX_TYPING_TIME);
    return totalTime + Math.random() * 1000; // Variación aleatoria
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

// ========== FUNCIONES DE RECOPILACIÓN DE DATOS ==========

function getStudentData(phoneNumber) {
    return studentDataCollection.get(phoneNumber) || {
        state: CONVERSATION_STATES.INITIAL,
        ci: null,
        nombreCompleto: null,
        carrera: null,
        consultaOriginal: null,
        departamentoAsignado: null
    };
}

function updateStudentData(phoneNumber, updates) {
    const currentData = getStudentData(phoneNumber);
    const updatedData = { ...currentData, ...updates };
    studentDataCollection.set(phoneNumber, updatedData);
    return updatedData;
}

// Extracción inteligente de datos (sin validación estricta)
function parseStudentData(message) {
    const text = message.trim();
    
    // Separar por líneas primero
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length >= 3) {
        return {
            ci: lines[0],
            nombreCompleto: lines[1],
            carrera: lines[2],
            valid: true
        };
    }
    
    // Si es una sola línea, intentar separar por espacios inteligentemente
    const words = text.split(' ').filter(w => w);
    
    if (words.length >= 4) {
        // Asumir: primer elemento = CI, últimos 2-3 = carrera, resto = nombre
        const ci = words[0];
        
        // Buscar índice donde podría empezar la carrera
        let careerStartIndex = words.length - 2;
        for (let i = 1; i < words.length - 1; i++) {
            const word = words[i].toLowerCase();
            if (word.includes('ingenier') || word.includes('medicina') || word.includes('derecho') || 
                word.includes('administr') || word.includes('psicolog') || word.includes('arquitec') ||
                word.includes('sistem') || word.includes('civil') || word.includes('industrial') ||
                word.includes('comunicac')) {
                careerStartIndex = i;
                break;
            }
        }
        
        const nombreCompleto = words.slice(1, careerStartIndex).join(' ');
        const carrera = words.slice(careerStartIndex).join(' ');
        
        if (nombreCompleto && carrera) {
            return {
                ci: ci,
                nombreCompleto: nombreCompleto,
                carrera: carrera,
                valid: true
            };
        }
    }
    
    // Intentar con separadores comunes
    const separators = [',', '|', ';'];
    for (const sep of separators) {
        if (text.includes(sep)) {
            const parts = text.split(sep).map(p => p.trim()).filter(p => p);
            if (parts.length >= 3) {
                return {
                    ci: parts[0],
                    nombreCompleto: parts[1],
                    carrera: parts[2],
                    valid: true
                };
            }
        }
    }
    
    // Si no puede separar claramente, asumir que es válido de todos modos
    // y dejar que el usuario lo corrija si es necesario
    if (words.length >= 3) {
        return {
            ci: words[0],
            nombreCompleto: words.slice(1, -1).join(' '),
            carrera: words[words.length - 1],
            valid: true
        };
    }
    
    return { valid: false };
}

function findBestCareerMatch(career) {
    const careerLower = career.toLowerCase().trim();
    
    // Buscar coincidencia exacta
    const exactMatch = CARRERAS_DISPONIBLES.find(c => c.toLowerCase() === careerLower);
    if (exactMatch) return exactMatch;
    
    // Buscar coincidencia parcial
    const partialMatch = CARRERAS_DISPONIBLES.find(c => 
        c.toLowerCase().includes(careerLower) || careerLower.includes(c.toLowerCase())
    );
    
    return partialMatch || career; // Si no encuentra coincidencia, usa lo que escribió el usuario
}

function generateDataCollectionMessage(departamento) {
    const saludo = getRandomElement(SALUDOS);
    const dept = DEPARTAMENTOS[departamento];
    
    return `${saludo} Para conectarte con ${dept.nombre}, necesito algunos datos.

📝 Por favor envíame en tu siguiente mensaje:

**1. Tu CI** (ej: 1234567)
**2. Tu nombre completo** (ej: Juan Pérez García)  
**3. Tu carrera** (ej: Ingeniería de Sistemas)

_Puedes escribir cada dato en una línea separada o separados por comas._

💡 Ejemplo:
\`\`\`
1234567-LP
Juan Pérez García
Ingeniería de Sistemas
\`\`\`

O también:
\`\`\`
1234567, Juan Pérez, Medicina
\`\`\``;
}

function generateCareerList() {
    let message = "📚 *CARRERAS DISPONIBLES:*\n\n";
    CARRERAS_DISPONIBLES.forEach((carrera, index) => {
        message += `${index + 1}. ${carrera}\n`;
    });
    message += "\n💡 Escribe el nombre de tu carrera tal como aparece en la lista.";
    return message;
}

// Configuración de departamentos y sus números de WhatsApp
const DEPARTAMENTOS = {
    CAJAS: {
        nombre: "Departamento de Cajas",
        numero: "59177439407", // Número actualizado
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

// Cliente de WhatsApp con configuración optimizada para WSL
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Importante para WSL
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
        ]
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
            model: "gpt-4.1-mini",
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

// Función mejorada para generar mensaje de redirección con enlace directo
function generarMensajeRedireccion(departamento, mensajeOriginal, studentData = null) {
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
    
    // Crear mensaje codificado para URL (versión más corta para mejor detección)
    let mensajeParaDepartamento;
    
    if (studentData && studentData.ci && studentData.nombreCompleto && studentData.carrera) {
        // Versión compacta con datos del estudiante
        mensajeParaDepartamento = `🔔 Nueva consulta\n👤 ${studentData.nombreCompleto}\n📋 CI: ${studentData.ci}\n📚 ${studentData.carrera}\n💬 "${mensajeOriginal}"`;
    } else {
        // Versión básica sin datos
        mensajeParaDepartamento = `🔔 Nueva consulta estudiantil\n💬 "${mensajeOriginal}"`;
    }
    
    const mensajeCodificado = encodeURIComponent(mensajeParaDepartamento);
    
    // Generar enlace directo de WhatsApp
    const enlaceWhatsApp = `https://wa.me/${dept.numero}?text=${mensajeCodificado}`;
    
    let datosEnviados = '';
    if (studentData && studentData.ci && studentData.nombreCompleto && studentData.carrera) {
        datosEnviados = `\n✅ *Datos enviados:*\n📋 CI: ${studentData.ci}\n🎓 Nombre: ${studentData.nombreCompleto}\n📚 Carrera: ${studentData.carrera}\n`;
    }
    
    const mensajesRedireccion = [
        `${saludo} ${transicion} te voy a conectar con ${dept.nombre}.

📋 *${dept.nombre}*
📝 *Tu consulta:* "${mensajeOriginal}"${datosEnviados}

🔗 *Enlace directo:*
${enlaceWhatsApp}

📱 *Número:* ${dept.numero}
⏰ *Horario:* Lun-Vie 8:00-18:00 | Sáb 8:00-12:00`,

        `${saludo} ${transicion} necesitas comunicarte con ${dept.nombre}.

💬 *Tu consulta:* "${mensajeOriginal}"${datosEnviados}

🔗 ${enlaceWhatsApp}

📱 *WhatsApp:* ${dept.numero}
*Atención:* L-V 8am-6pm | S 8am-12pm`
    ];
    
    return {
        respuesta: getRandomElement(mensajesRedireccion),
        redirigir: true,
        numeroDestino: dept.numero,
        enlaceWhatsApp: enlaceWhatsApp
    };
}

// Función adicional para enviar notificación automática al departamento
async function notificarDepartamento(client, numeroDepartamento, mensajeOriginal, numeroEstudiante, studentData = null) {
    try {
        let mensajeNotificacion = `🔔 *Nueva consulta estudiantil*\n\n`;
        
        if (studentData && studentData.ci && studentData.nombreCompleto && studentData.carrera) {
            mensajeNotificacion += `👤 *DATOS DEL ESTUDIANTE:*\n`;
            mensajeNotificacion += `📋 CI: ${studentData.ci}\n`;
            mensajeNotificacion += `🎓 Nombre: ${studentData.nombreCompleto}\n`;
            mensajeNotificacion += `📚 Carrera: ${studentData.carrera}\n`;
            mensajeNotificacion += `📱 WhatsApp: wa.me/${numeroEstudiante}\n\n`;
        } else {
            mensajeNotificacion += `👤 *Estudiante:* wa.me/${numeroEstudiante}\n`;
        }
        
        mensajeNotificacion += `📅 *Fecha/Hora:* ${new Date().toLocaleString('es-BO')}\n`;
        mensajeNotificacion += `💬 *Consulta:* "${mensajeOriginal}"\n\n`;
        mensajeNotificacion += `_El estudiante ha sido notificado para contactar directamente._`;

        // Enviar notificación al departamento
        await client.sendMessage(numeroDepartamento + '@c.us', mensajeNotificacion);
        console.log(`   ✅ Notificación enviada a ${numeroDepartamento}`);
        
    } catch (error) {
        console.error('❌ Error enviando notificación al departamento:', error);
    }
}

// Manejo de mensajes con medidas anti-bloqueo y recopilación de datos
client.on('message', async (message) => {
    // Ignorar mensajes propios y de grupos
    if (message.fromMe || message.from.includes('@g.us')) return;
    
    // Ignorar mensajes vacíos
    if (!message.body || message.body.trim() === '') {
        console.log('⚠️ Mensaje vacío ignorado');
        return;
    }
    
    // Verificar duplicados
    const messageId = getMessageId(message);
    console.log(`🔍 ID del mensaje: ${messageId}`);
    if (isMessageProcessed(messageId)) {
        console.log('🔄 Mensaje duplicado ignorado');
        return;
    }
    
    // Verificar procesamiento concurrente del mismo usuario
    if (processingUsers.has(message.from)) {
        console.log('🔄 Usuario ya siendo procesado, ignorando mensaje duplicado');
        return;
    }
    
    // Marcar usuario como en procesamiento
    processingUsers.add(message.from);

    console.log(`\n📨 Nuevo mensaje de ${message.from}:`);
    console.log(`   Mensaje: "${message.body}"`);
    
    // Verificar límite diario
    if (!checkDailyLimit()) {
        console.log('⚠️ Límite diario alcanzado (seguridad)');
        processingUsers.delete(message.from);
        return;
    }
    
    // Verificar límite por usuario
    if (!checkRateLimit(message.from)) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await message.reply('Por favor, espera unos minutos antes de enviar otro mensaje. Gracias por tu comprensión. 🙏');
        processingUsers.delete(message.from);
        return;
    }
    
    // Verificar horario de atención
    if (!isBusinessHours()) {
        await new Promise(resolve => setTimeout(resolve, getRandomDelay(1500, 3000)));
        await message.reply(`${getRandomElement(SALUDOS)} Nuestro horario de atención es:
        
📅 Lunes a Viernes: 8:00 - 18:00
📅 Sábados: 8:00 - 12:00

Tu mensaje será atendido en el próximo horario hábil. ¡Gracias! 😊`);
        processingUsers.delete(message.from);
        return;
    }

    try {
        const chat = await message.getChat();
        const phoneNumber = message.from;
        const messageText = message.body.trim();
        
        // Obtener datos actuales del estudiante
        let studentData = getStudentData(phoneNumber);
        
        // Simular tiempo de lectura natural
        const readTime = calculateReadTime(messageText);
        console.log(`   👀 Leyendo mensaje (${messageText.length} chars): ${Math.round(readTime)}ms`);
        await new Promise(resolve => setTimeout(resolve, readTime));

        // Manejar comando especial para ver carreras
        if (messageText.toLowerCase() === 'carreras') {
            await message.reply(generateCareerList());
            processingUsers.delete(message.from);
            return;
        }

        // Procesar según el estado de la conversación (flujo simplificado)
        if (studentData.state === CONVERSATION_STATES.INITIAL) {
            // Primer mensaje: Clasificar y solicitar datos si es necesario
            const departamento = await clasificarMensaje(messageText);
            console.log(`   Departamento asignado: ${departamento}`);
            
            let response;
            if (departamento === 'GENERAL') {
                // Mensaje general, no necesita datos del estudiante
                const { respuesta } = generarMensajeRedireccion(departamento, messageText);
                response = respuesta;
            } else {
                // Necesita redirección, solicitar datos en un solo mensaje
                studentData = updateStudentData(phoneNumber, {
                    state: CONVERSATION_STATES.WAITING_CI, // Reutilizamos este estado
                    consultaOriginal: messageText,
                    departamentoAsignado: departamento
                });
                
                response = generateDataCollectionMessage(departamento);
            }
            
            // Calcular tiempo de escritura basado en la respuesta
            await chat.sendStateTyping();
            const typingTime = calculateTypingTime(response.length);
            console.log(`   ⌨️ Escribiendo respuesta (${response.length} chars): ${Math.round(typingTime)}ms`);
            await new Promise(resolve => setTimeout(resolve, typingTime));
            
            await message.reply(response);
            
        } else if (studentData.state === CONVERSATION_STATES.WAITING_CI) {
            // Segundo mensaje: Intentar extraer todos los datos
            const parsedData = parseStudentData(messageText);
            
            let response;
            if (parsedData.valid) {
                // Datos encontrados, procesar redirección
                console.log('   ✅ Datos del estudiante extraídos correctamente');
                console.log(`   📋 CI: ${parsedData.ci}`);
                console.log(`   🎓 Nombre: ${parsedData.nombreCompleto}`);
                console.log(`   📚 Carrera: ${parsedData.carrera}`);
                
                studentData.ci = parsedData.ci;
                studentData.nombreCompleto = parsedData.nombreCompleto;
                studentData.carrera = findBestCareerMatch(parsedData.carrera);
                studentData.state = CONVERSATION_STATES.READY_TO_REDIRECT;
                
                const { respuesta, redirigir, numeroDestino } = generarMensajeRedireccion(
                    studentData.departamentoAsignado, 
                    studentData.consultaOriginal,
                    studentData
                );
                
                response = respuesta;
                
                // Calcular tiempo de escritura para respuesta de redirección
                await chat.sendStateTyping();
                const typingTime = calculateTypingTime(response.length);
                console.log(`   ⌨️ Escribiendo redirección (${response.length} chars): ${Math.round(typingTime)}ms`);
                await new Promise(resolve => setTimeout(resolve, typingTime));

                await message.reply(response);
                console.log('   ✅ Respuesta enviada con datos del estudiante');
                
                // Enviar notificación al departamento
                if (redirigir && numeroDestino) {
                    console.log(`   🔄 Enviando notificación con datos completos a ${studentData.departamentoAsignado}`);
                    
                    await new Promise(resolve => setTimeout(resolve, getRandomDelay(3000, 6000)));
                    const numeroEstudiante = phoneNumber.replace('@c.us', '');
                    
                    await notificarDepartamento(client, numeroDestino, studentData.consultaOriginal, numeroEstudiante, studentData);
                    
                    if (typeof registrarMensaje === 'function') {
                        registrarMensaje(phoneNumber, studentData.consultaOriginal, studentData.departamentoAsignado, true);
                    }
                }
                
                // Limpiar datos del estudiante después de la redirección
                studentDataCollection.delete(phoneNumber);
                
            } else {
                // No se pudieron extraer los datos, solicitar de nuevo con ejemplo
                response = `❌ No pude extraer todos los datos. Por favor, envíalos en este formato:

📝 **Ejemplo correcto:**
\`\`\`
1234567-LP
Juan Pérez García
Ingeniería de Sistemas
\`\`\`

O separados por comas:
\`\`\`
1234567, Juan Pérez, Medicina
\`\`\``;
                
                await chat.sendStateTyping();
                const typingTime = calculateTypingTime(response.length);
                console.log(`   ⌨️ Escribiendo error (${response.length} chars): ${Math.round(typingTime)}ms`);
                await new Promise(resolve => setTimeout(resolve, typingTime));
                
                await message.reply(response);
            }
            
        } else {
            // Estado desconocido, reiniciar
            console.log('   🔄 Estado desconocido, reiniciando conversación');
            studentDataCollection.delete(phoneNumber);
            await message.reply(`${getRandomElement(SALUDOS)} ¡Hola! ¿En qué puedo ayudarte?`);
        }
        
        // Registrar actividad en monitor
        if (monitor) {
            monitor.logActivity('message_sent', {
                from: phoneNumber,
                state: studentData.state,
                responseTime: Date.now() - message.timestamp * 1000
            });
        }
        
        // Incrementar contador diario
        dailyMessageCount++;
        console.log(`   📊 Mensajes hoy: ${dailyMessageCount}/${LIMITES.MAX_MESSAGES_PER_DAY}`);
        console.log(`   📋 Estado conversación: ${studentData.state}`);

    } catch (error) {
        console.error('❌ Error procesando mensaje:', error);
        
        if (monitor) {
            monitor.logActivity('message_failed', {
                from: message.from,
                error: error.message
            });
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        await message.reply('Disculpa, tuve un problema procesando tu mensaje. Por favor, intenta nuevamente escribiendo "hola" para reiniciar.');
        
        // Limpiar datos en caso de error
        studentDataCollection.delete(message.from);
    } finally {
        // Liberar usuario del procesamiento concurrente
        processingUsers.delete(message.from);
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