export type Language = 'tr' | 'en';

export const translations = {
    tr: {
        // Navigation
        dashboard: 'Kontrol Paneli',
        inventory: 'Malzeme Stok Takibi',
        users: 'Kullanıcılar',
        settings: 'Ayarlar',

        // User Management
        user_management_title: 'Kullanıcı Yönetimi',
        user_management_desc: 'Sisteme erişimi olan kullanıcıları görüntüleyin ve yönetin.',
        add_user: 'Yeni Kullanıcı Ekle',
        role_permissions: 'Rol Yetkileri',
        role_permissions_desc: 'Her rolün sistem içindeki yetkilerini düzenleyin',
        permissions_loading: 'Yetkiler yükleniyor...',
        error_permissions: 'Yetkiler yüklenirken hata oluştu',
        user_added: 'Kullanıcı başarıyla eklendi',
        error_user_add: 'Kullanıcı eklenirken hata oluştu',
        user_deleted: 'Kullanıcı silindi',
        error_delete: 'Silme işlemi başarısız',
        error_generic: 'İşlem sırasında hata',
        permission_updated: 'Yetki güncellendi',
        error_update: 'Güncelleme başarısız',
        conn_error: 'Bağlantı hatası',
        permission_col: 'Yetki',
        permission_note: 'Değişiklikler anında uygulanır. Project Owner yetkileri değiştirilemez.',
        cannot_remove_admin: 'Project Owner yetkileri değiştirilemez',

        // Forms
        name_surname: 'Ad Soyad',
        username_email: 'E-posta / Kullanıcı Adı',
        password: 'Şifre',
        role: 'Rol',
        role_select_user: 'İnci Personeli',
        role_select_ime: 'IME',
        role_select_quality: 'Kalite',
        role_select_admin: 'Project Owner',

        // Table
        table_user: 'Kullanıcı',
        table_role: 'Rol',
        table_date: 'Kayıt Tarihi',
        table_action: 'İşlem',

        // Edit Modal
        edit_user_title: 'Kullanıcı Düzenle',
        new_password: 'Yeni Şifre',
        password_hint: '(Değiştirmek istemiyorsanız boş bırakın)',
        user_updated: 'Kullanıcı güncellendi',

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

        // User Management
        user_management_title: 'User Management',
        user_management_desc: 'View and manage users with system access.',
        add_user: 'Add New User',
        role_permissions: 'Role Permissions',
        role_permissions_desc: 'Manage system permissions for each role',
        permissions_loading: 'Loading permissions...',
        error_permissions: 'Error loading permissions',
        user_added: 'User successfully added',
        error_user_add: 'Error adding user',
        user_deleted: 'User deleted',
        error_delete: 'Delete failed',
        error_generic: 'Error during operation',
        permission_updated: 'Permission updated',
        error_update: 'Update failed',
        conn_error: 'Connection error',
        permission_col: 'Permission',
        permission_note: 'Changes apply immediately. Project Owner permissions cannot be changed.',
        cannot_remove_admin: 'Project Owner permissions cannot be changed',

        // Forms
        name_surname: 'Name Surname',
        username_email: 'Email / Username',
        password: 'Password',
        role: 'Role',
        role_select_user: 'Staff',
        role_select_ime: 'IME',
        role_select_quality: 'Quality',
        role_select_admin: 'Project Owner',

        // Table
        table_user: 'User',
        table_role: 'Role',
        table_date: 'Registration Date',
        table_action: 'Actions',

        // Edit Modal
        edit_user_title: 'Edit User',
        new_password: 'New Password',
        password_hint: '(Leave blank to keep current)',
        user_updated: 'User updated',

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
