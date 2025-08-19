// start.js - Script para iniciar todos los servicios
const { spawn } = require('child_process');
const os = require('os');

console.log('🚀 Iniciando Sistema de WhatsApp Universidad...\n');

// Determinar comando según sistema operativo
const isWindows = os.platform() === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

// Iniciar bot de WhatsApp
console.log('📱 Iniciando Bot de WhatsApp...');
const whatsappBot = spawn('node', ['src/bot.js'], {
    stdio: 'inherit',
    shell: true
});

// Esperar 5 segundos antes de iniciar el panel
setTimeout(() => {
    console.log('\n📊 Iniciando Panel de Administración...');
    const adminPanel = spawn('node', ['src/admin-dashboard.js'], {
        stdio: 'inherit',
        shell: true
    });

    // Abrir navegador automáticamente (opcional)
    setTimeout(() => {
        const url = 'http://localhost:3000';
        const start = (process.platform == 'darwin' ? 'open' : 
                       process.platform == 'win32' ? 'start' : 'xdg-open');
        spawn(start, [url], { shell: true });
    }, 2000);

}, 5000);

// Manejar cierre
process.on('SIGINT', () => {
    console.log('\n👋 Cerrando todos los servicios...');
    process.exit();
});