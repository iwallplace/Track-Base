export type Language = 'tr' | 'en';

export const translations = {
    tr: {
        // Navigation
        dashboard: 'Kontrol Paneli',
        inventory: 'Malzeme Stok Takibi',
        users: 'Kullanıcılar',
        settings: 'Ayarlar',

        // Roles
        role_admin: 'Project Owner',
        role_user: 'İnci Personeli',
        role_ime: 'IME',
        role_quality: 'Kalite',
        role_unknown: 'Kullanıcı',

        // Common
        add: 'Ekle',
        edit: 'Düzenle',
        delete: 'Sil',
        save: 'Kaydet',
        cancel: 'İptal',
        search: 'Ara...',
        loading: 'Yükleniyor...',
        confirm_delete: 'Silmek istediğinize emin misiniz?',
        success: 'İşlem başarılı',
        error: 'Hata oluştu',

        // Inventory Page
        inventory_title: 'Malzeme Stok Takibi',
        inventory_desc: 'Envanter giriş çıkışlarını ve güncel stok durumunu buradan takip edebilirsiniz.',
        add_entry: 'Giriş Ekle',
        add_exit: 'Çıkış Ekle',
        date_range: 'Tarih Aralığı',
        this_week: 'Bu Hafta',
        all_times: 'Tüm Zamanlar',
        filter_status: 'İşlem Durumu',
        status_all: 'Tümü',
        status_entry: 'Giriş',
        status_exit: 'Çıkış',

        export: 'Dışa Aktar',
        month: 'Ay',
        week: 'Hafta',
        total_records: 'Toplam kayıt',
        page_size: 'Sayfa başına',
        showing_range: 'arası gösteriliyor',
        page: 'Sayfa',
        no_records: 'Kayıt bulunamadı. "Yeni Giriş/Çıkış" butonu ile ekleme yapabilirsiniz.',

        // Inventory Table
        col_year_month: 'YIL / AY',
        col_week: 'HAFTA',
        col_date: 'TARİH',
        col_company: 'FİRMA',
        col_waybill: 'İRSALİYE NO',
        col_reference: 'MALZEME REF',
        col_last_action: 'SON İŞLEM',
        col_stock: 'STOK ADET',
        col_note: 'NOT',
        col_modifier: 'İşlemi Yapan',

        // Material History
        material_history: 'Malzeme Geçmişi',
        movement_records: 'Hareket Kayıtları',
        pcs: 'Adet',
        deleted: 'Kayıt silindi.',
        delete_failed: 'Silme başarısız',
        back: 'Geri',

        // Validation
        required_fields: 'Lütfen zorunlu alanları doldurunuz',
        stock_error: 'Yetersiz Stok!',
        current_stock: 'Mevcut stok',
        requested: 'İstenen',

        confirm_delete_message: 'Bu kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
        search_placeholder: 'Ara...',
        records: 'kayıt',
        no_results: 'Sonuç bulunamadı.',
    },
    en: {
        // Navigation
        dashboard: 'Dashboard',
        inventory: 'Stock Tracking',
        users: 'Users',
        settings: 'Settings',

        // Roles
        role_admin: 'Project Owner',
        role_user: 'Staff',
        role_ime: 'IME',
        role_quality: 'Quality',
        role_unknown: 'User',

        // Common
        add: 'Add',
        edit: 'Edit',
        delete: 'Delete',
        save: 'Save',
        cancel: 'Cancel',
        search: 'Search...',
        loading: 'Loading...',
        confirm_delete: 'Are you sure you want to delete?',
        confirm_delete_message: 'Are you sure you want to delete this record? This action cannot be undone.',
        success: 'Operation successful',
        error: 'An error occurred',
        search_placeholder: 'Search...',
        records: 'records',
        no_results: 'No results found.',

        // Inventory Page
        inventory_title: 'Stock Tracking',
        inventory_desc: 'Track inventory movements and current stock status.',
        add_entry: 'Add Entry',
        add_exit: 'Add Exit',
        date_range: 'Date Range',
        this_week: 'This Week',
        all_times: 'All Time',
        filter_status: 'Status',
        status_all: 'All',
        status_entry: 'Entry',
        status_exit: 'Exit',

        export: 'Export',
        month: 'Month',
        week: 'Week',
        total_records: 'Total records',
        page_size: 'Items per page',
        showing_range: 'showing',
        page: 'Page',
        no_records: 'No records found. You can add new items using "Add Entry/Exit" buttons.',

        // Inventory Table
        col_year_month: 'YEAR / MONTH',
        col_week: 'WEEK',
        col_date: 'DATE',
        col_company: 'COMPANY',
        col_waybill: 'WAYBILL NO',
        col_reference: 'MATERIAL REF',
        col_last_action: 'LAST ACTION',
        col_stock: 'STOCK QTY',
        col_note: 'NOTE',
        col_modifier: 'Modified By',

        col_last_update: 'Last Update',
        col_total_stock: 'Total Stock',

        // Material History
        material_history: 'Material History',
        movement_records: 'Movement Records',
        pcs: 'Pcs',
        deleted: 'Record deleted.',
        delete_failed: 'Delete failed',
        back: 'Back',

        // Validation
        required_fields: 'Please fill in required fields',
        stock_error: 'Insufficient Stock!',
        current_stock: 'Current stock',
        requested: 'Requested',
    }
};

export type TranslationKey = keyof typeof translations.tr;
