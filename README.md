# 🏛️ Ciomas Keramik — Sistem Manajemen Toko

Aplikasi web manajemen toko keramik lengkap berbasis **Next.js 15** dan **PostgreSQL**.

---

## ✨ Fitur Utama

| Modul | Fitur |
|-------|-------|
| **Dashboard** | Ringkasan penjualan, produk terlaris, stok menipis, transaksi terbaru |
| **Master Produk** | CRUD produk keramik, harga multi-tier, tracking stok, riwayat harga |
| **Penjualan** | Buat invoice, multi-item, diskon, berbagai metode bayar |
| **Pembelian** | Purchase Order, penerimaan barang, update stok otomatis |
| **Stok & Pergerakan** | Barang masuk/keluar, penyesuaian, retur, histori lengkap |
| **Kategori** | Kelola jenis-jenis keramik |
| **Pelanggan** | Database pelanggan (retail, grosir, kontraktor), total pembelian |
| **Supplier** | Database supplier/pemasok |
| **Master User** | CRUD user dengan role-based access (admin, manager, kasir, gudang) |
| **Laporan** | Penjualan harian, bulanan, produk terlaris, pelanggan terbaik + grafik |

---

## 🛠 Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS
- **Backend**: Next.js API Routes (Server-side)
- **Database**: PostgreSQL 16
- **Auth**: JWT (via httpOnly cookie)
- **Charts**: Recharts
- **Font**: Cormorant Garamond (display) + Jost (body)

---

## 🚀 Cara Menjalankan

### Metode 1: Development (Manual)

**1. Siapkan Database PostgreSQL**
```bash
# Buat database
psql -U postgres -c "CREATE DATABASE ciomas_keramik;"

# Jalankan schema
psql -U postgres -d ciomas_keramik -f database/schema.sql
```

**2. Konfigurasi Environment**
```bash
cp .env.example .env.local
# Edit .env.local sesuaikan dengan konfigurasi database Anda
```

**3. Install Dependencies**
```bash
npm install
```

**4. Jalankan Development Server**
```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

---

### Metode 2: Docker Compose (Recommended)

```bash
# Clone/extract project
cd ciomas-keramik

# Jalankan semua service (PostgreSQL + App)
docker-compose up -d

# Cek status
docker-compose ps

# Lihat logs
docker-compose logs -f app
```

Buka [http://localhost:3000](http://localhost:3000)

---

## 🔐 Login Default

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `Admin@123` |
| Role | Administrator |

> ⚠️ **Penting**: Segera ganti password setelah pertama login!

---

## 👥 Role & Hak Akses

| Role | Dashboard | Produk | Penjualan | Pembelian | Stok | User |
|------|-----------|--------|-----------|-----------|------|------|
| **Admin** | ✅ | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Manager** | ✅ | ✅ Full | ✅ Full | ✅ Full | ✅ Full | 👁 View |
| **Kasir** | ✅ | 👁 View | ✅ Buat | ❌ | 👁 View | ❌ |
| **Gudang** | ✅ | 👁 View | ❌ | ✅ Terima | ✅ Full | ❌ |

---

## 📁 Struktur Project

```
ciomas-keramik/
├── src/
│   ├── app/
│   │   ├── (dashboard)/          # Protected routes
│   │   │   ├── layout.tsx        # Dashboard layout + sidebar
│   │   │   ├── dashboard/        # Halaman utama
│   │   │   ├── products/         # Master Produk
│   │   │   ├── sales/            # Penjualan
│   │   │   ├── purchases/        # Pembelian
│   │   │   ├── stock/            # Stok & Pergerakan
│   │   │   ├── categories/       # Kategori
│   │   │   ├── customers/        # Pelanggan
│   │   │   ├── suppliers/        # Supplier
│   │   │   ├── users/            # Master User
│   │   │   └── reports/          # Laporan
│   │   ├── api/                  # API Routes
│   │   │   ├── auth/             # Login, logout
│   │   │   ├── products/         # CRUD produk
│   │   │   ├── sales/            # CRUD penjualan
│   │   │   ├── purchases/        # CRUD pembelian
│   │   │   ├── stock/            # Manajemen stok
│   │   │   ├── customers/        # CRUD pelanggan
│   │   │   ├── suppliers/        # CRUD supplier
│   │   │   ├── categories/       # CRUD kategori
│   │   │   ├── users/            # CRUD user
│   │   │   └── reports/          # Laporan data
│   │   ├── login/                # Halaman login
│   │   ├── globals.css           # Global styles
│   │   └── layout.tsx            # Root layout
│   ├── components/
│   │   └── Sidebar.tsx           # Navigasi sidebar
│   └── lib/
│       ├── db.ts                 # Koneksi PostgreSQL
│       └── auth.ts               # JWT auth utilities
├── database/
│   └── schema.sql                # Schema & seed data
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── package.json
```

---

## 🎨 Design System

- **Palet Warna**: Stone (abu), Gold (#b8860b), Terracotta (#c44223)
- **Tipografi**: Cormorant Garamond untuk judul, Jost untuk teks
- **Tema**: Luxury ceramic store — elegan, hangat, profesional

---

## 📦 Menambah Data Sample

```bash
# Akses psql
psql -U postgres -d ciomas_keramik

# Tambah produk sample
INSERT INTO products (sku, name, category_id, selling_price, stock_quantity, size, material)
SELECT 'KRM-001', 'Keramik Lantai Putih 60x60', id, 85000, 500, '60x60', 'Keramik'
FROM categories WHERE name = 'Keramik Lantai' LIMIT 1;
```

---

## 🔧 Kustomisasi

- **Logo & Nama Toko**: Edit `src/components/Sidebar.tsx` dan `src/app/login/page.tsx`
- **Warna Tema**: Edit `src/app/globals.css` (CSS variables di `:root`)
- **Hak Akses**: Edit `src/middleware.ts`
- **Kategori Default**: Edit `database/schema.sql` bagian INSERT categories

---

## 📞 Dukungan

Dibuat dengan ❤️ untuk Ciomas Keramik.

**Stack**: Next.js 15 · React 19 · PostgreSQL 16 · Tailwind CSS · Recharts
