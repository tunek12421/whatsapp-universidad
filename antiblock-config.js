// antiblock-config.js - Configuración de medidas anti-bloqueo
// Puedes ajustar estos valores según tus necesidades

module.exports = {
    // DELAYS (en milisegundos)
    delays: {
        minResponseTime: 2000,      // Mínimo 2 segundos para responder
        maxResponseTime: 4000,      // Máximo 4 segundos
        typingTime: 2500,           // Tiempo mostrando "escribiendo..."
        readTimePerChar: 50,        // 50ms por carácter para "leer"
        maxReadTime: 2000,          // Máximo 2 segundos de lectura
        betweenMessages: 1000,      // 1 segundo entre mensajes múltiples
    },
    
    // LÍMITES
    limits: {
        maxMessagesPerDay: 60,      // 60 mensajes por día (con margen)
        maxMessagesPerHour: 15,     // 15 por hora máximo
        maxMessagesPerUser: 5,      // 5 mensajes por usuario por hora
        warningThreshold: 50,       // Avisar cuando llegues a 50 mensajes
    },
    
    // HORARIOS (formato 24 horas)
    schedule: {
        weekdays: {
            enabled: true,
            startHour: 8,           // 8:00 AM
            endHour: 18,            // 6:00 PM
        },
        saturday: {
            enabled: true,
            startHour: 8,           // 8:00 AM
            endHour: 12,            // 12:00 PM
        },
        sunday: {
            enabled: false,         // Domingos cerrado
        }
    },
    
    // MENSAJES VARIADOS
    messages: {
        greetings: [
            "Hola! 👋",
            "¡Hola! 😊",
            "¡Buen día!",
            "¡Hola, bienvenido/a!",
            "Hola, gracias por contactarnos 🙂"
        ],
        transitions: [
            "He analizado tu consulta y",
            "Según tu mensaje,",
            "Por lo que veo,",
            "De acuerdo a tu consulta,",
            "Entiendo que necesitas ayuda con"
        ],
        endings: [
            "¿Hay algo más en que pueda ayudarte?",
            "¿Necesitas ayuda con algo más?",
            "Estamos para servirte 😊",
            "¡Que tengas un excelente día!",
            "No dudes en escribirnos si necesitas más ayuda"
        ]
    },
    
    // CARACTERÍSTICAS DE SEGURIDAD
    security: {
        // Variación en delays (%)
        delayVariation: 20,         // ±20% de variación en tiempos
        
        // Pausas adicionales
        addRandomPauses: true,      // Agregar pausas aleatorias
        pauseProbability: 0.1,      // 10% de probabilidad de pausa extra
        pauseDuration: [500, 1500], // Entre 0.5 y 1.5 segundos
        
        // Simulación de errores humanos
        simulateTypos: false,       // No recomendado para universidad
        
        // Logs detallados
        verboseLogging: true,       // Mostrar todos los logs
    }
};

// TIPS PARA EVITAR BLOQUEOS:
// 1. No cambies drásticamente los delays (hazlo gradualmente)
// 2. Si recibes muchos mensajes, considera aumentar los límites gradualmente
// 3. Monitorea el número regularmente desde otro dispositivo
// 4. Ten siempre un número de respaldo listo
// 5. No uses el mismo número en múltiples dispositivos
// 6. Evita responder instantáneamente (mínimo 2 segundos)
// 7. Varía los mensajes lo más posible