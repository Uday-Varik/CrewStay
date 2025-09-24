import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertWorkerSchema, insertExtensionSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Worker management routes
  app.post("/api/workers", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user!.userType !== "construction") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { preferredHotel, ...workerFields } = req.body;
      const workerData = insertWorkerSchema.parse(workerFields);
      const worker = await storage.createWorker({
        ...workerData,
        companyId: req.user!.id,
      });

      // Update worker status to pending assignment
      await storage.updateWorkerStatus(worker.id, "pending_assignment");

      // Create accommodation request - for MVP, set hotelId to null for general requests
      const request = await storage.createAccommodationRequest({
        workerId: worker.id,
        companyId: req.user!.id,
        hotelId: null, // For MVP, accommodation requests are general and hotels can claim them
        notes: `Accommodation request for ${worker.name}. Preferred hotel: ${preferredHotel || 'Any available hotel'}`,
      });

      // Notify hotels via WebSocket
      broadcastToUserType("hotel", {
        type: "new_worker_request",
        data: { worker, request },
      });

      res.status(201).json(worker);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid data" });
    }
  });

  // Bulk worker import endpoint
  app.post("/api/workers/bulk", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user!.userType !== "construction") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const bulkWorkerSchema = z.object({
        workers: z.array(insertWorkerSchema.omit({ companyId: true })).min(1).max(1000)
      });

      const { workers: workersData } = bulkWorkerSchema.parse(req.body);

      const results = [];
      const errors = [];
      
      // Process workers in batch
      for (let i = 0; i < workersData.length; i++) {
        try {
          const workerData = workersData[i];
          
          // Create worker
          const worker = await storage.createWorker({
            ...workerData,
            companyId: req.user!.id,
          });

          // Update worker status to pending assignment
          await storage.updateWorkerStatus(worker.id, "pending_assignment");

          // Create accommodation request for each worker
          const request = await storage.createAccommodationRequest({
            workerId: worker.id,
            companyId: req.user!.id,
            hotelId: null,
            notes: `Accommodation request for ${worker.name} (bulk import)`,
          });

          results.push({ worker, request });
        } catch (error) {
          errors.push({ 
            index: i, 
            name: workersData[i]?.name || `Worker ${i + 1}`,
            error: error instanceof Error ? error.message : "Unknown error" 
          });
        }
      }

      // Notify hotels via WebSocket about all new workers
      if (results.length > 0) {
        broadcastToUserType("hotel", {
          type: "bulk_worker_requests",
          data: { 
            workers: results.map(r => r.worker), 
            requests: results.map(r => r.request),
            companyName: req.user!.companyName 
          },
        });
      }

      res.status(201).json({
        message: `Successfully imported ${results.length} workers`,
        imported: results.length,
        errors: errors.length,
        details: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Invalid bulk import data" 
      });
    }
  });

  app.get("/api/workers", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user!.userType !== "construction") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const workers = await storage.getWorkersByCompany(req.user!.id);
      res.json(workers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch workers" });
    }
  });

  app.get("/api/workers/export", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user!.userType !== "construction") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const csv = await storage.exportWorkersCSV(req.user!.id);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=workers.csv");
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "Failed to export workers" });
    }
  });

  app.patch("/api/workers/:id/status", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { status } = req.body;
      if (!["active", "inactive", "pending"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      await storage.updateWorkerStatus(req.params.id, status);
      
      // Notify relevant parties via WebSocket
      if (status === "inactive") {
        broadcastToUserType("hotel", {
          type: "worker_discontinued",
          data: { workerId: req.params.id },
        });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update worker status" });
    }
  });

  // Accommodation request routes
  app.post("/api/accommodation-requests", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user!.userType !== "construction") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { workerId, preferredHotel, notes } = req.body;
      
      if (!workerId) {
        return res.status(400).json({ message: "Worker ID is required" });
      }

      // Verify worker exists and belongs to requesting company
      const worker = await storage.getWorkerById(workerId);
      if (!worker || worker.companyId !== req.user!.id) {
        return res.status(404).json({ message: "Worker not found or access denied" });
      }

      const request = await storage.createAccommodationRequest({
        workerId,
        companyId: req.user!.id,
        hotelId: null, // For MVP, requests are general and hotels can claim them
        notes: notes || `Accommodation request. Preferred hotel: ${preferredHotel || 'Any available hotel'}`,
      });

      // Notify hotels via WebSocket
      broadcastToUserType("hotel", {
        type: "new_worker_request",
        data: { request },
      });

      res.status(201).json(request);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid data" });
    }
  });

  app.get("/api/accommodation-requests", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      let requests;
      if (req.user!.userType === "hotel") {
        requests = await storage.getRequestsByHotel(req.user!.id);
      } else {
        requests = await storage.getRequestsByCompany(req.user!.id);
      }

      res.json(requests);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch requests" });
    }
  });

  app.patch("/api/accommodation-requests/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user!.userType !== "hotel") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { status, assignedRoom, notes } = req.body;
      
      if (status === "approved" && !assignedRoom) {
        return res.status(400).json({ message: "Room assignment required for approval" });
      }

      // Use atomic update with proper state and ownership checking
      const success = await storage.updateRequestStatusAtomic(
        req.params.id,
        status,
        req.user!.id,
        assignedRoom,
        notes
      );

      if (!success) {
        return res.status(409).json({ message: "Request cannot be updated - already processed or not available to this hotel" });
      }

      // If approved, update worker assignment
      if (status === "approved") {
        const request = await storage.getRequestsByHotel(req.user!.id);
        const approvedRequest = request.find(r => r.id === req.params.id);
        
        if (approvedRequest) {
          // Update worker assignment and status (automatically sets to "room_assigned")
          await storage.updateWorkerAssignment(
            approvedRequest.workerId,
            req.user!.id,
            assignedRoom
          );

          // Notify construction company via WebSocket
          broadcastToUser(approvedRequest.companyId, {
            type: "room_assigned",
            data: {
              workerId: approvedRequest.workerId,
              hotelName: req.user!.companyName,
              roomNumber: assignedRoom,
            },
          });
        }
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update request" });
    }
  });

  // Extension routes
  app.post("/api/extensions", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user!.userType !== "construction") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const extensionData = insertExtensionSchema.parse(req.body);
      const extension = await storage.createExtension(extensionData);

      // Update worker status to extension requested
      await storage.updateWorkerForExtensionRequest(extensionData.workerId);

      // Get worker details for notification
      const worker = await storage.getWorkerById(extensionData.workerId);
      if (worker?.assignedHotelId) {
        broadcastToUser(worker.assignedHotelId, {
          type: "extension_request",
          data: { extension, worker },
        });
      }

      res.status(201).json(extension);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid data" });
    }
  });

  app.get("/api/extensions", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      let extensions;
      if (req.user!.userType === "hotel") {
        extensions = await storage.getExtensionsByHotel(req.user!.id);
      } else {
        // For construction companies, get extensions for all their workers
        const workers = await storage.getWorkersByCompany(req.user!.id);
        extensions = [];
        for (const worker of workers) {
          const workerExtensions = await storage.getExtensionsByWorker(worker.id);
          extensions.push(...workerExtensions);
        }
      }

      res.json(extensions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch extensions" });
    }
  });

  app.patch("/api/extensions/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user!.userType !== "hotel") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { status, hotelResponse } = req.body;
      
      // Authorization check: Ensure extension belongs to a worker assigned to this hotel
      const extensions = await storage.getExtensionsByHotel(req.user!.id);
      const extension = extensions.find(e => e.id === req.params.id);
      
      if (!extension) {
        return res.status(403).json({ message: "Access denied: Extension not found or not assigned to your hotel" });
      }
      
      await storage.updateExtensionStatus(req.params.id, status, hotelResponse);

      // Update worker status based on extension result
      if (status === "approved") {
        await storage.updateWorkerForExtensionApproval(extension.workerId, extension.requestedEndDate);
      } else if (status === "rejected") {
        // If extension rejected, worker goes back to checked_in status
        await storage.updateWorkerStatus(extension.workerId, "checked_in");
      }

      // Notify construction company
      if (extension) {
        const worker = await storage.getWorkerById(extension.workerId);
        if (worker) {
          broadcastToUser(worker.companyId, {
            type: "extension_response",
            data: {
              extensionId: req.params.id,
              status,
              hotelResponse,
              workerName: worker.name,
            },
          });
        }
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update extension" });
    }
  });

  // Statistics routes
  app.get("/api/stats", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      let stats;
      if (req.user!.userType === "construction") {
        stats = await storage.getConstructionStats(req.user!.id);
      } else {
        stats = await storage.getHotelStats(req.user!.id);
      }

      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  app.get("/api/hotels", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const hotels = await storage.getAllHotels();
      // Remove password from response
      const safeHotels = hotels.map(({ password, ...hotel }) => hotel);
      res.json(safeHotels);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch hotels" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket setup for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map<string, { ws: WebSocket; userId: string; userType: string }>();

  wss.on("connection", (ws, req) => {
    console.log("WebSocket connection established");

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === "auth" && data.userId) {
          // Associate WebSocket with user
          clients.set(ws.toString(), {
            ws,
            userId: data.userId,
            userType: data.userType,
          });
          
          ws.send(JSON.stringify({ type: "auth_success" }));
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", () => {
      clients.delete(ws.toString());
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      clients.delete(ws.toString());
    });
  });

  // Broadcast functions
  function broadcastToUser(userId: string, message: any) {
    clients.forEach((client) => {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  function broadcastToUserType(userType: string, message: any) {
    clients.forEach((client) => {
      if (client.userType === userType && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  return httpServer;
}
