# Bot — UTN SISTEMAS · INGRESANTES 2027

Bot de Discord para el servidor de estudio del ingreso a Ingeniería en Sistemas de Información (UTN FRC).

## Funciones

| Módulo | Qué hace |
|---|---|
| Moderación | Advertencias con historial persistente, timeouts, expulsión, baneo, purga de mensajes |
| Automoderación | Bloquea invitaciones externas, menciones masivas y spam por frecuencia |
| Bienvenidas | Embed de bienvenida + asignación automática de rol de miembro |
| Anuncios | `/anuncio` con cuatro formatos (general, académico, urgente, evento) |
| Fechas importantes | Recordatorios automáticos a 30, 14, 7, 3 y 1 día, y el mismo día (09:00 ART) |
| Salas de voz temporales | Canal "Únete para crear" con control de nombre y límite por el dueño |
| Salas privadas | Canales de texto privados con invitación y expulsión manual |
| Autoroles | Paneles de botones para roles autoasignables |
| Encuestas | Votación con botones, barras de progreso y resultados en vivo |
| Feeds | Publica automáticamente novedades RSS de fuentes oficiales |

## Instalación

1. **Crear la aplicación**
   - Entrá a https://discord.com/developers/applications → *New Application*.
   - En **Bot**, generá el token y activá los tres *Privileged Gateway Intents*: `PRESENCE`, `SERVER MEMBERS` y `MESSAGE CONTENT`.
   - En **OAuth2 → URL Generator**, marcá los scopes `bot` y `applications.commands`, y los permisos: *Manage Roles*, *Manage Channels*, *Kick Members*, *Ban Members*, *Moderate Members*, *Manage Messages*, *Move Members*, *Send Messages*, *Embed Links*, *Read Message History*.
   - Invitá el bot con la URL generada.

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables**
   ```bash
   cp .env.example .env
   ```
   Completá el archivo `.env`. Para copiar IDs, activá *Ajustes de usuario → Avanzado → Modo desarrollador* en Discord y usá clic derecho → *Copiar ID* sobre cada canal, rol o categoría.

4. **Registrar los comandos**
   ```bash
   npm run deploy
   ```

5. **Iniciar el bot**
   ```bash
   npm start
   ```

## Configuración crítica

- **Posición del rol del bot**: en *Ajustes del servidor → Roles*, el rol del bot debe estar **por encima** de todos los roles que vaya a asignar o moderar. Sin esto, autoroles y moderación fallan.
- **VOICE_HUB_ID**: es el ID del canal de voz "Únete para crear" que ya tenés.
- **VOICE_CATEGORY_ID**: categoría donde se generan las salas temporales.
- **PRIVATE_CATEGORY_ID**: categoría donde se crean las salas privadas de texto.

## Comandos

### Moderación (requiere permiso *Moderar miembros*)
```
/mod advertir usuario:@alguien motivo:"texto"
/mod historial usuario:@alguien
/mod limpiar-historial usuario:@alguien
/mod silenciar usuario:@alguien duracion:1h motivo:"texto"
/mod expulsar usuario:@alguien motivo:"texto"
/mod banear usuario:@alguien motivo:"texto" [borrar-dias:0-7]
/mod purgar cantidad:50 [usuario:@alguien]
```

### Utilidad
```
/anuncio titulo:"..." mensaje:"..." [tipo] [canal] [mencionar] [enlace] [imagen]
/fecha agregar titulo:"Examen de Matemática" fecha:2026-12-09 [descripcion] [canal]
/fecha listar
/fecha eliminar id:3
/encuesta pregunta:"..." opcion1:"..." opcion2:"..." [opcion3-10] [multiple]
/autoroles titulo:"..." descripcion:"..." rol1:@Rol [rol2-10] [estilo] [canal]
```

### Salas
```
/sala privada nombre:"grupo-matematica"
/sala invitar usuario:@alguien
/sala expulsar usuario:@alguien
/sala cerrar
/sala renombrar nombre:"Repaso de Física"     ← dentro de tu sala de voz
/sala limite cantidad:6                        ← dentro de tu sala de voz
```

## Carga inicial de fechas

```
/fecha agregar titulo:"Examen de Matemática" fecha:2026-12-09
/fecha agregar titulo:"Examen de Introducción a la Universidad" fecha:2026-12-11
/fecha agregar titulo:"Examen de Física" fecha:2026-12-15
```

## Redes oficiales

Instagram y X/Twitter cerraron el acceso público a sus APIs, así que **no es posible leer sus publicaciones automáticamente sin un servicio pago**. Alternativas:

1. **RSS del sitio oficial** — si la UTN FRC o el Centro de Estudiantes publican en un sitio con RSS, cargá las URLs en `FEED_URLS` y el bot publica cada novedad automáticamente.
2. **Replicación manual** — usá `/anuncio` para reenviar lo que se publique en redes. Es lo más confiable.
3. **Webhooks de terceros** — servicios como IFTTT o Zapier pueden enviar publicaciones a un webhook de Discord, sin depender de este bot.

Para verificar si un sitio tiene RSS, probá agregar `/feed/` o `/rss` al final de la URL.

## Persistencia

Los datos se guardan en `data/bot.db` (SQLite). Hacé backup de ese archivo periódicamente: contiene historial de sanciones, fechas cargadas y encuestas.

## Hosting

El bot necesita correr 24/7. Opciones: un VPS (el más barato alcanza de sobra), Railway, o una Raspberry Pi. No funciona en hosting web compartido tipo Hostinger básico, porque requiere un proceso Node persistente.
