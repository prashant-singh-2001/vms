function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "12h",
  workerInternalUrl: required("WORKER_INTERNAL_URL"),
  seed: {
    username: process.env.SEED_USERNAME,
    password: process.env.SEED_PASSWORD,
    rtspUrl: process.env.SEED_RTSP_URL,
  },
};
