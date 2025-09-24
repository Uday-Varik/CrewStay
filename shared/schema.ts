import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const userTypeEnum = pgEnum("user_type", ["construction", "hotel"]);
export const workerStatusEnum = pgEnum("worker_status", ["active", "inactive", "pending"]);
export const requestStatusEnum = pgEnum("request_status", ["pending", "approved", "rejected"]);
export const extensionStatusEnum = pgEnum("extension_status", ["pending", "approved", "rejected"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  userType: userTypeEnum("user_type").notNull(),
  companyName: text("company_name").notNull(),
  contactInfo: text("contact_info"),
  totalRooms: integer("total_rooms").default(50), // For hotels only
  createdAt: timestamp("created_at").defaultNow(),
});

export const workers = pgTable("workers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workerId: text("worker_id").notNull().unique(), // CWS-[COMPANY]-[NUMBER]
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  idNumber: text("id_number").notNull(),
  companyId: varchar("company_id").references(() => users.id).notNull(),
  status: workerStatusEnum("status").default("pending").notNull(),
  expectedDuration: integer("expected_duration").notNull(), // in days
  assignedHotelId: varchar("assigned_hotel_id").references(() => users.id),
  roomNumber: text("room_number"),
  specialRequirements: text("special_requirements"),
  checkinDate: timestamp("checkin_date"),
  expectedEndDate: timestamp("expected_end_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const accommodationRequests = pgTable("accommodation_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workerId: varchar("worker_id").references(() => workers.id).notNull(),
  companyId: varchar("company_id").references(() => users.id).notNull(),
  hotelId: varchar("hotel_id").references(() => users.id),
  status: requestStatusEnum("status").default("pending").notNull(),
  requestDate: timestamp("request_date").defaultNow(),
  assignedRoom: text("assigned_room"),
  notes: text("notes"),
  respondedAt: timestamp("responded_at"),
});

export const extensions = pgTable("extensions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workerId: varchar("worker_id").references(() => workers.id).notNull(),
  currentEndDate: timestamp("current_end_date").notNull(),
  requestedEndDate: timestamp("requested_end_date").notNull(),
  reason: text("reason"),
  status: extensionStatusEnum("status").default("pending").notNull(),
  hotelResponse: text("hotel_response"),
  createdAt: timestamp("created_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  workers: many(workers, { relationName: "company_workers" }),
  assignedWorkers: many(workers, { relationName: "hotel_assignments" }),
  accommodationRequests: many(accommodationRequests),
}));

export const workersRelations = relations(workers, ({ one, many }) => ({
  company: one(users, {
    fields: [workers.companyId],
    references: [users.id],
    relationName: "company_workers",
  }),
  assignedHotel: one(users, {
    fields: [workers.assignedHotelId],
    references: [users.id],
    relationName: "hotel_assignments",
  }),
  accommodationRequests: many(accommodationRequests),
  extensions: many(extensions),
}));

export const accommodationRequestsRelations = relations(accommodationRequests, ({ one }) => ({
  worker: one(workers, {
    fields: [accommodationRequests.workerId],
    references: [workers.id],
  }),
  company: one(users, {
    fields: [accommodationRequests.companyId],
    references: [users.id],
  }),
  hotel: one(users, {
    fields: [accommodationRequests.hotelId],
    references: [users.id],
  }),
}));

export const extensionsRelations = relations(extensions, ({ one }) => ({
  worker: one(workers, {
    fields: [extensions.workerId],
    references: [workers.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  userType: true,
  companyName: true,
  contactInfo: true,
});

export const insertWorkerSchema = createInsertSchema(workers).pick({
  name: true,
  phone: true,
  idNumber: true,
  expectedDuration: true,
  specialRequirements: true,
});

export const insertAccommodationRequestSchema = createInsertSchema(accommodationRequests).pick({
  workerId: true,
  companyId: true,
  hotelId: true,
  notes: true,
});

export const insertExtensionSchema = createInsertSchema(extensions).pick({
  workerId: true,
  currentEndDate: true,
  requestedEndDate: true,
  reason: true,
}).extend({
  currentEndDate: z.coerce.date(),
  requestedEndDate: z.coerce.date(),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertWorker = z.infer<typeof insertWorkerSchema>;
export type Worker = typeof workers.$inferSelect;
export type InsertAccommodationRequest = z.infer<typeof insertAccommodationRequestSchema>;
export type AccommodationRequest = typeof accommodationRequests.$inferSelect;
export type InsertExtension = z.infer<typeof insertExtensionSchema>;
export type Extension = typeof extensions.$inferSelect;

// Extended types for API responses
export type WorkerWithDetails = Worker & {
  company: Pick<User, "companyName">;
  assignedHotel: Pick<User, "companyName"> | null;
};

export type AccommodationRequestWithDetails = AccommodationRequest & {
  worker: Pick<Worker, "workerId" | "name" | "phone">;
  company: Pick<User, "companyName">;
  hotel: Pick<User, "companyName"> | null;
};

export type ExtensionWithDetails = Extension & {
  worker: Pick<Worker, "workerId" | "name" | "roomNumber"> & {
    assignedHotel: Pick<User, "companyName"> | null;
  };
};
