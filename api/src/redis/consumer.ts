import { PersonDetectedEventSchema, StatsPayloadSchema } from "../events";
import * as alertRepo from "../repositories/alerts";
import * as cameraRepo from "../repositories/cameras";
import { sendToUser } from "../ws/manager";
import { redisSub } from "./client";
import { GROUPS, STREAMS } from "./streams";

const CONSUMER_NAME = `api-${process.pid}`;

async function ensureGroup(stream: string, group: string): Promise<void> {
  try {
    await redisSub.xgroup("CREATE", stream, group, "$", "MKSTREAM");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("BUSYGROUP")) throw err;
  }
}

function fieldsToObject(fields: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) obj[fields[i]] = fields[i + 1];
  return obj;
}

async function handleDetectionEvent(fields: string[]): Promise<void> {
  const obj = fieldsToObject(fields);
  const event = PersonDetectedEventSchema.parse(JSON.parse(obj.event));

  const camera = await cameraRepo.getCameraById(event.cameraId);
  if (!camera) return;

  await alertRepo.insertAlert({
    id: event.id,
    cameraId: event.cameraId,
    type: event.type,
    confidence: event.confidence,
    detections: event.detections,
    frameWidth: event.frame.width,
    frameHeight: event.frame.height,
    ts: new Date(event.timestamp),
  });

  sendToUser(camera.userId, { type: "alert", data: event });
}

async function handleStats(fields: string[]): Promise<void> {
  const obj = fieldsToObject(fields);
  const stats = StatsPayloadSchema.parse({
    cameraId: obj.cameraId,
    fps: Number(obj.fps),
    detectionsPerMinute: Number(obj.detectionsPerMinute),
    state: obj.state,
    timestamp: obj.timestamp,
  });

  const camera = await cameraRepo.getCameraById(stats.cameraId);
  if (!camera) return;

  sendToUser(camera.userId, { type: "stats", data: stats });

  if (camera.status !== stats.state) {
    await cameraRepo.setCameraStatus(stats.cameraId, stats.state);
    sendToUser(camera.userId, {
      type: "camera_state",
      data: { cameraId: stats.cameraId, state: stats.state },
    });
  }
}

type StreamEntry = [id: string, fields: string[]];
type StreamResult = [streamName: string, entries: StreamEntry[]];

export async function startEventConsumer(): Promise<void> {
  await ensureGroup(STREAMS.events, GROUPS.api);
  await ensureGroup(STREAMS.stats, GROUPS.api);
  console.log("[redis] event consumer started");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = (await redisSub.xreadgroup(
        "GROUP",
        GROUPS.api,
        CONSUMER_NAME,
        "COUNT",
        "20",
        "BLOCK",
        "5000",
        "STREAMS",
        STREAMS.events,
        STREAMS.stats,
        ">",
        ">",
      )) as StreamResult[] | null;

      if (!res) continue;

      for (const [streamName, entries] of res) {
        for (const [entryId, fields] of entries) {
          try {
            if (streamName === STREAMS.events) {
              await handleDetectionEvent(fields);
            } else if (streamName === STREAMS.stats) {
              await handleStats(fields);
            }
          } catch (err) {
            console.error(`[redis] failed to process ${streamName} entry ${entryId}`, err);
          } finally {
            await redisSub.xack(streamName, GROUPS.api, entryId);
          }
        }
      }
    } catch (err) {
      console.error("[redis] consumer loop error, retrying in 2s", err);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
