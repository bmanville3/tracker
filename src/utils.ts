import { router } from "expo-router";
import { Alert } from "react-native";
import { MINUTE_MS } from "./constants";
import { supabase } from "./supabase";
import { CACHE_FACTORY } from "./swrCache";
import { ISODate, ProfileRow, UUID } from "./types";
import { DistanceUnit, WeightUnit } from "./types/enums";

const TTL_MS = 1 * MINUTE_MS;
type WrappedProfile = ProfileRow & { id: UUID };
export const PROFILE_CACHE =
  CACHE_FACTORY.getOrCreateSwrIdCache<WrappedProfile>("profileCache", TTL_MS);

export async function getUser(): Promise<ProfileRow | null> {
  try {
    const wrappedProfile = await PROFILE_CACHE.fetch(async () => {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        showAlert("Auth error", authErr.message);
        throw authErr;
      }
      const user = auth.user;
      if (!user) {
        showAlert(
          "No user found",
          "You appear to be logged out. Try logging out and back in",
        );
        throw new Error("No user found");
      }
      const { data: profile, error: profileErr } = await supabase
        .from("user_profile")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (profileErr) {
        showAlert(
          "Error fetching profile. Please contact bmanville03@gmail.com if error persists.",
          profileErr.message,
        );
        throw profileErr;
      }
      if (!profile) {
        showAlert("No profile found. Please contact bmanville03@gmail.com.");
        throw new Error("No profile found");
      }
      const fetchedProfile: ProfileRow = profile;
      return [
        { ...fetchedProfile, id: fetchedProfile.user_id },
      ];
    });
    return [...wrappedProfile.values()].at(0) ?? null;
  } catch (e: unknown) {
    showAlert(
      "Error getting profile",
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}

export async function logOut() {
  CACHE_FACTORY.clearAll();
  await supabase.auth.signOut();
  router.replace("/");
}

export async function requireGetUser(): Promise<ProfileRow | null> {
  const user = await getUser();
  if (user === null) {
    await logOut();
  }
  return user;
}

export const showAlert = (title: string, message?: string) => {
  if (typeof window !== "undefined") {
    window.alert(message ? `${title}\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
};

export function pageKey(
  prefix: string,
  parts: Record<string, unknown>,
): string {
  const entries = Object.entries(parts).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const normalized = Object.fromEntries(entries);
  return `${prefix}:${JSON.stringify(normalized)}`;
}

export function capitalizeFirstLetter(val: string) {
  if (val.length === 0) {
    return val;
  }
  if (val.length === 1) {
    return val.charAt(0).toUpperCase();
  }
  return val.charAt(0).toUpperCase() + val.slice(1);
}

export function setsEqual<T>(a: Set<T>, b: Set<T>) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

export function changeUnit<T extends string | number | symbol>(
  x: number,
  sourceUnit: T,
  targetUnit: T,
  conversionToBaseUnit: Record<T, number>,
): number {
  if (sourceUnit === targetUnit) return x;

  if (!(sourceUnit in conversionToBaseUnit)) {
    throw new Error(`Unsupported source unit: ${String(sourceUnit)}`);
  }

  if (!(targetUnit in conversionToBaseUnit)) {
    throw new Error(`Unsupported target unit: ${String(targetUnit)}`);
  }

  const inBaseUnit = x * conversionToBaseUnit[sourceUnit];
  return inBaseUnit / conversionToBaseUnit[targetUnit];
}

const TO_KG: Record<WeightUnit, number> = {
  kg: 1,
  lb: 0.45359237,
};

export function changeWeightUnit(
  weight: number,
  sourceUnit: WeightUnit,
  targetUnit: WeightUnit,
): number {
  return changeUnit(weight, sourceUnit, targetUnit, TO_KG);
}

const TO_METERS: Record<DistanceUnit, number> = {
  m: 1,
  km: 1000,
  mi: 1609.344,
  ft: 0.3048,
  yd: 0.9144,
};

export function changeDistanceUnit(
  distance: number,
  sourceUnit: DistanceUnit,
  targetUnit: DistanceUnit,
): number {
  return changeUnit(distance, sourceUnit, targetUnit, TO_METERS);
}

export function isSubsetOf<T>(a: Set<T>, b: Set<T>): boolean {
  if (a === b) {
    return true;
  }
  for (const ai of a) {
    if (!b.has(ai)) return false;
  }
  return true;
}

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function fromISODate(d: ISODate): Date {
  const [yearStr, monthStr, dayStr] = d.split("-");

  const year = Number(yearStr);
  const month = Number(monthStr); // 1–12
  const day = Number(dayStr);

  return new Date(year, month - 1, day);
}

export function arraysEqual<T>(
  a: readonly T[],
  b: readonly T[],
  eq: (x: T, y: T) => boolean,
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!eq(a[i], b[i])) return false;
  }
  return true;
}

export function doubleArraysEqual<T>(
  a: readonly T[][],
  b: readonly T[][],
  eq: (x: T, y: T) => boolean,
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!arraysEqual(a[i], b[i], eq)) return false;
  }
  return true;
}

export function tripleArraysEqual<T>(
  a: readonly T[][][],
  b: readonly T[][][],
  eq: (x: T, y: T) => boolean,
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!doubleArraysEqual(a[i], b[i], eq)) return false;
  }
  return true;
}

export function anyErrorToString(e: any, fallback: string): string {
  return e instanceof Error
      ? e.message
      : typeof e === "string"
      ? e
      : e?.message || fallback;
}

export type OmitNever<T, K extends keyof T> =
  Omit<T, K> & {
    [P in K]?: never;
  };
