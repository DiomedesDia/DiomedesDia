# 📚 Study Buddy · Calendar

Aplicación web que se conecta a **tu Google Calendar** para ayudarte a organizar el estudio:

- 🔔 **Recordatorios con alarma**: detecta eventos que suenan a "estudiar", "parcial", "examen", etc. (o los marcás vos manualmente) y te avisa con sonido + notificación del navegador X minutos antes.
- ⏱️ **Cronómetro de estudio**: cronómetro por materia/tema, con historial del día guardado en tu dispositivo.
- ✅ **Objetivos y eventos puntuales**: agregá desde la misma lista un objetivo del día, un parcial o una entrega de proyecto en cualquier fecha futura, con hora opcional. Quedan mezclados ahí como uno más (con el ícono 📌), en vez de una lista aparte.
- 🗓️ **Horario semanal**: cargá tus clases (materia, día, hora, lugar/profesor) y sincronizalas como eventos recurrentes semanales en tu Google Calendar con un clic.
- 👥 **Varias cuentas de Google a la vez**: vinculá más de una cuenta (por ejemplo, tu personal y la del cole/facultad). "Próximos eventos" muestra la mezcla de las dos, y todo lo que agregues desde la app (objetivos, parciales, entregas, horario) se crea en el calendario de **todas** las cuentas vinculadas al mismo tiempo.
- 🤖 **Asistente de calendario con IA**: el botón flotante abre un chat (con Gemini, de Google — gratis) al que le podés pedir cosas en lenguaje natural — "agregame un parcial de física el jueves a las 3pm", "posponé mi clase del lunes para el miércoles", "borrá la entrega que agregué ayer" — y el asistente decide qué crear/editar/borrar y lo hace por vos. Requiere un pequeño servidor propio (incluido) y tu clave gratis de la API de Gemini — ver la sección de configuración más abajo.
- 🎙️ **Asistente virtual con voz**: apenas cargan tus eventos te saluda solo y te resume el día (sin gastar la API — es un mensaje armado localmente), sin que tengas que preguntarle nada. Le podés hablar con el micrófono 🎤 en vez de escribir, y te responde en voz alta (🔊, silenciable con un clic) — como un Siri/Alexa casero para tu calendario.

La lectura y escritura de tu Google Calendar es 100% desde tu navegador (no hay backend de por medio ni tus datos de calendario pasan por ningún servidor propio): tus datos de cronómetro quedan guardados en el `localStorage` de tu navegador; los objetivos, parciales/entregas y el horario viven directamente en tu Google Calendar. La app puede **leer, crear, editar y borrar eventos** en tu Google Calendar (permiso `calendar.events`); no toca la configuración de tus calendarios ni nada fuera de eventos. El asistente de IA sí necesita un pequeño servidor propio (incluido en este repo) — es el único componente no-100%-cliente de la app, y existe solo para no exponer tu clave de la API de Gemini en el navegador.

> Cada evento que agregás así (objetivo, parcial, entrega…) queda en la fecha que elijas, con hora si la pusiste o como "todo el día" si la dejaste vacía. Aparece mezclado en "Próximos eventos" con el ícono 📌; borrarlo desde ahí (✕) borra también el evento real en tu calendario.

> ⚠️ Los recordatorios se agendan con temporizadores del navegador, así que solo suenan **mientras la pestaña esté abierta**. No hay notificaciones push en segundo plano (eso requeriría un backend con Google Calendar Push Notifications, que no está incluido en esta versión).

## 1. Crear las credenciales de Google (una sola vez)

