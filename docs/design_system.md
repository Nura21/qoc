# QOC Design System v2 — Smooth Mobile UI & Arsitektur Anti-Benturan

Dokumen acuan resmi bagi **Product Owner / Pengambil Keputusan**, **UI/UX Designer**, dan **Software Engineer** untuk aplikasi **QOC (Quotation → Invoice Cepat)** berbasis **Ionic React + Tailwind CSS v4 + Capacitor SQLite**.

---

## 1. Filosofi Visual (*Smooth, Clean, & Effortless*)
Desain QOC mengutamakan **ketenangan visual (*visual calm*)**, bentuk elemen yang **halus (*soft squircle & pill geometry*)**, dan **hierarki tipografi yang tegas** sehingga pengguna UMKM/freelancer bisa membuat dokumen dalam hitungan detik tanpa lelah mata:

1. **Kanvas Lembut & Kartu Mengambang**: Latar layar `#F4F6FA` (*Light*) / `#0F172A` (*Dark*) dipadukan dengan kartu `#FFFFFF` / `#1E293B` bersudut halus **`18px`** dan bayangan difus lembut (*soft ambient elevation*) sehingga elemen terasa modern dan tidak kaku.
2. **Satu Fokus Warna Utama**: Royal Blue **`#2563EB`** (dengan gradasi halus ke Indigo **`#4338CA`** pada kartu Hero KPI) sebagai warna aksi bisnis, Hijau **`#16A34A`** khusus aksi WhatsApp & status Lunas, Amber **`#D97706`** untuk DP/Barang, dan Merah **`#DC2626`** khusus Jatuh Tempo (*Overdue*) atau aksi hapus.
3. **Aturan Arsitektur CSS Cascade (Wajib di Ionic + Tailwind v4)**:
   - Seluruh stylesheet dasar Ionic (`core.css`, `normalize.css`, `structure.css`, `typography.css`) **wajib dimuat di dalam `@layer base`** sebelum `@layer utilities` Tailwind.
   - Tujuannya agar aturan reset bawaan Ionic (`button { padding: 0; border-radius: 0 }` dan `h1/h2/h3 { font-size: 22–26px }`) **tidak pernah menimpa** bentuk sudut membulat tombol, *padding*, maupun skala tipografi Design System.

---

## 2. Kalibrasi Perangkat: Xiaomi Redmi 13C (`360×800dp`) & Multi-Device

| Parameter | Kalibrasi Redmi 13C & Android Umum | Standar Implementasi QOC v2 |
| :--- | :--- | :--- |
| **Viewport Baseline** | `360px × 800px` (`720×1600 @ 2x`), uji turun ke `320px` | Gutter layar `16px` (`12px` di `<=355px`), lebar kartu bersih `328px`, kontainer maksimal `520px` di tablet/web. |
| **Status Bar & *Waterdrop Notch*** | Tinggi ~`32dp` di atas, navigasi 3-tombol/gesture di bawah | **Single-Source Native Insets**: `WindowCompat.setDecorFitsSystemWindows(window, false)` + `WindowInsetsCompat` (`systemBars \| displayCutout \| ime`) satu kali di `MainActivity.java` (tanpa duplikasi *padding* atas!). |
| **Bar Bawah Tunggal** | Hindari tumpukan 2 bar bawah | 5 Tab Utama (`Beranda · Dokumen · Barang · Preview · Profil`, tinggi `64px`) aktif di layar root; layar Form menyembunyikan `TabBar`. |
| **Pencarian Anti-Potong** | Placeholder `IonSearchbar` mudah terpotong di `360px` | Menggunakan komponen **`DsSearchBar`** (`height: 44px`, radius `14px`, padding presisi + tombol hapus `×`). |

---

## 3. Bentuk Elemen, Radius & Ukuran Standar

### 3.1 Sistem Radius Halus (*Soft Geometry*)
| Elemen | Border Radius | Catatan Visual |
| :--- | :--- | :--- |
| **Kartu Hero KPI** | **`20px`** | Gradasi `#2563EB → #4338CA` + kilau tepi dalam halus (`inset 0 1px 0 rgba(255,255,255,0.2)`). |
| **Kartu Konten (`.qoc-card`)** | **`18px`** | Garis tepi hairline `1px solid var(--ds-border)` + bayangan ambient lembut. |
| **Tombol Utama (`lg`) & Search Bar** | **`14px`** | Terasa empuk disentuh (*squircle*), tinggi nyaman di jangkauan jempol. |
| **Tombol Standar (`md`) & Input Form** | **`12px`** | Konsisten antar tombol aksi kartu dan kotak ketik form. |
| **Tombol Ringkas (`sm`)** | **`10px`** | Rapi di sudut kanan *header* (`+ Baru`, `+ Tambah`, `Edit Profil`). |
| **Avatar, Status Badge, & Filter Chip** | **`999px` (Pill)** | Lingkaran/kapsul penuh agar membedakan indikator status dari tombol kotak. |

