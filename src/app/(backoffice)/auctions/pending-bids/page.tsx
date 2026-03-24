"use client";

import { useState, useEffect, useCallback } from "react";
import { API_BACKOFFICE_PREFIX } from "@/lib/api-config";
import Image from "next/image";
import { ExternalLink, Search, Check, X, Loader2, Pencil } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface PendingBid {
  id: number;
  auctionRequestId: number;
  price: number;
  bidCount: number;
  status: string;
  staff: { id: number; name: string } | null;
  recordedAt: string;
  auctionRequest?: {
    id: number;
    url: string;
    title: string;
    imageUrl: string;
    yahooItemId: string;
    currentPrice: number;
    endTime: string;
    username?: string;
    externalId?: string;
    note?: string | null;
  };
}

interface StaffItem {
  id: number;
  name: string;
}

function useCountdown(endISO?: string | null) {
  const [text, setText] = useState<string>(() => {
    if (!endISO) return "-";
    const diff = new Date(endISO).getTime() - Date.now();
    if (diff <= 0) return "Ended";
    const hours = Math.floor(diff / 3600_000);
    const minutes = Math.floor((diff % 3600_000) / 60_000);
    const seconds = Math.floor((diff % 60_000) / 1000);
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h ${minutes}m`;
    }
    return `${hours}h ${minutes}m ${seconds}s`;
  });

  useEffect(() => {
    if (!endISO) return;
    const tick = () => {
      const diff = new Date(endISO).getTime() - Date.now();
      if (diff <= 0) {
        setText("Ended");
        return;
      }
      const hours = Math.floor(diff / 3600_000);
      const minutes = Math.floor((diff % 3600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1000);
      if (hours >= 24) {
        const days = Math.floor(hours / 24);
        setText(`${days}d ${hours % 24}h ${minutes}m`);
      } else {
        setText(`${hours}h ${minutes}m ${seconds}s`);
      }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endISO]);

  return text;
}

function Countdown({ endISO }: { endISO?: string | null }) {
  const text = useCountdown(endISO);
  const isEnded = text === "Ended";
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums ${
        isEnded
          ? "bg-rose-100 text-rose-700"
          : "bg-emerald-100 text-emerald-700"
      }`}
    >
      {text}
    </span>
  );
}

