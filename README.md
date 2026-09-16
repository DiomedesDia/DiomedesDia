# 📚 Study Buddy · Calendar

Aplicación web que se conecta a **tu Google Calendar** para ayudarte a organizar el estudio:

- 🔔 **Recordatorios con alarma**: detecta eventos que suenan a "estudiar", "parcial", "examen", etc. (o los marcás vos manualmente) y te avisa con sonido + notificación del navegador X minutos antes.
- ⏱️ **Cronómetro de estudio**: cronómetro por materia/tema, con historial del día guardado en tu dispositivo.
- ✅ **Objetivos y eventos puntuales**: agregá desde la misma lista un objetivo del día, un parcial o una entrega de proyecto en cualquier fecha futura, con hora opcional. Quedan mezclados ahí como uno más (con el ícono 📌), en vez de una lista aparte.
- 🗓️ **Horario semanal**: cargá tus clases (materia, día, hora, lugar/profesor) y sincronizalas como eventos recurrentes semanales en tu Google Calendar con un clic.
- 👥 **Varias cuentas de Google a la vez**: vinculá más de una cuenta (por ejemplo, tu personal y la del cole/facultad). "Próximos eventos" muestra la mezcla de las dos, y todo lo que agregues desde la app (objetivos, parciales, entregas, horario) se crea en el calendario de **todas** las cuentas vinculadas al mismo tiempo.

Es una app 100% de cliente (React + Vite): no hay backend ni base de datos, tus datos de cronómetro quedan guardados en el `localStorage` de tu navegador; los objetivos, parciales/entregas y el horario viven directamente en tu Google Calendar. La app puede **leer, crear, editar y borrar eventos** en tu Google Calendar (permiso `calendar.events`); no toca la configuración de tus calendarios ni nada fuera de eventos.

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

## 3. Cómo usarla

- **Recordatorios**: en la lista de eventos, cada evento tiene un checkbox. Los que parecen de estudio (examen, parcial, tarea…) ya vienen tildados; podés activar/desactivar cualquiera a mano. Elegí con cuánta anticipación querés el aviso (justo a la hora, 15 min antes, 1 hora antes, etc.).
- **Cronómetro**: escribí qué estás estudiando, iniciá el cronómetro, pausalo cuando quieras y "Terminar y guardar" para registrar la sesión. Vas a ver el total de horas estudiadas hoy y el detalle por sesión.
- **Objetivos y eventos puntuales**: arriba de la lista de eventos hay un formulario con título, fecha y hora (opcional). Dejá la hora vacía para un objetivo o entrega de "todo el día", o cargala para un parcial a una hora exacta. Al tocar "Agregar" se crea el evento en el Google Calendar de **todas tus cuentas vinculadas** (en la fecha que elegiste, no solo hoy) y aparece al toque mezclado con el resto de tus eventos (con el ícono 📌; si tenés más de una cuenta vinculada, cada evento muestra a qué cuenta pertenece). Podés activarle recordatorio como a cualquier otro evento, y borrarlo con el ✕ que solo aparece en los que creó la app (borra nada más la copia de esa cuenta puntual).
- **Horario semanal**: la sección viene precargada con un horario de ejemplo (podés borrarlo y cargar el tuyo con el formulario: materia, día, hora de inicio/fin y lugar u profesor opcional). Con "Agregar clase" se guarda localmente; tocando **"Sincronizar (N)"** se crea el evento recurrente en el calendario de todas tus cuentas vinculadas que todavía no lo tengan. El ícono 📅 indica sincronizado con todas; "📅 1/2" indica que falta alguna cuenta. El ✎ de cada clase la abre para editar (materia, día, hora o lugar) — sirve tanto para corregir un dato como para posponerla a otro horario; al guardar, si ya estaba sincronizada, actualiza el evento existente (todas las repeticiones futuras) en vez de crear uno nuevo. Borrar la clase en la app borra el evento (y todas sus repeticiones futuras) en el calendario de cada cuenta donde se había sincronizado.
- **Vincular varias cuentas**: el botón "Vincular otra cuenta" siempre te deja elegir una cuenta de Google distinta (o la misma, para renovar el acceso). Cada cuenta vinculada aparece como una etiqueta con una ✕ para desvincularla. Mientras tengas más de una vinculada, todo lo que agregues desde la app se copia a todas.

### Si ya habías conectado la app antes

El permiso cambió (antes solo pedía leer/escribir eventos; ahora también pide tu email, para poder distinguir cuentas), así que Google te va a pedir vincular de nuevo la próxima vez que hagas clic en "Conectar con Google Calendar" para autorizar el nuevo alcance. Lo que ya tenías sincronizado en tu horario se migra automáticamente a la primera cuenta que vincules después de este cambio, así que no se pierde.

## Estructura del proyecto

```
src/
  components/     UI: cuentas vinculadas, lista de eventos (incluye alta de objetivos), alarma, cronómetro, horario semanal
  hooks/          useGoogleAccounts (OAuth multi-cuenta), useCalendarEvents, useReminders, useLocalStorage
  utils/          alarma (sonido + notificaciones), detección de eventos de estudio, formato de fechas,
                  llamadas de escritura a Google Calendar (crear/editar/borrar eventos)
```

## Producción

```bash
npm run build
npm run preview
```

Al desplegar, recordá agregar el dominio final a los **Orígenes autorizados de JavaScript** en Google Cloud Console.
