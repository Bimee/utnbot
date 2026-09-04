import Parser from "rss-parser";
import { EmbedBuilder } from "discord.js";
import { config } from "../config.js";
import { feedEstado } from "../database.js";
import { log } from "../utils/logger.js";

const parser = new Parser({ timeout: 10_000 });

export function iniciarFeeds(client) {
  if (!config.feeds.urls.length || !config.feeds.canal) {
    log.info("Feeds RSS desactivados (falta FEED_URLS o FEED_CHANNEL)");
    return;
  }

  const revisarTodos = () => Promise.all(config.feeds.urls.map((url) => revisar(client, url)));

  revisarTodos();
  setInterval(revisarTodos, config.feeds.intervaloMin * 60_000);
  log.info(`Feeds RSS activos: ${config.feeds.urls.length} fuente(s)`);
}

async function revisar(client, url) {
  try {
    const feed = await parser.parseURL(url);
    const estado = feedEstado.obtener.get(url);
    const entradas = feed.items ?? [];

    // Primera ejecución: se guarda el puntero sin publicar, para no inundar
    // el canal con el histórico completo del feed.
    if (!estado) {
      const primerId = entradas[0]?.guid ?? entradas[0]?.link;
      if (primerId) feedEstado.guardar.run(url, primerId, Date.now());
      return;
    }

    const nuevas = [];
    for (const item of entradas) {
      const id = item.guid ?? item.link;
      if (id === estado.ultimo_id) break;
      nuevas.push(item);
    }

    if (!nuevas.length) return;

    const canal = await client.channels.fetch(config.feeds.canal).catch(() => null);
    if (!canal?.isTextBased()) return;

    for (const item of nuevas.reverse().slice(-5)) {
      await canal.send({ embeds: [construirEmbed(feed, item)] }).catch(() => null);
    }

    const nuevoId = entradas[0]?.guid ?? entradas[0]?.link;
    feedEstado.guardar.run(url, nuevoId, Date.now());
  } catch (err) {
    log.error(`Fallo al leer el feed ${url}`, err);
  }
}

function construirEmbed(feed, item) {
  const resumen = (item.contentSnippet ?? item.content ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);

  return new EmbedBuilder()
    .setColor(config.colores.primario)
    .setAuthor({ name: feed.title ?? "Novedades" })
    .setTitle(item.title?.slice(0, 256) ?? "Nueva publicación")
    .setURL(item.link ?? null)
    .setDescription(resumen ? `${resumen}${resumen.length === 400 ? "…" : ""}` : null)
    .setTimestamp(item.isoDate ? new Date(item.isoDate) : new Date());
}
