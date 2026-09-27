const NAME_KEY = 'displayName';

export function saveDisplayName(name: string): void {
  localStorage.setItem(NAME_KEY, name.trim());
}

export function getDisplayName(): string | null {
  return localStorage.getItem(NAME_KEY);
}

export function clearDisplayName(): void {
  localStorage.removeItem(NAME_KEY);
}
