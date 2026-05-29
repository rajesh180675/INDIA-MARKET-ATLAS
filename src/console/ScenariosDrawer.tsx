// Saved-scenarios drawer. A small dialog accessible from the rail and the
// command palette: lets you name the current view, recall earlier views,
// rename / delete, and export/import the list as JSON.

import { useEffect, useRef, useState } from "react";
import {
  type SavedScenario,
  deleteScenario,
  exportJson,
  importJson,
  listScenarios,
  saveScenario,
  updateScenario,
} from "./scenarios";

interface Props {
  open: boolean;
  onClose: () => void;
  onLoad: (hash: string) => void;
  /** Current hash to offer for "Save current view". */
  currentHash: string;
  /** Workspace title, used as the default name. */
  currentTitle: string;
}

export default function ScenariosDrawer({
  open,
  onClose,
  onLoad,
  currentHash,
  currentTitle,
}: Props) {
  const [list, setList] = useState<SavedScenario[]>([]);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNote, setEditNote] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Default name = workspace title
  useEffect(() => {
    if (open) {
      setList(listScenarios());
      setName(currentTitle);
      setNote("");
      setImportStatus(null);
      setEditingId(null);
    }
  }, [open, currentTitle]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveScenario({
      name,
      hash: currentHash,
      note: note.trim() || undefined,
    });
    setList(listScenarios());
    setName(currentTitle);
    setNote("");
  };

  const handleDelete = (id: string) => {
    deleteScenario(id);
    setList(listScenarios());
    if (editingId === id) setEditingId(null);
  };

  const startEdit = (s: SavedScenario) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditNote(s.note ?? "");
  };

  const commitEdit = () => {
    if (!editingId) return;
    updateScenario(editingId, { name: editName, note: editNote });
    setList(listScenarios());
    setEditingId(null);
  };

  const handleExport = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atlas-scenarios-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    const result = importJson(text);
    if (result.error) {
      setImportStatus(`Import failed: ${result.error}`);
    } else {
      setImportStatus(
        `Imported ${result.imported} scenario${result.imported === 1 ? "" : "s"}` +
          (result.skipped > 0
            ? `, skipped ${result.skipped} (duplicate or malformed)`
            : ""),
      );
    }
    setList(listScenarios());
  };

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Saved scenarios"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }}
      />
      {/* Panel — right-side slide-in */}
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-hidden"
        style={{
          background: "var(--surface)",
          borderLeft: "1px solid var(--rule)",
        }}
      >
        <header
          className="rule-b flex items-center justify-between px-5 py-4"
          style={{ borderColor: "var(--rule)" }}
        >
          <div>
            <div className="eyebrow">Scenarios</div>
            <div className="display text-[18px] leading-tight">
              Saved views
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scenarios panel"
            className="segmented px-3 py-1.5 text-[12px]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--ink-soft)",
            }}
          >
            Close ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Save current */}
          <form onSubmit={handleSave} className="mb-6 space-y-2">
            <label className="eyebrow block">Save current view</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name…"
              className="w-full rounded-none border bg-transparent px-3 py-2 text-[14px]"
              style={{ borderColor: "var(--rule)", color: "var(--ink)" }}
              maxLength={80}
              aria-label="Scenario name"
            />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note…"
              rows={2}
              className="w-full rounded-none border bg-transparent px-3 py-2 text-[13px]"
              style={{ borderColor: "var(--rule)", color: "var(--ink)" }}
              maxLength={500}
              aria-label="Scenario note"
            />
            <div
              className="num text-[11px]"
              style={{ color: "var(--ink-faint)" }}
            >
              hash · {currentHash}
            </div>
            <button
              type="submit"
              className="segmented w-full px-3 py-2 text-[13px]"
              style={{ color: "var(--signal)" }}
            >
              Save view
            </button>
          </form>

          {/* List */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Saved ({list.length})</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={list.length === 0}
                  className="text-[11px] underline disabled:no-underline disabled:opacity-50"
                  style={{ color: "var(--ink-soft)" }}
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] underline"
                  style={{ color: "var(--ink-soft)" }}
                >
                  Import…
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportFile(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            {importStatus ? (
              <div
                className="text-[12px]"
                role="status"
                style={{ color: "var(--ink-soft)" }}
              >
                {importStatus}
              </div>
            ) : null}

            {list.length === 0 ? (
              <p
                className="text-[13px]"
                style={{ color: "var(--ink-faint)" }}
              >
                No saved views yet. Build a view you want to recall, give
                it a name, and save. Saved views persist locally and can be
                exported as JSON to share or back up.
              </p>
            ) : (
              <ul className="space-y-2" aria-label="Saved scenarios">
                {list.map((s) => (
                  <li
                    key={s.id}
                    className="rule-b pb-3"
                    style={{ borderColor: "var(--rule)" }}
                  >
                    {editingId === s.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-none border bg-transparent px-3 py-1.5 text-[14px]"
                          style={{
                            borderColor: "var(--rule)",
                            color: "var(--ink)",
                          }}
                          aria-label="Edit name"
                        />
                        <textarea
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          rows={2}
                          placeholder="Note…"
                          className="w-full rounded-none border bg-transparent px-3 py-1.5 text-[13px]"
                          style={{
                            borderColor: "var(--rule)",
                            color: "var(--ink)",
                          }}
                          aria-label="Edit note"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={commitEdit}
                            className="segmented px-2.5 py-1 text-[12px]"
                            style={{ color: "var(--signal)" }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="segmented px-2.5 py-1 text-[12px]"
                            style={{ color: "var(--ink-soft)" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onLoad(s.hash)}
                            className="text-left text-[14px] font-medium underline-offset-2 hover:underline"
                            style={{ color: "var(--ink)" }}
                            title="Load this view"
                          >
                            {s.name}
                          </button>
                          <span
                            className="num text-[10.5px] shrink-0"
                            style={{ color: "var(--ink-faint)" }}
                          >
                            {new Date(s.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {s.note ? (
                          <p
                            className="mt-0.5 text-[12.5px]"
                            style={{ color: "var(--ink-soft)" }}
                          >
                            {s.note}
                          </p>
                        ) : null}
                        <div
                          className="num mt-1 text-[10.5px] truncate"
                          style={{ color: "var(--ink-faint)" }}
                          title={s.hash}
                        >
                          {s.hash}
                        </div>
                        <div className="mt-1.5 flex gap-3 text-[11.5px]">
                          <a
                            href={s.hash}
                            target="_blank"
                            rel="noopener"
                            className="underline"
                            style={{ color: "var(--ink-soft)" }}
                          >
                            Open in new tab
                          </a>
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            className="underline"
                            style={{ color: "var(--ink-soft)" }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            className="underline"
                            style={{ color: "var(--neg)" }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <footer
          className="rule-t px-5 py-3 text-[11px]"
          style={{ borderColor: "var(--rule)", color: "var(--ink-faint)" }}
        >
          Scenarios live in your browser only. Export to JSON to back up
          or share. Tip: open multiple in new tabs and tile your windows
          for side-by-side compare.
        </footer>
      </aside>
    </div>
  );
}
