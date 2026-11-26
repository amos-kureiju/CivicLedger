export type AppLang = "id" | "en";

export const UI_COPY = {
  id: {
    brandSub: "Kupon Bantuan Sembako Masyarakat",
    portalSub: "Portal Pengurus",
    largeTextOn: "Huruf Besar",
    largeTextOff: "Perbesar Huruf",
    dayMode: "Mode Siang",
    nightMode: "Mode Malam",
    online: "Online",
    offline: "Offline",
    onlineConnected: "Online · Terhubung",
    offlineSaved: "Offline · Tersimpan di HP",
    simBadge: "Data Simulasi",
    signOut: "Keluar",
    changePassword: "Ubah Sandi",
    resetDemo: "Reset Data Demo",
    syncOffline: "Kirim",
    navMain: "Menu Utama",
    navOthers: "Lainnya",
    tabs: {
      COORDINATOR: {
        label: "Pengurus",
        title: "Beranda Pengurus",
        subtitle: "Lihat sisa dana, data warga, dan buat kupon sembako.",
      },
      BENEFICIARY: {
        label: "Kupon",
        title: "Kupon Warga",
        subtitle: "Tunjukkan QR atau kode kupon ini saat mengambil sembako di kedai.",
      },
      MERCHANT_POS: {
        label: "Kasir",
        title: "Kasir Kedai",
        subtitle: "Cek dan terima kupon warga. Tetap bisa dipakai saat sinyal hilang.",
      },
      CLEARINGHOUSE: {
        label: "Pencairan",
        title: "Pencairan & Riwayat",
        subtitle: "Kirim catatan offline, lihat riwayat penukaran, dan cairkan saldo kedai.",
      },
      REPORTS: {
        label: "Laporan",
        title: "Laporan & Data",
        subtitle: "Ringkasan pembagian bantuan dan tombol unduh data Excel / JSON.",
      },
      GUIDE: {
        label: "Cara Pakai",
        title: "Cara Pakai",
        subtitle: "Panduan singkat dengan gambar untuk pengurus, warga, dan pemilik kedai.",
      },
    },
    auth: {
      badge: "Bantuan Pangan Komunitas · STACK 2026",
      heroLine1: "Pembagian Kupon Sembako",
      heroAccent: "Untuk Masyarakat",
      heroDesc:
        "Catat penerima bansos, bagikan kupon sembako, dan tukar di kedai mitra terdekat. Tetap bisa dipakai walau sinyal sedang tidak ada.",
      feat1Title: "Bisa Pakai QR atau Kertas",
      feat1Desc:
        "Warga yang punya HP cukup tunjukkan QR. Yang tidak pakai HP cukup bawa kode kupon yang dicetak di kertas.",
      feat2Title: "Jalan Saat Sinyal Susah",
      feat2Desc:
        "Kedai tetap bisa mengecek kupon tanpa internet. Catatan disimpan dulu di HP lalu dikirim saat sinyal masuk.",
      feat3Title: "Cegah Kupon Palsu & Ganda",
      feat3Desc:
        "Kupon cuma bisa dipakai sekali. Kalau ada yang coba ubah nominal atau tukar dua kali, sistem langsung menolak.",
      tabLogin: "Masuk",
      tabReset: "Lupa Sandi",
      tabRegister: "Daftar",
      loginEyebrow: "SELAMAT DATANG KEMBALI",
      loginHeading: "Masuk ke",
      loginSub: "Kelola bantuan. Hubungkan komunitas.",
      emailPhoneLabel: "Email atau Nomor HP",
      passLabel: "Kata Sandi",
      forgotLink: "Lupa kata sandi?",
      loginBtn: "Masuk",
      loginBusy: "Memeriksa...",
      primaryWebTitle: "Portal Web Utama (Pengurus)",
      primaryWebDesc:
        "Digunakan pengurus komunitas untuk mendata warga, menerbitkan kupon, memantau rekonsiliasi, dan mencairkan dana kedai.",
      pwaFallbackTitle: "Mode Uji Web / PWA Cadangan (Warga & Kedai)",
      pwaFallbackDesc:
        "Di lapangan, Warga Penerima dan Pemilik Kedai menggunakan Aplikasi Mobile CivicLedger. Akun di bawah tersedia untuk uji langsung lewat browser.",
      fillBtn: "Isi",
    },
  },
  en: {
    brandSub: "Community Food Voucher Clearinghouse",
    portalSub: "Organizer Portal",
    largeTextOn: "Large Text",
    largeTextOff: "Enlarge Text",
    dayMode: "Light Mode",
    nightMode: "Dark Mode",
    online: "Online",
    offline: "Offline",
    onlineConnected: "Online · Connected",
    offlineSaved: "Offline · Saved on Device",
    simBadge: "Simulated Data",
    signOut: "Sign Out",
    changePassword: "Change Password",
    resetDemo: "Reset Demo Data",
    syncOffline: "Sync",
    navMain: "Main Menu",
    navOthers: "More",
    tabs: {
      COORDINATOR: {
        label: "Organizer",
        title: "Organizer Console",
        subtitle: "Monitor aid funds, manage beneficiaries, and issue signed vouchers.",
      },
      BENEFICIARY: {
        label: "Voucher",
        title: "Beneficiary Wallet",
        subtitle: "Present this QR code or printed voucher code at participating stalls.",
      },
      MERCHANT_POS: {
        label: "Merchant POS",
        title: "Merchant POS (Offline-First)",
        subtitle: "Verify and redeem vouchers instantly—even during internet outages.",
      },
      CLEARINGHOUSE: {
        label: "Clearinghouse",
        title: "Settlement & Ledger",
        subtitle: "Reconcile offline batches, verify SHA-256 hash chain, and settle stalls.",
      },
      REPORTS: {
        label: "Reports",
        title: "Reports & Audit",
        subtitle: "Operational distribution metrics and 1-click CSV / JSON audit export.",
      },
      GUIDE: {
        label: "Guide",
        title: "User Guide",
        subtitle: "Step-by-step illustrated walkthrough for organizers, residents, and stalls.",
      },
    },
    auth: {
      badge: "Community Mutual Aid · STACK 2026",
      heroLine1: "Resilient Local Vouchers",
      heroAccent: "For Every Community",
      heroDesc:
        "Register beneficiaries, issue cryptographically signed food vouchers, and verify redemptions at local stalls—even without mobile internet.",
      feat1Title: "Dual-Channel QR & Paper Slip",
      feat1Desc:
        "Smartphone users show a bright QR code; non-smartphone or elderly residents use a printed 6-character code.",
      feat2Title: "Offline-First Verification",
      feat2Desc:
        "Local stalls verify signatures on-device without signal, buffer transactions locally, and batch-sync upon reconnection.",
      feat3Title: "Anti-Fraud & Anti-Duplicate",
      feat3Desc:
        "Single-use nonces and HMAC-SHA256 signatures immediately block forged amounts or duplicate redemptions.",
      tabLogin: "Sign In",
      tabReset: "Reset Password",
      tabRegister: "Register",
      loginEyebrow: "WELCOME BACK",
      loginHeading: "Sign in to",
      loginSub: "Manage aid. Connect communities.",
      emailPhoneLabel: "Email or Phone Number",
      passLabel: "Password",
      forgotLink: "Forgot password?",
      loginBtn: "Sign In",
      loginBusy: "Signing in...",
      primaryWebTitle: "Primary Web Portal (Organizer)",
      primaryWebDesc:
        "Used by community organizers to manage beneficiaries, issue vouchers, reconcile offline logs, and settle merchants.",
      pwaFallbackTitle: "Web / PWA Fallback Demo (Beneficiary & Merchant)",
      pwaFallbackDesc:
        "In the field, Beneficiaries and Local Merchants use the CivicLedger Mobile App. These demo accounts also work directly in the browser.",
      fillBtn: "Fill",
    },
  },
} as const;
