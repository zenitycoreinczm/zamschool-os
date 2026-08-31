/**
 * Offline file upload queue — stores file metadata and defers upload until reconnection.
 * 
 * Files > 5MB are NOT queued (too large for localStorage). Users see an error
 * suggesting they retry when online with a smaller file.
 */

const FILE_UPLOAD_QUEUE_KEY = "zamschool-file-upload-queue";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit for localStorage

export interface PendingFileUpload {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  entityType: string;
  base64Data: string; // For files <= 5MB only
  timestamp: number;
  retries: number;
}

type UploadListener = (count: number) => void;
const uploadListeners = new Set<UploadListener>();

function notifyListeners() {
  const count = getPendingUploadCount();
  for (const listener of uploadListeners) {
    try {
      listener(count);
    } catch {
      /* ignore */
    }
  }
}

export function subscribeToPendingUploads(listener: UploadListener): () => void {
  uploadListeners.add(listener);
  listener(getPendingUploadCount());
  return () => uploadListeners.delete(listener);
}

export function getPendingUploadCount(): number {
  return loadPendingUploads().length;
}

/**
 * Queue a file for later upload if offline. Returns null if file is too large.
 */
export async function queueFileUpload(
  file: File,
  entityType: string,
): Promise<PendingFileUpload | null> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    console.warn("[OfflineFileUpload] File too large for offline queue:", file.size);
    return null;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuffer)),
    );

    const pendingUpload: PendingFileUpload = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      entityType,
      base64Data,
      timestamp: Date.now(),
      retries: 0,
    };

    const queue = loadPendingUploads();
    queue.push(pendingUpload);
    localStorage.setItem(FILE_UPLOAD_QUEUE_KEY, JSON.stringify(queue));
    notifyListeners();

    return pendingUpload;
  } catch (error) {
    console.error("[OfflineFileUpload] Failed to queue file:", error);
    return null;
  }
}

/**
 * Process all pending file uploads. Called when network returns.
 */
export async function processPendingUploads(): Promise<{
  processed: number;
  failed: number;
}> {
  const queue = loadPendingUploads();
  if (queue.length === 0) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;
  const remaining: PendingFileUpload[] = [];

  for (const item of queue) {
    try {
      // Convert base64 back to Blob
      const binaryString = atob(item.base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: item.fileType });
      const file = new File([blob], item.fileName, { type: item.fileType });

      // Create FormData for upload
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", item.entityType);

      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (response.ok) {
        processed++;
      } else if (response.status >= 500) {
        // Server error — retry up to 3 times
        if (item.retries < 3) {
          item.retries++;
          remaining.push(item);
        } else {
          failed++;
        }
      } else {
        // Client error (4xx) — drop permanently
        console.error("[OfflineFileUpload] Upload failed:", item.fileName, response.status);
        failed++;
      }
    } catch (error) {
      console.warn("[OfflineFileUpload] Upload error:", error);
      if (item.retries < 3) {
        item.retries++;
        remaining.push(item);
      } else {
        failed++;
      }
    }
  }

  // Update queue
  if (remaining.length === 0) {
    localStorage.removeItem(FILE_UPLOAD_QUEUE_KEY);
  } else {
    localStorage.setItem(FILE_UPLOAD_QUEUE_KEY, JSON.stringify(remaining));
  }

  notifyListeners();
  return { processed, failed };
}

function loadPendingUploads(): PendingFileUpload[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FILE_UPLOAD_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingFileUpload[];
  } catch (error) {
    console.error("[OfflineFileUpload] Failed to load queue:", error);
    return [];
  }
}
