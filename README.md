# Project Track Base 📦

**Project Track Base**, lojistik, envanter yönetimi ve raporlama süreçlerini dijitalleştirmek için tasarlanmış, Next.js 15 ve Yapay Zeka destekli modern bir web uygulamasıdır.

![Dashboard Preview](https://via.placeholder.com/1200x600?text=Project+Track+Base+Dashboard)

## ✨ Özellikler

### 📊 Dashboard & Raporlama
- **KPI Kartları:** Toplam stok, aktif firmalar ve kritik ürünler gibi önemli metriklerin anlık takibi.
- **Dinamik Grafikler:** Zaman aralığına göre filtrelenebilir satış ve stok hareket grafikleri.
- **Tarih Filtreleme:** Özelleştirilebilir tarih aralıkları ile raporları detaylandırma.

### 📦 Envanter Yönetimi
- **Detaylı Stok Takibi:** Malzeme referansı, firma ve stok miktarı bazında listeleme.
- **Hareket Geçmişi:** Her bir materyalin giriş-çıkış hareketlerinin tarihçesi.
- **Kritik Stok Uyarıları:** Belirlenen eşiğin altına düşen ürünler için otomatik bildirimler.
- **Hızlı Ekleme:** Yeni materyal ve stok girişleri için optimize edilmiş formlar.

### 🤖 Intra Arc (AI Asistanı)
- **Google Gemini Entegrasyonu:** Doğal dil işleme ile stok verilerini sorgulama.
- **Akıllı Analiz:** "Hangi ürün kritik seviyede?", "En son hangi firma işlem yaptı?" gibi sorulara anlık yanıtlar.

### 🔐 Güvenlik & Yönetim
- **Role Dayalı Erişim:** Kullanıcı yetkilendirmeleri (Admin/User).
- **Güvenli Kimlik Doğrulama:** NextAuth.js ile şifreli giriş sistemi.
- **Ayarlar:** Profil yönetimi ve tema (Light/Dark) tercihleri.

---

## 🏗 Proje Yapısı

```
inventory-app/
├── 📂 app/
│   ├── 📂 api/              # Backend API rotaları (Next.js Route Handlers)
│   ├── 📂 dashboard/        # Ana yönetim paneli sayfaları
│   │   ├── 📂 inventory/    # Stok listesi ve detay sayfaları
│   │   ├── 📂 reports/      # Raporlama ekranları
│   │   └── 📂 settings/     # Kullanıcı ve uygulama ayarları
│   └── 📂 login/            # Giriş sayfası
├── 📂 components/           # Yeniden kullanılabilir UI bileşenleri
│   ├── 📂 ai/               # AI chatbot bileşenleri
│   └── ...                  # İkonlar, tablolar, modallar
├── 📂 lib/                  # Yardımcı fonksiyonlar ve yapılandırmalar
│   ├── db.ts               # Prisma veritabanı istemcisi
│   └── ai/                 # Gemini AI istemcisi
├── 📂 prisma/               # Veritabanı şeması ve seed dosyaları
└── 📂 public/               # Statik dosyalar
```

---

## 🛠 Kullanılan Teknolojiler

| Kategori | Teknoloji | Açıklama |
|----------|-----------|----------|
| **Frontend** | Next.js 15 | App Router yapısı ile modern React framework'ü |
| **Dil** | TypeScript | Tip güvenli geliştirme |
| **Stil** | Tailwind CSS v4 | Hızlı ve esnek UI tasarımı |
| **Veritabanı** | SQLite | Hafif ve hızlı yerel veritabanı |
| **ORM** | Prisma | Veritabanı yönetimi ve tip güvenli sorgular |
| **Auth** | NextAuth.js | Güvenli kimlik doğrulama çözümü |
| **AI** | Google Gemini | Üretken yapay zeka entegrasyonu |

---

## 🚀 Kurulum Adımları

1. **Repoyu Klonlayın**
   ```bash
   git clone https://github.com/kullaniciadi/inventory-app.git
   cd inventory-app
   ```

2. **Bağımlılıkları Yükleyin**
   ```bash
   npm install
   ```

3. **Çevresel Değişkenleri (.env) Ayarlayın**
   `.env` dosyasını oluşturun ve aşağıdaki değerleri (kendi production ortamınıza göre) güncelleyin:

   ```bash
   # Veritabanı (Yerel SQLite)
   DATABASE_URL="file:./dev.db"

   # NextAuth Ayarları
   NEXTAUTH_SECRET="gizli-anahtariniz-buraya"
   NEXTAUTH_URL="http://localhost:3000"

   # Google Gemini AI API Anahtarı
   GEMINI_API_KEY="AIzaSy..."
   ```

4. **Veritabanını Oluşturun**
   ```bash
   npx prisma db push
   ```

5. **Uygulamayı Başlatın**
   ```bash
   npm run dev
   ```
   Uygulama `http://localhost:3000` adresinde çalışacaktır.

---

## 🧪 Geliştirme Komutları

- `npm run dev`: Geliştirme sunucusunu başlatır.
- `npm run build`: Production için build alır.
- `npm run start`: Build alınmış uygulamayı başlatır.
- `npx prisma studio`: Veritabanını görsel arayüzle yönetmenizi sağlar.

## 🤝 Katkıda Bulunma

1. Bu repoyu fork'layın.
2. Yeni bir feature branch oluşturun (`git checkout -b feature/yeni-ozellik`).
3. Değişikliklerinizi commit'leyin (`git commit -m 'Yeni özellik eklendi'`).
4. Branch'inizi push'layın (`git push origin feature/yeni-ozellik`).
5. Bir Pull Request oluşturun.

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır.
