// monitor.js - Script de monitoreo para detectar problemas
const fs = require('fs');
const path = require('path');

class WhatsAppMonitor {
    constructor() {
        this.logFile = path.join(__dirname, 'monitor.log');
        this.alertFile = path.join(__dirname, 'alerts.log');
        this.stats = {
            startTime: new Date(),
            totalMessages: 0,
            failedMessages: 0,
            avgResponseTime: 0,
            lastActivity: new Date(),
            alerts: []
        };
    }

    // Registrar actividad
    logActivity(type, data) {
        const entry = {
            timestamp: new Date(),
            type,
            data
        };
        
        // Actualizar estadísticas
        if (type === 'message_sent') {
            this.stats.totalMessages++;
            this.stats.lastActivity = new Date();
        } else if (type === 'message_failed') {
            this.stats.failedMessages++;
            this.checkFailureRate();
        }
        
        // Guardar en archivo
        fs.appendFileSync(this.logFile, JSON.stringify(entry) + '\n');
    }

    // Verificar tasa de fallos
    checkFailureRate() {
        const failureRate = this.stats.failedMessages / this.stats.totalMessages;
        if (failureRate > 0.1) { // Más del 10% de fallos
            this.createAlert('HIGH_FAILURE_RATE', {
                rate: failureRate,
                total: this.stats.totalMessages,
                failed: this.stats.failedMessages
            });
        }
    }

    // Crear alerta
    createAlert(type, data) {
        const alert = {
            timestamp: new Date(),
            type,
            severity: this.getSeverity(type),
            data,
            message: this.getAlertMessage(type, data)
        };
        
        this.stats.alerts.push(alert);
        fs.appendFileSync(this.alertFile, JSON.stringify(alert) + '\n');
        
        // Mostrar en consola con color
        console.log(`\n🚨 ALERTA [${alert.severity}]: ${alert.message}\n`);
        
        // Si es crítico, sugerir acciones
        if (alert.severity === 'CRITICAL') {
            this.suggestActions(type);
        }
    }

    // Obtener severidad
    getSeverity(type) {
        const severities = {
            'HIGH_FAILURE_RATE': 'HIGH',
            'NO_ACTIVITY': 'MEDIUM',
            'RATE_LIMIT_APPROACHING': 'MEDIUM',
            'UNUSUAL_PATTERN': 'HIGH',
            'CONNECTION_LOST': 'CRITICAL',
            'VERIFICATION_REQUEST': 'CRITICAL'
        };
        return severities[type] || 'LOW';
    }

    // Obtener mensaje de alerta
    getAlertMessage(type, data) {
        const messages = {
            'HIGH_FAILURE_RATE': `Alta tasa de fallos: ${(data.rate * 100).toFixed(1)}% de mensajes fallando`,
            'NO_ACTIVITY': `Sin actividad por ${data.minutes} minutos`,
            'RATE_LIMIT_APPROACHING': `Aproximándose al límite: ${data.current}/${data.limit} mensajes`,
            'UNUSUAL_PATTERN': `Patrón inusual detectado: ${data.description}`,
            'CONNECTION_LOST': 'Conexión con WhatsApp perdida',
            'VERIFICATION_REQUEST': 'WhatsApp solicitó verificación - POSIBLE DETECCIÓN DE BOT'
        };
        return messages[type] || 'Alerta desconocida';
    }

    // Sugerir acciones
    suggestActions(type) {
        console.log('📋 ACCIONES RECOMENDADAS:');
        
        const actions = {
            'CONNECTION_LOST': [
                '1. Verificar conexión a internet',
                '2. Revisar si WhatsApp Web está activo en el teléfono',
                '3. Escanear QR nuevamente si es necesario'
            ],
            'VERIFICATION_REQUEST': [
                '1. DETENER EL BOT INMEDIATAMENTE',
                '2. Verificar el número manualmente en WhatsApp',
                '3. Considerar cambiar a un número diferente',
                '4. Reducir actividad por 24-48 horas'
            ],
            'HIGH_FAILURE_RATE': [
                '1. Revisar logs de errores',
                '2. Verificar límites de API',
                '3. Comprobar conexión con WhatsApp'
            ]
        };
        
        const actionList = actions[type] || ['Revisar logs para más información'];
        actionList.forEach(action => console.log(`   ${action}`));
        console.log('');
    }

    // Verificar salud del sistema
    checkHealth() {
        const now = new Date();
        const inactiveMinutes = (now - this.stats.lastActivity) / 60000;
        
        // Verificar inactividad
        if (inactiveMinutes > 30 && this.stats.totalMessages > 0) {
            this.createAlert('NO_ACTIVITY', { minutes: Math.floor(inactiveMinutes) });
        }
        
        // Mostrar resumen
        console.log('\n📊 === RESUMEN DE SALUD ===');
        console.log(`Tiempo activo: ${this.getUptime()}`);
        console.log(`Mensajes totales: ${this.stats.totalMessages}`);
        console.log(`Mensajes fallidos: ${this.stats.failedMessages}`);
        console.log(`Tasa de éxito: ${((1 - this.stats.failedMessages / this.stats.totalMessages) * 100).toFixed(1)}%`);
        console.log(`Última actividad: hace ${Math.floor(inactiveMinutes)} minutos`);
        console.log(`Alertas activas: ${this.stats.alerts.length}`);
        console.log('========================\n');
    }

    // Obtener tiempo activo
    getUptime() {
        const diff = new Date() - this.stats.startTime;
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
    }

    // Iniciar monitoreo
    start() {
        console.log('🔍 Monitor de salud iniciado');
        
        // Verificar salud cada 5 minutos
        setInterval(() => this.checkHealth(), 300000);
        
        // Verificación inicial
        this.checkHealth();
    }
}

// Exportar para uso en index.js
module.exports = WhatsAppMonitor;

// Si se ejecuta directamente, mostrar estadísticas
if (require.main === module) {
    const monitor = new WhatsAppMonitor();
    
    // Leer logs existentes
    if (fs.existsSync(monitor.logFile)) {
        const logs = fs.readFileSync(monitor.logFile, 'utf8').split('\n').filter(l => l);
        console.log(`\n📈 Analizando ${logs.length} entradas de log...\n`);
        
        // Analizar patrones
        const messagesByHour = {};
        const messagesByDay = {};
        
        logs.forEach(log => {
            try {
                const entry = JSON.parse(log);
                const date = new Date(entry.timestamp);
                const hour = date.getHours();
                const day = date.toDateString();
                
                messagesByHour[hour] = (messagesByHour[hour] || 0) + 1;
                messagesByDay[day] = (messagesByDay[day] || 0) + 1;
            } catch (e) {}
        });
        
        console.log('📊 Mensajes por hora:');
        Object.entries(messagesByHour).sort(([a], [b]) => a - b).forEach(([hour, count]) => {
            const bar = '█'.repeat(Math.ceil(count / 2));
            console.log(`  ${hour.padStart(2, '0')}:00 ${bar} ${count}`);
        });
        
        console.log('\n📅 Mensajes por día:');
        Object.entries(messagesByDay).slice(-7).forEach(([day, count]) => {
            console.log(`  ${day}: ${count} mensajes`);
        });
    } else {
        console.log('No hay logs previos para analizar');
    }
}