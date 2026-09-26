// Server-side environment access. Never import this from src/ — these values
// must not reach the browser bundle.

/** Thrown when a required env var is missing. http.ts turns it into a generic 500. */
export class ConfigError extends Error {
  constructor(public readonly variable: string) {
    super(`Missing required environment variable ${variable}. Add it to .env.local (see .env.example).`);
    this.name = 'ConfigError';
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ConfigError(name);
  return value;
}
