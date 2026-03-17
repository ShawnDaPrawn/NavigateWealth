import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { createModuleLogger } from "./stderr-logger.ts";

const app = new Hono();
const log = createModuleLogger('kv');

// Root route - helpful for debugging
app.get("/", (c) => {
  return c.json({ 
    message: "KV Store API", 
    usage: "GET /:key to retrieve a value",
    example: "/kv-store/user_profile%3A123%3Aclient_keys"
  });
});

// GET /:key - Get a value from the KV store
app.get("/:key", async (c) => {
  try {
    const key = c.req.param("key");
    
    if (!key) {
      return c.json({ error: "Missing key" }, 400);
    }
    
    log.info(`Fetching key: ${key}`);
    
    const value = await kv.get(key);
    
    if (value === null || value === undefined) {
      log.warn(`Key not found: ${key}`);
      return c.json({ error: "Key not found", key }, 404);
    }
    
    log.info(`Key found: ${key}`);
    return c.json({ key, value });
  } catch (e) {
    log.error("Error fetching from KV:", e);
    return c.json({ error: "Failed to fetch value", details: String(e) }, 500);
  }
});

export default app;