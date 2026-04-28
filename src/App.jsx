import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  listBuckets,
  listFiles,
  uploadFile,
  downloadFile,
  moveFile,
  moveFolder,
  renameFile,
  renameFolder,
  deleteFiles,
  deleteFolder,
  buildPath,
  parentPath,
} from "./storage";
import { 
  getSupabase, 
  initSupabase, 
  clearSupabase 
} from "./supabase";
import { save } from "@tauri-apps/api/dialog";
import { writeBinaryFile } from "@tauri-apps/api/fs";

// ─── Icons ────────────────────────────────────────────────────────────────────

function getIcon(name, type) {
  if (type === "folder") return "📁";
  const ext = name.split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "avif"].includes(ext)) return "🖼️";
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "🎬";
  if (ext === "pdf") return "📄";
  if (["zip", "tar", "gz", "rar", "7z"].includes(ext)) return "🗜️";
  if (["doc", "docx", "txt", "md", "rtf"].includes(ext)) return "📝";
  if (["csv", "xlsx", "xls"].includes(ext)) return "📊";
  if (["mp3", "wav", "ogg", "flac", "aac"].includes(ext)) return "🎵";
  if (["js", "ts", "jsx", "tsx", "py", "go", "rs", "html", "css", "json", "sql"].includes(ext)) return "💻";
  return "📎";
}

function fmtSize(b) {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(1)} GB`;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === "error" ? "⚠ " : "✓ "}{t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}


// ─── Context Menu ─────────────────────────────────────────────────────────────

function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div className="context-menu" style={{ left: x, top: y }} ref={ref} onClick={(e) => e.stopPropagation()}>
      {items.map((item, i) =>
        item === "sep" ? (
          <div key={i} className="cm-sep" />
        ) : (
          <div
            key={i}
            className={`cm-item ${item.danger ? "danger" : ""} ${item.disabled ? "disabled" : ""}`}
            onClick={(e) => { 
              e.stopPropagation(); 
              if (!item.disabled) { 
                item.action(); 
                onClose(); 
              } 
            }}
          >
            <span className="cm-icon">{item.icon}</span>
            {item.label}
          </div>
        )
      )}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, label }) {
  return (
    <div className="progress-wrap">
      <div className="progress-label">{label}</div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${value}%` }} />
      </div>
      <div className="progress-pct">{value}%</div>
    </div>
  );
}

// ─── File Card (Grid) ─────────────────────────────────────────────────────────

function FileCard({ item, selected, renamingId, onSelect, onOpen, onContextMenu, onRenameCommit, onRenameCancel, dragHandlers }) {
  const isRenaming = renamingId === item.id;
  const inputRef = useRef();

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (isRenaming) return;
    onSelect(e, item);
  };

  return (
    <div
      className={`file-card ${selected ? "selected" : ""}`}
      onClick={handleClick}
      onDoubleClick={() => onOpen(item)}
      onContextMenu={(e) => onContextMenu(e, item)}
      draggable={!isRenaming}
      {...dragHandlers(item)}
    >
      <div className="file-icon">{getIcon(item.name, item.type)}</div>
      {isRenaming ? (
        <input
          ref={inputRef}
          className="rename-input"
          defaultValue={item.name}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onRenameCommit(item, e.target.value);
            }
            if (e.key === "Escape") onRenameCancel();
          }}
          onBlur={(e) => {
            if (renamingId === item.id) {
              onRenameCommit(item, e.target.value);
            }
          }}
        />
      ) : (
        <div className="file-name" title={item.name}>{item.name}</div>
      )}
      <div className="file-meta">
        {item.type === "folder" ? "Folder" : fmtSize(item.metadata?.size)}
      </div>
    </div>
  );
}

// ─── File Row (List) ──────────────────────────────────────────────────────────

