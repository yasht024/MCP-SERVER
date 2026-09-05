import fs from 'fs';
import path from 'path';
import { Logger } from './logger.js';

export interface IdempotencyRecord {
  key: string;
  result: any;
  timestamp: string;
}

export class IdempotencyStore {
  private filePath: string;
  private records: Map<string, IdempotencyRecord>;

  constructor(filePath: string = process.env.IDEMPOTENCY_STORAGE_PATH || 'idempotency.json') {
    this.filePath = path.resolve(process.cwd(), filePath);
    this.records = new Map();
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(data) as IdempotencyRecord[];
        for (const record of parsed) {
          this.records.set(record.key, record);
        }
      }
    } catch (error) {
      Logger.error('Failed to load idempotency store', { error });
    }
  }

  private save() {
    try {
      const data = Array.from(this.records.values());
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      Logger.error('Failed to save idempotency store', { error });
    }
  }

  public get(key: string): any | null {
    const record = this.records.get(key);
    if (record) {
      // Optional: Check retention period, e.g., 24 hours. For now, keep it simple.
      return record.result;
    }
    return null;
  }

  public set(key: string, result: any) {
    this.records.set(key, {
      key,
      result,
      timestamp: new Date().toISOString(),
    });
    this.save();
  }
}

export const globalIdempotencyStore = new IdempotencyStore();
