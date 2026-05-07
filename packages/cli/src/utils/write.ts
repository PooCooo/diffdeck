import { writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export function writeFileAtomic(path: string, data: string): void {
    try {
        mkdirSync(dirname(path), { recursive: true });
        const tmp = path + "." + 'tmp-' + randomUUID();
        writeFileSync(tmp, data);
        renameSync(tmp, path);
    } catch (err: unknown) {
        throw new Error(
            `Error writing to "${path}": ${(err as Error).message}`,
        );
    }
}