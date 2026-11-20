import type { DatabaseSync } from 'node:sqlite';
export declare const SCHEMA: string;
export declare const MIN_PASSWORD: number;
export declare function dataDir(): string;
export declare function openDb(): DatabaseSync;
export declare function hashPassword(pw: string): string;
export declare function verifyPassword(pw: string, stored: string): boolean;
