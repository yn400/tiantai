/// <reference types="vite/client" />

export {};

interface ImportMetaEnv {
  readonly VITE_DEEPSEEK_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** preload 安全桥暴露的能力（见 electron/preload.cjs） */
declare global {
  interface Window {
    tiantaiCare?: {
      setEnabled: (v: boolean) => Promise<boolean>;
      setCloseToTray: (v: boolean) => Promise<boolean>;
    };
    tiantaiSecure?: {
      set: (key: string, value: string) => Promise<boolean>;
      get: (key: string) => Promise<string>;
    };
    tiantaiTTS?: {
      speak: (text: string) => Promise<string | null>;
    };
    tiantaiBackup?: {
      backup: (json: string) => Promise<boolean>;
    };
  }
}