function FileRow({ item, selected, renamingId, onSelect, onOpen, onContextMenu, onRenameCommit, onRenameCancel, dragHandlers }) {
  const isRenaming = renamingId === item.id;
  const inputRef = useRef();

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (isRenaming) return;
    onSelect(e, item);
  };

  return (
    <div
      className={`file-row ${selected ? "selected" : ""}`}
      onClick={handleClick}
      onDoubleClick={() => onOpen(item)}
      onContextMenu={(e) => onContextMenu(e, item)}
      draggable={!isRenaming}
      {...dragHandlers(item)}
    >
      <span className="row-icon">{getIcon(item.name, item.type)}</span>
      <div className="row-name">
        {isRenaming ? (
          <input
            ref={inputRef}
            className="rename-input inline"
            defaultValue={item.name}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameCommit(item, e.target.value);
              if (e.key === "Escape") onRenameCancel();
            }}
            onBlur={(e) => {
              if (renamingId === item.id) {
                onRenameCommit(item, e.target.value);
              }
            }}
          />
        ) : (
          item.name
        )}
      </div>
      <div className="row-size">{item.type === "folder" ? "—" : fmtSize(item.metadata?.size)}</div>
      <div className="row-date">{fmtDate(item.updated_at || item.created_at)}</div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activeBucket, setActiveBucket] = useState(null);
  const [buckets, setBuckets] = useState([]);
  const [path, setPath] = useState([]); // Array of folder segments
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [renamingId, setRenamingId] = useState(null);
  const isCommittingRename = useRef(false);
  const [view, setView] = useState("grid"); // "grid" | "list"
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [progress, setProgress] = useState(null);
  const [modal, setModal] = useState(null); // { type: "move" | "delete" | "createFolder" | "settings" }
  const [contextMenu, setContextMenu] = useState(null);
  const [hasCredentials, setHasCredentials] = useState(!!getSupabase());

  const fileInputRef = useRef();
  const dragSourceRef = useRef(null);
  const [dragOverId, setDragOverId] = useState(null);

  // ── Toast helpers ──────────────────────────────────────────────────────────

  const toast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const toastError = useCallback((err) => {
    console.error(err);
    toast(err?.message || String(err), "error");
  }, [toast]);

  // ── Load buckets ───────────────────────────────────────────────────────────

  const loadBuckets = useCallback(async () => {
    try {
      const data = await listBuckets();
      setBuckets(data);
      if (data.length > 0 && !activeBucket) {
        setActiveBucket(data[0].name);
      }
    } catch (err) {
      toastError(err);
    }
  }, [activeBucket, toastError]);

  useEffect(() => {
    if (hasCredentials) {
      loadBuckets();
    }
  }, [hasCredentials, loadBuckets]);

  // ── Load files ─────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    if (!activeBucket || !hasCredentials) return;
    setLoading(true);
    setSelected(new Set());
    try {
      const items = await listFiles(activeBucket, parentPath(path));
      setFiles(items);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [activeBucket, path, hasCredentials, toastError]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const navigateTo = (segments) => {
    setPath(segments);
    setSelected(new Set());
    setRenamingId(null);
  };

  const openItem = (item) => {
    if (item.type === "folder") {
      navigateTo([...path, item.name]);
    } else {
      handleDownload(item);
    }
  };

  // ── Selection ──────────────────────────────────────────────────────────────

  const handleSelect = (e, item) => {
    e.stopPropagation();
    if (renamingId) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (e.ctrlKey || e.metaKey) {
        next.has(item.id) ? next.delete(item.id) : next.add(item.id);
      } else if (e.shiftKey && prev.size > 0) {
        const ids = files.map((f) => f.id);
        const lastId = [...prev].pop();
        const from = ids.indexOf(lastId);
        const to = ids.indexOf(item.id);
        const [a, b] = from < to ? [from, to] : [to, from];
        ids.slice(a, b + 1).forEach((id) => next.add(id));
      } else {
        next.clear();
        next.add(item.id);
      }
      return next;
    });
  };

  // ── Rename ─────────────────────────────────────────────────────────────────

  const startRename = (item) => {
    setSelected(new Set([item.id]));
    setRenamingId(item.id);
  };

  const commitRename = async (item, newName) => {
    if (isCommittingRename.current) return;
    isCommittingRename.current = true;
    setRenamingId(null);
    newName = newName.trim();
    if (!newName || newName === item.name) {
      isCommittingRename.current = false;
      return;
    }
    try {
      if (item.type === "folder") {
        setProgress({ label: `Renaming folder "${item.name}"…`, value: 0 });
        await renameFolder(activeBucket, parentPath(path), item.name, newName, (v) =>
          setProgress({ label: `Renaming…`, value: v })
        );
      } else {
        await renameFile(activeBucket, parentPath(path), item.name, newName);
      }
      toast(`Renamed to "${newName}"`);
    } catch (err) {
      toastError(err);
    } finally {
      isCommittingRename.current = false;
      setProgress(null);
      refresh();
    }
  };

  // ── Upload ─────────────────────────────────────────────────────────────────

  const handleFileInputChange = async (e) => {
    const fileList = Array.from(e.target.files);
    if (!fileList.length) return;
    let done = 0;
    for (const file of fileList) {
      try {
        setProgress({ label: `Uploading ${file.name}…`, value: 0 });
        await uploadFile(activeBucket, parentPath(path), file, (v) =>
          setProgress({ label: `Uploading ${file.name}…`, value: v })
        );
        done++;
      } catch (err) {
        toastError(err);
      }
    }
    setProgress(null);
    if (done) toast(`Uploaded ${done} file${done !== 1 ? "s" : ""}`);
    refresh();
    e.target.value = "";
  };

  // ── Download ───────────────────────────────────────────────────────────────

  const handleDownload = async (item) => {
    try {
      const filePath = buildPath(path, item.name);
      const blob = await downloadFile(activeBucket, filePath);
      
      const selectedPath = await save({
        defaultPath: item.name,
      });

      if (selectedPath) {
        const arrayBuffer = await blob.arrayBuffer();
        await writeBinaryFile(selectedPath, new Uint8Array(arrayBuffer));
        toast(`Saved to ${selectedPath}`);
      }
    } catch (err) {
      toastError(err);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (items) => {
    setModal(null);
    const folders = items.filter((i) => i.type === "folder");
    const fileItems = items.filter((i) => i.type !== "folder");
    let totalDeleted = 0;
    try {
      if (fileItems.length) {
        const paths = fileItems.map((i) => buildPath(path, i.name));
        await deleteFiles(activeBucket, paths);
        totalDeleted += fileItems.length;
      }
      for (const folder of folders) {
        setProgress({ label: `Deleting "${folder.name}"…`, value: 0 });
        const count = await deleteFolder(activeBucket, buildPath(path, folder.name));
        totalDeleted += count + 1;
      }
      toast(`Deleted ${items.length} item${items.length !== 1 ? "s" : ""}`);
    } catch (err) {
      toastError(err);
    } finally {
      setProgress(null);
      setSelected(new Set());
      refresh();
    }
  };

  const confirmDelete = (items) => {
    setModal({ type: "confirm-delete", items });
    setContextMenu(null);
  };

  // ── Move ───────────────────────────────────────────────────────────────────

  const handleMove = async (items, targetPath) => {
    setModal(null);
    let moved = 0;
    try {
      for (const item of items) {
        const fromPath = buildPath(path, item.name);
        const toPath = targetPath ? `${targetPath}/${item.name}` : item.name;
        
        if (item.type === "folder") {
          setProgress({ label: `Moving "${item.name}"…`, value: 0 });
          await moveFolder(activeBucket, fromPath, toPath, (v) =>
            setProgress({ label: `Moving "${item.name}"…`, value: v })
          );
        } else {
          await moveFile(activeBucket, fromPath, toPath);
        }
        moved++;
      }
      toast(`Moved ${moved} item${moved !== 1 ? "s" : ""}`);
    } catch (err) {
      toastError(err);
    } finally {
      setProgress(null);
      setSelected(new Set());
      refresh();
    }
  };

  const openMoveModal = (items) => {
    const subfolders = files.filter(
      (f) => f.type === "folder" && !items.find((i) => i.id === f.id)
    );
    
    const locations = subfolders.map(f => ({ 
      label: `Into: ${f.name}`, 
      path: buildPath(path, f.name) 
    }));

    for (let i = 0; i < path.length; i++) {
      const parentSegs = path.slice(0, i);
      const parentName = parentSegs[parentSegs.length - 1] || activeBucket;
      locations.unshift({ 
        label: `Up to: ${parentName}`, 
        path: parentSegs.join("/") 
      });
    }

    setModal({ type: "move", items, locations });
    setContextMenu(null);
  };

  // ── New folder ─────────────────────────────────────────────────────────────

  const createFolder = async (name) => {
    setModal(null);
    try {
      const placeholder = new File([""], ".keep", { type: "text/plain" });
      const folderPath = buildPath(path, name);
      await uploadFile(activeBucket, folderPath, placeholder);
      toast(`Created folder "${name}"`);
    } catch (err) {
      toastError(err);
    }
    refresh();
  };

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  const dragHandlers = (item) => ({
    onDragStart: (e) => {
      dragSourceRef.current = item;
      e.dataTransfer.effectAllowed = "move";
    },
    onDragEnd: () => { dragSourceRef.current = null; setDragOverId(null); },
    onDragOver: (e) => {
      if (item.type !== "folder") return;
      if (dragSourceRef.current?.id === item.id) return;
      e.preventDefault();
      setDragOverId(item.id);
    },
    onDragLeave: () => setDragOverId(null),
    onDrop: (e) => {
      e.preventDefault();
      setDragOverId(null);
      const source = dragSourceRef.current;
      if (!source || source.id === item.id || item.type !== "folder") return;
      const toMove = selected.has(source.id)
        ? files.filter((f) => selected.has(f.id))
        : [source];
      handleMove(toMove, buildPath(path, item.name));
    },
  });

  // ── Context menu builder ───────────────────────────────────────────────────

  const showContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    let currentSelected = selected;
    if (!selected.has(item.id)) {
      currentSelected = new Set([item.id]);
      setSelected(currentSelected);
    }

    const selectedItems = files.filter((f) => currentSelected.has(f.id));
    const availableFolders = files.filter(
      (f) => f.type === "folder" && !selectedItems.find((s) => s.id === f.id)
    );
    const isSingle = selectedItems.length === 1;

    const menuItems = [
      isSingle && {
        icon: "✏️", label: "Rename",
        action: () => startRename(item),
      },
      item.type === "file" && isSingle && {
        icon: "⬇️", label: "Download",
        action: () => handleDownload(item),
      },
      { icon: "📂", label: "Move to…", action: () => openMoveModal(selectedItems) },
      availableFolders.length > 0 && "sep",
      ...availableFolders.map((f) => ({
        icon: "→", label: `Move into "${f.name}"`,
        action: () => handleMove(selectedItems, buildPath(path, f.name)),
      })),
      "sep",
      {
        icon: "🗑️", label: `Delete${selectedItems.length > 1 ? ` (${selectedItems.length})` : ""}`,
        danger: true,
        action: () => confirmDelete(selectedItems),
      },
    ].filter(Boolean);

    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 200),
      y: Math.min(e.clientY, window.innerHeight - 250),
      items: menuItems,
    });
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const selectedItems = files.filter((f) => selected.has(f.id));

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!hasCredentials) {
    return (
      <SetupScreen onConnect={(url, key) => {
        initSupabase(url, key);
        setHasCredentials(true);
        toast("Connected to Supabase!");
      }} />
    );
  }

  return (
    <div className="app" onClick={() => { setSelected(new Set()); setContextMenu(null); }}>

      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">⚡</div>
          <div className="sidebar-title">Storage Manager</div>
        </div>
        <div className="sidebar-label">Buckets</div>
        <div className="bucket-list">
          {buckets.map((b) => (
            <div
              key={b.name}
              className={`bucket-item ${activeBucket === b.name ? "active" : ""}`}
              onClick={(e) => { e.stopPropagation(); setActiveBucket(b.name); setPath([]); }}
            >
              <span className="bucket-icon">🗄️</span>
              <span className="bucket-name">{b.name}</span>
              {b.public && <span className="bucket-badge">public</span>}
            </div>
          ))}
          {buckets.length === 0 && (
            <div className="sidebar-empty">No buckets found.</div>
          )}
        </div>
        <div className="sidebar-footer">
          <button className="btn-icon" title="Connection Settings" onClick={() => setModal({ type: "settings" })}>
            ⚙️
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="toolbar">
          <nav className="breadcrumb">
            <span
              className="bc-seg"
              onClick={(e) => { e.stopPropagation(); navigateTo([]); }}
            >
              {activeBucket || "—"}
            </span>
            {path.map((seg, i) => (
              <React.Fragment key={i}>
                <span className="bc-sep">›</span>
                <span
                  className={`bc-seg ${i === path.length - 1 ? "current" : ""}`}
                  onClick={(e) => { e.stopPropagation(); navigateTo(path.slice(0, i + 1)); }}
                >
                  {seg}
                </span>
              </React.Fragment>
            ))}
          </nav>

          <div className="toolbar-actions">
            {selectedItems.length > 0 && (
              <>
                <button className="btn" onClick={(e) => { e.stopPropagation(); openMoveModal(selectedItems); }}>
                  Move
                </button>
                <button className="btn danger" onClick={(e) => { e.stopPropagation(); confirmDelete(selectedItems); }}>
                  Delete
                </button>
              </>
            )}
            <div className="view-toggle">
              <button className={`view-btn ${view === "grid" ? "active" : ""}`} onClick={() => setView("grid")}>⊞</button>
              <button className={`view-btn ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}>☰</button>
            </div>
            <button className="btn" onClick={(e) => { e.stopPropagation(); setModal({ type: "new-folder" }); }}>
              + Folder
            </button>
            <button className="btn primary" onClick={(e) => { e.stopPropagation(); fileInputRef.current.click(); }}>
              ↑ Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={handleFileInputChange}
            />
          </div>
        </div>

        {progress && <ProgressBar value={progress.value} label={progress.label} />}

        <div className="file-area" onClick={() => setSelected(new Set())}>
          {loading ? (
            <div className="empty-state">
              <div className="spinner" />
              <div>Loading files…</div>
            </div>
          ) : files.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📂</div>
              <div>This folder is empty</div>
            </div>
          ) : view === "grid" ? (
            <div className="file-grid">
              {files.map((item) => (
                <FileCard
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  renamingId={renamingId}
                  onSelect={handleSelect}
                  onOpen={openItem}
                  onContextMenu={showContextMenu}
                  onRenameCommit={commitRename}
                  onRenameCancel={() => setRenamingId(null)}
                  dragHandlers={dragHandlers}
                />
              ))}
            </div>
          ) : (
            <div className="file-list">
              <div className="list-header">
                <span className="row-icon" />
                <span className="row-name">Name</span>
                <span className="row-size">Size</span>
                <span className="row-date">Modified</span>
              </div>
              {files.map((item) => (
                <FileRow
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  renamingId={renamingId}
                  onSelect={handleSelect}
                  onOpen={openItem}
                  onContextMenu={showContextMenu}
                  onRenameCommit={commitRename}
                  onRenameCancel={() => setRenamingId(null)}
                  dragHandlers={dragHandlers}
                />
              ))}
            </div>
          )}
        </div>

        <div className="status-bar">
          <span>{files.filter(f => f.type === "folder").length} folders, {files.filter(f => f.type !== "folder").length} files</span>
          <span className="status-spacer" />
          <button className="status-refresh" onClick={refresh}>↺ Refresh</button>
        </div>
      </main>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {modal?.type === "confirm-delete" && (
        <Modal title="Confirm Delete" onClose={() => setModal(null)}>
          <p className="modal-body">
            Delete {modal.items.length} items?
          </p>
          <div className="modal-btns">
            <button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn danger" onClick={() => handleDelete(modal.items)}>Delete</button>
          </div>
        </Modal>
      )}

      {modal?.type === "move" && (
        <MoveModal
          items={modal.items}
          locations={modal.locations}
          onMove={(targetPath) => handleMove(modal.items, targetPath)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "new-folder" && (
        <NewFolderModal
          onCreate={createFolder}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "settings" && (
        <SettingsModal
          onSave={(url, key) => {
            initSupabase(url, key);
            setHasCredentials(true);
            setModal(null);
            toast("Settings saved!");
          }}
          onDisconnect={() => {
            clearSupabase();
            setHasCredentials(false);
            setModal(null);
            setBuckets([]);
            setActiveBucket(null);
          }}
          onClose={() => setModal(null)}
        />
      )}

      <Toast toasts={toasts} />
    </div>
  );
}

function SetupScreen({ onConnect }) {
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h1>Storage Manager</h1>
        <p>Connect to your Supabase project. Admin access is required for folder operations, so please use your <strong>Service Role Key</strong>.</p>
        <div className="form-group">
          <label>Project URL</label>
          <input type="text" placeholder="https://your-project.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Service Role Key</label>
          <input type="password" placeholder="Secret Key" value={key} onChange={(e) => setKey(e.target.value)} />
        </div>
        <button className="btn primary full" disabled={!url || !key} onClick={() => onConnect(url, key)}>
          Connect
        </button>
      </div>
    </div>
  );
}

function SettingsModal({ onSave, onDisconnect, onClose }) {
  const [url, setUrl] = useState(localStorage.getItem("supabase_url") || "");
  const [key, setKey] = useState(localStorage.getItem("supabase_key") || "");

  return (
    <Modal title="Connection Settings" onClose={onClose}>
      <div className="form-group">
        <label>Project URL</label>
        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Service Role Key</label>
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} />
      </div>
      <div className="modal-btns">
        <button className="btn danger" onClick={onDisconnect}>Disconnect</button>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => onSave(url, key)}>Save Changes</button>
      </div>
    </Modal>
  );
}

function MoveModal({ items, locations, onMove, onClose }) {
  const [dest, setDest] = useState(locations[0]?.path || "");
  return (
    <Modal title={`Move ${items.length} items to…`} onClose={onClose}>
      <select className="modal-select" value={dest} onChange={(e) => setDest(e.target.value)}>
        {locations.map((loc) => (
          <option key={loc.path} value={loc.path}>{loc.label}</option>
        ))}
      </select>
      <div className="modal-btns">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => onMove(dest)}>Move</button>
      </div>
    </Modal>
  );
}

function NewFolderModal({ onCreate, onClose }) {
  const [name, setName] = useState("");
  const inputRef = useRef();
  useEffect(() => inputRef.current?.focus(), []);
  const submit = () => { if (name.trim()) { onCreate(name.trim()); } };
  return (
    <Modal title="New Folder" onClose={onClose}>
      <input
        ref={inputRef}
        className="modal-input"
        placeholder="Folder name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <div className="modal-btns">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!name.trim()} onClick={submit}>Create</button>
      </div>
    </Modal>
  );
}
