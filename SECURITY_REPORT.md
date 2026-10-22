# SECURITY_REPORT.md - WolfTeI Autogestión

## 1. Auditoría de Stack y Dependencias

| Tecnología / Dependencia | Propósito en el Proyecto | Contribución a la Seguridad |
| :--- | :--- | :--- |
| **Angular v22** | Framework SPA con Standalone Components | Protección nativa contra Cross-Site Scripting (XSS) mediante contexto de interpolación segura y enlaces de propiedades DOM tipados. |
| **Firebase JS SDK (v10+)** | Conexión directa a Google Cloud Firestore y Auth | Aislamiento y comunicación cifrada de nivel bancario (TLS 1.3). SDK modular que evita inclusión de código no utilizado (tree-shaking). |
| **Firebase Authentication** | Gestión descentralizada de identidades | Almacenamiento y verificación de contraseñas mediante hashing scrypt seguro de Google, con tokens JWT / ID Tokens firmados con rotación periódica automática. |
| **Google Cloud Firestore** | Base de datos documental NoSQL serverless | Control granular de acceso por documento y atributo validado en el borde mediante `firestore.rules`. Protección nativa contra inyecciones SQL/NoSQL. |
| **Tauri v2** | Entorno de ejecución Desktop (Rust) | Restricción estricta de IPC entre la webview y el sistema operativo, impidiendo acceso a comandos arbitrarios del sistema y delimitando el origen. |
| **Angular Material** | Componentes de Interfaz de Usuario | Validaciones de formulario reactivas y accesibles que impiden el envío de datos con formatos maliciosos o inconsistentes. |
| **Web Crypto API (SubtleCrypto)** | Criptografía nativa del navegador (CSPRNG) | Generación de identificadores de propuestas (`wlf-XXXXXX`) y encuestas (`srv-XXXXXX`) con entropía segura a través de `crypto.getRandomValues()`. |

---

## 2. Mapa de Seguridad y Acceso a Datos (Firestore & Auth)

Con la migración directa a Firebase, el control de acceso se rige por las políticas declarativas de `firestore.rules`:

| Recurso / Colección | Nivel de Seguridad | Mecanismo de Control | Servicio Responsable |
| :--- | :--- | :--- | :--- |
| **Firebase Auth** | Público / Controlado | `signInWithEmailAndPassword`, `signOut` | `AuthService` |
| `/clients/{id}` | **Privado** | Requiere sesión activa (`request.auth != null`) | `ClientesService` |
| `/projects/{id}` | **Privado** / Mixto | Lectura privada o mediante token de encuesta (`reviewToken`) | `ProyectosService` |
| `/payments/{id}` | **Privado** | Requiere sesión activa (`request.auth != null`) | `PagosService` |
| `/proposals/{id}` | **Privado** / Mixto | Creación/Edición requiere `request.auth != null`. Lectura pública por `token`. Aceptación legal de clientes restringida a campos de firma. | `PropuestasService` |
| `/contacto/{id}` | **Público (Escritura)** / **Privado (Lectura)** | Creación abierta con validación de tipo de datos; lectura y borrado restringidos a `request.auth != null`. | `ContactoService` |
| `/usuarios/{id}` | **Privado (Lectura)** / **Denegado (Escritura)** | Lista blanca de operadores autorizados (RBAC). Lectura para verificación de identidad (`request.auth != null`), escritura bloqueada (`false`). | `AuthService` / Firebase Rules |

---

## 3. Estrategia de Sanitización y Validación

1. **Prevención contra SQL / NoSQL Injection (OWASP A03):**
   * Al utilizar los métodos tipados de Firestore (`doc`, `getDoc`, `query`, `where`), no existen concatenaciones de strings para consultas. Los parámetros son tratados de forma estricta como literales de búsqueda dentro del motor de base de datos.
2. **Prevención de Cross-Site Scripting (XSS - OWASP A03):**
   * Todas las interpolaciones en plantillas de Angular (`{{}}`) y bindings de propiedades (`[value]`, `[disabled]`) sanitizan el contenido contra código ejecutable HTML/JS.
   * Los formularios reactivos de Angular (`ReactiveFormsModule`) validan tipos, obligatoriedad y longitudes mínimas en el cliente.
3. **Manejo Seguro de Identificadores y Tokens (OWASP A02):**
   * Ningún token sensible se genera mediante `Math.random()`. Se utiliza exclusivamente `crypto.getRandomValues()` de la Web Crypto API.
4. **Transporte Seguro (ISO 27001 - Control 8.24):**
   * Toda la comunicación entre la aplicación Tauri / Angular y los servidores de Google Firebase se transmite cifrada mediante TLS 1.3 forzado.

---

## 4. Matriz de Prevención de Vulnerabilidades (OWASP Top 10)

| Vulnerabilidad | Tipo de Ataque Prevenido | Medida Implementada |
| :--- | :--- | :--- |
| **A01: Broken Access Control** | Lectura o manipulación no autorizada de cotizaciones, clientes y proyectos | Matriz de permisos en `firestore.rules` con denegación por defecto (`allow read, write: if false;`) y verificación de identidad `request.auth != null`. |
| **A02: Cryptographic Failures** | Predicción de tokens de propuestas o interceptación de credenciales | Pre-requisito de TLS 1.3 nativo de Firebase, uso de CSPRNG (`crypto.getRandomValues()`) y delegación del ciclo de vida de tokens a Firebase Auth. |
| **A03: Injection** | Inyecciones en formularios o parámetros de consulta | SDK de Firestore con parámetros fuertemente tipados y parseo de tipos en Angular. |
| **A07: Identification and Authentication Failures** | Fuerza bruta o robo de credenciales | Autenticación gestionada por Firebase Auth con bloqueo ante intentos repetidos y rotación periódica de tokens JWT. |
| **A08: Software and Data Integrity Failures** | Adulteración de firmas o contratos en local | Empaquetado estático y compilado de la firma oficial (`firma-oficial.ts`) y validación estricta en base de datos. |
