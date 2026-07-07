declare global {
  namespace Express {
    interface Request {
      /** Correlation id assigned by the request-id middleware. */
      requestId: string;
      /** Epoch ms when the request entered the app; feeds durationMs metadata. */
      startedAt: number;
    }
  }
}

export {};
