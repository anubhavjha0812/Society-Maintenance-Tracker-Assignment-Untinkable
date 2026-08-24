import "dotenv/config";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";

async function main() {
  const app = await buildApp();

  // BullMQ worker + repeatable overdue-sweep job are started here, inside
  // the same process, right after the API is listening (Build Order step
  // 4). Render's free tier has no background-worker product, so this is
  // the MVP tradeoff documented in README.md.

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
