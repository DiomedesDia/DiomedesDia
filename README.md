# 📚 Study Buddy · Calendar

Aplicación web que se conecta a **tu Google Calendar** para ayudarte a organizar el estudio:

- 🔔 **Recordatorios con alarma**: detecta eventos que suenan a "estudiar", "parcial", "examen", etc. (o los marcás vos manualmente) y te avisa con sonido + notificación del navegador X minutos antes.
- ⏱️ **Cronómetro de estudio**: cronómetro por materia/tema, con historial del día guardado en tu dispositivo.
- ✅ **Objetivos diarios**: checklist de metas del día con barra de progreso.

Es una app 100% de cliente (React + Vite): no hay backend ni base de datos, tus datos de cronómetro y objetivos quedan guardados solo en el `localStorage` de tu navegador. La conexión con Google Calendar es de **solo lectura**.

> ⚠️ Los recordatorios se agendan con temporizadores del navegador, así que solo suenan **mientras la pestaña esté abierta**. No hay notificaciones push en segundo plano (eso requeriría un backend con Google Calendar Push Notifications, que no está incluido en esta versión).

## 1. Crear las credenciales de Google (una sola vez)

1. Entrá a [Google Cloud Console](https://console.cloud.google.com/) y creá un proyecto (o usá uno existente).
2. Andá a **APIs y servicios → Biblioteca**, buscá **Google Calendar API** y habilitala.
3. Andá a **APIs y servicios → Pantalla de consentimiento OAuth**:
   - Tipo de usuario: **Externo** (si es solo para vos, podés dejarlo en modo "Prueba" y agregarte como usuario de prueba).
   - Completá nombre de la app y correo de contacto.
4. Andá a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
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
- **Objetivos diarios**: agregá tus metas del día, marcalas como completadas y mirá tu progreso con la barra. Se reinician automáticamente cada día (quedan guardadas por fecha).

## Estructura del proyecto

```
src/
  components/     UI: login, lista de eventos, alarma, cronómetro, objetivos
  hooks/          useGoogleAuth (OAuth), useCalendarEvents, useReminders, useLocalStorage
  utils/          alarma (sonido + notificaciones), detección de eventos de estudio, formato de fechas
```

## Producción

```bash
npm run build
npm run preview
```

Al desplegar, recordá agregar el dominio final a los **Orígenes autorizados de JavaScript** en Google Cloud Console.
