# Cambios en la Estructura del Proyecto

## Resumen de Modificaciones

Se ha reorganizado la estructura del proyecto WhatsApp Universidad para mejorar la organización y mantenimiento del código.

## Estructura Anterior
```
whatsapp-universidad/
├── README.md
├── index.js
├── admin-dashboard.js
├── antiblock-config.js
├── monitor.js
├── start.js
├── whatsapp-utils.js
├── monitor.log
├── package.json
├── package-lock.json
└── node_modules/
```

## Nueva Estructura
```
whatsapp-universidad/
├── README.md
├── package.json
├── package-lock.json
├── node_modules/
├── src/
│   ├── bot.js (antes index.js)
│   ├── admin-dashboard.js
│   ├── monitor.js
│   └── start.js
├── config/
│   └── antiblock-config.js
├── utils/
│   └── whatsapp-utils.js
└── logs/
    └── monitor.log
```

## Cambios Realizados

### 1. Organización de Directorios
- **src/**: Contiene todos los archivos principales de la aplicación
- **config/**: Archivos de configuración
- **utils/**: Utilidades y funciones auxiliares
- **logs/**: Archivos de registro y logs

### 2. Archivos Movidos
- `index.js` → `src/bot.js` (renombrado para mayor claridad)
- `admin-dashboard.js` → `src/admin-dashboard.js`
- `monitor.js` → `src/monitor.js`
- `start.js` → `src/start.js`
- `antiblock-config.js` → `config/antiblock-config.js`
- `whatsapp-utils.js` → `utils/whatsapp-utils.js`
- `monitor.log` → `logs/monitor.log`

### 3. Actualización de Scripts
Se actualizaron los scripts en `package.json` para reflejar las nuevas rutas:

```json
{
  "main": "src/bot.js",
  "scripts": {
    "start": "node src/start.js",
    "bot": "node src/bot.js",
    "admin": "node src/admin-dashboard.js",
    "monitor": "node src/monitor.js",
    "dev": "concurrently \"npm run bot\" \"npm run admin\"",
    "health": "node src/monitor.js"
  }
}
```

## Beneficios de la Nueva Estructura

1. **Organización Clara**: Separación lógica entre código fuente, configuración, utilidades y logs
2. **Mantenimiento Mejorado**: Más fácil ubicar y mantener diferentes tipos de archivos
3. **Escalabilidad**: Estructura preparada para el crecimiento del proyecto
4. **Estándares**: Sigue las mejores prácticas de organización de proyectos Node.js

## Compatibilidad

- Todos los comandos npm siguen funcionando igual
- Las funcionalidades del bot no se ven afectadas
- Los imports internos se mantienen correctos
- No se requieren cambios en las variables de entorno

## Notas Importantes

- Los archivos de configuración (.env) permanecen en la raíz del proyecto
- La base de datos (whatsapp_stats.db) permanece en la raíz del proyecto
- No se modificó la funcionalidad del código, solo su organización