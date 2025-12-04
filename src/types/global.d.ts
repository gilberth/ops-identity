export {};

declare global {
  interface Window {
    env: {
      VPS_ENDPOINT?: string;
    };
  }
}
