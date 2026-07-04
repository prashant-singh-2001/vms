import Redis from "ioredis";
import { config } from "../config";

// Separate connections: XREADGROUP with BLOCK holds the connection open, so it
// can't share a client with request/response commands like XADD.
export const redisPub = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
export const redisSub = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
