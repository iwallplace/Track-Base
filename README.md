# Project Track Base 📦

**Project Track Base**, lojistik, envanter yönetimi ve raporlama süreçlerini dijitalleştirmek için tasarlanmış, Next.js 15 ve Yapay Zeka destekli modern bir kurumsal web uygulamasıdır.

![Dashboard Preview](https://via.placeholder.com/1200x600?text=Project+Track+Base+Dashboard)

## ✨ Özellikler

### 📊 Dashboard & Raporlama
- **KPI Kartları:** Toplam stok, aktif firmalar ve kritik ürünler gibi önemli metriklerin anlık takibi.
- **Dinamik Grafikler:** Zaman aralığına göre filtrelenebilir satış ve stok hareket grafikleri.
- **Tarih Filtreleme:** Özelleştirilebilir tarih aralıkları ile raporları detaylandırma.

### 📦 Envanter Yönetimi
- **Detaylı Stok Takibi:** Malzeme referansı, firma ve stok miktarı bazında listeleme.
- **Sezgisel Arama (Intuitive Search):** İrsaliye no veya not gibi geçmiş veriler arandığında, ilgili tarihi tespit edip o kaydın bulunduğu satıra otomatik odaklanma ve vurgulama (Highlight).
- **Hareket Geçmişi:** Her bir materyalin giriş-çıkış hareketlerinin tarihçesi (Tarih ve Saat detaylı).
- **Kritik Stok Uyarıları:** Belirlenen eşiğin altına düşen ürünler için otomatik bildirimler.

### 🛡️ Güvenlik & RBAC (Role Tabanlı Erişim)
- **Granüler Yetkilendirme:** `inventory.create`, `inventory.delete`, `users.manage` gibi ince ayarlı izin sistemi.
- **Dinamik Rol Yönetimi:** Admin (Project Owner) paneli üzerinden rollere anlık yetki tanımlama/kaldırma.
- **Güvenli Silme:** Project Owner onayı veya yetkisi ile stok hareketlerini silme ve geri alma korumaları.
- **Güvenli Kimlik Doğrulama:** NextAuth.js ile şifreli, session tabanlı giriş sistemi.

### 🌍 Çoklu Dil Desteği (I18n)
- **Tam Lokalizasyon:** Türkçe (TR) ve İngilizce (EN) tam destek.
- **Dinamik Dil Geçişi:** Arayüz üzerinden anlık dil değiştirme ve kullanıcı tercihinin hatırlanması.

### 🤖 Intra Arc (AI Asistanı)
- **Google Gemini Entegrasyonu:** Doğal dil işleme ile stok verilerini sorgulama.
- **Akıllı Analiz:** "Hangi ürün kritik seviyede?", "En son hangi firma işlem yaptı?" gibi sorulara anlık yanıtlar.

---

## 🏗 Proje Yapısı

```
inventory-app/
├── 📂 app/
│   ├── 📂 api/              # Backend API rotaları (Next.js Route Handlers)
│   ├── 📂 dashboard/        # Ana yönetim paneli sayfaları
│   │   ├── 📂 inventory/    # Stok listesi ve detay sayfaları
│   │   ├── 📂 reports/      # Raporlama ekranları
│   │   └── 📂 users/        # Kullanıcı ve Rol yönetimi (RBAC)
│   └── 📂 login/            # Giriş sayfası
├── 📂 components/           # Yeniden kullanılabilir UI bileşenleri
├── 📂 lib/                  # Yardımcı fonksiyonlar, DB ve Auth yapılandırmaları
│   ├── db.ts               # Prisma veritabanı istemcisi
│   ├── permissions.ts      # RBAC yetki kontrol mekanizması
│   └── i18n.ts             # Çeviri sözlükleri ve yapılandırması
├── 📂 prisma/               # Veritabanı şeması (Schema)
└── 📂 public/               # Statik dosyalar
```

---

## 🛠 Kullanılan Teknolojiler

| Kategori | Teknoloji | Açıklama |
|----------|-----------|----------|
| **Frontend** | Next.js 15 | App Router yapısı ile modern React framework'ü |
| **Dil** | TypeScript | Tip güvenli geliştirme |
| **Stil** | Tailwind CSS v4 | Hızlı ve esnek UI tasarımı |
| **Veritabanı** | PostgreSQL (Supabase) | Ölçeklenebilir ve güvenli veritabanı |
| **ORM** | Prisma | Veritabanı yönetimi ve tip güvenli sorgular |
| **Auth** | NextAuth.js | Güvenli kimlik doğrulama çözümü |
| **I18n** | React Context | Hafif ve performanslı, client-side çeviri yönetimi |
| **AI** | Google Gemini | Üretken yapay zeka entegrasyonu |

---

## 🚀 Kurulum Adımları

1. **Repoyu Klonlayın**
   ```bash
   git clone https://github.com/iwallplace/Track-Base.git
   cd inventory-app
   ```

2. **Bağımlılıkları Yükleyin**
   ```bash
   npm install
   ```

3. **Çevresel Değişkenleri (.env) Ayarlayın**
   `.env` dosyasını oluşturun ve veritabanı, auth secret gibi değerleri girin.

4. **Veritabanını Oluşturun**
   ```bash
   npx prisma db push
   ```

5. **Uygulamayı Başlatın**
   ```bash
   npm run dev
   ```

---

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır. All rights reserved © 2026.
