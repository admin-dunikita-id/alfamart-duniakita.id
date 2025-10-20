// src/components/dashboard/LeaveRequestsPage.jsx
import React, { useEffect, useState } from "react";
import { useAuth, useLeaveRequests } from "@/context";
import LeaveForm from "./LeaveForm";
import ReasonModal from "./ReasonModal";
import api from "@/config/api";
import Swal from "sweetalert2";
import { 
  CheckIcon, XMarkIcon, TrashIcon, StopCircleIcon,
  PauseCircleIcon, CheckCircleIcon, XCircleIcon, MinusCircleIcon
} from "@heroicons/react/24/solid";

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  const color =
    {      
      pending:  "bg-yellow-100 text-yellow-800 ring-yellow-200",      
      approved: "bg-green-100  text-green-700  ring-green-200",
      rejected: "bg-red-100    text-red-700    ring-red-200",
      canceled: "bg-gray-100   text-gray-700   ring-gray-200",
    }[s] || "bg-gray-100 text-gray-700 ring-gray-200";

  const label =
    { pending: "Pending", approved: "Approved", rejected: "Rejected", canceled: "Canceled" }[s] ||
    (status || "-");

  const icon =
    {
      pending:  <PauseCircleIcon className="w-4 h-4" />,
      approved: <CheckCircleIcon className="w-4 h-4" />,
      rejected: <XCircleIcon className="w-4 h-4" />,
      canceled: <MinusCircleIcon className="w-4 h-4" />,
    }[s] || <MinusCircleIcon className="w-4 h-4" />;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ring-1 ${color}`}>
      {icon}
      {label}
    </span>
  );
}

/* ===== Helpers agar seragam dengan Tukar Shift ===== */
const pick = (...vals) => vals.find(v => v !== undefined && v !== null && String(v).trim() !== "");

// Potong alasan per jumlah tombol + popup lihat lengkap
const escapeHtml = (str = "") =>
  String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;")
             .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");

const showFullReason = (title, reason) => {
  if (!reason) return;
  Swal.fire({
    icon: "info",
    title,
    html: `<div style="text-align:left;white-space:pre-wrap">${escapeHtml(reason)}</div>`,
    confirmButtonText: "Tutup",
  });
};

// maxWidthClass = batas lebar supaya truncate bekerja di <table>
const ReasonInline = ({ label, reason, color = "text-gray-600", limit = 14, maxWidthClass = "max-w-[240px]" }) => {
  if (!reason) return null;
  const s = String(reason).trim();
  const truncated = s.length > limit;
  const short = truncated ? s.slice(0, limit - 1) + "…" : s;

  return (
    <div className={`text-xs ${color} ${maxWidthClass} truncate whitespace-nowrap`}>
      {label}:{" "}
      {truncated ? (
        <span
          role="button"
          onClick={() => showFullReason(label, reason)}
          className="underline decoration-dotted underline-offset-2 hover:decoration-solid cursor-pointer align-middle"
        >
          {short}
        </span>
      ) : (
        short
      )}
    </div>
  );
};

/* ===== End Helpers ===== */

export default function LeaveRequestsPage() {
  const { user } = useAuth();
  const {
    list,
    loading,
    error,
    fetchList,
    approveRequest,  // approve/reject
    cancelRequest,   // cancel oleh pemohon
  } = useLeaveRequests();

  const [loadingRows, setLoadingRows] = useState({});
  const [deletingAll, setDeletingAll] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Modal alasan (untuk reject & cancel)
  const [modal, setModal] = useState({
    open: false,
    mode: null, // 'reject' | 'cancel'
    id: null,
    submitting: false,
  });

  useEffect(() => { fetchList(); }, [fetchList]);

  const setBusy = (id, key, val) =>
    setLoadingRows((p) => ({ ...p, [id]: { ...(p[id] || {}), [key]: val } }));

  const toast = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  // Rules approve:
  // - Admin: semua
  // - Ac: pengajuan dari COS
  // - COS: pengajuan dari Employee & ACOS
  const canApprove = (row) => {
    if (row.status !== "pending") return false;
    const me = user?.role;
    const target = row.employee?.role;
    if (me === "admin") return true;
    if (me === "ac") return target === "cos";
    if (me === "cos") return target === "employee" || target === "acos";
    return false;
  };

  // Pemohon boleh cancel saat pending
  const canCancel = (row) => user?.id === row.employee?.id && row.status === "pending";

  // Hanya admin bisa delete
  const canDelete = () => user?.role === "admin";
  const canDeleteAll = user?.role === "admin";

  // Actions
  const handleApprove = async (id) => {
    setBusy(id, "approve", true);
    const res = await approveRequest(id, "approve");
    setBusy(id, "approve", false);
    if (res?.success) {
      toast("Pengajuan disetujui.");
      fetchList();
    }
  };

  const openRejectModal = (id) => setModal({ open: true, mode: "reject", id, submitting: false });
  const openCancelModal = (id) => setModal({ open: true, mode: "cancel", id, submitting: false });

  const submitReason = async (note) => {
    const { id, mode } = modal;
    setModal((m) => ({ ...m, submitting: true }));
    setBusy(id, mode, true);

    let res;
    if (mode === "reject") res = await approveRequest(id, "reject", note);
    else res = await cancelRequest(id, note);

    setBusy(id, mode, false);
    setModal((m) => ({ ...m, submitting: false }));

    if (res?.success) {
      setModal({ open: false, mode: null, id: null, submitting: false });
      toast(mode === "reject" ? "Pengajuan ditolak." : "Pengajuan dibatalkan.");
      fetchList();
    }
  };

  // Delete
  const handleDelete = async (id, employeeName) => {
    const agreed = await confirmDeleteSingle(employeeName);
    if (!agreed) return;
    setBusy(id, "delete", true);
    try {
      await api.delete(`/leave-requests/${id}`);
      toast("Data pengajuan berhasil dihapus.");
      fetchList();
    } catch (err) {
      const msg = err?.response?.data?.message || "Gagal menghapus data.";
      toast(msg);
    } finally {
      setBusy(id, "delete", false);
    }
  };

  const handleDeleteAll = async () => {
    const agreed = await confirmDeleteAll();
    if (!agreed) return;
    setDeletingAll(true);
    try {
      await api.delete(`/leave-requests`);
      toast("Semua data cuti/izin berhasil dihapus.");
      fetchList();
    } catch (err) {
      const msg = err?.response?.data?.message || "Gagal menghapus semua data.";
      toast(msg);
    } finally {
      setDeletingAll(false);
    }
  };

  // Konfirmasi hapus
  const confirmDeleteSingle = async (employeeName = "") => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Yakin ingin menghapus?",
      html: employeeName
        ? `Data pengajuan milik <b>"${employeeName}"</b> akan dihapus permanen.`
        : "Data pengajuan ini akan dihapus permanen.",
      showCancelButton: true,
      confirmButtonText: "Ya, hapus!",
      cancelButtonText: "Batal",
      reverseButtons: true,
      focusCancel: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
    });
    return result.isConfirmed;
  };

  const confirmDeleteAll = async () => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Hapus SEMUA data?",
      html: "Seluruh data cuti/izin/sakit akan dihapus secara permanen dan tidak bisa dikembalikan.",
      showCancelButton: true,
      confirmButtonText: "Ya, hapus semua!",
      cancelButtonText: "Batal",
      reverseButtons: true,
      focusCancel: true,
      confirmButtonColor: "#991b1b",
      cancelButtonColor: "#6b7280",
    });
    return result.isConfirmed;
  };

  // gaya tombol (samakan dengan Tukar Shift)
  const btnBase =
    "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md";

  return (
    <div className="p-6">
      {error && <p className="text-red-500 mb-2">{error}</p>}
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded mb-2">
          {successMessage}
        </div>
      )}

      {/* Form ajukan — disembunyikan untuk admin */}
      {user.role !== "admin" && (
        <div className="max-w-3xl w-full mx-auto">
          <LeaveForm onSubmitted={fetchList} />
        </div>
      )}

      {/* Tombol Hapus Semua — rata kanan */}
      {canDeleteAll && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleDeleteAll}
            disabled={deletingAll || loading}
            className={`inline-flex items-center gap-1 px-3 py-2 rounded text-white ${
              deletingAll ? "bg-red-400 cursor-not-allowed" : "bg-red-800 hover:bg-red-900"
            }`}
            title="Hapus semua data cuti/izin"
          >
            <TrashIcon className="w-5 h-5" />
            {deletingAll ? "Menghapus..." : "Hapus Semua Data"}
          </button>
        </div>
      )}

      <table className="min-w-full border border-gray-300 mt-4">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1 text-center">Karyawan</th>
            <th className="border px-2 py-1 text-center">Jenis</th>
            <th className="border px-2 py-1 text-center">Tanggal</th>
            <th className="border px-2 py-1 text-left">Status</th>
            <th className="border px-2 py-1 text-center whitespace-nowrap">Aksi</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5} className="text-center py-4 text-gray-500">Loading...</td>
            </tr>
          ) : list.length > 0 ? (
            list.map((r) => {
              const rowLoad = loadingRows[r.id] || {};
              // Hitung tombol yang tampil di kolom Aksi
              const actionsCount =
                (canApprove(r) ? 2 : 0) + // Approve + Reject
                (canCancel(r) ? 1 : 0) +  // Batalkan
                (canDelete(r) ? 1 : 0);   // Hapus (admin)

              const reasonLimit = actionsCount <= 1 ? 20 : 10;

              // Lebar maksimum baris alasan supaya tetap 1 baris (sedikit lebih lega saat tombolnya 1)
              const reasonMaxW = actionsCount <= 1 ? "max-w-[300px]" : "max-w-[240px]";

              const hasActions = canApprove(r) || canCancel(r) || canDelete();

              return (
                <tr key={r.id} className="align-top">
                  <td className="border px-2 py-1 text-center align-middle">{r.employee?.name}</td>
                  <td className="border px-2 py-1 text-center align-middle">{r.type}</td>
                  <td className="border px-2 py-1 text-center align-middle">
                    {r.start_date} - {r.end_date}
                  </td>

                  {/* Status + alasan (truncate + popup) */}
                  <td className="border px-2 py-1">
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={r.status} />
                  
                      {/* REJECTED → Ditolak oleh {Approver}: alasan… */}
                      {String(r.status).toLowerCase() === "rejected" && (r.reject_reason || r.note) && (
                        <ReasonInline
                          label={`Ditolak oleh ${r.rejected_by_name || r.approver?.name || "Approver"}`}
                          reason={r.reject_reason || r.note}
                          color="text-red-600"
                          limit={reasonLimit}
                          maxWidthClass={reasonMaxW}
                        />
                      )}
                  
                      {/* CANCELED → Dibatalkan oleh {Nama}: alasan… */}
                      {String(r.status).toLowerCase() === "canceled" && (r.cancel_reason || r.note) && (
                        <ReasonInline
                          label={`Dibatalkan oleh ${r.canceled_by_name || r.employee?.name || "Pemohon"}`}
                          reason={r.cancel_reason || r.note}
                          color="text-gray-600"
                          limit={reasonLimit}
                          maxWidthClass={reasonMaxW}
                        />
                      )}
                    </div>
                  </td>

                  {/* Aksi — sebaris & dinamis */}
                  <td className="border px-2 py-1">
                    <div
                      className={
                        "flex items-center justify-center gap-2 flex-nowrap whitespace-nowrap " +
                        (hasActions ? "" : "")
                      }
                    >
                      {canApprove(r) && (
                        <>
                          <button
                            onClick={() => handleApprove(r.id)}
                            className={`${btnBase} bg-green-600 text-white hover:bg-green-700`}
                            disabled={rowLoad.approve}
                            title="Setujui"
                          >
                            <CheckIcon className="w-4 h-4" />
                            {rowLoad.approve ? "Mengirim..." : "Approve"}
                          </button>

                          <button
                            onClick={() => openRejectModal(r.id)}
                            className={`${btnBase} bg-red-600 text-white hover:bg-red-700`}
                            disabled={rowLoad.reject}
                            title="Tolak"
                          >
                            <XMarkIcon className="w-4 h-4" />
                            {rowLoad.reject ? "Mengirim..." : "Reject"}
                          </button>
                        </>
                      )}

                      {canCancel(r) && (
                        <button
                          onClick={() => openCancelModal(r.id)}
                          className={`${btnBase} bg-orange-600 text-white hover:bg-orange-700`}
                          disabled={rowLoad.cancel}
                          title="Batalkan pengajuan"
                        >
                          <StopCircleIcon className="w-4 h-4" />
                          {rowLoad.cancel ? "Mengirim..." : "Batalkan"}
                        </button>
                      )}

                      {canDelete() && (
                        <button
                          onClick={() => handleDelete(r.id, r.employee?.name)}
                          className={`${btnBase} bg-red-600 text-white hover:bg-red-700`}
                          disabled={rowLoad.delete}
                          title="Hapus data ini"
                        >
                          <TrashIcon className="w-4 h-4" />
                          {rowLoad.delete ? "Menghapus..." : "Hapus"}
                        </button>
                      )}

                      {!hasActions && <span className="text-gray-400 text-sm">-</span>}
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={5} className="text-center py-4 text-gray-500">
                Belum ada pengajuan izin/cuti.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Modal alasan */}
      <ReasonModal
        open={modal.open}
        submitting={modal.submitting}
        title={modal.mode === "reject" ? "Tolak Pengajuan" : "Batalkan Pengajuan"}
        placeholder={modal.mode === "reject" ? "Tulis alasan penolakan..." : "Tulis alasan pembatalan..."}
        confirmText={modal.mode === "reject" ? "Kirim" : "Batalkan"}
        onSubmit={submitReason}
        onClose={() =>
          !modal.submitting &&
          setModal({ open: false, mode: null, id: null, submitting: false })
        }
      />
    </div>
  );
}
