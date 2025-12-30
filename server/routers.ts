import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";

// Zod schemas for validation
const participantSchema = z.object({
  uuid: z.string().uuid(),
  name: z.string().min(1).max(255),
  mobile: z.string().max(20).optional().nullable(),
  qrToken: z.string().min(1).max(64),
  groupName: z.string().max(255).optional().nullable(),
  emergencyContact: z.string().max(20).optional().nullable(),
  emergencyContactName: z.string().max(255).optional().nullable(),
  emergencyContactRelation: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
  photoUri: z.string().optional().nullable(),
  bloodGroup: z.string().max(10).optional().nullable(),
  medicalConditions: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  medications: z.string().optional().nullable(),
  age: z.number().int().positive().optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
});

const scanLogSchema = z.object({
  uuid: z.string().uuid(),
  participantUuid: z.string().uuid(),
  checkpointId: z.number().int().positive(),
  deviceId: z.string().max(64).optional().nullable(),
  gpsLat: z.string().optional().nullable(),
  gpsLng: z.string().optional().nullable(),
  scannedAt: z.string().datetime(),
});

const familyGroupSchema = z.object({
  uuid: z.string().uuid(),
  name: z.string().min(1).max(255),
  headOfFamilyUuid: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  memberUuids: z.array(z.string().uuid()).optional(),
});

const checkpointNoteSchema = z.object({
  uuid: z.string().uuid(),
  checkpointId: z.number().int().positive(),
  participantUuid: z.string().uuid().optional().nullable(),
  volunteerUuid: z.string().uuid().optional().nullable(),
  note: z.string().min(1),
  noteType: z.enum(["general", "medical", "assistance", "other"]).default("general"),
});

