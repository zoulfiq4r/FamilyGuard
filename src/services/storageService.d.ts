export type StoredChildContext = {
  childId: string;
  parentId?: string;
  childName?: string;
};

export function loadStoredChildContext(): Promise<StoredChildContext | null>;
export function persistChildContext(context: StoredChildContext): Promise<void>;
export function clearStoredChildContext(): Promise<void>;
