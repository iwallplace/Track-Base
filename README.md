# Project Track Base - Modern Envanter Yönetimi

Project Track Base, modern teknolojilerle geliştirilmiş, yapay zeka destekli bir lojistik ve envanter takip sistemidir.

## 🚀 Özellikler

- **Dashboard & Raporlar:** Detaylı grafikler ve KPI kartları ile anlık durum takibi.
- **Envanter Yönetimi:** Ürün ekleme, düzenleme ve hareket geçmişi görüntüleme.
- **AI Asistanı (Intra Arc):** Stok durumu ve analizler için Google Gemini destekli akıllı sohbet botu.
- **Güvenlik:** NextAuth ile güvenli kimlik doğrulama.
- **Modern Arayüz:** Tailwind CSS ve Framer Motion ile geliştirilmiş responsive tasarım (Light/Dark mod desteği).

## 🛠 Kullanılan Teknolojiler

- **Framework:** Next.js 15 (App Router)
- **Dil:** TypeScript
- **Veritabanı:** SQLite & Prisma ORM
- **Stil:** Tailwind CSS v4
- **Kimlik Doğrulama:** NextAuth.js
- **Yapay Zeka:** Google Gemini AI
- **Email:** Resend

## ⚙️ Kurulum

1. **Projeyi klonlayın:**
   ```bash
   git clone https://github.com/kullaniciadi/inventory-app.git
   cd inventory-app
   ```

2. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   ```

3. **Çevresel Değişkenleri Ayarlayın:**
   `.env.example` dosyasını `.env` olarak kopyalayın ve gerekli anahtarları ekleyin:
   ```bash
   cp .env.example .env
   ```

4. **Veritabanını Hazırlayın:**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

5. **Uygulamayı Başlatın:**
   ```bash
   npm run dev
   ```
   Tarayıcınızda `http://localhost:3000` adresine gidin.

## 🤝 Katkıda Bulunma

Pull requestler kabul edilir. Büyük değişiklikler için lütfen önce tartışmak amacıyla bir konu açınız.

## 📄 Lisans

[MIT](https://choosealicense.com/licenses/mit/)
