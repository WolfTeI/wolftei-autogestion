# 🐺 WolfTeI - Manual Integral del Sistema & Arquitectura Funcional

Este documento recopila la **totalidad de las funciones, módulos, arquitectura técnica y flujos de negocio** del ecosistema de software de **WolfTeI**, compuesto por:
1. **WolfTeI Autogestión:** Aplicación de escritorio nativa para administración, CRM, emisión de contratos, seguimiento de proyectos, cobranzas y moderación (Tauri v2 + Angular v22 + Rust).
2. **WolfTeI Web:** Portal institucional público con visor interactivo de propuestas comerciales y encuestas de satisfacción post-entrega (Angular v22 SSR + Firebase Firestore).

---

## 📑 Índice General
1. [Arquitectura General & Stack](#1-arquitectura-general--stack)
2. [Ecosistema de Datos en Firebase Firestore](#2-ecosistema-de-datos-en-firebase-firestore)
3. [Módulos de WolfTeI Autogestión (Desktop)](#3-módulos-de-wolftei-autogestión-desktop)
   - [3.1 Autenticación y Seguridad de Acceso](#31-autenticación-y-seguridad-de-acceso)
   - [3.2 Resumen Operativo (Home Dashboard)](#32-resumen-operativo-home-dashboard)
   - [3.3 Mensajería Web y Notificaciones Nativas](#33-mensajería-web-y-notificaciones-nativas)
   - [3.4 CRM y Directorio de Clientes](#34-crm-y-directorio-de-clientes)
   - [3.5 Propuestas Comerciales, Presupuestos y Presets](#35-propuestas-comerciales-presupuestos-y-presets)
   - [3.6 Automatización Comercial por WhatsApp a 1 Clic](#36-automatización-comercial-por-whatsapp-a-1-clic)
   - [3.7 Tablero Kanban de Proyectos & Ciclo de Desarrollo](#37-tablero-kanban-de-proyectos--ciclo-de-desarrollo)
   - [3.8 Bóveda Segura de Infraestructura (Cifrado AES-256-GCM)](#38-bóveda-segura-de-infraestructura-cifrado-aes-256-gcm)
   - [3.9 Generadores de Documentos Legales en PDF](#39-generadores-de-documentos-legales-en-pdf)
   - [3.10 Tablero de Finanzas, Cuentas Corrientes y Recibos Oficiales](#310-tablero-de-finanzas-cuentas-corrientes-y-recibos-oficiales)
   - [3.11 Moderador de Reseñas y Testimonios Web](#311-moderador-de-reseñas-y-testimonios-web)
   - [3.12 Actualizador Automático de la App (Auto-updater)](#312-actualizador-automático-de-la-app-auto-updater)
4. [Módulos de WolfTeI Web (Portal Público)](#4-módulos-de-wolftei-web-portal-público)
   - [4.1 Visor Interactivo y Firma de Propuestas (`/propuesta/:token`)](#41-visor-interactivo-y-firma-de-propuestas-propuestatoken)
   - [4.2 Trazabilidad de Lectura (`visto`) y Respaldo Legal con IP](#42-trazabilidad-de-lectura-visto-y-respaldo-legal-con-ip)
   - [4.3 Encuesta de Satisfacción Post-Entrega (`/feedback/:token`)](#43-encuesta-de-satisfacción-post-entrega-feedbacktoken)
5. [Estándares de Seguridad (OWASP & ISO 27001/27002)](#5-estándares-de-seguridad-owasp--iso-2700127002)

---

## 1. Arquitectura General & Stack

| Capa | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Desktop Core** | **Tauri v2 (Rust)** | Empaquetado ligero nativo para Windows/Linux/macOS, acceso a sistema de archivos, notificaciones nativas y auto-actualizaciones seguras. |
| **Frontend Desktop** | **Angular v22 (Standalone + Signals)** | UI de autogestión de alta performance con Angular Material, control flow moderno (`@if`, `@for`) y reactividad en tiempo real. |
| **Portal Web** | **Angular v22 (SSR / Prerendering)** | Sitio web corporativo SEO-friendly, renderizado del lado del servidor para visitas ultrarrápidas y visor de contratos. |
| **Backend & DB** | **Google Firebase Firestore** | Base de datos NoSQL documental en tiempo real con WebSockets/long-polling y reglas de seguridad declarativas. |
| **Auth** | **Firebase Authentication** | Gestión de credenciales seguras de administración, sesiones persistentes y tokens JWT. |
| **Generación de PDFs** | **jsPDF + html2canvas** | Motor cliente de vectorización tipográfica para contratos, acuerdos NDA, actas y recibos con logotipo oficial y firma gráfica de Carlos Alberto Prost. |
| **Criptografía** | **Web Crypto API (SubtleCrypto)** | CSPRNG, derivación de claves PBKDF2 (100.000 iteraciones SHA-256) y cifrado simétrico AES-256-GCM para la bóveda de claves. |

---

## 2. Ecosistema de Datos en Firebase Firestore

Las dos aplicaciones comparten las siguientes colecciones principales:

1. **`contacts`**: Mensajes recibidos a través del formulario web de contacto.
   - Campos: `name`, `email`, `phone`, `subject`, `message`, `status` (`unread`, `read`, `replied`), `createdAt`.
2. **`clients`**: Directorio de personas y empresas clientes de WolfTeI.
   - Campos: `name`, `company`, `email`, `phone`, `taxId` (CUIT/DNI), `address`, `notes`, `createdAt`, `updatedAt`.
3. **`proposals`**: Presupuestos y propuestas comerciales.
   - Campos: `token`, `title`, `clientId`, `clientPreviewName`, `description`, `modules` (lista de alcances), `deliveryTimeDays`, `totalAmount`, `currency` (`USD` o `ARS`), `status` (`borrador`, `enviado`, `visto`, `aceptado`, `rechazado`, `en_desarrollo`, `finalizado`, `cancelado`), `viewedAt`, `acceptance` (`acceptedBy`, `taxId`, `clientIp`, `clientUserAgent`, `acceptedAt`), `createdAt`, `updatedAt`.
4. **`projects`**: Tablero Kanban de proyectos activos y entregados.
   - Campos: `clientId`, `title`, `description`, `status` (`pendiente`, `en_progreso`, `testing`, `entregado`, `cancelado`), `currentPhase`, `totalAmount`, `currency`, `credenciales` (bóveda de accesos cifrada con AES), `dominio`, `proveedorInfra`, `cuentaInfra`, `vencimientoHosting`, `vencimientoDominio`, `actaGarantiaGenerada`, `reviewToken`, `reviewCompleted`, `reviewStars`, `reviewComment`, `reviewPublicada`, `createdAt`, `updatedAt`.
5. **`payments`**: Libro diario de cobranzas y pagos.
   - Campos: `propuestaId`, `clientId`, `amount`, `currency`, `exchangeRate`, `concept` (`anticipo`, `saldo`, `total`, `cuota`, `otro`), `paymentMethod` (`transferencia`, `usdt`, `efectivo`, `mercadopago`), `receiptNumber` (`REC-AAMMDD-XXX`), `notes`, `createdAt`, `updatedAt`.

---

## 3. Módulos de WolfTeI Autogestión (Desktop)

### 3.1 Autenticación y Seguridad de Acceso
- **Ruta:** `/login`
- **Componentes:** `LoginComponent`, `ChangePasswordDialogComponent`, `authGuard`.
- **Funcionamiento:** Inicio de sesión exclusivo del administrador contra Firebase Auth. Si no hay sesión válida, el guard redirige inmediatamente al login. Incluye diálogo de cambio de contraseña dentro del sistema.

### 3.2 Resumen Operativo (Home Dashboard)
- **Ruta:** `/dashboard`
- **Componentes:** `HomeDashboardComponent`.
- **Métricas principales:**
  - Contador en tiempo real de Propuestas Totales, Proyectos en Curso, Clientes y Mensajes Web.
  - Tasa de Conversión (%) calculada como `(Aceptadas / Totales) * 100`.
  - Contratado total en Dólares (USD) y Contratado total en Pesos (ARS).
  - Botón de **Exportar Balance a CSV** compatible con Excel (con codificación UTF-8 con BOM).
  - Accesos directos a las operaciones frecuentes.

### 3.3 Mensajería Web y Notificaciones Nativas
- **Ruta:** `/dashboard/contacts`
- **Servicios:** `ContactoService`, `NotificationService`.
- **Funcionamiento:** Escucha de nuevos mensajes web en segundo plano. Cuando entra un mensaje nuevo, la aplicación de escritorio emite una notificación de sistema operativo mediante el plugin de Tauri (`@tauri-apps/plugin-notification`). Permite marcar como leído, archivar o responder por email o WhatsApp con un clic.

### 3.4 CRM y Directorio de Clientes
- **Rutas:** `/dashboard/clientes`, `/dashboard/clientes/:id`
- **Servicios:** `ClientesService`.
- **Funcionamiento:**
  - Creación, modificación y visualización de clientes con datos fiscales (CUIT/RUT/DNI) para facturación y contratos.
  - Ficha individual del cliente que consolida todos sus proyectos y propuestas vigentes.
  - Enlace rápido a WhatsApp con mensaje precargado.

### 3.5 Propuestas Comerciales, Presupuestos y Presets
- **Rutas:** `/dashboard/propuestas`, `/dashboard/propuestas/nueva`, `/dashboard/propuestas/:id`, `/dashboard/propuestas/:id/editar`
- **Servicios:** `PropuestasService`.
- **Características clave:**
  - **Catálogo de Presets Rápidos:** Menú selector para autocompletar formularios en 1 clic:
    - *Landing Page Institucional / One-Page* (7 días, diseño responsive, formulario y SEO).
    - *Sistema Web / Panel de Control a Medida* (30 días, autenticación, base de datos y reportes).
    - *App Móvil Android / Solución Multiplataforma* (45 días, Tauri/Capacitor, notificaciones push y SQLite).
    - *Mantenimiento Técnico & Soporte Mensual* (Mensual, backups, parches de seguridad y uptime).
  - **Alertas de Propuestas Frías:** Badge animado `⚠️ Fría` para toda propuesta que lleve más de 48 horas en estado `enviado` o `visto` sin definición del cliente.
  - **Generación de Token Web:** Crea un token alfanumérico seguro para que el cliente acceda a `https://wolftei.com.ar/propuesta/<TOKEN>`.

### 3.6 Automatización Comercial por WhatsApp a 1 Clic
- **Servicio:** `WhatsAppService` ([whatsapp.service.ts](file:///d:/Programacion/Github%20WolTeI/WolfTeI-autogestion/src/app/service/whatsapp.service.ts)).
- **Disparadores integrados:**
  1. *Enviar Propuesta:* Genera saludo cordial con enlace directo al visor web.
  2. *Seguimiento de Propuesta Fría:* Mensaje amable consultando si tuvo oportunidad de revisar la propuesta o si desea evacuar dudas técnicas.
  3. *Bienvenida al Proyecto:* Mensaje formal una vez aprobada la propuesta confirmando el inicio del desarrollo.
  4. *Encuesta de Calidad:* Envío del enlace de reseña tras la entrega del proyecto.

### 3.7 Tablero Kanban de Proyectos & Ciclo de Desarrollo
- **Ruta:** `/dashboard/proyectos`
- **Servicios:** `ProyectosService`.
- **Vistas:** Alternancia entre vista **Kanban visual** (columnas: Pendiente, En Progreso, Testing, Entregado) y **Tabla detallada**.
- **Acciones directas:**
  - Arrastrar o avanzar fases en tiempo real con actualización optimista inmediata (0ms).
  - Al marcar como "Entregado", genera automáticamente el enlace de satisfacción (`reviewToken`) y lo copia al portapapeles.
  - Menú de documentos legales asociados al proyecto.

### 3.8 Bóveda Segura de Infraestructura (Cifrado AES-256-GCM)
- **Componente:** `BovedaDialogComponent` ([boveda-dialog.component.ts](file:///d:/Programacion/Github%20WolTeI/WolfTeI-autogestion/src/app/views/dashboard/proyectos/boveda-dialog/boveda-dialog.component.ts)).
- **Módulo criptográfico:** `vault-crypto.ts` ([vault-crypto.ts](file:///d:/Programacion/Github%20WolTeI/WolfTeI-autogestion/src/app/utils/vault-crypto.ts)).
- **Funcionamiento:**
  - Guarda credenciales de clientes (cPanel, Hostinger, AWS, Cloudflare, DB) asociadas al proyecto.
  - Las contraseñas **nunca se guardan en texto plano**: se cifran mediante **AES-256-GCM** en el navegador usando una clave maestra definida por el administrador.
  - Cada credencial almacena su propio Vector de Inicialización (IV de 12 bytes) y Salt criptográfico (16 bytes) aleatorios generados por `crypto.getRandomValues`.
  - **Alerta de Vencimiento de Infraestructura:** Badges visuales que advierten automáticamente si el hosting o dominio del cliente caduca en menos de 30 días.

### 3.9 Generadores de Documentos Legales en PDF
El sistema cuenta con un motor nativo en cliente sin intermediarios que produce documentos formales de alta calidad técnica y jurídica:
1. **Contrato de Prestación de Servicios de Software:** Basado en la propuesta aceptada, con plazos, condiciones de pago, derechos de autor y propiedad intelectual.
2. **Acuerdo de Confidencialidad y No Divulgación (NDA):** Protección de secretos comerciales, código fuente y datos del cliente.
3. **Acta de Entrega y Garantía Técnica de 30 Días ([acta-garantia-pdf-generator.ts](file:///d:/Programacion/Github%20WolTeI/WolfTeI-autogestion/src/app/utils/acta-garantia-pdf-generator.ts)):** Formaliza la transferencia de custodia de servidores y habilita el periodo de soporte técnico y corrección de bugs por 30 días corridos sin costo adicional.
4. **Descarga de Carpeta Completa del Proyecto:** Genera en un solo archivo todos los documentos para firma presencial o archivo físico.

### 3.10 Tablero de Finanzas, Cuentas Corrientes y Recibos Oficiales
- **Ruta:** `/dashboard/finanzas`
- **Componente:** `FinanzasComponent` ([finanzas.component.ts](file:///d:/Programacion/Github%20WolTeI/WolfTeI-autogestion/src/app/views/dashboard/finanzas/finanzas.component.ts)).
- **Servicio:** `PagosService`.
- **Cuentas Corrientes & Cobranzas:**
  - Indicadores globales: Total cobrado en USD, Total cobrado en ARS, Saldos pendientes en USD y ARS.
  - **Tabla de Cuentas por Cobrar:** Listado dinámico de contratos aprobados o en curso que adeudan anticipo o saldo final, con porcentaje de avance y botón para registrar cobranza en 1 clic.
  - **Libro Diario de Cobranzas:** Tabla de cobros realizados con concepto (Anticipo, Saldo, Cuota, Total), medio de pago (Transferencia, USDT, Efectivo, Mercado Pago) y monto.
  - **Generación de Recibo Oficial en PDF ([receipt-pdf-generator.ts](file:///d:/Programacion/Github%20WolTeI/WolfTeI-autogestion/src/app/utils/receipt-pdf-generator.ts)):** Descarga instantánea de comprobante de pago foliado (`REC-AAMMDD-XXX`) con membrete de WolfTeI, datos fiscales y firma oficial de Carlos Alberto Prost.
  - Exportación del libro de cobranzas a CSV/Excel.

### 3.11 Moderador de Reseñas y Testimonios Web
- **Pestaña integrada en:** `/dashboard/finanzas`
- **Funcionamiento:**
  - Escucha las respuestas enviadas por los clientes desde la web (`/feedback/:token`).
  - Muestra la calificación en estrellas (1 a 5), el comentario redactado, el proyecto y el cliente.
  - Calcula el promedio general **CSAT** y el porcentaje de satisfacción de WolfTeI.
  - **Toggle "Visible en Web":** Permite al administrador aprobar o esconder reseñas en la web pública con un solo clic, impactando en tiempo real sobre Firestore (`reviewPublicada: true/false`).
  - Botón para copiar el testimonio formateado para compartir en Instagram, LinkedIn o WhatsApp.

### 3.12 Actualizador Automático de la App (Auto-updater)
- **Servicio:** `UpdaterService` ([updater.service.ts](file:///d:/Programacion/Github%20WolTeI/WolfTeI-autogestion/src/app/service/updater.service.ts)).
- **Mecanismo:** Basado en `@tauri-apps/plugin-updater`. Consulta los releases oficiales del repositorio de GitHub (`WolfTeI/wolftei-autogestion`). Si detecta una versión más nueva que la instalada, descarga el binario y aplica la actualización de manera transparente.

---

## 4. Módulos de WolfTeI Web (Portal Público)

### 4.1 Visor Interactivo y Firma de Propuestas (`/propuesta/:token`)
- **Ruta:** `https://wolftei.com.ar/propuesta/:token`
- **Componente:** `PropuestaComponent` en el repositorio `web`.
- **Experiencia de usuario:**
  - El cliente recibe el link y visualiza su presupuesto de forma moderna y profesional, con el isotipo de WolfTeI, el desglose de módulos cotizados, el plazo de entrega en días corridos y el monto de inversión.
  - Cláusulas de contratación transparentes (50% anticipo para iniciar, 50% contra entrega y testing de conformidad).

### 4.2 Trazabilidad de Lectura (`visto`) y Respaldo Legal con IP
- **Registro de visualización:** Al momento exacto en que el cliente abre la página, si la propuesta estaba en estado `enviado`, cambia de forma desatendida a estado `visto` con la fecha y hora de visualización (`viewedAt`). Esto permite al equipo de ventas saber si el cliente ya la abrió.
- **Firma digital y consentimiento legal:**
  - Al presionar *"Aceptar Propuesta"*, el cliente completa un formulario modal con su Nombre y Apellido y DNI/CUIT.
  - El sistema captura en segundo plano la **dirección IP pública** del dispositivo (vía `api.ipify.org`) y el **User-Agent** de su navegador.
  - Se guardan los datos en Firestore como prueba electrónica inalterable del consentimiento contractual.
  - Se despliegan en pantalla los datos de la cuenta bancaria de WolfTeI para el pago del anticipo y se le entrega un botón de descarga directa del contrato firmado en PDF.

### 4.3 Encuesta de Satisfacción Post-Entrega (`/feedback/:token`)
- **Ruta:** `https://wolftei.com.ar/feedback/:token`
- **Componente:** `FeedbackComponent` en el repositorio `web`.
- **Servicio:** `FeedbackService`.
- **Funcionamiento:**
  - Una vez entregado el proyecto, el cliente recibe su enlace personal para valorar el trabajo.
  - Puede seleccionar de 1 a 5 estrellas y redactar una reseña o sugerencia.
  - El resultado impacta directamente en el proyecto para su posterior aprobación en el panel de autogestión.

---

## 5. Estándares de Seguridad (OWASP & ISO 27001/27002)

Para garantizar la integridad y confidencialidad del negocio y de los clientes, la plataforma sigue estrictamente las siguientes medidas (reflejadas en [SECURITY_REPORT.md](file:///d:/Programacion/Github%20WolTeI/WolfTeI-autogestion/SECURITY_REPORT.md)):

1. **Gestión de Secretos & Cero Fugas en Git (OWASP A02):** Archivos `environment.ts` y `.prod.ts` excluidos del versionado mediante `.gitignore` y auditados para evitar alertas de GitHub Secret Scanning.
2. **Cifrado de Credenciales en Reposo (ISO 27002 - Control 8.24):** Las contraseñas de infraestructura no viajan ni se guardan en texto claro; se utiliza AES-256-GCM con claves maestras locales.
3. **Control de Acceso y Mínimo Privilegio (OWASP A01):** Rutas administrativas resguardadas por `authGuard`. Escrituras en Firebase Firestore restringidas por reglas de seguridad de `firestore.rules`.
4. **Respaldo de Auditoría:** Registro de direcciones IP, User-Agent y sellos de tiempo ISO 8601 en toda aceptación de contratos y pagos.
