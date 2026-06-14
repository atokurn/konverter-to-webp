# WebM to WebP Converter (Transparan & Animasi)

Aplikasi berbasis web untuk mengonversi berkas video **WebM (ber-alpha/transparan)** menjadi berkas gambar/animasi **WebP transparan** secara langsung di sisi klien menggunakan **FFmpeg WASM**.

## 🚀 Fitur Utama
- **Batch Conversion:** Unggah beberapa file sekaligus untuk dikonversi secara antrean.
- **Transparansi Utuh:** Menggunakan metode decoding khusus `-vcodec libvpx-vp9` / `-vcodec libvpx` untuk mempertahankan saluran alpha (transparansi) asli dari file WebM tanpa mengubah background menjadi warna putih/hitam.
- **Kontrol Penuh:**
  - **Start / Pause / Stop:** Menunda, melanjutkan, atau menghentikan proses konversi yang sedang berjalan kapan saja.
  - **Retry:** Tombol untuk mengulang kembali file-file yang gagal dikonversi, baik secara satuan maupun massal (*Ulangi yang Gagal*).
- **Pengaturan Kustom:**
  - **Interval Waktu:** Atur jeda waktu antar konversi berkas untuk mengoptimalkan kinerja memori (mencegah masalah memori penuh / OOM pada browser).
- **Pemulihan Otomatis:** Sistem secara otomatis mendeteksi crash pada modul FFmpeg WASM (seperti kehabisan memori) dan memuat ulang engine secara bersih sebelum mencoba kembali berkas yang bermasalah.

## 🛠️ Teknologi yang Digunakan
- **Frontend Framework:** React (Vite)
- **Styling:** TailwindCSS
- **Core Conversion Engine:** `@ffmpeg/ffmpeg` & `@ffmpeg/util` (FFmpeg WebAssembly)

## 💻 Cara Menjalankan secara Lokal

1. **Kloning Repositori:**
   ```bash
   git clone <url-repository>
   cd konverter-to-webp
   ```

2. **Instalasi Dependensi:**
   ```bash
   npm install
   ```

3. **Jalankan Development Server:**
   ```bash
   npm run dev
   ```

## 🌐 Panduan Deploy ke Vercel

Karena aplikasi ini menggunakan **FFmpeg WASM**, browser wajib mengaktifkan fitur **Cross-Origin Isolation** melalui header keamanan HTTP. Jika tidak, engine FFmpeg tidak akan bisa dimuat di lingkungan produksi.

Kami sudah menyertakan file konfigurasi [`vercel.json`](./vercel.json) di dalam proyek ini:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        }
      ]
    }
  ]
}
```

### Cara Deploy Menggunakan Vercel CLI:
1. Pastikan Anda sudah login ke Vercel:
   ```bash
   npx vercel login
   ```
2. Jalankan perintah deploy untuk pertama kali:
   ```bash
   npx vercel
   ```
3. Deploy langsung ke produksi agar domain utama ter-update:
   ```bash
   npx vercel --prod
   ```
