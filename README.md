# 🐺 WolfTeI Autogestión

Aplicación de escritorio corporativa para la gestión integral de **WolfTeI** (Soluciones de Software & Ciberseguridad). Construida con **Tauri v2 (Rust)** y **Angular v22**.

---

## 📖 Documentación Completa del Sistema

Para consultar en detalle todas las funcionalidades, flujos operativos, circuitos de contratos, arquitectura y generadores en PDF, revisá el manual oficial:

👉 **[MANUAL_DEL_SISTEMA.md](MANUAL_DEL_SISTEMA.md)**

Y para detalles de normativas de ciberseguridad, mitigación de vulnerabilidades y buenas prácticas:

👉 **[SECURITY_REPORT.md](SECURITY_REPORT.md)**

---

## 🚀 Requisitos y Entorno de Desarrollo

- **Node.js:** v20+ o v22+
- **Rust:** v1.75+ con `cargo`
- **Tauri CLI:** v2.x
- **Angular CLI:** v22.x

### Instalación de Dependencias
```bash
npm install
```

### Configuración de Entorno
Copiá la plantilla de ejemplo y colocá tus credenciales de Firebase:
```bash
cp src/environments/environment.example.ts src/environments/environment.ts
```

### Ejecutar en Desarrollo (Desktop)
```bash
npm run tauri dev
```

### Compilar para Producción
```bash
npm run build
npm run tauri build
```

---

## 🛠️ Módulos Principales de la Aplicación
1. **Resumen y Home Dashboard:** KPIs de facturación, conversión y balance en CSV.
2. **Mensajes Web & Notificaciones Nativas:** Recepción en tiempo real de contactos web con alerta nativa de OS.
3. **CRM de Clientes:** Fichas de clientes, historial de contratos y contacto por WhatsApp.
4. **Propuestas Comerciales & Presets:** Presupuestos a medida, plantillas rápidas y alerta de propuestas frías (>48hs).
5. **Tablero Kanban de Proyectos:** Seguimiento de fases, entrega formal y solicitud de encuestas.
6. **Bóveda Segura de Infraestructura:** Almacenamiento local de accesos cifrado con AES-256-GCM y monitoreo de vencimientos a 30 días.
7. **Documentos Legales en PDF:** Contrato de desarrollo, Acuerdo NDA, Recibo Oficial y Acta de Entrega con Garantía de 30 días.
8. **Finanzas & Cobranzas:** Cuentas corrientes, libros diarios foliados y moderador de opiniones públicas.
9. **Auto-Updater:** Actualizaciones automáticas y seguras desde GitHub Releases.
