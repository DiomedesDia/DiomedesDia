# 📚 Study Buddy · Calendar

Aplicación web que se conecta a **tu Google Calendar** para ayudarte a organizar el estudio:

- 🔔 **Recordatorios con alarma**: detecta eventos que suenan a "estudiar", "parcial", "examen", etc. (o los marcás vos manualmente) y te avisa con sonido + notificación del navegador X minutos antes.
- ⏱️ **Cronómetro de estudio**: cronómetro por materia/tema, con historial del día guardado en tu dispositivo.
- ✅ **Objetivos diarios**: checklist de metas del día con barra de progreso, sincronizado como eventos en tu Google Calendar (uno por objetivo, para el día de hoy).
- 🗓️ **Horario semanal**: cargá tus clases (materia, día, hora, lugar/profesor) y sincronizalas como eventos recurrentes semanales en tu Google Calendar con un clic.

Es una app 100% de cliente (React + Vite): no hay backend ni base de datos, tus datos de cronómetro y objetivos quedan guardados en el `localStorage` de tu navegador. La app puede **leer, crear, editar y borrar eventos** en tu Google Calendar (permiso `calendar.events`); no toca la configuración de tus calendarios ni nada fuera de eventos.

> Cada objetivo diario que agregás crea un evento de un solo día (hoy), no recurrente — así que solo va quedando dentro de la semana en la que lo fuiste anotando, sin acumular eventos futuros. Al marcarlo como hecho, el evento se actualiza con un ✅; al borrar el objetivo en la app, se borra también el evento.

> ⚠️ Los recordatorios se agendan con temporizadores del navegador, así que solo suenan **mientras la pestaña esté abierta**. No hay notificaciones push en segundo plano (eso requeriría un backend con Google Calendar Push Notifications, que no está incluido en esta versión).

## 1. Crear las credenciales de Google (una sola vez)

1. Entrá a [Google Cloud Console](https://console.cloud.google.com/) y creá un proyecto (o usá uno existente).
2. Andá a **APIs y servicios → Biblioteca**, buscá **Google Calendar API** y habilitala.
3. Andá a **Google Auth Platform** (antes se llamaba "Pantalla de consentimiento OAuth"):
   - En **Información de la marca**: nombre de la app y tu correo de contacto.
   - En **Público**: tipo de usuario **Externo**, y agregá tu Gmail en "Usuarios de prueba" (mientras la app no esté publicada/verificada, solo esas cuentas pueden conectarse).
   - En **Acceso a los datos** → "Agregar o quitar permisos" → buscá "Google Calendar API" y marcá el scope `.../auth/calendar.events` (View and edit events on all your calendars). Guardá.
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

Abrí `http://localhost:5173`, hacé clic en **"Conectar con Google Calendar"** e iniciá sesión con la cuenta cuyo calendario querés usar (si la app de Google Cloud está en modo "Prueba", tu cuenta debe estar en la lista de usuarios de prueba del paso 3).

## 3. Cómo usarla

- **Recordatorios**: en la lista de eventos, cada evento tiene un checkbox. Los que parecen de estudio (examen, parcial, tarea…) ya vienen tildados; podés activar/desactivar cualquiera a mano. Elegí con cuánta anticipación querés el aviso (justo a la hora, 15 min antes, 1 hora antes, etc.).
- **Cronómetro**: escribí qué estás estudiando, iniciá el cronómetro, pausalo cuando quieras y "Terminar y guardar" para registrar la sesión. Vas a ver el total de horas estudiadas hoy y el detalle por sesión.
- **Objetivos diarios**: agregá tus metas del día, marcalas como completadas y mirá tu progreso con la barra. Se reinician automáticamente cada día (quedan guardadas por fecha). Si estás conectado con Google, cada objetivo aparece también como evento en tu calendario (ícono 📅 junto al objetivo cuando ya se sincronizó).
- **Horario semanal**: la sección viene precargada con un horario de ejemplo (podés borrarlo y cargar el tuyo con el formulario: materia, día, hora de inicio/fin y lugar u profesor opcional). Con "Agregar clase" se guarda localmente; para que además cree el evento recurrente en Google Calendar necesitás estar conectado — si agregaste clases antes de conectarte, tocá el botón **"Sincronizar (N)"** que aparece arriba de la lista para crearlas todas de una. Cada clase se guarda como un evento que se repite todas las semanas el mismo día y horario; borrar la clase en la app borra también el evento (y todas sus repeticiones futuras) en el calendario.

### Si ya habías conectado la app antes

El permiso cambió (antes era de solo lectura, ahora incluye crear/editar eventos), así que Google te va a pedir iniciar sesión de nuevo la próxima vez que hagas clic en "Conectar con Google Calendar" para autorizar el nuevo alcance.

## Estructura del proyecto

```
src/
  components/     UI: login, lista de eventos, alarma, cronómetro, objetivos, horario semanal
  hooks/          useGoogleAuth (OAuth), useCalendarEvents, useReminders, useLocalStorage
  utils/          alarma (sonido + notificaciones), detección de eventos de estudio, formato de fechas,
                  llamadas de escritura a Google Calendar (crear/editar/borrar eventos)
```

## Producción

```bash
npm run build
npm run preview
```

Al desplegar, recordá agregar el dominio final a los **Orígenes autorizados de JavaScript** en Google Cloud Console.