1. Entrá a [Google Cloud Console](https://console.cloud.google.com/) y creá un proyecto (o usá uno existente).
2. Andá a **APIs y servicios → Biblioteca**, buscá **Google Calendar API** y habilitala.
3. Andá a **Google Auth Platform** (antes se llamaba "Pantalla de consentimiento OAuth"):
   - En **Información de la marca**: nombre de la app y tu correo de contacto.
   - En **Público**: tipo de usuario **Externo**, y agregá tu Gmail en "Usuarios de prueba" (mientras la app no esté publicada/verificada, solo esas cuentas pueden conectarse).
   - En **Acceso a los datos** → "Agregar o quitar permisos" → buscá "Google Calendar API" y marcá el scope `.../auth/calendar.events` (View and edit events on all your calendars). También marcá `.../auth/userinfo.email` (o "email" — suele estar en una sección aparte, no bajo "Google Calendar API"; sirve solo para que la app sepa qué cuenta acabás de vincular y no la vuelva a agregar dos veces). Guardá.
4. Andá a **Clientes** (antes "Credenciales") → **Crear cliente**:
   - Tipo de aplicación: **Aplicación web**.
   - En **Orígenes autorizados de JavaScript** agregá:
     - `http://localhost:5173` (para desarrollo local)
     - la URL donde vayas a alojar la app en producción, si aplica.
   - Guardá y copiá el **Client ID** generado (termina en `.apps.googleusercontent.com`).

## 2. Configurar el proyecto

```bash
cp .env.example .env
# Editá .env y pegá tu Client ID:
# VITE_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com

npm install
npm run dev
```

Abrí `http://localhost:5173`, hacé clic en **"Conectar con Google Calendar"** e iniciá sesión con la cuenta cuyo calendario querés usar (si la app de Google Cloud está en modo "Prueba", tu cuenta debe estar en la lista de usuarios de prueba del paso 3). Repetí con **"Vincular otra cuenta"** para agregar cuentas adicionales.

`npm run dev` ahora arranca **dos** procesos a la vez (el frontend en `:5173` y el servidor del asistente en `:3001`) — vas a ver los logs de ambos, con el prefijo `web` o `agent`, en la misma terminal. Si el asistente de IA no te interesa, no pasa nada: podés dejar el paso 3 sin hacer y el resto de la app funciona igual (el botón 🤖 va a avisar que falta configurarlo).

## 3. Configurar el asistente de IA (opcional, gratis)

El botón flotante 🤖 abre un chat con un asistente que puede crear, editar y borrar tus eventos/horario por vos, en lenguaje natural. Corre sobre la API de **Gemini** (Google) a través de un servidor chiquito incluido en `server/index.js` — así tu clave de API nunca se expone en el navegador.

1. Conseguí una clave **gratis** en [aistudio.google.com/apikey](https://aistudio.google.com/apikey) con tu cuenta de Google (la misma que ya usás, o cualquier otra). El nivel gratis de Gemini alcanza de sobra para uso personal — no hace falta poner tarjeta.
2. Agregala a tu `.env` (el mismo archivo de antes, **sin** el prefijo `VITE_` — así Vite nunca la incluye en el código que baja al navegador):
   ```
   GEMINI_API_KEY=tu-clave-real
   ```
3. Reiniciá `npm run dev`. Si te falta la clave, vas a ver un aviso `⚠️ Falta GEMINI_API_KEY` en la consola del servidor del agente, y el chat de la app te va a avisar que no está configurado.

Si no querés usar el asistente, simplemente no completes este paso — el resto de la app (calendario, cronómetro, horario) funciona sin él.

## 4. Cómo usarla

- **Recordatorios**: la lista de eventos está agrupada por día ("Hoy", "Mañana", y después por fecha) y cada evento tiene un checkbox. Los que parecen de estudio (examen, parcial, tarea…) ya vienen tildados; podés activar/desactivar cualquiera a mano. Elegí con cuánta anticipación querés el aviso (justo a la hora, 15 min antes, 1 hora antes, etc.). Si tenés varias cuentas vinculadas y el mismo evento (mismo título y horario) existe en más de una, la lista lo muestra **una sola vez** con la etiqueta "en tus N cuentas" en vez de repetirlo — tildar el recordatorio ahí lo activa en todas las copias a la vez.
- **Cronómetro**: escribí qué estás estudiando, iniciá el cronómetro, pausalo cuando quieras y "Terminar y guardar" para registrar la sesión. Vas a ver el total de horas estudiadas hoy y el detalle por sesión.
- **Objetivos y eventos puntuales**: arriba de la lista de eventos hay un formulario con título, fecha y hora (opcional). Dejá la hora vacía para un objetivo o entrega de "todo el día", o cargala para un parcial a una hora exacta. Al tocar "Agregar" se crea el evento en el Google Calendar de **todas tus cuentas vinculadas** (en la fecha que elegiste, no solo hoy) y aparece al toque mezclado con el resto de tus eventos (con el ícono 📌; si tenés más de una cuenta vinculada, cada evento muestra a qué cuenta pertenece). Podés activarle recordatorio como a cualquier otro evento, y borrarlo con el ✕ que solo aparece en los que creó la app (borra nada más la copia de esa cuenta puntual).
- **Horario semanal**: la sección viene precargada con un horario de ejemplo (podés borrarlo y cargar el tuyo con el formulario: materia, día, hora de inicio/fin y lugar u profesor opcional). Con "Agregar clase" se guarda localmente; tocando **"Sincronizar (N)"** se crea el evento recurrente en el calendario de todas tus cuentas vinculadas que todavía no lo tengan. El ícono 📅 indica sincronizado con todas; "📅 1/2" indica que falta alguna cuenta. El ✎ de cada clase la abre para editar (materia, día, hora o lugar) — sirve tanto para corregir un dato como para posponerla a otro horario; al guardar, si ya estaba sincronizada, actualiza el evento existente (todas las repeticiones futuras) en vez de crear uno nuevo. Borrar la clase en la app borra el evento (y todas sus repeticiones futuras) en el calendario de cada cuenta donde se había sincronizado.
  - **Si el horario queda duplicado o desincronizado en Google Calendar** (por ejemplo, después de vincular/desvincular cuentas o de una versión vieja de la app que perdió el rastro de qué ya estaba creado): primero borrá a mano los eventos de más o viejos directamente en Google Calendar, y después usá el aviso **"¿Tu horario quedó duplicado...?"** que aparece arriba de la lista — marca todas las clases como "sin sincronizar" (sin tocar nada en Google Calendar) para que un solo "Sincronizar" las vuelva a crear limpias.
- **Vincular varias cuentas**: el botón "Vincular otra cuenta" siempre te deja elegir una cuenta de Google distinta (o la misma, para renovar el acceso). Cada cuenta vinculada aparece como una etiqueta con una ✕ para desvincularla. Mientras tengas más de una vinculada, todo lo que agregues desde la app se copia a todas.
- **Asistente de calendario (🤖, abajo a la derecha)**: escribile en lenguaje natural — "agregame un parcial de física el jueves a las 3pm", "¿qué tengo esta semana?", "posponé la clase de sistemas del lunes para el miércoles a las 4pm". El asistente ve tu horario y tus próximos eventos como contexto y usa las mismas acciones que los formularios (crear/editar/borrar eventos y clases); si algo es ambiguo, te va a preguntar en vez de adivinar. Necesita el paso 3 de configuración hecho.
- **Saludo automático**: la primera vez que abrís la app (con al menos una cuenta vinculada), el asistente te avisa solo con un puntito rojo en el botón 🤖 y, al abrirlo, un mensaje con el resumen del día — no hace falta preguntarle nada. Este saludo se genera localmente (no gasta tu cuota de Gemini), así que es instantáneo.
- **Hablar en vez de escribir**: si tu navegador soporta reconocimiento de voz (Chrome/Edge tienen el mejor soporte; Safari parcial; Firefox no lo soporta), vas a ver un botón 🎤 junto al campo de texto del chat — tocalo, hablá, y se envía solo. Las respuestas del asistente también se leen en voz alta; podés silenciarlas con el botón 🔊/🔇 en la esquina del chat (se recuerda tu preferencia).

### Si ya habías conectado la app antes

El permiso cambió (antes solo pedía leer/escribir eventos; ahora también pide tu email, para poder distinguir cuentas), así que Google te va a pedir vincular de nuevo la próxima vez que hagas clic en "Conectar con Google Calendar" para autorizar el nuevo alcance. Lo que ya tenías sincronizado en tu horario se migra automáticamente a la primera cuenta que vincules después de este cambio, así que no se pierde.

## Estructura del proyecto

```
src/
  components/     UI: cuentas vinculadas, lista de eventos (incluye alta de objetivos), alarma, cronómetro,
                  horario semanal, chat del asistente de IA
  hooks/          useGoogleAccounts (OAuth multi-cuenta), useCalendarEvents, useReminders, useLocalStorage,
                  useClassSchedule (horario semanal), useAgentChat (conversación + ejecución de herramientas)
  utils/          alarma (sonido + notificaciones), detección de eventos de estudio, formato de fechas,
                  llamadas de escritura a Google Calendar (crear/editar/borrar eventos)
server/
  index.js        servidor del asistente de IA: recibe el mensaje + el contexto del calendario desde el
                  navegador, llama a la API de Gemini con las herramientas de calendario, y devuelve la
                  respuesta (nunca ejecuta acciones de Google Calendar él mismo — eso lo hace el navegador,
                  que es quien tiene el token de acceso de cada cuenta)
```

## Producción

```bash
npm run build
npm run preview
```

Esto compila y sirve el frontend, pero **no** el servidor del agente — para desplegarlo necesitás correr `server/index.js` (con `GEMINI_API_KEY` configurada) en algún lado accesible desde donde sirvas el frontend, y actualizar la URL de `/api` en `vite.config.ts` o el proxy de tu hosting para que apunte ahí.

Al desplegar, recordá agregar el dominio final a los **Orígenes autorizados de JavaScript** en Google Cloud Console.
