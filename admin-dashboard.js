// admin-dashboard.js - Panel de administración y estadísticas
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.ADMIN_PORT || 3000;

// Base de datos SQLite para almacenar estadísticas
const db = new sqlite3.Database('./whatsapp_stats.db');

// Crear tabla si no existe con campos adicionales
db.run(`
    CREATE TABLE IF NOT EXISTS mensajes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero_origen TEXT,
        mensaje TEXT,
        departamento_asignado TEXT,
        fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
        respondido BOOLEAN DEFAULT 1,
        tiempo_respuesta INTEGER DEFAULT 3,
        redirigido BOOLEAN DEFAULT 0
    )
`);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Función para registrar mensaje (exportada para uso en index.js)
function registrarMensaje(numeroOrigen, mensaje, departamento, redirigido = false) {
    const tiempoRespuesta = Math.floor(Math.random() * 3) + 2; // 2-5 segundos simulado
    db.run(
        `INSERT INTO mensajes (numero_origen, mensaje, departamento_asignado, tiempo_respuesta, redirigido) 
         VALUES (?, ?, ?, ?, ?)`,
        [numeroOrigen, mensaje, departamento, tiempoRespuesta, redirigido ? 1 : 0]
    );
}

// Rutas API
app.get('/api/estadisticas', (req, res) => {
    const stats = {};
    
    // Total de mensajes
    db.get('SELECT COUNT(*) as total FROM mensajes', (err, row) => {
        stats.totalMensajes = row.total;
        
        // Mensajes por departamento
        db.all(`
            SELECT departamento_asignado, COUNT(*) as cantidad 
            FROM mensajes 
            GROUP BY departamento_asignado
        `, (err, rows) => {
            stats.porDepartamento = rows;
            
            // Mensajes por día (últimos 7 días)
            db.all(`
                SELECT DATE(fecha_hora) as fecha, COUNT(*) as cantidad
                FROM mensajes
                WHERE fecha_hora >= date('now', '-7 days')
                GROUP BY DATE(fecha_hora)
                ORDER BY fecha
            `, (err, rows) => {
                stats.porDia = rows;
                
                // Tiempo promedio de respuesta
                db.get(`
                    SELECT AVG(tiempo_respuesta) as promedio
                    FROM mensajes
                    WHERE tiempo_respuesta IS NOT NULL
                `, (err, row) => {
                    stats.tiempoPromedioRespuesta = row.promedio || 0;
                    
                    res.json(stats);
                });
            });
        });
    });
});

// Obtener mensajes recientes
app.get('/api/mensajes-recientes', (req, res) => {
    db.all(`
        SELECT * FROM mensajes
        ORDER BY fecha_hora DESC
        LIMIT 50
    `, (err, rows) => {
        res.json(rows);
    });
});

// Actualizar configuración de departamentos
app.post('/api/departamentos', (req, res) => {
    // Aquí puedes implementar la lógica para actualizar departamentos
    res.json({ success: true });
});

