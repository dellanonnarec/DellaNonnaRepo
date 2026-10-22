export {};

declare global {
  interface Window {
    desktop?: {
      platform: string;
      getPrinters: () => Promise<Array<{ name: string; displayName?: string; status?: number }>>;
      printReceipt: (input: { printerName: string; order: unknown }) => Promise<{ jobId: number; bytes: number }>;
      testPrinter: (printerName: string) => Promise<{ jobId: number; bytes: number }>;
      getStartupSetting: () => Promise<boolean>;
      setStartupSetting: (enabled: boolean) => Promise<boolean>;
    };
  }
}
