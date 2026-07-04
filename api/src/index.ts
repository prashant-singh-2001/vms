import { createApp } from "./app";
import { config } from "./config";
import { runMigrations } from "./db/migrate";
import { startEventConsumer } from "./redis/consumer";
import { seedDemoData } from "./seed";
import { websocket } from "./ws/bun";

const app = createApp();

await runMigrations();
await seedDemoData();
startEventConsumer().catch((err) => {
  console.error("[redis] event consumer crashed", err);
  process.exit(1);
});

console.log(`[api] listening on :${config.port}`);

export default {
  port: config.port,
  fetch: app.fetch,
  websocket,
};