const lostFoundItemSchema = z.object({
  uuid: z.string().uuid(),
  itemType: z.enum(["lost", "found"]),
  description: z.string().min(1),
  location: z.string().max(255).optional().nullable(),
  reportedBy: z.string().max(255).optional().nullable(),
  photoUri: z.string().optional().nullable(),
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ==================== PARTICIPANTS API ====================
  participants: router({
    // Get all participants
    list: publicProcedure.query(async () => {
      return db.getAllParticipants();
    }),

    // Get participant by UUID
    get: publicProcedure
      .input(z.object({ uuid: z.string().uuid() }))
      .query(async ({ input }) => {
        return db.getParticipantByUuid(input.uuid);
      }),

    // Get participant by QR token
    getByQrToken: publicProcedure
      .input(z.object({ qrToken: z.string() }))
      .query(async ({ input }) => {
        return db.getParticipantByQrToken(input.qrToken);
      }),

    // Get participants updated since a timestamp (for sync)
    getUpdatedSince: publicProcedure
      .input(z.object({ since: z.string().datetime() }))
      .query(async ({ input }) => {
        return db.getParticipantsUpdatedSince(new Date(input.since));
      }),

    // Create or update a participant
    upsert: publicProcedure
      .input(participantSchema)
      .mutation(async ({ input }) => {
        await db.upsertParticipant(input);
        return { success: true };
      }),

    // Bulk create/update participants
    bulkUpsert: publicProcedure
      .input(z.object({ participants: z.array(participantSchema) }))
      .mutation(async ({ input }) => {
        await db.bulkUpsertParticipants(input.participants);
        return { success: true, count: input.participants.length };
      }),

    // Delete a participant
    delete: publicProcedure
      .input(z.object({ uuid: z.string().uuid() }))
      .mutation(async ({ input }) => {
        await db.deleteParticipant(input.uuid);
        return { success: true };
      }),
  }),

  // ==================== SCAN LOGS API ====================
  scanLogs: router({
    // Get all scan logs
    list: publicProcedure.query(async () => {
      return db.getAllScanLogs();
    }),

    // Get scan logs by participant
    getByParticipant: publicProcedure
      .input(z.object({ participantUuid: z.string().uuid() }))
      .query(async ({ input }) => {
        return db.getScanLogsByParticipant(input.participantUuid);
      }),

    // Get scan logs by checkpoint
    getByCheckpoint: publicProcedure
      .input(z.object({ checkpointId: z.number().int() }))
      .query(async ({ input }) => {
        return db.getScanLogsByCheckpoint(input.checkpointId);
      }),

    // Get scan logs created since a timestamp (for sync)
    getUpdatedSince: publicProcedure
      .input(z.object({ since: z.string().datetime() }))
      .query(async ({ input }) => {
        return db.getScanLogsUpdatedSince(new Date(input.since));
      }),

    // Create a scan log
    create: publicProcedure
      .input(scanLogSchema)
      .mutation(async ({ input }) => {
        const result = await db.createScanLog({
          ...input,
          scannedAt: new Date(input.scannedAt),
        });
        return result;
      }),

    // Bulk create scan logs
    bulkCreate: publicProcedure
      .input(z.object({ scanLogs: z.array(scanLogSchema) }))
      .mutation(async ({ input }) => {
        const results = await db.bulkCreateScanLogs(
          input.scanLogs.map(log => ({
            ...log,
            scannedAt: new Date(log.scannedAt),
          }))
        );
        return { success: true, results };
      }),
  }),

  // ==================== FAMILY GROUPS API ====================
  familyGroups: router({
    // Get all family groups
    list: publicProcedure.query(async () => {
      return db.getAllFamilyGroups();
    }),

    // Get family group members
    getMembers: publicProcedure
      .input(z.object({ familyGroupUuid: z.string().uuid() }))
      .query(async ({ input }) => {
        return db.getFamilyGroupMembers(input.familyGroupUuid);
      }),

    // Create or update a family group
    upsert: publicProcedure
      .input(familyGroupSchema)
      .mutation(async ({ input }) => {
        const { memberUuids, ...groupData } = input;
        await db.upsertFamilyGroup(groupData);
        
        // Add members if provided
        if (memberUuids && memberUuids.length > 0) {
          for (const memberUuid of memberUuids) {
            await db.addFamilyGroupMember({
              familyGroupUuid: input.uuid,
              participantUuid: memberUuid,
            });
          }
        }
        
        return { success: true };
      }),
  }),

  // ==================== CHECKPOINT NOTES API ====================
  checkpointNotes: router({
    // Get notes for a checkpoint
    getByCheckpoint: publicProcedure
      .input(z.object({ checkpointId: z.number().int() }))
      .query(async ({ input }) => {
        return db.getCheckpointNotes(input.checkpointId);
      }),

    // Create a checkpoint note
    create: publicProcedure
      .input(checkpointNoteSchema)
      .mutation(async ({ input }) => {
        await db.createCheckpointNote(input);
        return { success: true };
      }),
  }),

  // ==================== LOST & FOUND API ====================
  lostFound: router({
    // Get all lost and found items
    list: publicProcedure.query(async () => {
      return db.getAllLostFoundItems();
    }),

    // Create a lost/found item
    create: publicProcedure
      .input(lostFoundItemSchema)
      .mutation(async ({ input }) => {
        await db.createLostFoundItem(input);
        return { success: true };
      }),

    // Update item status
    updateStatus: publicProcedure
      .input(z.object({
        uuid: z.string().uuid(),
        status: z.enum(["open", "resolved"]),
      }))
      .mutation(async ({ input }) => {
        await db.updateLostFoundItemStatus(input.uuid, input.status);
        return { success: true };
      }),
  }),

  // ==================== SYNC API ====================
  sync: router({
    // Get all data for initial sync
    fullSync: publicProcedure.query(async () => {
      const [participantsList, scanLogsList, familyGroupsList] = await Promise.all([
        db.getAllParticipants(),
        db.getAllScanLogs(),
        db.getAllFamilyGroups(),
      ]);
      
      return {
        participants: participantsList,
        scanLogs: scanLogsList,
        familyGroups: familyGroupsList,
        syncedAt: new Date().toISOString(),
      };
    }),

    // Get incremental updates since last sync
    incrementalSync: publicProcedure
      .input(z.object({ 
        deviceId: z.string(),
        lastSyncAt: z.string().datetime(),
      }))
      .query(async ({ input }) => {
        const since = new Date(input.lastSyncAt);
        
        const [participantsList, scanLogsList] = await Promise.all([
          db.getParticipantsUpdatedSince(since),
          db.getScanLogsUpdatedSince(since),
        ]);
        
        return {
          participants: participantsList,
          scanLogs: scanLogsList,
          syncedAt: new Date().toISOString(),
        };
      }),

    // Push local changes to server
    pushChanges: publicProcedure
      .input(z.object({
        deviceId: z.string(),
        participants: z.array(participantSchema).optional(),
        scanLogs: z.array(scanLogSchema).optional(),
      }))
      .mutation(async ({ input }) => {
        const results = {
          participantsUpserted: 0,
          scanLogsCreated: 0,
          scanLogsDuplicate: 0,
        };
        
        // Upsert participants
        if (input.participants && input.participants.length > 0) {
          await db.bulkUpsertParticipants(input.participants);
          results.participantsUpserted = input.participants.length;
        }
        
        // Create scan logs
        if (input.scanLogs && input.scanLogs.length > 0) {
          const scanResults = await db.bulkCreateScanLogs(
            input.scanLogs.map(log => ({
              ...log,
              scannedAt: new Date(log.scannedAt),
            }))
          );
          results.scanLogsCreated = scanResults.filter(r => r.success).length;
          results.scanLogsDuplicate = scanResults.filter(r => r.duplicate).length;
        }
        
        // Update sync metadata
        await db.updateSyncMetadata(input.deviceId);
        
        return {
          success: true,
          ...results,
          syncedAt: new Date().toISOString(),
        };
      }),
  }),

  // ==================== STATISTICS API ====================
  stats: router({
    // Get checkpoint statistics
    checkpoints: publicProcedure.query(async () => {
      return db.getCheckpointStats();
    }),

    // Get today's statistics
    today: publicProcedure.query(async () => {
      return db.getTodayStats();
    }),

    // Get overall summary
    summary: publicProcedure.query(async () => {
      const [participantsList, scanLogsList, todayStats] = await Promise.all([
        db.getAllParticipants(),
        db.getAllScanLogs(),
        db.getTodayStats(),
      ]);
      
      return {
        totalParticipants: participantsList.length,
        totalScans: scanLogsList.length,
        todayScans: todayStats.totalScans,
        todayUniqueParticipants: todayStats.uniqueParticipants,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
