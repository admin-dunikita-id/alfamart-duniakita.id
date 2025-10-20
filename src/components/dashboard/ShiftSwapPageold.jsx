// src/components/dashboard/ShiftSwapPage.jsx
import React, { useState } from "react";
import { useAuth, useShiftSwaps, EmployeeProvider } from "@/context";
import SwapForm from "./SwapForm";
import api from "@/config/api";
import ReasonModal from "./ReasonModal";
import Swal from "sweetalert2";
import {
  TrashIcon,
  PauseCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  MinusCircleIcon,
  ClockIcon,
  CheckIcon,
  XMarkIcon,
  StopCircleIcon,
} from "@heroicons/react/24/solid";

function getErrMessage(err, fb = "Terjadi kesalahan") {
  return err?.response?.data?.message || err?.message || fb;
}

/** Normalisasi status supaya konsisten */
const normStatus = (s) => {
  s = String(s || "").toLowerCase();
  if (s === "cancel" || s === "cancelled") return "canceled";
  if (s === "decline") return "declined";
  return s;
};

/** Badge status dengan ikon (mirip pengajuan cuti/izin) */
function StatusBadge({ status }) {
  const s = normStatus(status);

  const color = {
    pending: "bg-yellow-100 text-yellow-800 ring-yellow-200",
    approved: "bg-green-100 text-green-700 ring-green-200",
    accepted: "bg-blue-100 text-blue-700 ring-blue-200",
    rejected: "bg-red-100 text-red-700 ring-red-200",
    canceled: "bg-gray-100 text-gray-700 ring-gray-200",
    waiting: "bg-gray-100 text-gray-700 ring-gray-200",
    declined: "bg-red-100 text-red-700 ring-red-200",
    expired: "bg-orange-100 text-orange-700 ring-orange-200",
  }[s] || "bg-gray-100 text-gray-700 ring-gray-200";

  const label = {
    pending: "Pending",
    approved: "Approved",
    accepted: "Accepted",
    rejected: "Rejected",
    canceled: "Canceled",
    waiting: "Waiting",
    declined: "Declined",
    expired: "Expired",
  }[s] || (status || "-");

  const icon = {
    pending: <PauseCircleIcon className="w-4 h-4" />,
    approved: <CheckCircleIcon className="w-4 h-4" />,
    accepted: <CheckCircleIcon className="w-4 h-4" />,
    rejected: <XCircleIcon className="w-4 h-4" />,
    canceled: <MinusCircleIcon className="w-4 h-4" />,
    waiting: <PauseCircleIcon className="w-4 h-4" />,
    declined: <XCircleIcon className="w-4 h-4" />,
    expired: <ClockIcon className="w-4 h-4" />,
  }[s] || <MinusCircleIcon className="w-4 h-4" />;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ring-1 ${color}`}>
      {icon}
      {label}
    </span>
  );
}

export default function ShiftSwapPage() {
  const { user } = useAuth() || {};
  const {
    list = [],
    loadingData,
    error: contextError,
    approveSwap,
    fetchList,
    requesterCancel,
  } = useShiftSwaps();

  const [localError, setLocalError] = useState("");
  const [loadingButtons, setLoadingButtons] = useState({});
  const [shadowPartnerStatus, setShadowPartnerStatus] = useState({});

  // state ReasonModal
  const [reasonModal, setReasonModal] = useState({
    open: false,
    id: null,
    mode: null, // 'cosReject' | 'partnerDecline' | 'requesterCancel'
    submitting: false,
  });

  const setBusy = (id, key, value) =>
    setLoadingButtons((p) => ({ ...p, [id]: { ...(p[id] || {}), [key]: value } }));

  const isAdmin = user?.role === "admin";
  const isCOS = user?.role === "cos";

  // Siapa boleh approve tukar shift
  const canApproveSwap = (row, effectivePartnerStatus) => {
    if (row.status !== "pending") return false;
    if (effectivePartnerStatus !== "accepted") return false;
    return isAdmin || isCOS;
  };

  // === COS approve langsung
  const handleCosApprove = async (id) => {
    setLocalError("");
    setBusy(id, "approve", true);
    try {
      await approveSwap(id, "approve");
      if (fetchList) await fetchList();
    } catch (err) {
      setLocalError(getErrMessage(err));
    } finally {
      setBusy(id, "approve", false);
    }
  };

  const openCosReject = (id) => setReasonModal({ open: true, id, mode: "cosReject", submitting: false });

  // === Partner accept/decline
  const handlePartnerAccept = async (id) => {
    setLocalError("");
    setBusy(id, "accept", true);
    setShadowPartnerStatus((p) => ({ ...p, [id]: "accepted" })); // optimistic
    try {
      await api.post(`/shift-swaps/${id}/partner?action=accept`, { action: "accept" });
    } catch (err) {
      const msg = getErrMessage(err, "");
      const already = err?.response?.status === 422 && /diproses/i.test(msg || "");
      if (!already) {
        setShadowPartnerStatus((p) => {
          const c = { ...p };
          delete c[id];
          return c;
        });
      }
    } finally {
      setBusy(id, "accept", false);
      if (fetchList) await fetchList();
    }
  };

  const openPartnerDecline = (id) =>
    setReasonModal({ open: true, id, mode: "partnerDecline", submitting: false });

  // === Requester cancel
  const openRequesterCancel = (id) =>
    setReasonModal({ open: true, id, mode: "requesterCancel", submitting: false });

  // === Submit modal alasan
  const submitReason = async (note) => {
    const { id, mode } = reasonModal;
    setReasonModal((m) => ({ ...m, submitting: true }));
    setLocalError("");

    try {
      if (mode === "cosReject") {
        await approveSwap(id, "reject", { note });
      } else if (mode === "partnerDecline") {
        await api.post(`/shift-swaps/${id}/partner?action=decline`, { action: "decline", note });
      } else if (mode === "requesterCancel") {
        await requesterCancel(id, note);
      }
      if (fetchList) await fetchList();
      setReasonModal({ open: false, id: null, mode: null, submitting: false });
    } catch (err) {
      setLocalError(getErrMessage(err));
      setReasonModal((m) => ({ ...m, submitting: false }));
    }
  };

  const cancelModal = () => setReasonModal({ open: false, id: null, mode: null, submitting: false });

  const [deletingAll, setDeletingAll] = useState(false);

  // role yang boleh hapus
  const canDelete = () => user?.role === "admin";
  const canDeleteAll = user?.role === "admin";

  // SweetAlert2 konfirmasi
  const confirmDeleteSingle = async (names = "") => {
    const res = await Swal.fire({
      icon: "warning",
      title: "Yakin ingin menghapus?",
      html: names
        ? `Data tukar shift <b>${names}</b> akan dihapus permanen.`
        : "Data ini akan dihapus permanen.",
      showCancelButton: true,
      confirmButtonText: "Ya, hapus!",
      cancelButtonText: "Batal",
      reverseButtons: true,
      focusCancel: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
    });
    return res.isConfirmed;
  };

  const confirmDeleteAll = async () => {
    const res = await Swal.fire({
      icon: "warning",
      title: "Hapus SEMUA data tukar shift?",
      html: "Semua data tukar shift akan dihapus permanen dan tidak bisa dikembalikan.",
      showCancelButton: true,
      confirmButtonText: "Ya, hapus semua!",
      cancelButtonText: "Batal",
      reverseButtons: true,
      focusCancel: true,
      confirmButtonColor: "#991b1b",
      cancelButtonColor: "#6b7280",
    });
    return res.isConfirmed;
  };

  // handler hapus per-data
  const handleDelete = async (id, requesterName, partnerName) => {
    const agreed = await confirmDeleteSingle(
      requesterName && partnerName ? `"${requesterName}" ⇄ "${partnerName}"` : ""
    );
    if (!agreed) return;

    setBusy(id, "delete", true);
    setLocalError("");
    try {
      await api.delete(`/shift-swaps/${id}`);
      if (fetchList) await fetchList();
    } catch (err) {
      setLocalError(getErrMessage(err));
    } finally {
      setBusy(id, "delete", false);
    }
  };

  // handler hapus semua data
  const handleDeleteAll = async () => {
    const agreed = await confirmDeleteAll();
    if (!agreed) return;

    setDeletingAll(true);
    setLocalError("");
    try {
      await api.delete(`/shift-swaps`);
      if (fetchList) await fetchList();
    } catch (err) {
      setLocalError(getErrMessage(err));
    } finally {
      setDeletingAll(false);
    }
  };

  /*** ===== Helpers alasan (truncate + popup) ===== ***/

// Nama approver (utamakan yang paling spesifik)
const getApproverName = (row) =>
  pick(
    row.approved_by_name,         // snake_case
    row.rejected_by_name,
    row.approvedBy?.name,         // relasi camelCase
    row.rejectedBy?.name,
    row.approver?.name,
    row.approved_by?.name,        // kalau backend kirim objek nested 'approved_by'
    row.rejected_by?.name
  );

// Role approver (ADMIN/COS)
const getApproverRole = (row) => {
  const role =
    pick(
      row.approved_by_role,       // snake_case dari resource
      row.rejected_by_role,
      row.approvedBy?.role,       // relasi camelCase
      row.rejectedBy?.role,
      row.approver?.role,
      row.approved_by?.role,      // nested object
      row.rejected_by?.role
    ) || "approver";
  return String(role).toUpperCase(); // "ADMIN" | "COS" | "APPROVER"
};

  // pilih string pertama yang berisi
  const pick = (...vals) => vals.find(v => v !== undefined && v !== null && String(v).trim() !== "");

  // deteksi apakah penolakan berasal dari partner
  const isPartnerDeclined = (row, partnerStatus) => {
    const ps = normStatus(partnerStatus);
    if (["rejected"].includes(ps)) return true;

    const byRole = String(row.rejected_by_role || row.rejectedByRole || "").toLowerCase();
    if (byRole === "partner" || byRole === "mitra") return true;

    const byId = row.rejected_by_id ?? row.rejectedById;
    if (byId && row.partner?.id && Number(byId) === Number(row.partner.id)) return true;

    return false;
  };

  // ambil alasan partner dengan fallback ke reject_reason bila API gabung
  const getPartnerReason = (row) =>
    pick(
      row.partner_reason,
      row.partner_note,
      row.partner_decline_reason,
      row.partnerDeclineReason,
      row.note_partner,
      row.partnerMessage,
      row.partner_comment,
      row.partnerNote,
      row.reject_reason, // fallback penting
      row.note
    );

  // potong alasan sampai N karakter (bukan kata)
  const truncateChars = (text, limit = 10) => {
    const s = String(text ?? "").trim();
    const truncated = s.length > limit;
    return {
      short: truncated ? s.slice(0, limit) + "..." : s,
      truncated,
    };
  };

  // escape untuk HTML
  const escapeHtml = (str = "") =>
    String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  // popup alasan penuh
  const showReasonPopup = (title, reason) => {
    Swal.fire({
      icon: "info",
      title,
      html: `<div style="text-align:left;white-space:pre-wrap">${escapeHtml(reason)}</div>`,
      confirmButtonText: "Tutup",
    });
  };

  // komponen baris alasan (truncate + klik)
const ReasonLine = ({ label, reason, color = "text-gray-600" }) => {
  if (!reason) return null;

  // reason berupa STRING → potong per-karakter + popup
  if (typeof reason === "string") {
    const { short, truncated } = truncateChars(reason, 11);
    return (
      <div className={`text-xs ${color}`}>
        {label ? <span className="font-medium">{label}: </span> : null}
        {truncated ? (
          <button
            type="button"
            onClick={() => showReasonPopup(label || "", reason)}
            className="inline whitespace-nowrap underline decoration-dotted underline-offset-2 hover:decoration-solid"
            title="Klik untuk lihat lengkap"
          >
            {short}
          </button>
        ) : (
          <span className="inline whitespace-nowrap">{short}</span>
        )}
      </div>
    );
  }

  // reason berupa JSX → tampilkan apa adanya (tanpa truncate)
  return (
    <div className={`text-xs ${color}`}>
      {label ? <span className="font-medium">{label}: </span> : null}
      {reason}
    </div>
  );
};

  // rangkum sumber & teks alasan (prioritas: partner decline > approver reject > requester cancel)
const getDecisionInfo = (row, partnerStatus) => {
  const s = normStatus(row.status);
  const approverName = getApproverName(row);
  const approverRole = getApproverRole(row); // "ADMIN" | "COS" | "APPROVER"

    // ========== partner decline ==========
  if (isPartnerDeclined(row, partnerStatus)) {
    const text = getPartnerReason(row);
    const by = row.partner?.name
      ? `Ditolak oleh Partner (${row.partner.name})`
      : "Ditolak oleh Partner";
    return { label: by, text, color: "text-red-600" };
  }

  // ========== pending & waiting ==========
    if (s === "pending" && (partnerStatus === "waiting" || partnerStatus == null)) {
      return {
        label: "Menunggu persetujuan partner",
        text: row.partner?.name || "-",
        color: "text-yellow-600", 
      };
    }

  // ========== pending & patner : accepted ==========
  if (s === "pending" && partnerStatus === "accepted") {
    const approverRole = row.approved_by_role?.toUpperCase() || "COS";
    return {
      label: "Menunggu persetujuan Approver",
      text: `(${approverRole}) - Partner sudah Accepted`,
      color: "text-yellow-600", // pending tetap kuning
    };
  }

  // ========== partner accepted + approver approved =========
if (s === "approved") {
  return {
    label: `Disetujui oleh Approver (${row.approved_by_role?.toUpperCase() || "APPROVER"})`,
    text: `Tukar shift ${row.requester?.name} dengan ${row.partner?.name} telah disetujui${row.approved_by_name ? ` oleh ${row.approved_by_name}` : ""}`,
    color: "text-green-600",
  };
}

  // ========== hanya approver approved (opsional, tetap) ==========
  if (s === "approved") {
    return {
      label: `Disetujui oleh Approver (${approverRole})`,
      text: approverName || "-",
      color: "text-green-600",
    };
  }

  // ========== DITOLAK oleh Approver (COS) ==========
if (s === "rejected") {
  return {
    label: `Ditolak oleh Approver (${row.rejected_by_role?.toUpperCase() || "APPROVER"})`,
    text: row.reject_reason || "-",
    color: "text-red-600",
  };
}

  // ========== DIBATALKAN oleh Requester (Nama) ==========
  if (s === "canceled") {
    const by = pick(row.canceled_by_name, row.requester?.name) || "Pemohon";
    const text = pick(row.cancel_reason, row.note);
    return { label: `Dibatalkan oleh Requester (${by})`, text, color: "text-gray-600" };
  }

  return null;
};


  const btnBase = "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md";

  return (
    <div className="p-6">
      {/* Form tukar disembunyikan untuk admin & ac */}
      {!["admin", "ac"].includes(user?.role) && (
        <EmployeeProvider>
          <div className="mb-6 max-w-4xl w-full mx-auto"> 
            <SwapForm />
          </div>
        </EmployeeProvider>
      )}

      {loadingData && <p className="text-gray-500 mb-2">Memuat data…</p>}
      {(contextError || localError) && (
        <p className="text-red-500 mb-3">{contextError || localError}</p>
      )}

      {/* Tombol Hapus Semua — admin only */}
      {canDeleteAll && (
        <div className="mt-2 mb-5 pt-2 flex justify-end">
          <button
            onClick={handleDeleteAll}
            disabled={deletingAll || loadingData}
            className={`inline-flex items-center gap-1 px-3 py-2 rounded text-white ${
              deletingAll ? "bg-red-400 cursor-not-allowed" : "bg-red-800 hover:bg-red-900"
            }`}
            title="Hapus semua data tukar shift"
          >
            <TrashIcon className="w-5 h-5" />
            {deletingAll ? "Menghapus..." : "Hapus Semua Data"}
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border rounded-md overflow-hidden">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 text-left">Pemohon</th>
              <th className="border p-2 text-left">Partner</th>
              <th className="border p-2 text-center">Tanggal</th>
              <th className="border p-2 text-left">Status</th>
              <th className="border p-2 text-center whitespace-nowrap">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loadingData ? (
              <tr>
                <td colSpan={5} className="text-center p-4 text-gray-500">Loading...</td>
              </tr>
            ) : list.length > 0 ? (
              list.map((r) => {
                const btn = loadingButtons[r.id] || {};
                const effectivePartnerStatus =
                  shadowPartnerStatus[r.id] || r.partner_status || "waiting";

                const isRequester = user?.id === r.requester?.id;

                const s = normStatus(r.status); // status utama: pending | approved | rejected | canceled

// partner status mentah
const rawPartnerStatus = shadowPartnerStatus[r.id] || r.partner_status || "waiting";

// aturan override: kalau requester canceled → partner ikut canceled
const displayPartnerStatus = s === "canceled" ? "canceled" : rawPartnerStatus;

                const canPartnerAct =
                  user?.id === r.partner?.id &&
                  r.status === "pending" &&
                  effectivePartnerStatus === "waiting";

                const canApproverAct = canApproveSwap(r, effectivePartnerStatus);

                const canRequesterCancel =
                  isRequester &&
                  r.status === "pending" &&
                  effectivePartnerStatus === "waiting";

                // 🚩 perbaiki: evaluasi canDelete untuk baris ini
                const canDeleteRow = canDelete(r);

                // 🚩 hasActions harus mempertimbangkan semua aksi
                const hasActions =
                  canPartnerAct || canApproverAct || canRequesterCancel || canDeleteRow;

                const reqShiftName = r.requester_shift?.name || r.requesterShift?.name;
                const reqShiftCode = r.requester_shift?.code || r.requesterShift?.code;
                const parShiftName = r.partner_shift?.name || r.partnerShift?.name;
                const parShiftCode = r.partner_shift?.code || r.partnerShift?.code;

                return (
                  <tr key={r.id} className="align-top">
                    <td className="border p-2">
                      <div className="font-medium">{r.requester?.name || "-"}</div>
                      {(reqShiftName || reqShiftCode) && (
                        <div className="text-xs text-gray-500">
                          {reqShiftName} {reqShiftCode ? `(${reqShiftCode})` : ""}
                        </div>
                      )}
                    </td>

                    <td className="border p-2">
                      <div className="font-medium">{r.partner?.name || "-"}</div>
                      {(parShiftName || parShiftCode) && (
                        <div className="text-xs text-gray-500">
                          {parShiftName} {parShiftCode ? `(${parShiftCode})` : ""}
                        </div>
                      )}
                    </td>

                    <td className="border p-2 text-center">{r.date || "-"}</td>

                    {/* STATUS */}
                    <td className="border p-2">
                      <div className="flex flex-col gap-1 sm:gap-1.5">
                        {/* Baris 1 */}
                        <div className="flex items-center gap-2">
                          <StatusBadge status={r.status} />
                          {displayPartnerStatus && (
                            <>
                              <span className="hidden sm:inline text-xs text-gray-500">partner:</span>
                              <span className="hidden sm:inline">
                                <StatusBadge status={displayPartnerStatus} />
                              </span>
                            </>
                          )}
                        </div>
                        {/* Baris 2 (mobile only) */}
                        {displayPartnerStatus && (
                          <div className="flex items-center gap-2 sm:hidden">
                            <span className="text-xs text-gray-500">partner:</span>
                            <StatusBadge status={displayPartnerStatus} />
                          </div>
                        )}

                        {/* Baris 3: alasan (pakai getDecisionInfo/ReasonLine kalau ada) */}
                        {(() => {
                          const info = getDecisionInfo(r, displayPartnerStatus);
                          if (!info || !info.text) return null;
                          return (
                            <ReasonLine
                              label={info.label}
                              reason={info.text}
                              color={info.color}
                            />
                          );
                        })()}
                      </div>
                    </td>

                    {/* AKSI */}
                    <td className="border p-2 text-center">
                      <div className="flex items-center justify-center gap-2 flex-nowrap whitespace-nowrap">
                        {canPartnerAct && (
                          <>
                            <button
                              onClick={() => handlePartnerAccept(r.id)}
                              className={`${btnBase} bg-blue-600 text-white hover:bg-blue-700`}
                              disabled={btn.accept}
                              title="Terima permintaan tukar"
                            >
                              <CheckIcon className="w-4 h-4" />
                              {btn.accept ? "Memproses…" : "Terima"}
                            </button>
                            <button
                              onClick={() => openPartnerDecline(r.id)}
                              className={`${btnBase} bg-red-600 text-white hover:bg-red-700`}
                              disabled={btn.decline}
                              title="Tolak permintaan tukar"
                            >
                              <XMarkIcon className="w-4 h-4" />
                              Tolak
                            </button>
                          </>
                        )}

                        {canApproverAct && (
                          <>
                            <button
                              onClick={() => handleCosApprove(r.id)}
                              className={`${btnBase} bg-green-600 text-white hover:bg-green-700`}
                              disabled={btn.approve}
                              title="Setujui tukar shift"
                            >
                              <CheckIcon className="w-4 h-4" />
                              {btn.approve ? "Memproses…" : "Approve"}
                            </button>
                            <button
                              onClick={() => openCosReject(r.id)}
                              className={`${btnBase} bg-gray-700 text-white hover:bg-gray-800`}
                              disabled={btn.reject}
                              title="Tolak tukar shift"
                            >
                              <XMarkIcon className="w-4 h-4" />
                              Reject
                            </button>
                          </>
                        )}

                        {canRequesterCancel && (
                          <button
                            onClick={() => openRequesterCancel(r.id)}
                            className={`${btnBase} bg-orange-600 text-white hover:bg-orange-700`}
                            disabled={btn.cancel}
                            title="Batalkan pengajuan"
                          >
                            <StopCircleIcon className="w-4 h-4" />
                            Batalkan
                          </button>
                        )}

                        {canDeleteRow && (
                          <button
                            onClick={() => handleDelete(r.id, r.requester?.name, r.partner?.name)}
                            className={`${btnBase} bg-red-600 text-white hover:bg-red-700`}
                            disabled={btn.delete}
                            title="Hapus data ini"
                          >
                            <TrashIcon className="w-4 h-4" />
                            {btn.delete ? "Menghapus..." : "Hapus"}
                          </button>
                        )}
                      </div>

                      {/* 🚩 jangan tampilkan '-' jika sudah ada aksi */}
                      {!hasActions ? <span className="text-gray-400">-</span> : null}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="text-center p-4 text-gray-400">Tidak ada data</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal alasan */}
      <ReasonModal
        open={reasonModal.open}
        submitting={reasonModal.submitting}
        onClose={() => (reasonModal.submitting ? null : cancelModal())}
        onSubmit={submitReason}
        title={
          reasonModal.mode === "cosReject"
            ? "Tolak Pengajuan (COS)"
            : reasonModal.mode === "partnerDecline"
            ? "Tolak Pengajuan (Partner)"
            : "Batalkan Pengajuan (Pemohon)"
        }
        placeholder={
          reasonModal.mode === "requesterCancel"
            ? "Tulis alasan pembatalan…"
            : "Tulis alasan penolakan…"
        }
        confirmText={reasonModal.mode === "requesterCancel" ? "Batalkan" : "Kirim"}
      />
    </div>
  );
}
