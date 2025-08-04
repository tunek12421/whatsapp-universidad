#!/bin/bash

echo "🔧 Instalando dependencias para WhatsApp Web.js en WSL..."

# Actualizar lista de paquetes
echo "📦 Actualizando lista de paquetes..."
sudo apt update

# Instalar dependencias necesarias para Chromium/Puppeteer
echo "🌐 Instalando dependencias de Chromium..."
sudo apt install -y \
    gconf-service \
    libasound2 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    ca-certificates \
    fonts-liberation \
    libappindicator1 \
    libnss3 \
    lsb-release \
    xdg-utils \
    wget

# Instalar dependencias adicionales para WSL
echo "🐧 Instalando dependencias adicionales para WSL..."
sudo apt install -y \
    libgbm-dev \
    libxshmfence-dev \
    libdrm2 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libgtk-4-1

echo "✅ Dependencias instaladas correctamente!"
echo ""
echo "🚀 Ahora puedes ejecutar:"
echo "   npm start"
echo ""
echo "📋 Si sigues teniendo problemas, prueba:"
echo "   export DISPLAY=:0"
echo "   npm start"