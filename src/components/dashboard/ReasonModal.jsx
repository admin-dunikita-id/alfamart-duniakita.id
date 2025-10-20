import React, { useEffect, useState } from "react";

export default function ReasonModal({
  open,
  title = "Tolak Pengajuan",
  placeholder = "Tulis alasan penolakan...",
  confirmText = "Kirim",
  cancelText = "Batal",
  submitting = false,
  onSubmit,
  onClose,
}) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-[480px] rounded-lg shadow-lg">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-lg">{title}</h3>
        </div>

        <div className="p-5">
          <textarea
            className="w-full border rounded p-2 min-h-[120px] outline-none"
            placeholder={placeholder}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            * Minimal 3 karakter.
          </p>
        </div>

        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded border"
            onClick={onClose}
            disabled={submitting}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded bg-red-600 text-white disabled:bg-gray-400"
            disabled={submitting || note.trim().length < 3}
            onClick={() => onSubmit?.(note.trim())}
          >
            {submitting ? "Memproses…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
