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
            background: #f0f2f5;
            color: #333;
            height: 100vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        
        header {
            background: #075e54;
            color: white;
            padding: 0.75rem 1.5rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            flex-shrink: 0;
        }
        
        header h1 {
            font-size: 1.25rem;
            font-weight: 600;
        }
        
        .main-container {
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            padding: 1rem;
            max-width: 1400px;
            width: 100%;
            margin: 0 auto;
        }
        
        /* Sección superior: estadísticas y gráficos */
        .top-section {
            display: grid;
            grid-template-columns: 200px 1fr;
            gap: 1rem;
            margin-bottom: 1rem;
            height: 240px;
        }
        
        /* Estadísticas verticales */
        .stats-column {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }
        
        .stat-card {
            background: white;
            padding: 0.75rem 1rem;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            transition: all 0.2s;
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        
        .stat-card:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        
        .stat-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #075e54;
            line-height: 1;
        }
        
        .stat-label {
            color: #666;
            font-size: 0.75rem;
            margin-top: 0.25rem;
        }
        
        /* Contenedor de gráficos */
        .charts-row {
            display: grid;
            grid-template-columns: 1fr 1.5fr;
            gap: 1rem;
            height: 100%;
        }
        
        .chart-container {
            background: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
        }
        
        .chart-container h2 {
            font-size: 0.875rem;
            color: #555;
            margin-bottom: 0.5rem;
            font-weight: 600;
        }
        
        .chart-wrapper {
            flex: 1;
            position: relative;
            min-height: 0;
        }
        
        /* Tabla de mensajes */
        .messages-section {
            flex: 1;
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
            min-height: 0;
        }
        
        .messages-header {
            padding: 0.75rem 1rem;
            background: #f8f9fa;
            border-bottom: 1px solid #e0e0e0;
            border-radius: 8px 8px 0 0;
        }
        
        .messages-header h2 {
            font-size: 0.875rem;
            color: #555;
            font-weight: 600;
        }
        
        .table-container {
            flex: 1;
            overflow: auto;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.813rem;
        }
        
        th {
            background: #075e54;
            color: white;
            padding: 0.5rem 0.75rem;
            text-align: left;
            font-weight: 500;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        
        td {
            padding: 0.5rem 0.75rem;
            border-bottom: 1px solid #f0f0f0;
        }
        
        tr:hover {
            background: #f8fafb;
        }
        
        /* Columna de fecha más estrecha */
        th:first-child, td:first-child {
            width: 120px;
        }
        
        /* Columna de número más estrecha */
        th:nth-child(2), td:nth-child(2) {
            width: 100px;
        }
        
        /* Columna de estado más estrecha */
        th:last-child, td:last-child {
            width: 100px;
            text-align: center;
        }
        
        .status-badge {
            display: inline-block;
            padding: 0.2rem 0.5rem;
            border-radius: 10px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        
        .badge-cajas { background: #fee0e0; color: #c33; }
        .badge-plataforma { background: #e0e0fe; color: #33c; }
        .badge-registro { background: #e0fee0; color: #3c3; }
        .badge-bienestar { background: #fee0fe; color: #c3c; }
        .badge-biblioteca { background: #fffde0; color: #cc3; }
        .badge-general { background: #e8e8e8; color: #666; }
        
        /* Responsive */
        @media (max-width: 1200px) {
            .top-section {
                grid-template-columns: 1fr;
                height: auto;
            }
            
            .stats-column {
                flex-direction: row;
                flex-wrap: wrap;
            }
            
            .stat-card {
                flex: 1 1 calc(25% - 0.75rem);
                min-width: 140px;
            }
            
            .charts-row {
                grid-template-columns: 1fr;
                height: 400px;
            }
        }
        
        @media (max-width: 768px) {
            .main-container {
                padding: 0.5rem;
            }
            
            .stat-card {
                flex: 1 1 calc(50% - 0.5rem);
            }
            
            th, td {
                padding: 0.4rem 0.5rem;
                font-size: 0.75rem;
            }
            
            th:nth-child(3), td:nth-child(3) {
                display: none; /* Ocultar columna mensaje en móvil */
            }
        }
        
        /* Scrollbar personalizada */
        .table-container::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        
        .table-container::-webkit-scrollbar-track {
            background: #f1f1f1;
        }
        
        .table-container::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 4px;
        }
        
        .table-container::-webkit-scrollbar-thumb:hover {
            background: #555;
        }
    </style>
</head>
<body>
    <header>
        <h1>🎓 WhatsApp Universidad - Panel de Control</h1>
    </header>
    
    <div class="main-container">
        <div class="top-section">
            <!-- Columna de estadísticas -->
            <div class="stats-column">
                <div class="stat-card">
                    <div class="stat-value" id="totalMensajes">0</div>
                    <div class="stat-label">Total Mensajes</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="mensajesHoy">0</div>
                    <div class="stat-label">Mensajes Hoy</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="tiempoRespuesta">0s</div>
                    <div class="stat-label">Tiempo Respuesta</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="tasaRedireccion">0%</div>
                    <div class="stat-label">Redirección</div>
                </div>
            </div>
            
            <!-- Gráficos -->
            <div class="charts-row">
                <div class="chart-container">
                    <h2>Distribución por Departamento</h2>
                    <div class="chart-wrapper">
                        <canvas id="departamentosChart"></canvas>
                    </div>
                </div>
                
                <div class="chart-container">
                    <h2>Tendencia Semanal</h2>
                    <div class="chart-wrapper">
                        <canvas id="mensajesDiaChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Tabla de mensajes -->
        <div class="messages-section">
            <div class="messages-header">
                <h2>Mensajes Recientes</h2>
            </div>
            <div class="table-container">
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
                            <td colspan="5" style="text-align: center; color: #999; padding: 2rem;">Cargando mensajes...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
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
                        <td>\${new Date(msg.fecha_hora).toLocaleString('es-BO', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}</td>
                        <td>\${msg.numero_origen.slice(-8)}</td>
                        <td title="\${msg.mensaje}">\${msg.mensaje.substring(0, 40)}...</td>
                        <td><span class="status-badge badge-\${msg.departamento_asignado.toLowerCase()}">\${msg.departamento_asignado}</span></td>
                        <td>\${msg.respondido ? '✅' : '⏳'}</td>
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
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 10,
                                font: {
                                    size: 11
                                }
                            }
                        }
                    }
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
                    labels: data.map(d => {
                        const fecha = new Date(d.fecha);
                        return fecha.toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric' });
                    }),
                    datasets: [{
                        label: 'Mensajes',
                        data: data.map(d => d.cantidad),
                        borderColor: '#075e54',
                        backgroundColor: 'rgba(7, 94, 84, 0.1)',
                        tension: 0.3,
                        borderWidth: 2,
                        pointBackgroundColor: '#075e54',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                font: {
                                    size: 11
                                }
                            }
                        },
                        x: {
                            ticks: {
                                font: {
                                    size: 11
                                }
                            }
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

// Iniciar servidor solo si se ejecuta directamente
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`✅ Panel de administración disponible en http://localhost:${PORT}`);
    });
}

module.exports = { registrarMensaje };