### 3.2 Matriks Ukuran Tombol (`DsButton`)
| Ukuran | Tinggi Pasti | Padding Kiri-Kanan | Ukuran Font | Ikon | Penggunaan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`lg`** | **`48px`** | **`20px`** | `14px` Bold | `18px` | CTA utama penuh (*Terbitkan & Preview*, *Kirim PDF WA*, *Simpan Profil*). |
| **`md`** | **`42px`** | **`16px`** | `13px` Bold | `16px` | Aksi di dalam kartu (*Ingatkan WA*, *Detail*, *+ Buat Dokumen*, *Ekspor JSON*). |
| **`sm`** | **`34px`** | **`12px`** | `12px` Bold | `15px` | Tombol header (`+ Baru`, `+ Tambah`, `Edit Profil`), aksi sekunder (`+ Manual`, `List Barang`). |
| **`icon`** | **`38 × 38px`** | `0px` | — | `18px` | Ikon tunggal (`Duplikat`, `Cetak PDF`, `Hapus baris`). |

### 3.3 Hierarki Warna Tombol
- **`primary`**: Biru solid `#2563EB`, teks putih + bayangan biru tipis (`shadow-blue-600/20`).
- **`whatsapp`**: Hijau solid `#16A34A`, teks putih — eksklusif aksi WhatsApp & Ekspor Backup.
- **`secondary`**: Latar biru lembut `rgba(37, 99, 235, 0.10)`, teks `#2563EB` — pendamping tombol utama (*Detail*, *Edit Profil*).
- **`outline`**: Latar putih `#FFFFFF`, garis tepi `#CBD5E1`, teks `#1E293B` — aksi netral (*+ Quotation*, *Restore JSON*, *Simpan Draft*).
- **`danger`**: Latar merah lembut `#FEE2E2`, teks `#B91C1C` — aksi hapus/batal.

---

## 4. Skala Tipografi (`Inter`, Bebas Override Ionic)
| Peran | Ukuran & Bobot | Line Height | Penerapan |
| :--- | :--- | :--- | :--- |
| **Display KPI** | `26px` / `800` (`tabular-nums`) | `1.15` | Total Tagihan Belum Dibayar di kartu Hero Beranda. |
| **Page Title** | `17px` / `700` | `1.25` | Judul halaman di *Top App Bar* (`QOC Bisnis`, `Daftar Dokumen`). |
| **Card Title** | `14.5px` / `700` | `1.35` | Nama klien, judul proyek, judul kartu profil & katalog. |
| **Section Label** | `11px` / `700` (`uppercase`, `tracking-wider`) | `1.3` | Header bagian (`PERLU DITINDAKLANJUTI (0)`, `RIWAYAT AKTIVITAS`). |
| **Body / Input** | `13.5px` / `500` | `1.45` | Nilai input form, deskripsi kartu, isi pesan WA. |
| **Caption / Mono** | `11px` / `600` | `1.35` | Nomor dokumen (`INV-202611-012`), SKU, tanggal jatuh tempo, label field. |

---

## 5. Standar Form Input (`DsField`), Modal Keyboard-Safe (`DsFormModal`), & Filter Chip
1. **External Static Label**: Label `12px` semibold diletakkan di atas kotak input (jarak `6px`), tidak melayang di dalam kotak sehingga mustahil bertabrakan saat skala font HP dinaikkan.
2. **Kotak Input & Auto-Scroll Fokus**: Tinggi pasti `44px`, radius `12px`, latar `#F8FAFC` (*focus*: `#FFFFFF` + ring lembut biru `0 0 0 3px rgba(37,99,235,0.12)`). Setiap input otomatis memanggil `scrollIntoView({ block: 'center' })` saat diketuk agar tidak pernah tertutup *keyboard*.
3. **Batas Panjang Placeholder 2-Kolom (Anti-Potong di `360px`)**: Input dalam grid 2 kolom (`50%`) **wajib** memakai *placeholder* ringkas maksimal **12 karakter** (contoh: `"Opsional"`, `"pcs / paket"`, `"BCA"`, `"0"`).
4. **Aturan Emas Modal vs Keyboard Android (`DsFormModal`)**:
   - **DILARANG** memakai *Sheet Modal* (`initialBreakpoint` / `breakpoints`) untuk modal yang berisi `<input>`, `<textarea>`, atau kolom pencarian! Pada Android (`adjustResize` + `IME`), *Sheet Modal* akan terpotong dan memunculkan ruang putih kosong di atas *keyboard*.
   - Seluruh modal input & pencarian **wajib** memakai **`DsFormModal`** (mode *Full-Screen Modal* dengan `IonHeader` tetap di atas, `IonContent` dapat di-scroll leluasa di atas *keyboard*, dan tombol aksi utama menempel di `IonFooter`).
   - *Sheet Modal* (`initialBreakpoint`) **hanya** boleh dipakai untuk modal baca/konfirmasi **tanpa input ketik** (misal *Preview Pesan WA*).
