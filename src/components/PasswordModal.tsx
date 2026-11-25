"use client";

import React from "react";
import { Eye, EyeOff, KeyRound, X } from "lucide-react";
import { AuthUser } from "@/lib/types";
import { AppLang } from "@/lib/i18n";

interface PasswordModalProps {
  lang: AppLang;
  currentUser: AuthUser;
  open: boolean;
  cpError: string;
  cpOldPass: string;
  setCpOldPass: (v: string) => void;
  cpNewPass: string;
  setCpNewPass: (v: string) => void;
  cpConfirmPass: string;
  setCpConfirmPass: (v: string) => void;
  cpShowPass: boolean;
  setCpShowPass: (v: boolean) => void;
  cpBusy: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function PasswordModal({
  lang,
  currentUser,
  open,
  cpError,
  cpOldPass,
  setCpOldPass,
  cpNewPass,
  setCpNewPass,
  cpConfirmPass,
  setCpConfirmPass,
  cpShowPass,
  setCpShowPass,
  cpBusy,
  onClose,
  onSubmit,
}: PasswordModalProps) {
  if (!open) return null;
  const en = lang === "en";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card border border-line rounded-2xl shadow-xl p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-ink-primary flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emeraldTech" />
              {en ? "Change Password" : "Ganti Kata Sandi"}
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              {currentUser.name} ({currentUser.email})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-ink-muted hover:text-ink-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {cpError && (
          <div className="p-3 rounded-xl bg-roseTech/10 border border-roseTech/35 text-xs font-semibold text-roseTech">
            {cpError}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3.5">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-primary">
              {en ? "Current Password" : "Kata Sandi Lama"}
            </label>
            <input
              type={cpShowPass ? "text" : "password"}
              required
              value={cpOldPass}
              onChange={(e) => setCpOldPass(e.target.value)}
              placeholder={
                en ? "Enter current password" : "Masukkan kata sandi lama"
              }
              className="w-full h-11 px-3.5 rounded-xl bg-surface border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-primary">
              {en
                ? "New Password (min. 6 characters)"
                : "Kata Sandi Baru (min. 6 karakter)"}
            </label>
            <div className="relative">
              <input
                type={cpShowPass ? "text" : "password"}
                required
                minLength={6}
                value={cpNewPass}
                onChange={(e) => setCpNewPass(e.target.value)}
                placeholder={
                  en ? "Enter new password" : "Masukkan kata sandi baru"
                }
                className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-surface border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
              />
              <button
                type="button"
                onClick={() => setCpShowPass(!cpShowPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary"
              >
                {cpShowPass ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-primary">
              {en ? "Confirm New Password" : "Ulangi Kata Sandi Baru"}
            </label>
            <input
              type={cpShowPass ? "text" : "password"}
              required
              minLength={6}
              value={cpConfirmPass}
              onChange={(e) => setCpConfirmPass(e.target.value)}
              placeholder={
                en ? "Re-enter new password" : "Ketik ulang kata sandi baru"
              }
              className="w-full h-11 px-3.5 rounded-xl bg-surface border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-ink-muted hover:text-ink-primary"
            >
              {en ? "Cancel" : "Batal"}
            </button>
            <button
              type="submit"
              disabled={cpBusy}
              className="px-5 py-2.5 rounded-xl bg-cta-bg hover:opacity-90 text-cta-ink text-xs font-bold transition shadow-sm"
            >
              {cpBusy
                ? en
                  ? "Saving..."
                  : "Menyimpan..."
                : en
                  ? "Save"
                  : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
