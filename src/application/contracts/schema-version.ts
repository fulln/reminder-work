import { z } from "zod";

export const schemaVersion = z.literal(1);

export interface VersionedContract {
  readonly schemaVersion: 1;
}
