/**
 * Server-side mutable user directory for mock APIs (provisioning, suspend).
 * Overlays patches on seed users from mock-data; tracks newly provisioned users.
 */

import { users as seedUsers } from "@/lib/mock-data";
import type { User } from "@/lib/types";

const userPatches = new Map<string, Partial<User>>();
const addedUsers: User[] = [];

export function listDirectoryUsers(): User[] {
  const merged = seedUsers.map((u) => ({ ...u, ...userPatches.get(u.id) }));
  return [...merged, ...addedUsers];
}

export function getDirectoryUserById(id: string): User | undefined {
  return listDirectoryUsers().find((u) => u.id === id);
}

export function patchDirectoryUser(id: string, patch: Partial<User>): User | undefined {
  if (seedUsers.some((u) => u.id === id)) {
    userPatches.set(id, { ...userPatches.get(id), ...patch });
    return listDirectoryUsers().find((u) => u.id === id);
  }
  const idx = addedUsers.findIndex((u) => u.id === id);
  if (idx >= 0) {
    addedUsers[idx] = { ...addedUsers[idx], ...patch };
    return addedUsers[idx];
  }
  return undefined;
}

export function addDirectoryUser(user: User): void {
  addedUsers.push(user);
}
