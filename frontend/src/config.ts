/** Central app configuration. Fail fast if env vars are missing. */
const requireEnv = (key: string): string => {
    const value = import.meta.env[key];
    if (!value) throw new Error(`Missing required env variable: ${key}`);
    return value;
  };
  
  export const config = {
    apiUrl: requireEnv('VITE_API_URL') as string,
    wsUrl: requireEnv('VITE_WS_URL') as string,
    stunServer: requireEnv('VITE_STUN_SERVER') as string,
  } as const;
  