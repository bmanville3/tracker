import { router } from "expo-router";
import { Alert } from "react-native";
import { MINUTE_MS } from "./constants";
import { supabase } from "./supabase";
import { CACHE_FACTORY } from "./swrCache";
import { ISODate, ProfileRow, UUID } from "./types";
import { DistanceUnit, TimeUnit, WeightUnit } from "./types/enums";

const TTL_MS = 5 * MINUTE_MS;
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
      return [{ ...fetchedProfile, id: fetchedProfile.user_id }];
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

const TO_SECONDS: Record<TimeUnit, number> = {
  sec: 1,
  min: 60,
  hr: 3600,
};

export function changeTimeUnit(
  time: number,
  sourceUnit: TimeUnit,
  targetUnit: TimeUnit,
): number {
  return changeUnit(time, sourceUnit, targetUnit, TO_SECONDS);
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

export function isSubsetOfArray<T>(a: Array<T>, b: Array<T>): boolean {
  if (a === b) {
    return true;
  }
  for (const ai of a) {
    if (!b.includes(ai)) return false;
  }
  return true;
}

export function maxNullable(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
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

/**
 * Gets the number of days from date1 to date2.
 * For example, if date1='2025-10-20' and date2='2025-10-21',
 * then daysBetweenDates(date1, date2) = 1.
 *
 * It is assumed date1 <= date2. A negative number CAN be returned.
 */
export function daysBetweenDates(date1: ISODate, date2: ISODate): number {
  const d1 = new Date(date1 + "T00:00:00Z");
  const d2 = new Date(date2 + "T00:00:00Z");

  const diffMs = d2.getTime() - d1.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function addDays(date: Date, days: number): Date {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}

export function addDaysToIsoDate(date: ISODate, days: number): ISODate {
  return toISODate(addDays(fromISODate(date), days));
}

export function generateDateRange(
  minDateInclusive: ISODate,
  maxDateInclusive: ISODate,
): ISODate[] {
  const range = [];
  let currDate = minDateInclusive;
  while (currDate <= maxDateInclusive) {
    range.push(currDate);
    currDate = addDaysToIsoDate(currDate, 1);
  }
  return range;
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

export function stringifyList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * https://stackoverflow.com/questions/51203917/math-behind-hsv-to-rgb-conversion-of-colors
 */
function hsvToRgb(
  h: number,
  s: number,
  v: number,
): { r: number; b: number; g: number } {
  let r: number = 0;
  let b: number = 0;
  let g: number = 0;

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      ((r = v), (g = t), (b = p));
      break;
    case 1:
      ((r = q), (g = v), (b = p));
      break;
    case 2:
      ((r = p), (g = v), (b = t));
      break;
    case 3:
      ((r = p), (g = q), (b = v));
      break;
    case 4:
      ((r = t), (g = p), (b = v));
      break;
    case 5:
      ((r = v), (g = p), (b = q));
      break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

export function rgbColorGenerator(step: number, maxSteps: number): string {
  const h = (step % maxSteps) / maxSteps;
  const s = 0.8;
  const v = 0.825;

  const rgb = hsvToRgb(h, s, v);
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

export type OmitNever<T, K extends keyof T> = Omit<T, K> & {
  [P in K]?: never;
};
export type AllOrNothing<T> = T | { [K in keyof T]: null };

export function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function isRealNumber(value: any): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function randomInt(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
