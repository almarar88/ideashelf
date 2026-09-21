import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface AudiobookPage {
  page: number;
  /** Spoken by the device voice. */
  text?: string;
  /** Pre-signed audio URL for a store book. */
  url?: string;
}

export interface AudiobookStartOptions {
  mode: "tts" | "audio";
  title: string;
  author: string;
  rate: number;
  startPage: number;
  pages: AudiobookPage[];
}

export interface AudiobookNativePlugin {
  ensureNotificationPermission(): Promise<{ granted: boolean }>;
  start(options: AudiobookStartOptions): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  seekToPage(options: { page: number }): Promise<void>;
  isRunning(): Promise<{ running: boolean }>;
  addListener(event: "pageChanged", cb: (data: { page: number }) => void): Promise<PluginListenerHandle>;
  addListener(event: "stateChanged", cb: (data: { playing: boolean }) => void): Promise<PluginListenerHandle>;
  addListener(event: "finished", cb: () => void): Promise<PluginListenerHandle>;
  addListener(event: "narrationError", cb: (data: { message: string }) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

/** Implemented by AudiobookPlugin.java; a no-op stub on the web. */
export const Audiobook = registerPlugin<AudiobookNativePlugin>("Audiobook");
