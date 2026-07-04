import type { CameraCommand } from "../events";
import { redisPub } from "./client";
import { STREAMS } from "./streams";

export async function publishCameraCommand(cmd: CameraCommand): Promise<void> {
  await redisPub.xadd(
    STREAMS.commands,
    "*",
    "action",
    cmd.action,
    "cameraId",
    cmd.cameraId,
    "rtspUrl",
    cmd.rtspUrl ?? "",
  );
}
