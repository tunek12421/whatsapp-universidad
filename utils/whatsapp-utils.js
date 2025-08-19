// whatsapp-utils.js - Utilidades para el sistema de WhatsApp

// Validador de números de WhatsApp
const validarNumeroWhatsApp = (numero) => {
    // Remover caracteres no numéricos
    const numeroLimpio = numero.replace(/\D/g, '');
    
    // Verificar longitud (10-15 dígitos)
    if (numeroLimpio.length < 10 || numeroLimpio.length > 15) {
        return { valido: false, error: 'Número debe tener entre 10 y 15 dígitos' };
    }
    
    // Verificar código de país Bolivia (591)
    if (numeroLimpio.startsWith('591')) {
        return { valido: true, numero: numeroLimpio };
    }
    
    return { valido: false, error: 'Número debe incluir código de país (591)' };
};

// Generador de enlaces WhatsApp mejorado
class WhatsAppLinkGenerator {
    constructor() {
        this.baseUrl = 'https://wa.me/';
        this.maxMessageLength = 1000; // Límite seguro para URLs
    }
    
    generarEnlace(numero, mensaje, opciones = {}) {
        const { 
            incluirSaludo = true,
            incluirFirma = true,
            departamento = null 
        } = opciones;
        
        // Validar número
        const validacion = validarNumeroWhatsApp(numero);
        if (!validacion.valido) {
            throw new Error(`Número inválido: ${validacion.error}`);
        }
        
        // Construir mensaje
        let mensajeCompleto = '';
        
        if (incluirSaludo) {
            mensajeCompleto += '👋 Hola, vengo redirigido del sistema automático.\n\n';
        }
        
        mensajeCompleto += mensaje;
        
        if (incluirFirma && departamento) {
            mensajeCompleto += `\n\n_Redirigido a: ${departamento}_`;
        }
        
        // Recortar si es muy largo
        if (mensajeCompleto.length > this.maxMessageLength) {
            mensajeCompleto = mensajeCompleto.substring(0, this.maxMessageLength - 3) + '...';
        }
        
        // Codificar para URL
        const mensajeCodificado = encodeURIComponent(mensajeCompleto);
        
        return `${this.baseUrl}${validacion.numero}?text=${mensajeCodificado}`;
    }
    
    generarEnlaceCorto(numero) {
        // Enlace sin mensaje predefinido
        const validacion = validarNumeroWhatsApp(numero);
        if (!validacion.valido) {
            throw new Error(`Número inválido: ${validacion.error}`);
        }
        return `${this.baseUrl}${validacion.numero}`;
    }
}

// Sistema de plantillas mejorado
class PlantillaMensajes {
    constructor() {
        this.plantillas = {
            CAJAS: {
                estudiante: {
                    inicial: "Tu consulta sobre {tema} será atendida por el Departamento de Cajas.",
                    redireccion: "Haz clic en el enlace para comunicarte directamente con Cajas.",
                    recordatorio: "Recuerda tener a mano tu número de estudiante."
                },
                departamento: {
                    notificacion: "📍 Nueva consulta de estudiante\n👤 Número: {numero}\n📝 Tema: {tema}\n⏰ Hora: {hora}",
                    urgente: "🚨 CONSULTA URGENTE: {mensaje}"
                }
            },
            PLATAFORMA: {
                estudiante: {
                    inicial: "Veo que tienes problemas con la plataforma. Te conectaré con soporte técnico.",
                    redireccion: "El equipo técnico te ayudará con tu problema de acceso.",
                    recordatorio: "Ten listo tu código de estudiante y describe el error que ves."
                },
                departamento: {
                    notificacion: "🔧 Soporte técnico requerido\n👤 Usuario: {numero}\n🐛 Problema: {tema}\n⏰ Reportado: {hora}",
                    urgente: "⚠️ FALLO CRÍTICO: {mensaje}"
                }
            }
        };
    }
    
    obtenerPlantilla(departamento, tipo, subtipo) {
        return this.plantillas[departamento]?.[tipo]?.[subtipo] || '';
    }
    
    rellenarPlantilla(plantilla, datos) {
        let resultado = plantilla;
        Object.keys(datos).forEach(key => {
            resultado = resultado.replace(`{${key}}`, datos[key]);
        });
        return resultado;
    }
}

// Monitor de redirecciones
class MonitorRedirecciones {
    constructor(db) {
        this.db = db;
        this.initDB();
    }
    
    initDB() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS redirecciones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_origen TEXT,
                departamento TEXT,
                enlace_generado TEXT,
                fecha_generacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                clicked BOOLEAN DEFAULT 0,
                fecha_click DATETIME,
                tiempo_respuesta_dept INTEGER
            )
        `);
    }
    
    registrarRedireccion(numeroOrigen, departamento, enlace) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO redirecciones (numero_origen, departamento, enlace_generado) 
                 VALUES (?, ?, ?)`,
                [numeroOrigen, departamento, enlace],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }
    
    marcarComoClickeado(redireccionId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE redirecciones 
                 SET clicked = 1, fecha_click = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [redireccionId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }
    
    obtenerEstadisticas() {
        return new Promise((resolve, reject) => {
            const queries = {
                totalRedirecciones: `SELECT COUNT(*) as total FROM redirecciones`,
                porDepartamento: `SELECT departamento, COUNT(*) as total FROM redirecciones GROUP BY departamento`,
                tasaClicks: `SELECT 
                    COUNT(*) as total,
                    SUM(clicked) as clicks,
                    ROUND(CAST(SUM(clicked) AS FLOAT) / COUNT(*) * 100, 2) as tasa_clicks
                    FROM redirecciones`,
                tiempoPromedio: `SELECT AVG(tiempo_respuesta_dept) as promedio FROM redirecciones WHERE tiempo_respuesta_dept IS NOT NULL`
            };
            
            const stats = {};
            
            Promise.all(Object.entries(queries).map(([key, query]) => 
                new Promise((res, rej) => {
                    this.db.get(query, (err, row) => {
                        if (err) rej(err);
                        else {
                            stats[key] = row;
                            res();
                        }
                    });
                })
            )).then(() => resolve(stats)).catch(reject);
        });
    }
}

// Clase para gestionar timeouts y delays de forma más eficiente
class DelayManager {
    constructor(config) {
        this.config = config;
        this.activeTimeouts = new Map();
    }
    
    async esperarConVariacion(tipoDelay) {
        const baseDelay = this.config.delays[tipoDelay];
        const variacion = this.config.security.delayVariation / 100;
        const delayFinal = baseDelay + (Math.random() - 0.5) * 2 * baseDelay * variacion;
        
        return new Promise(resolve => {
            const timeoutId = setTimeout(resolve, Math.max(0, delayFinal));
            this.activeTimeouts.set(Date.now(), timeoutId);
        });
    }
    
    calcularTiempoLectura(mensaje) {
        const caracteresLeidos = mensaje.length * this.config.delays.readTimePerChar;
        return Math.min(caracteresLeidos, this.config.delays.maxReadTime);
    }
    
    limpiarTimeouts() {
        this.activeTimeouts.forEach(timeout => clearTimeout(timeout));
        this.activeTimeouts.clear();
    }
}

// Exportar todas las utilidades
module.exports = {
    validarNumeroWhatsApp,
    WhatsAppLinkGenerator,
    PlantillaMensajes,
    MonitorRedirecciones,
    DelayManager
};