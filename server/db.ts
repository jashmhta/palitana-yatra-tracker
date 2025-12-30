import { eq, gte, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users,
  InsertParticipant, participants,
  InsertScanLog, scanLogs,
  InsertFamilyGroup, familyGroups,
  InsertFamilyGroupMember, familyGroupMembers,
  InsertVolunteer, volunteers,
  InsertVolunteerCheckpoint, volunteerCheckpoints,
  InsertCheckpointNote, checkpointNotes,
  InsertLostFoundItem, lostFoundItems,
  InsertSyncMetadata, syncMetadata,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== USER QUERIES ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ==================== PARTICIPANT QUERIES ====================

export async function getAllParticipants() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(participants).orderBy(desc(participants.createdAt));
}

export async function getParticipantByUuid(uuid: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(participants).where(eq(participants.uuid, uuid)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getParticipantByQrToken(qrToken: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(participants).where(eq(participants.qrToken, qrToken)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getParticipantsUpdatedSince(since: Date) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(participants).where(gte(participants.updatedAt, since));
}

export async function upsertParticipant(data: InsertParticipant) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(participants).values(data).onDuplicateKeyUpdate({
    set: {
      name: data.name,
      mobile: data.mobile,
      groupName: data.groupName,
      emergencyContact: data.emergencyContact,
      emergencyContactName: data.emergencyContactName,
      emergencyContactRelation: data.emergencyContactRelation,
      notes: data.notes,
      photoUri: data.photoUri,
      bloodGroup: data.bloodGroup,
      medicalConditions: data.medicalConditions,
      allergies: data.allergies,
      medications: data.medications,
      age: data.age,
      gender: data.gender,
    },
  });
}

export async function bulkUpsertParticipants(dataList: InsertParticipant[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (const data of dataList) {
    await upsertParticipant(data);
  }
}

export async function deleteParticipant(uuid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(participants).where(eq(participants.uuid, uuid));
}

// ==================== SCAN LOG QUERIES ====================

export async function getAllScanLogs() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(scanLogs).orderBy(desc(scanLogs.scannedAt));
}

export async function getScanLogsByParticipant(participantUuid: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(scanLogs).where(eq(scanLogs.participantUuid, participantUuid));
}

export async function getScanLogsByCheckpoint(checkpointId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(scanLogs).where(eq(scanLogs.checkpointId, checkpointId));
}

export async function getScanLogsUpdatedSince(since: Date) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(scanLogs).where(gte(scanLogs.createdAt, since));
}

export async function createScanLog(data: InsertScanLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check for duplicate scan at same checkpoint
  const existing = await db.select().from(scanLogs).where(
    and(
      eq(scanLogs.participantUuid, data.participantUuid),
      eq(scanLogs.checkpointId, data.checkpointId)
    )
  ).limit(1);
  
  if (existing.length > 0) {
    return { success: false, duplicate: true, existingId: existing[0].uuid };
  }
  
  await db.insert(scanLogs).values(data);
  
  return { success: true, duplicate: false };
}

export async function bulkCreateScanLogs(dataList: InsertScanLog[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const results = [];
  for (const data of dataList) {
    const result = await createScanLog(data);
    results.push({ uuid: data.uuid, ...result });
  }
  return results;
}

// ==================== FAMILY GROUP QUERIES ====================

export async function getAllFamilyGroups() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(familyGroups).orderBy(desc(familyGroups.createdAt));
}

export async function getFamilyGroupMembers(familyGroupUuid: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(familyGroupMembers).where(eq(familyGroupMembers.familyGroupUuid, familyGroupUuid));
}

export async function upsertFamilyGroup(data: InsertFamilyGroup) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(familyGroups).values(data).onDuplicateKeyUpdate({
    set: {
      name: data.name,
      headOfFamilyUuid: data.headOfFamilyUuid,
      notes: data.notes,
    },
  });
}

export async function addFamilyGroupMember(data: InsertFamilyGroupMember) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(familyGroupMembers).values(data);
}

// ==================== VOLUNTEER QUERIES ====================

export async function getAllVolunteers() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(volunteers).orderBy(desc(volunteers.createdAt));
}

export async function getVolunteerByUuid(uuid: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(volunteers).where(eq(volunteers.uuid, uuid)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertVolunteer(data: InsertVolunteer) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(volunteers).values(data).onDuplicateKeyUpdate({
    set: {
      name: data.name,
      mobile: data.mobile,
      pin: data.pin,
      isActive: data.isActive,
    },
  });
}

// ==================== CHECKPOINT NOTES QUERIES ====================

export async function getCheckpointNotes(checkpointId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(checkpointNotes).where(eq(checkpointNotes.checkpointId, checkpointId));
}

export async function createCheckpointNote(data: InsertCheckpointNote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(checkpointNotes).values(data);
}

// ==================== LOST & FOUND QUERIES ====================

export async function getAllLostFoundItems() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(lostFoundItems).orderBy(desc(lostFoundItems.createdAt));
}

export async function createLostFoundItem(data: InsertLostFoundItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(lostFoundItems).values(data);
}

export async function updateLostFoundItemStatus(uuid: string, status: "open" | "resolved") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(lostFoundItems).set({ 
    status,
    resolvedAt: status === "resolved" ? new Date() : null,
  }).where(eq(lostFoundItems.uuid, uuid));
}

// ==================== SYNC METADATA QUERIES ====================

export async function getSyncMetadata(deviceId: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(syncMetadata).where(eq(syncMetadata.deviceId, deviceId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateSyncMetadata(deviceId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(syncMetadata).values({
    deviceId,
    lastSyncAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: { lastSyncAt: new Date() },
  });
}

// ==================== STATISTICS QUERIES ====================

export async function getCheckpointStats() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    checkpointId: scanLogs.checkpointId,
    scanCount: sql<number>`count(*)`,
  }).from(scanLogs).groupBy(scanLogs.checkpointId);
  
  return result;
}

export async function getTodayStats() {
  const db = await getDb();
  if (!db) return { totalScans: 0, uniqueParticipants: 0 };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const scans = await db.select({
    totalScans: sql<number>`count(*)`,
    uniqueParticipants: sql<number>`count(distinct participantUuid)`,
  }).from(scanLogs).where(gte(scanLogs.scannedAt, today));
  
  return scans[0] || { totalScans: 0, uniqueParticipants: 0 };
}
