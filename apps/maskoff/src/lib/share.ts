import { Capacitor } from "@capacitor/core";

/**
 * Sharing an image, on every platform we run on.
 *
 * Android WebView supports neither `navigator.share` with files nor
 * `<a download>`, so inside the APK both the web paths are dead ends. There we
 * write the PNG to the app's cache directory and hand its URI to the native
 * share sheet, which is what actually surfaces Instagram Stories and WhatsApp.
 */
export type ShareOutcome = "shared" | "saved" | "cancelled";

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  // Chunked to avoid blowing the argument limit on a ~1MB story image.
  const CHUNK = 0x8000;
  for (let i = 0; i < buffer.length; i += CHUNK) {
    binary += String.fromCharCode(...buffer.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export async function shareImage(
  blob: Blob,
  filename: string,
  title: string,
  text: string,
): Promise<ShareOutcome> {
  if (isNative()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);

    const written = await Filesystem.writeFile({
      path: filename,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
    });

    try {
      await Share.share({ title, text, files: [written.uri] });
      return "shared";
    } catch (error) {
      // The native sheet throws a plain Error on dismissal.
      if (error instanceof Error && /cancel/i.test(error.message)) return "cancelled";
      throw error;
    }
  }

  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      throw error;
    }
  }

  downloadBlob(blob, filename);
  return "saved";
}

export async function saveImage(blob: Blob, filename: string): Promise<ShareOutcome> {
  if (isNative()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    // Documents is the only directory a user can actually find from a file
    // manager without extra storage permissions.
    await Filesystem.writeFile({
      path: filename,
      data: await blobToBase64(blob),
      directory: Directory.Documents,
    });
    return "saved";
  }

  downloadBlob(blob, filename);
  return "saved";
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
