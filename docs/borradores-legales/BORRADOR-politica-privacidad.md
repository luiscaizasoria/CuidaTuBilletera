# Política de privacidad de CuidaTuBilletera (BORRADOR, NO PUBLICAR)

> Borrador interno del paso 387. Reemplazar cada `[PENDIENTE: ...]` y recibir la aprobación del usuario antes de publicar. Fecha de última actualización: `[PENDIENTE: fecha de publicación]`.

## 1. Quién es el responsable
- Responsable del tratamiento: `[PENDIENTE: nombre o razón social del responsable, tal como figure en Google Play Console]`.
- Contacto de privacidad y soporte: `[PENDIENTE: correo de soporte]`.
- País o jurisdicción: `[PENDIENTE: a definir por el responsable]`.

## 2. Qué es CuidaTuBilletera
Aplicación móvil para Android que permite llevar el control de gastos e ingresos en cuentas propias, con categorías, historial, calendario, reportes y exportación. Es gratuita, no muestra anuncios y no se conecta con bancos ni con servicios de pago.

## 3. Datos que tratamos
**Datos de tu cuenta de Google (inicio de sesión):** al iniciar sesión con Google recibimos y guardamos tu correo electrónico, tu nombre (si tu cuenta lo tiene) y un identificador estable de tu cuenta de Google (`sub`). No guardamos tu contraseña de Google ni tu foto.

**Datos que tú escribes en la aplicación:** nombres, colores e íconos de tus cuentas; saldos iniciales; categorías; y tus movimientos (monto, fecha, categoría y nota de hasta 500 caracteres). Pueden ser datos financieros personales; la app no los verifica ni los comparte con bancos.

**Datos técnicos de sesión:** guardamos un identificador interno, fechas de creación y un registro cifrado (huella irreversible) de los tokens de sesión para mantenerte conectado y poder cerrar tu sesión.

**En tu teléfono:** los tokens de sesión se guardan en el almacén seguro de Android (Expo SecureStore) y algunas preferencias, como las ayudas que ya cerraste. Los reportes que exportes (CSV o PDF) los guardas o compartes tú y quedan fuera de nuestro control.

**Lo que no recopilamos:** ubicación, contactos, fotos, micrófono, cámara, identificador de publicidad ni datos de otras aplicaciones. `[PENDIENTE: confirmar con el manifiesto final de la AAB y el índice de SDK de Google Play]`.

## 4. Para qué los usamos
Para identificarte, mantener tu sesión, guardar y mostrarte tus cuentas, categorías y movimientos, calcular saldos y reportes y generar tus exportaciones. No los usamos para publicidad, ni para perfilarte, ni los vendemos.

## 5. Con quién se comparten
- **Google:** el inicio de sesión lo gestiona Google (Google Sign-In y Servicios de Google Play), sujeto a su propia política.
- **Cloudflare:** alojamos la API y la base de datos en Cloudflare Workers y D1 como proveedor de infraestructura. `[PENDIENTE: confirmar la región/ubicación de la base de datos y cómo clasificar a Cloudflare en el formulario de seguridad de los datos]`.
- No vendemos ni cedemos tus datos a terceros con fines comerciales.

## 6. Seguridad
La comunicación entre la app y el servidor usa HTTPS. Cada consulta se limita a los datos del usuario que inició sesión. Los tokens de sesión caducan y se renuevan; al cerrar sesión se revocan. Ningún sistema es infalible: `[PENDIENTE: texto de responsabilidad a criterio del responsable]`.

## 7. Cuánto tiempo conservamos tus datos
Conservamos tus datos mientras tengas tu cuenta. Los movimientos que anulas o las cuentas que archivas se conservan para tu historial hasta que elimines tu cuenta. Cuando eliminas tu cuenta, tus datos se borran de la base de datos activa. Después, **copias de recuperación del proveedor de base de datos (Cloudflare D1, función Time Travel) pueden conservar los datos durante un periodo limitado**: `[PENDIENTE: indicar 7 días si el plan es gratuito o 30 días si es de pago, según el plan real de producción; verificado en la documentación de Cloudflare el 2026-10-19]`. Si en el futuro se activan registros del servidor, su retención será `[PENDIENTE: 3 días (plan gratuito) o 7 días (de pago) si se activan]` y no incluirán cuerpos de peticiones ni tus datos financieros.

## 8. Tus derechos y cómo eliminar tu cuenta
- **Eliminar tu cuenta y tus datos desde la app:** Más → Privacidad y datos → «Eliminar mi cuenta y mis datos». Es irreversible y te pedimos confirmar con tu cuenta de Google antes de eliminar.
- **Sin la app:** solicítalo en `[PENDIENTE: URL de la página de eliminación]` o escribe a `[PENDIENTE: correo de soporte]` desde el correo de tu cuenta de Google; verificaremos tu identidad antes de eliminar y responderemos en `[PENDIENTE: plazo comprometido por el responsable]`.
- **Exportar tus datos:** puedes exportar tus movimientos en CSV o PDF desde la app antes de eliminar tu cuenta.
- **Acceso, corrección y otros derechos:** escribe a `[PENDIENTE: correo de soporte]`. `[PENDIENTE: derechos aplicables según la jurisdicción del responsable]`.
- Tu cuenta de Google no se elimina; para retirar el acceso de la app a tu cuenta de Google usa la configuración de tu cuenta de Google.

## 9. Menores de edad
La aplicación no está dirigida a menores. `[PENDIENTE: edad mínima a definir por el responsable y coherente con el público objetivo declarado en Play Console]`.

## 10. Cambios en esta política
Publicaremos aquí cualquier cambio e indicaremos la fecha de actualización. `[PENDIENTE: forma de aviso de cambios sustanciales]`.

## 11. Contacto
`[PENDIENTE: correo de soporte]`
