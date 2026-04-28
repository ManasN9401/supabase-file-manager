import { getSupabase } from "./supabase";

// ─── List ────────────────────────────────────────────────────────────────────

/**
 * List all items in a bucket at the given path prefix.
 * Returns folders first, then files, both sorted alphabetically.
 */
export async function listFiles(bucket, prefix = "", includeHidden = false) {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(prefix || undefined, { limit: 1000, sortBy: { column: "name", order: "asc" } });

  if (error) throw error;

  // Supabase marks folders by having a null id and null metadata.
  const isFolder = (item) =>
    item.id === null || item.metadata === null || item.metadata === undefined;

  const folders = data
    .filter(isFolder)
    .map((item) => ({ 
      ...item, 
      id: item.id || `folder:${item.name}`, 
      type: "folder" 
    }));

  const placeholderNames = [".keep", ".emptyFolderPlaceholder"];

  const files = data
    .filter((item) => !isFolder(item) && (includeHidden || !placeholderNames.includes(item.name)))
    .map((item) => ({ 
      ...item, 
      type: "file" 
    }));

  return [...folders, ...files];
}

// ─── Buckets ─────────────────────────────────────────────────────────────────

export async function listBuckets() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  return data;
}

// ─── Upload ──────────────────────────────────────────────────────────────────

/**
 * Upload a File object into the bucket at the given folder path.
 * e.g. bucket="documents", folderPath="Reports/Archive", file=<File>
 */
export async function uploadFile(bucket, folderPath, file, onProgress) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const filePath = folderPath ? `${folderPath}/${file.name}` : file.name;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      upsert: false,
      onUploadProgress: (progress) => {
        if (onProgress) {
          onProgress(Math.round((progress.loaded / progress.total) * 100));
        }
      },
    });

  if (error) throw error;
  return data;
}

// ─── Download ────────────────────────────────────────────────────────────────

export async function downloadFile(bucket, filePath) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(filePath);
  if (error) throw error;
  return data; // Blob
}

export function getPublicUrl(bucket, filePath) {
  const supabase = getSupabase();
  if (!supabase) return "";
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

// ─── Move / Rename ───────────────────────────────────────────────────────────

/**
 * Move or rename a single file.
 * Supabase Storage's .move() handles both — it's just changing the path.
 */
export async function moveFile(bucket, fromPath, toPath) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.storage
    .from(bucket)
    .move(fromPath, toPath);
  if (error) throw error;
}

/**
 * Rename a file in its current folder.
 */
export async function renameFile(bucket, folderPath, oldName, newName) {
  const fromPath = folderPath ? `${folderPath}/${oldName}` : oldName;
  const toPath = folderPath ? `${folderPath}/${newName}` : newName;
  return moveFile(bucket, fromPath, toPath);
}

/**
 * Move a folder by listing all its contents and moving each file.
 * Supabase Storage has no native folder move, so we do it recursively.
 * Returns total number of files moved.
 */
export async function moveFolder(bucket, fromPrefix, toPrefix, onProgress) {
  const allFiles = await listAllFilesRecursive(bucket, fromPrefix);
  const total = allFiles.length;
  let done = 0;

  for (const filePath of allFiles) {
    const relativePath = filePath.slice(fromPrefix.length + 1);
    const newPath = `${toPrefix}/${relativePath}`;
    await moveFile(bucket, filePath, newPath);
    done++;
    if (onProgress) onProgress(Math.round((done / total) * 100));
  }

  return total;
}

/**
 * Rename a folder (move all its contents to a new prefix).
 */
export async function renameFolder(
  bucket,
  parentPath,
  oldName,
  newName,
  onProgress
) {
  const fromPrefix = parentPath ? `${parentPath}/${oldName}` : oldName;
  const toPrefix = parentPath ? `${parentPath}/${newName}` : newName;
  return moveFolder(bucket, fromPrefix, toPrefix, onProgress);
}

// ─── Delete ──────────────────────────────────────────────────────────────────

/**
 * Delete a list of file paths from a bucket.
 */
export async function deleteFiles(bucket, filePaths) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.storage.from(bucket).remove(filePaths);
  if (error) throw error;
}

/**
 * Delete a folder and all its contents recursively.
 */
export async function deleteFolder(bucket, folderPrefix) {
  const allFiles = await listAllFilesRecursive(bucket, folderPrefix);
  if (allFiles.length === 0) return 0;
  await deleteFiles(bucket, allFiles);
  return allFiles.length;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Recursively list all file paths under a prefix.
 * Returns flat array of full paths (not folders, only leaf files).
 */
async function listAllFilesRecursive(bucket, prefix) {
  const items = await listFiles(bucket, prefix, true);
  const results = [];

  for (const item of items) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.type === "folder") {
      const nested = await listAllFilesRecursive(bucket, itemPath);
      results.push(...nested);
    } else {
      results.push(itemPath);
    }
  }

  return results;
}

/**
 * Build the full storage path for an item given the current bucket path array.
 * e.g. path=["Reports","Archive"], name="file.pdf" → "Reports/Archive/file.pdf"
 */
export function buildPath(pathSegments, name) {
  return [...pathSegments, name].join("/");
}

export function parentPath(pathSegments) {
  return pathSegments.join("/");
}