export declare function normalizeParentPath(value: unknown): string;
export declare function parentSegmentId(parentPath: string): string;
export declare function pagePathMap(entries: readonly { id: string; parent?: unknown }[]): Map<string, string>;