export default function PendingBidsPage() {
  const [bids, setBids] = useState<PendingBid[]>([]);
  const [staffs, setStaffs] = useState<StaffItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [editingNoteArId, setEditingNoteArId] = useState<number | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [bidsRes, staffsRes] = await Promise.all([
        fetch(`${API_BACKOFFICE_PREFIX}/pending-bids`),
        fetch(`${API_BACKOFFICE_PREFIX}/staffs`),
      ]);
      const bidsJson = await bidsRes.json();
      const staffsJson = await staffsRes.json();

      if (bidsJson.success) setBids(bidsJson.data ?? []);
      else setError(bidsJson.error?.message ?? "Failed to load bids");

      if (staffsJson.success) setStaffs(staffsJson.data ?? []);
    } catch {
      setError("Network error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = filterUser
    ? bids.filter(
        (b) =>
          (b.auctionRequest?.title ?? "")
            .toLowerCase()
            .includes(filterUser.toLowerCase()) ||
          (b.auctionRequest?.username ?? "")
            .toLowerCase()
            .includes(filterUser.toLowerCase()) ||
          (b.auctionRequest?.externalId ?? "")
            .toLowerCase()
            .includes(filterUser.toLowerCase()) ||
          String(b.id).includes(filterUser),
      )
    : bids;

  const cancelAction = () => {
    setEditingNoteArId(null);
    setEditingNoteValue("");
    setApprovingId(null);
    setSelectedStaff("");
    setRejectingId(null);
    setRejectReason("");
  };

  const handleApprove = async (bidId: number) => {
    if (!selectedStaff) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/backoffice/bids/${bidId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ biddedBy: Number(selectedStaff) }),
      });
      const json = await res.json();
      if (json.success) {
        cancelAction();
        fetchData();
      } else {
        setError(json.error?.message ?? "Failed to approve");
      }
    } catch {
      setError("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (bidId: number) => {
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BACKOFFICE_PREFIX}/bids/${bidId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const json = await res.json();
      if (json.success) {
        cancelAction();
        fetchData();
      } else {
        setError(json.error?.message ?? "Failed to reject");
      }
    } catch {
      setError("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const startEditNote = (arId: number, currentNote: string | null) => {
    setEditingNoteArId(arId);
    setEditingNoteValue(currentNote ?? "");
  };

  const cancelEditNote = () => {
    setEditingNoteArId(null);
    setEditingNoteValue("");
  };

  const saveNote = async () => {
    if (editingNoteArId == null) return;
    const value = editingNoteValue.trim() || null;
    if (value && value.length > 2000) {
      setError("Note must be at most 2000 characters");
      return;
    }
    setNoteSaving(true);
    try {
      const res = await fetch(
        `${API_BACKOFFICE_PREFIX}/auction-requests/${editingNoteArId}/note`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: value }),
        },
      );
      const json = await res.json();
      if (json.success) {
        setBids((prev) =>
          prev.map((b) =>
            b.auctionRequest?.id === editingNoteArId
              ? { ...b, auctionRequest: { ...b.auctionRequest!, note: value } }
              : b,
          ),
        );
        cancelEditNote();
      } else {
        setError(json.error?.message ?? "Failed to save note");
      }
    } catch {
      setError("Network error");
    } finally {
      setNoteSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-sakura-900 tracking-tight">
            การประมูลที่รออนุมัติ
          </h1>
        </div>
        <span className="rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-semibold text-indigo-700">
          {filtered.length} pending
        </span>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-center justify-between">
          {error}
          <button
            onClick={() => setError("")}
            className="text-red-500 hover:text-red-700 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="mb-5">
        <div className="relative w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            placeholder="Search by title, user ID or user name..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-card-border bg-white text-sm
                       placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-shadow"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-sakura-200/60 bg-white shadow-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-sakura-200 bg-sakura-50/80">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36 whitespace-nowrap">
                    รหัสผู้ใช้
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36">
                    ชื่อผู้ใช้
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center">
                    สินค้า
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36 whitespace-nowrap">
                    ลิงก์ประมูล
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 text-center align-middle w-[120px] whitespace-nowrap">
                    ราคาปัจจุบัน
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 text-center align-middle w-[120px] whitespace-nowrap">
                    ราคาที่ขอ
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center">
                    เวลาสิ้นสุด
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-24 whitespace-nowrap">
                    สถานะ
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center">
                    หมายเหตุ
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center">
                    การดำเนินการ
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((bid) => {
                  const isApproving = approvingId === bid.id;
                  const isRejecting = rejectingId === bid.id;
                  const isPending = bid.status === "pending";

                  return (
                    <tr
                      key={bid.id}
                      className="border-b border-sakura-100 last:border-0 hover:bg-indigo-50/30 transition-colors group"
                    >
                      <td className="px-6 py-5 align-middle text-center w-36">
                        <span
                          className="inline-flex items-center rounded-lg bg-sakura-100 px-2.5 py-1 font-mono text-xs font-medium text-sakura-800 max-w-full truncate"
                          title={bid.auctionRequest?.externalId ?? undefined}
                        >
                          {bid.auctionRequest?.externalId ?? "-"}
                        </span>
                      </td>
                      <td className="px-6 py-5 align-middle text-center w-36">
                        <span className="inline-flex items-center rounded-lg bg-sakura-100 px-2.5 py-1 font-mono text-xs font-semibold text-sakura-800">
                          {bid.auctionRequest?.username ?? "-"}
                        </span>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        <div className="flex items-center gap-4">
                          {bid.auctionRequest?.imageUrl ? (
                            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-sakura-100 ring-1 ring-sakura-200/50">
                              <Image
                                src={bid.auctionRequest.imageUrl}
                                alt={bid.auctionRequest?.title ?? "Product"}
                                fill
                                className="object-cover"
                                sizes="56px"
                              />
                            </div>
                          ) : (
                            <div className="h-14 w-14 shrink-0 rounded-xl bg-sakura-100 flex items-center justify-center text-muted text-xs ring-1 ring-sakura-200/50">
                              —
                            </div>
                          )}
                          <span className="font-medium text-sakura-900 line-clamp-2 max-w-[200px] leading-snug">
                            {bid.auctionRequest?.title ?? "-"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle text-center w-36">
                        {bid.auctionRequest?.url ? (
                          <a
                            href={bid.auctionRequest.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={bid.auctionRequest.url}
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 hover:underline text-xs font-medium"
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            Link
                          </a>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td className="px-6 py-5 align-middle text-center w-[120px]">
                        <div className="flex min-h-[56px] w-full items-center justify-center">
                          <span className="font-bold tabular-nums text-sakura-900 whitespace-nowrap">
                            {bid.auctionRequest?.currentPrice != null
                              ? `¥${formatPrice(bid.auctionRequest.currentPrice)}`
                              : "-"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle text-center w-[120px]">
                        <div className="flex min-h-[56px] w-full items-center justify-center">
                          <span className="font-bold tabular-nums text-indigo-700 whitespace-nowrap">
                            ¥{formatPrice(bid.price)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle text-center">
                        <Countdown endISO={bid.auctionRequest?.endTime} />
                      </td>
                      <td className="px-6 py-5 align-middle text-center w-24">
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span
                            className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
                              bid.status === "pending"
                                ? "bg-amber-100 text-amber-800"
                                : bid.status === "approved"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {bid.status}
                          </span>
                          {bid.staff && (
                            <p
                              className="text-xs text-muted truncate max-w-full"
                              title={bid.staff.name}
                            >
                              by {bid.staff.name}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle text-center">
                        {bid.auctionRequest?.id != null &&
                        editingNoteArId === bid.auctionRequest.id ? (
                          <div className="flex flex-col gap-1.5 min-w-[180px]">
                            <textarea
                              value={editingNoteValue}
                              onChange={(e) =>
                                setEditingNoteValue(
                                  e.target.value.slice(0, 2000),
                                )
                              }
                              placeholder="Add note..."
                              rows={2}
                              maxLength={2000}
                              className="rounded-lg border border-sakura-200 px-2.5 py-1.5 text-xs resize-none
                                         focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                              autoFocus
                            />
                            <div className="flex gap-1.5">
                              <button
                                onClick={saveNote}
                                disabled={noteSaving}
                                className="flex-1 inline-flex items-center justify-center gap-1 rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white
                                           hover:bg-indigo-700 disabled:opacity-50"
                              >
                                {noteSaving ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                )}
                                Save
                              </button>
                              <button
                                onClick={cancelEditNote}
                                className="rounded border border-sakura-200 px-2 py-1 text-xs font-medium text-sakura-600 hover:bg-sakura-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              bid.auctionRequest?.id != null &&
                              startEditNote(
                                bid.auctionRequest.id,
                                bid.auctionRequest.note ?? null,
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-sakura-600 hover:bg-sakura-50 hover:text-sakura-800 transition-colors text-left min-h-[32px]"
                          >
                            <Pencil className="h-3 w-3 shrink-0 opacity-60" />
                            <span className="line-clamp-2 max-w-[140px]">
                              {bid.auctionRequest?.note?.trim() || "Add note"}
                            </span>
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-5 align-middle">
                        <div className="flex justify-center">
                          {/* Approve form */}
                          {isApproving && (
                            <div className="flex flex-col gap-2 min-w-[220px]">
                              <select
                                value={selectedStaff}
                                onChange={(e) =>
                                  setSelectedStaff(e.target.value)
                                }
                                className="rounded-lg border border-sakura-200 px-3 py-2 text-sm
                                         focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300"
                                autoFocus
                              >
                                <option value="">Select staff...</option>
                                {staffs.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApprove(bid.id)}
                                  disabled={!selectedStaff || actionLoading}
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white
                                           hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {actionLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                  Confirm
                                </button>
                                <button
                                  onClick={cancelAction}
                                  className="rounded-lg border border-sakura-200 px-3 py-2 text-xs font-medium text-sakura-600 hover:bg-sakura-50 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Reject form */}
                          {isRejecting && (
                            <div className="flex flex-col gap-2 min-w-[220px]">
                              <textarea
                                value={rejectReason}
                                onChange={(e) =>
                                  setRejectReason(e.target.value)
                                }
                                placeholder="Reason for rejection..."
                                rows={2}
                                className="rounded-lg border border-sakura-200 px-3 py-2 text-sm resize-none
                                         focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleReject(bid.id)}
                                  disabled={
                                    !rejectReason.trim() || actionLoading
                                  }
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white
                                           hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {actionLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <X className="h-3.5 w-3.5" />
                                  )}
                                  Confirm Reject
                                </button>
                                <button
                                  onClick={cancelAction}
                                  className="rounded-lg border border-sakura-200 px-3 py-2 text-xs font-medium text-sakura-600 hover:bg-sakura-50 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Default buttons */}
                          {!isApproving && !isRejecting && isPending && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  cancelAction();
                                  setApprovingId(bid.id);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white
                                         hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-sm hover:shadow"
                              >
                                <Check className="h-3.5 w-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => {
                                  cancelAction();
                                  setRejectingId(bid.id);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white
                                         hover:bg-rose-700 active:scale-[0.98] transition-all shadow-sm hover:shadow"
                              >
                                <X className="h-3.5 w-3.5" /> Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && !isLoading && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-6 py-16 text-center align-middle"
                    >
                      <p className="text-sakura-500 font-medium">
                        {filterUser
                          ? `No bids found for "${filterUser}"`
                          : "No pending bids"}
                      </p>
                      <p className="text-sm text-muted mt-1">
                        {filterUser
                          ? "Try a different search term"
                          : "New bid requests will appear here"}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
