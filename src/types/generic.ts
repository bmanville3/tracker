export type UUID = string;
export type ISODate = string;

export type AllOrNothing<T> = T | { [K in keyof T]: null };