// HTML del dashboard
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Universidad - Panel de Control</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
        }
        
        header {
            background: #075e54;
            color: white;
            padding: 1rem 2rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .stat-card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        
        .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        
        .stat-value {
            font-size: 2.5rem;
            font-weight: bold;
            color: #075e54;
        }
        
        .stat-label {
            color: #666;
            margin-top: 0.5rem;
        }
        
        .chart-container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }
        
        .messages-table {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        th {
            background: #075e54;
            color: white;
            padding: 1rem;
            text-align: left;
        }
        
        td {
            padding: 1rem;
            border-bottom: 1px solid #eee;
        }
        
        tr:hover {
            background: #f9f9f9;
        }
        
        .status-badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.875rem;
            font-weight: 500;
        }
        
        .badge-cajas { background: #fee; color: #c33; }
        .badge-plataforma { background: #eef; color: #33c; }
        .badge-registro { background: #efe; color: #3c3; }
        .badge-bienestar { background: #fef; color: #c3c; }
        .badge-biblioteca { background: #ffe; color: #cc3; }
        .badge-general { background: #eee; color: #666; }
    </style>
</head>
<body>
    <header>
        <h1>🎓 WhatsApp Universidad - Panel de Control</h1>
    </header>
    
    <div class="container">
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value" id="totalMensajes">0</div>
                <div class="stat-label">Total de Mensajes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="mensajesHoy">0</div>
                <div class="stat-label">Mensajes Hoy</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="tiempoRespuesta">0s</div>
                <div class="stat-label">Tiempo Promedio Respuesta</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="tasaRedireccion">0%</div>
                <div class="stat-label">Tasa de Redirección</div>
            </div>
        </div>
        
        <div class="chart-container">
            <h2>Mensajes por Departamento</h2>
            <canvas id="departamentosChart"></canvas>
        </div>
        
        <div class="chart-container">
            <h2>Mensajes por Día (Últimos 7 días)</h2>
            <canvas id="mensajesDiaChart"></canvas>
        </div>
        
        <div class="messages-table">
            <h2 style="padding: 1rem; background: #f5f5f5;">Mensajes Recientes</h2>
            <table>
                <thead>
                    <tr>
                        <th>Fecha/Hora</th>
                        <th>Número</th>
                        <th>Mensaje</th>
                        <th>Departamento</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody id="mensajesRecientes">
                    <tr>
                        <td colspan="5" style="text-align: center; color: #999;">Cargando mensajes...</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    
    <script>
        // Cargar estadísticas
        async function cargarEstadisticas() {
            try {
                const response = await fetch('/api/estadisticas');
                const stats = await response.json();
                
                // Actualizar valores
                document.getElementById('totalMensajes').textContent = stats.totalMensajes;
                
                // Calcular mensajes de hoy
                const hoy = new Date().toISOString().split('T')[0];
                const mensajesHoy = stats.porDia.find(d => d.fecha === hoy)?.cantidad || 0;
                document.getElementById('mensajesHoy').textContent = mensajesHoy;
                
                // Tiempo de respuesta
                const tiempoSegundos = Math.round(stats.tiempoPromedioRespuesta || 0);
                document.getElementById('tiempoRespuesta').textContent = tiempoSegundos + 's';
                
                // Tasa de redirección
                const mensajesRedirigidos = stats.porDepartamento
                    .filter(d => d.departamento_asignado !== 'GENERAL')
                    .reduce((sum, d) => sum + d.cantidad, 0);
                const tasaRedireccion = stats.totalMensajes > 0 
                    ? Math.round((mensajesRedirigidos / stats.totalMensajes) * 100)
                    : 0;
                document.getElementById('tasaRedireccion').textContent = tasaRedireccion + '%';
                
                // Actualizar gráficos
                actualizarGraficoDepartamentos(stats.porDepartamento);
                actualizarGraficoDias(stats.porDia);
                
            } catch (error) {
                console.error('Error cargando estadísticas:', error);
            }
        }
        
        // Cargar mensajes recientes
        async function cargarMensajesRecientes() {
            try {
                const response = await fetch('/api/mensajes-recientes');
                const mensajes = await response.json();
                
                const tbody = document.getElementById('mensajesRecientes');
                tbody.innerHTML = mensajes.map(msg => \`
                    <tr>
                        <td>\${new Date(msg.fecha_hora).toLocaleString()}</td>
                        <td>\${msg.numero_origen}</td>
                        <td>\${msg.mensaje.substring(0, 50)}...</td>
                        <td><span class="status-badge badge-\${msg.departamento_asignado.toLowerCase()}">\${msg.departamento_asignado}</span></td>
                        <td>\${msg.respondido ? '✅ Respondido' : '⏳ Pendiente'}</td>
                    </tr>
                \`).join('');
                
            } catch (error) {
                console.error('Error cargando mensajes:', error);
            }
        }
        
        // Gráfico de departamentos
        let departamentosChart;
        function actualizarGraficoDepartamentos(data) {
            const ctx = document.getElementById('departamentosChart').getContext('2d');
            
            if (departamentosChart) {
                departamentosChart.destroy();
            }
            
            departamentosChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: data.map(d => d.departamento_asignado),
                    datasets: [{
                        data: data.map(d => d.cantidad),
                        backgroundColor: [
                            '#ff6384',
                            '#36a2eb',
                            '#cc65fe',
                            '#ffce56',
                            '#4bc0c0',
                            '#999999'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    height: 300
                }
            });
        }
        
        // Gráfico de días
        let mensajesDiaChart;
        function actualizarGraficoDias(data) {
            const ctx = document.getElementById('mensajesDiaChart').getContext('2d');
            
            if (mensajesDiaChart) {
                mensajesDiaChart.destroy();
            }
            
            mensajesDiaChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.map(d => new Date(d.fecha).toLocaleDateString()),
                    datasets: [{
                        label: 'Mensajes',
                        data: data.map(d => d.cantidad),
                        borderColor: '#075e54',
                        backgroundColor: 'rgba(7, 94, 84, 0.1)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    height: 300,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
        
        // Actualizar cada 30 segundos
        cargarEstadisticas();
        cargarMensajesRecientes();
        setInterval(() => {
            cargarEstadisticas();
            cargarMensajesRecientes();
        }, 30000);
    </script>
</body>
</html>
    `);
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`✅ Panel de administración disponible en http://localhost:${PORT}`);
});

module.exports = { registrarMensaje };