5. **Single-Source Safe-Area & Keyboard (IME) Android**: Di Android native (`qoc-native-android`), `SystemBars.insetsHandling` dimatikan (`'disable'`) di `capacitor.config.ts`, dan **`MainActivity.java` memasang 1 listener tunggal pada `decorView`** untuk `systemBars | displayCutout | ime` sambil menolkan kembali inset tersebut via `WindowInsetsCompat.Builder` sebelum diteruskan ke WebView. Ini mencegah **kotak putih kosong di atas keyboard** (*double IME padding* oleh `SystemBars` + `MainActivity` / Chromium WebView >= 139) dan menghilangkan celah ganda di bawah status bar (`--ion-safe-area-*: 0px`).
6. **Filter Chip (`Semua | Barang | Jasa`)**: Tinggi pasti **`34px`**, padding **`0 14px`**, radius **`999px`**, teks `12px` Bold.
7. **Segmented Control (`Semua | Quotation | Invoice | BAST`)**: Track tinggi `42px` radius `14px` padding `4px`, item aktif latar putih radius `10px` dengan bayangan halus.
8. **Proteksi Hapus & Edit Fleksibel**: Setiap aksi hapus (*Katalog*, *Klien*, *Draft Dokumen*, *Riwayat Pembayaran*, *VOID Invoice*) wajib melalui dialog konfirmasi (`IonAlert`), dan setiap item di form transaksi dapat diedit harga/namanya secara khusus tanpa mengubah master katalog.
9. **Input Rupiah Anti-Salah Nol (`DsCurrencyInput`)**: Semua input uang (*Harga Katalog*, *Harga Item*, *Diskon*, *Pajak*, *Nominal Bayar*) wajib memakai `DsCurrencyInput` dengan prefix `Rp` statis + format pemisah ribuan otomatis saat mengetik (`250.000`) dan `inputMode="numeric"` + `enterKeyHint`.
10. **Sticky Thumb-Zone Bar & Progressive Disclosure**: Form transaksi menampilkan 3 inti di atas (*Klien*, *Item*, *Total*) sementara opsi tambahan (*Diskon, Pajak, Scope*) dibungkus accordion opsional, dengan ringkasan **Total Real-Time + tombol Draft & Terbitkan** menempel permanen di `IonFooter` (zona ibu jari 1/3 bawah layar).
11. **Material Design 3 Haptics & Android Back Gesture**: Interaksi penting memakai getaran halus (`hapticLight` / `hapticSuccess` / `hapticError` via `@capacitor/haptics`), dan tombol/gesture *Back* Android menutup modal/alert dulu sebelum berpindah halaman atau memunculkan konfirmasi keluar 2x tekan di Beranda.
12. **Animasi Buka Aplikasi — Opsi A (*Snappy Fintech*, `~900ms`)**:
    - **Native Android 12+ SplashScreen**: `styles.xml` (`Theme.SplashScreen`) memakai warna permukaan `@color/qoc_surface` (`#F4F6FA` / `#0B1120` dark) dan vektor `@drawable/qoc_splash_icon` di zona aman lingkaran Android 12+, dipadukan dengan `SplashScreen.installSplashScreen(this)` di `MainActivity.java` dan pre-paint background di `index.html` (**0% *white flash***).
    - **Branded Reveal (`LaunchSplash.tsx`)**: Emblem QOC *spring-scale* + *ambient pulse* + teks *glide-up* berjalan paralel bersama inisialisasi SQLite (`getDb()`), maksimal batas aman `1,6 detik`, lalu *fade-scale out* mulus (`280ms`) dan otomatis ter-unmount total. Wajib menghormati `prefers-reduced-motion: reduce`.
