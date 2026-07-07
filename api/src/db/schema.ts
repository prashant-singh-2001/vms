import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  real,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cameras = pgTable("cameras", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  rtspUrl: text("rtsp_url").notNull(),
  location: text("location"),
  enabled: boolean("enabled").notNull().default(true),
  // connecting | live | stopped | error
  status: text("status").notNull().default("stopped"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cameraId: uuid("camera_id")
      .notNull()
      .references(() => cameras.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("person_detected"),
    confidence: real("confidence").notNull(),
    detections: jsonb("detections").notNull(),
    frameWidth: integer("frame_width").notNull(),
    frameHeight: integer("frame_height").notNull(),
    annotatedImageId: text("annotated_image_id"),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    cameraTsIdx: index("alerts_camera_ts_idx").on(table.cameraId, table.ts),
  }),
);

export type User = typeof users.$inferSelect;
export type Camera = typeof cameras.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
