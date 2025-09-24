import { users, workers, accommodationRequests, extensions, type User, type InsertUser, type Worker, type InsertWorker, type AccommodationRequest, type InsertAccommodationRequest, type Extension, type InsertExtension, type WorkerWithDetails, type AccommodationRequestWithDetails, type ExtensionWithDetails } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, count } from "drizzle-orm";
import session from "express-session";
import { Store } from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Worker management
  createWorker(worker: InsertWorker & { companyId: string }): Promise<Worker>;
  getWorkersByCompany(companyId: string): Promise<WorkerWithDetails[]>;
  getWorkerById(id: string): Promise<WorkerWithDetails | undefined>;
  updateWorkerStatus(id: string, status: "active" | "inactive" | "pending"): Promise<void>;
  updateWorkerAssignment(id: string, hotelId: string, roomNumber: string): Promise<void>;
  getNextWorkerNumber(companyId: string): Promise<number>;
  exportWorkersCSV(companyId: string): Promise<string>;
  
  // Accommodation requests
  createAccommodationRequest(request: InsertAccommodationRequest): Promise<AccommodationRequest>;
  getRequestsByHotel(hotelId: string): Promise<AccommodationRequestWithDetails[]>;
  getRequestsByCompany(companyId: string): Promise<AccommodationRequestWithDetails[]>;
  updateRequestStatus(id: string, status: "approved" | "rejected", hotelId?: string, assignedRoom?: string, notes?: string): Promise<void>;
  updateRequestStatusAtomic(id: string, status: "approved" | "rejected", hotelId: string, assignedRoom?: string, notes?: string): Promise<boolean>;
  
  // Extensions
  createExtension(extension: InsertExtension): Promise<Extension>;
  getExtensionsByWorker(workerId: string): Promise<ExtensionWithDetails[]>;
  getExtensionsByHotel(hotelId: string): Promise<ExtensionWithDetails[]>;
  updateExtensionStatus(id: string, status: "approved" | "rejected", hotelResponse?: string): Promise<void>;
  
  // Statistics
  getConstructionStats(companyId: string): Promise<{
    totalWorkers: number;
    activeWorkers: number;
    pendingAssignments: number;
    extensionsDue: number;
  }>;
  
  getHotelStats(hotelId: string): Promise<{
    totalRooms: number;
    occupiedRooms: number;
    pendingRequests: number;
    availableRooms: number;
  }>;

  sessionStore: Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createWorker(worker: InsertWorker & { companyId: string }): Promise<Worker> {
    const company = await this.getUser(worker.companyId);
    const companyCode = company?.companyName
      .replace(/[^A-Z0-9]/gi, '') // Remove non-alphanumeric characters
      .substring(0, 3)
      .toUpperCase() || "UNK";
    
    // Calculate expected end date
    const expectedEndDate = new Date();
    expectedEndDate.setDate(expectedEndDate.getDate() + worker.expectedDuration);
    
    // Generate truly unique worker ID with retry mechanism
    let workerId: string;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      workerId = `CWS-${companyCode}-${uniqueSuffix}`;
      
      try {
        const [newWorker] = await db
          .insert(workers)
          .values({
            ...worker,
            workerId,
            expectedEndDate,
          })
          .returning();
        return newWorker;
      } catch (error: any) {
        if (error.code === '23505' && error.constraint === 'workers_worker_id_unique') {
          // Unique constraint violation, retry with new ID
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error('Unable to generate unique worker ID after multiple attempts');
          }
          continue;
        }
        // Re-throw other errors
        throw error;
      }
    }
    
    throw new Error('Failed to create worker after maximum attempts');
  }

  async getWorkersByCompany(companyId: string): Promise<WorkerWithDetails[]> {
    return await db
      .select({
        id: workers.id,
        workerId: workers.workerId,
        name: workers.name,
        phone: workers.phone,
        idNumber: workers.idNumber,
        companyId: workers.companyId,
        status: workers.status,
        expectedDuration: workers.expectedDuration,
        assignedHotelId: workers.assignedHotelId,
        roomNumber: workers.roomNumber,
        specialRequirements: workers.specialRequirements,
        checkinDate: workers.checkinDate,
        expectedEndDate: workers.expectedEndDate,
        createdAt: workers.createdAt,
        company: {
          companyName: users.companyName,
        },
        assignedHotel: sql<{ companyName: string } | null>`
          CASE 
            WHEN ${workers.assignedHotelId} IS NOT NULL 
            THEN json_build_object('companyName', hotel.company_name)
            ELSE NULL 
          END
        `,
      })
      .from(workers)
      .leftJoin(users, eq(workers.companyId, users.id))
      .leftJoin(sql`${users} as hotel`, sql`${workers.assignedHotelId} = hotel.id`)
      .where(eq(workers.companyId, companyId))
      .orderBy(desc(workers.createdAt));
  }

  async getWorkerById(id: string): Promise<WorkerWithDetails | undefined> {
    const [worker] = await db
      .select({
        id: workers.id,
        workerId: workers.workerId,
        name: workers.name,
        phone: workers.phone,
        idNumber: workers.idNumber,
        companyId: workers.companyId,
        status: workers.status,
        expectedDuration: workers.expectedDuration,
        assignedHotelId: workers.assignedHotelId,
        roomNumber: workers.roomNumber,
        specialRequirements: workers.specialRequirements,
        checkinDate: workers.checkinDate,
        expectedEndDate: workers.expectedEndDate,
        createdAt: workers.createdAt,
        company: {
          companyName: users.companyName,
        },
        assignedHotel: sql<{ companyName: string } | null>`
          CASE 
            WHEN ${workers.assignedHotelId} IS NOT NULL 
            THEN json_build_object('companyName', hotel.company_name)
            ELSE NULL 
          END
        `,
      })
      .from(workers)
      .leftJoin(users, eq(workers.companyId, users.id))
      .leftJoin(sql`${users} as hotel`, sql`${workers.assignedHotelId} = hotel.id`)
      .where(eq(workers.id, id));
    
    return worker || undefined;
  }

  async updateWorkerStatus(id: string, status: "active" | "inactive" | "pending"): Promise<void> {
    await db
      .update(workers)
      .set({ status })
      .where(eq(workers.id, id));
  }

  async updateWorkerAssignment(id: string, hotelId: string, roomNumber: string): Promise<void> {
    await db
      .update(workers)
      .set({ 
        assignedHotelId: hotelId,
        roomNumber,
        status: "active",
        checkinDate: new Date(),
      })
      .where(eq(workers.id, id));
  }

  async getNextWorkerNumber(companyId: string): Promise<number> {
    // Get the count of existing workers for this company to determine next number
    const [result] = await db
      .select({ count: count() })
      .from(workers)
      .where(eq(workers.companyId, companyId));
    
    return (result?.count || 0) + 1;
  }

  async exportWorkersCSV(companyId: string): Promise<string> {
    const workersList = await this.getWorkersByCompany(companyId);
    
    const csvHeader = "Worker ID,Name,Phone,Status,Hotel,Room,Duration (days),Check-in Date,Expected End Date\n";
    const csvRows = workersList.map(worker => [
      worker.workerId,
      worker.name,
      worker.phone,
      worker.status,
      worker.assignedHotel?.companyName || "Not assigned",
      worker.roomNumber || "N/A",
      worker.expectedDuration,
      worker.checkinDate ? worker.checkinDate.toISOString().split('T')[0] : "N/A",
      worker.expectedEndDate ? worker.expectedEndDate.toISOString().split('T')[0] : "N/A",
    ].join(","));
    
    return csvHeader + csvRows.join("\n");
  }

  async createAccommodationRequest(request: InsertAccommodationRequest): Promise<AccommodationRequest> {
    const [newRequest] = await db
      .insert(accommodationRequests)
      .values(request)
      .returning();
    return newRequest;
  }

  async getRequestsByHotel(hotelId: string): Promise<AccommodationRequestWithDetails[]> {
    return await db
      .select({
        id: accommodationRequests.id,
        workerId: accommodationRequests.workerId,
        companyId: accommodationRequests.companyId,
        hotelId: accommodationRequests.hotelId,
        status: accommodationRequests.status,
        requestDate: accommodationRequests.requestDate,
        assignedRoom: accommodationRequests.assignedRoom,
        notes: accommodationRequests.notes,
        respondedAt: accommodationRequests.respondedAt,
        worker: {
          workerId: workers.workerId,
          name: workers.name,
          phone: workers.phone,
        },
        company: {
          companyName: users.companyName,
        },
        hotel: sql<{ companyName: string } | null>`
          CASE 
            WHEN hotel.id IS NOT NULL 
            THEN json_build_object('companyName', hotel.company_name)
            ELSE NULL 
          END
        `,
      })
      .from(accommodationRequests)
      .leftJoin(workers, eq(accommodationRequests.workerId, workers.id))
      .leftJoin(users, eq(accommodationRequests.companyId, users.id))
      .leftJoin(sql`${users} as hotel`, sql`${accommodationRequests.hotelId} = hotel.id`)
      .where(sql`${accommodationRequests.hotelId} = ${hotelId} OR ${accommodationRequests.hotelId} IS NULL`)
      .orderBy(desc(accommodationRequests.requestDate));
  }

  async getRequestsByCompany(companyId: string): Promise<AccommodationRequestWithDetails[]> {
    return await db
      .select({
        id: accommodationRequests.id,
        workerId: accommodationRequests.workerId,
        companyId: accommodationRequests.companyId,
        hotelId: accommodationRequests.hotelId,
        status: accommodationRequests.status,
        requestDate: accommodationRequests.requestDate,
        assignedRoom: accommodationRequests.assignedRoom,
        notes: accommodationRequests.notes,
        respondedAt: accommodationRequests.respondedAt,
        worker: {
          workerId: workers.workerId,
          name: workers.name,
          phone: workers.phone,
        },
        company: {
          companyName: users.companyName,
        },
        hotel: sql<{ companyName: string } | null>`
          CASE 
            WHEN hotel.id IS NOT NULL 
            THEN json_build_object('companyName', hotel.company_name)
            ELSE NULL 
          END
        `,
      })
      .from(accommodationRequests)
      .leftJoin(workers, eq(accommodationRequests.workerId, workers.id))
      .leftJoin(users, eq(accommodationRequests.companyId, users.id))
      .leftJoin(sql`${users} as hotel`, sql`${accommodationRequests.hotelId} = hotel.id`)
      .where(eq(accommodationRequests.companyId, companyId))
      .orderBy(desc(accommodationRequests.requestDate));
  }

  async updateRequestStatus(id: string, status: "approved" | "rejected", hotelId?: string, assignedRoom?: string, notes?: string): Promise<void> {
    await db
      .update(accommodationRequests)
      .set({ 
        status,
        hotelId,
        assignedRoom,
        notes,
        respondedAt: new Date(),
      })
      .where(eq(accommodationRequests.id, id));
  }

  async updateRequestStatusAtomic(id: string, status: "approved" | "rejected", hotelId: string, assignedRoom?: string, notes?: string): Promise<boolean> {
    try {
      const result = await db
        .update(accommodationRequests)
        .set({ 
          status,
          hotelId,
          assignedRoom,
          notes,
          respondedAt: new Date(),
        })
        .where(
          and(
            eq(accommodationRequests.id, id),
            eq(accommodationRequests.status, "pending"),
            sql`(${accommodationRequests.hotelId} IS NULL OR ${accommodationRequests.hotelId} = ${hotelId})`
          )
        )
        .returning({ id: accommodationRequests.id });
      
      // Check if any rows were updated by checking if we got a result back
      return result.length > 0;
    } catch (error) {
      console.error("Error in updateRequestStatusAtomic:", error);
      return false;
    }
  }

  async createExtension(extension: InsertExtension): Promise<Extension> {
    const [newExtension] = await db
      .insert(extensions)
      .values(extension)
      .returning();
    return newExtension;
  }

  async getExtensionsByWorker(workerId: string): Promise<ExtensionWithDetails[]> {
    return await db
      .select({
        id: extensions.id,
        workerId: extensions.workerId,
        currentEndDate: extensions.currentEndDate,
        requestedEndDate: extensions.requestedEndDate,
        reason: extensions.reason,
        status: extensions.status,
        hotelResponse: extensions.hotelResponse,
        createdAt: extensions.createdAt,
        respondedAt: extensions.respondedAt,
        worker: {
          workerId: workers.workerId,
          name: workers.name,
          roomNumber: workers.roomNumber,
          assignedHotel: sql<{ companyName: string } | null>`
            CASE 
              WHEN hotel.id IS NOT NULL 
              THEN json_build_object('companyName', hotel.company_name)
              ELSE NULL 
            END
          `,
        },
      })
      .from(extensions)
      .leftJoin(workers, eq(extensions.workerId, workers.id))
      .leftJoin(sql`${users} as hotel`, sql`${workers.assignedHotelId} = hotel.id`)
      .where(eq(extensions.workerId, workerId))
      .orderBy(desc(extensions.createdAt));
  }

  async getExtensionsByHotel(hotelId: string): Promise<ExtensionWithDetails[]> {
    return await db
      .select({
        id: extensions.id,
        workerId: extensions.workerId,
        currentEndDate: extensions.currentEndDate,
        requestedEndDate: extensions.requestedEndDate,
        reason: extensions.reason,
        status: extensions.status,
        hotelResponse: extensions.hotelResponse,
        createdAt: extensions.createdAt,
        respondedAt: extensions.respondedAt,
        worker: {
          workerId: workers.workerId,
          name: workers.name,
          roomNumber: workers.roomNumber,
          assignedHotel: sql<{ companyName: string } | null>`
            CASE 
              WHEN hotel.id IS NOT NULL 
              THEN json_build_object('companyName', hotel.company_name)
              ELSE NULL 
            END
          `,
        },
      })
      .from(extensions)
      .leftJoin(workers, eq(extensions.workerId, workers.id))
      .leftJoin(sql`${users} as hotel`, sql`${workers.assignedHotelId} = hotel.id`)
      .where(eq(workers.assignedHotelId, hotelId))
      .orderBy(desc(extensions.createdAt));
  }

  async updateExtensionStatus(id: string, status: "approved" | "rejected", hotelResponse?: string): Promise<void> {
    const updateData: any = {
      status,
      respondedAt: new Date(),
    };
    
    if (hotelResponse) {
      updateData.hotelResponse = hotelResponse;
    }
    
    // Start transaction for atomic updates
    await db.transaction(async (tx) => {
      // Update extension status
      await tx
        .update(extensions)
        .set(updateData)
        .where(eq(extensions.id, id));
      
      // If approved, update worker's expected end date
      if (status === "approved") {
        const extension = await tx
          .select({
            workerId: extensions.workerId,
            requestedEndDate: extensions.requestedEndDate,
          })
          .from(extensions)
          .where(eq(extensions.id, id))
          .limit(1);
        
        if (extension.length > 0) {
          await tx
            .update(workers)
            .set({ expectedEndDate: extension[0].requestedEndDate })
            .where(eq(workers.id, extension[0].workerId));
        }
      }
    });
  }

  async getConstructionStats(companyId: string): Promise<{
    totalWorkers: number;
    activeWorkers: number;
    pendingAssignments: number;
    extensionsDue: number;
  }> {
    const [totalWorkers] = await db
      .select({ count: count() })
      .from(workers)
      .where(eq(workers.companyId, companyId));

    const [activeWorkers] = await db
      .select({ count: count() })
      .from(workers)
      .where(and(eq(workers.companyId, companyId), eq(workers.status, "active")));

    const [pendingAssignments] = await db
      .select({ count: count() })
      .from(workers)
      .where(and(eq(workers.companyId, companyId), eq(workers.status, "pending")));

    const [extensionsDue] = await db
      .select({ count: count() })
      .from(extensions)
      .leftJoin(workers, eq(extensions.workerId, workers.id))
      .where(and(eq(workers.companyId, companyId), eq(extensions.status, "pending")));

    return {
      totalWorkers: totalWorkers?.count || 0,
      activeWorkers: activeWorkers?.count || 0,
      pendingAssignments: pendingAssignments?.count || 0,
      extensionsDue: extensionsDue?.count || 0,
    };
  }

  async getHotelStats(hotelId: string): Promise<{
    totalRooms: number;
    occupiedRooms: number;
    pendingRequests: number;
    availableRooms: number;
  }> {
    // For this MVP, we'll use simple counts. In a real system, you'd have a rooms table
    const [occupiedRooms] = await db
      .select({ count: count() })
      .from(workers)
      .where(and(eq(workers.assignedHotelId, hotelId), eq(workers.status, "active")));

    const [pendingRequests] = await db
      .select({ count: count() })
      .from(accommodationRequests)
      .where(
        and(
          sql`(${accommodationRequests.hotelId} IS NULL OR ${accommodationRequests.hotelId} = ${hotelId})`,
          eq(accommodationRequests.status, "pending")
        )
      );

    // Assuming a hotel has 50 total rooms for this MVP
    const totalRooms = 50;
    const occupied = occupiedRooms?.count || 0;

    return {
      totalRooms,
      occupiedRooms: occupied,
      pendingRequests: pendingRequests?.count || 0,
      availableRooms: totalRooms - occupied,
    };
  }
}

export const storage = new DatabaseStorage();
