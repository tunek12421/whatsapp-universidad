# Sistema de WhatsApp con IA para Universidad

Sistema automatizado para clasificar y redirigir consultas estudiantiles a través de WhatsApp usando Inteligencia Artificial.

## 🚀 Características

- **Clasificación Inteligente**: Analiza mensajes usando IA (OpenAI GPT-3.5)
- **Redirección Automática**: Envía consultas al departamento correcto
- **Panel de Administración**: Estadísticas en tiempo real
- **Base de Datos**: Registro de todas las interacciones
- **Multi-departamento**: Soporte para múltiples áreas de la universidad

## 📋 Requisitos Previos

- Node.js v14 o superior
- NPM o Yarn
- Cuenta de OpenAI con API Key
- WhatsApp Business o cuenta regular

## 🔧 Instalación

1. **Clonar o crear el proyecto**
```bash
mkdir whatsapp-universidad
cd whatsapp-universidad
```

2. **Instalar dependencias**
```bash
npm init -y
npm install whatsapp-web.js openai qrcode-terminal dotenv express sqlite3
```

3. **Instalar Chromium (requerido para whatsapp-web.js)**
```bash
# En Ubuntu/Debian
sudo apt-get install chromium-browser

# En macOS
brew install chromium

# En Windows
# Descargar desde https://www.chromium.org/
```

## ⚙️ Configuración

1. **Crear archivo `.env`** con tus credenciales:
```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxx

# Números de WhatsApp (formato: código_país + número sin +)
NUMERO_CAJAS=591701234567
NUMERO_PLATAFORMA=591701234568
NUMERO_REGISTRO=591701234569
NUMERO_BIENESTAR=591701234570
NUMERO_BIBLIOTECA=591701234571
```

2. **Configurar departamentos** en el archivo principal:
```javascript
const DEPARTAMENTOS = {
    CAJAS: {
        nombre: "Departamento de Cajas",
        numero: process.env.NUMERO_CAJAS,
        palabrasClave: ["pago", "cuota", "mensualidad"],
        descripcion: "Pagos, cuotas, mensualidades"
    },
    // ... más departamentos
};
```

## 🏃‍♂️ Ejecutar el Sistema

1. **Iniciar el bot de WhatsApp**:
```bash
node index.js
```

2. **Escanear código QR**:
   - Aparecerá un código QR en la terminal
   - Escanéalo con WhatsApp (Configuración > Dispositivos vinculados)

3. **Iniciar panel de administración** (opcional):
```bash
node admin-dashboard.js
```
   - Acceder a: http://localhost:3000

## 📱 Uso del Sistema

### Para Estudiantes:
1. Envían mensaje al número principal de WhatsApp
2. El sistema analiza y clasifica la consulta
3. Reciben respuesta con información del departamento correcto
4. Son redirigidos automáticamente

### Ejemplos de Mensajes:
- "Necesito pagar mi mensualidad" → Redirige a CAJAS
- "No puedo entrar a la plataforma" → Redirige a PLATAFORMA
- "Quiero solicitar mi certificado" → Redirige a REGISTRO
- "Información sobre becas" → Redirige a BIENESTAR

## 📊 Panel de Administración

El panel muestra:
- Total de mensajes recibidos
- Mensajes por departamento
- Gráficos de tendencias
- Mensajes recientes
- Tiempo promedio de respuesta

## 🔐 Seguridad

- Las API Keys deben mantenerse en el archivo `.env`
- No subir `.env` a repositorios públicos
- Usar HTTPS en producción
- Implementar rate limiting si es necesario

## 🛠️ Personalización

### Agregar Nuevo Departamento:
```javascript
ADMISIONES: {
    nombre: "Departamento de Admisiones",
    numero: "591XXXXXXXX",
    palabrasClave: ["admisión", "postular", "requisitos", "examen"],
    descripcion: "Proceso de admisión y postulación"
}
```

### Modificar Mensajes de Respuesta:
Editar la función `generarMensajeRedireccion()` en el archivo principal.

### Cambiar Modelo de IA:
```javascript
model: "gpt-4" // En lugar de gpt-3.5-turbo
```

## 📈 Mejoras Sugeridas

1. **Integración con CRM**: Conectar con sistema de tickets
2. **Multiidioma**: Soporte para varios idiomas
3. **Horarios**: Respuestas diferentes fuera de horario
4. **Encuestas**: Satisfacción post-atención
5. **Backup**: Sistema de respaldo automático

## 🐛 Solución de Problemas

### Error de QR Code:
- Cerrar sesión en WhatsApp Web
- Eliminar carpeta `.wwebjs_auth`
- Reiniciar el bot

### Error de API OpenAI:
- Verificar API Key válida
- Revisar límites de uso
- Verificar conexión a internet

### Mensajes no llegan:
- Verificar número en formato correcto
- Comprobar que WhatsApp esté conectado
- Revisar logs en consola

## 🤝 Soporte

Para ayuda adicional:
- Email: soporte@universidad.edu
- Documentación: wiki.universidad.edu/whatsapp-bot
- Issues: github.com/universidad/whatsapp-bot

## 📄 Licencia

Este proyecto es de uso interno para la Universidad.# whatsapp-universidad
