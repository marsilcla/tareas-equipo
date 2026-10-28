# Tareas del equipo

App web instalable (PWA) para las tareas del día del equipo, con casillas y avisos push.

- Datos: Supabase (proyecto dedar-kebab, tablas `tareas_*`, acceso solo con el código del equipo).
- Avisos: función `supabase/functions/tareas-push` (Web Push con claves VAPID guardadas en `tareas_config`).
- Publicada con GitHub Pages desde la rama `main`.
