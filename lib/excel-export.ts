import ExcelJS from 'exceljs';

interface InventoryItem {
    id: string;
    year: number;
    month: number;
    week: number;
    date: string | Date;
    company: string;
    waybillNo: string;
    materialReference: string;
    stockCount: number;
    lastAction: string;
    note: string;
    createdAt?: string | Date;
}

export async function exportToExcel(data: InventoryItem[]) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TrackBase System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Envanter', {
        views: [{ state: 'frozen', ySplit: 1 }] // Freeze header
    });

    // Define Columns
    // Note: We'll set widths but not headers directly because we want custom styling
    worksheet.columns = [
        { header: 'Tarih', key: 'date', width: 15 },
        { header: 'Firma', key: 'company', width: 25 },
        { header: 'İrsaliye', key: 'waybill', width: 15 },
        { header: 'Referans', key: 'reference', width: 30 },
        { header: 'İşlem', key: 'action', width: 12 },
        { header: 'Stok Mik.', key: 'stock', width: 12 },
        { header: 'Not', key: 'note', width: 30 },
    ];

    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F2937' } // Dark gray background
    };
    headerRow.alignment = { horizontal: 'center' };

    // 1. Group Data by Material Reference
    const groups: { [key: string]: InventoryItem[] } = {};

    data.forEach(item => {
        if (!groups[item.materialReference]) {
            groups[item.materialReference] = [];
        }
        groups[item.materialReference].push(item);
    });

    // 2. Iterate Groups and Add Rows
    // Sort keys alphabetically
    const sortedRefs = Object.keys(groups).sort();

    for (const ref of sortedRefs) {
        const history = groups[ref];

        // Sort history by Date Descending
        history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Calculate Summary
        let totalEntry = 0;
        let totalExit = 0;
        history.forEach(h => {
            if (h.lastAction === 'Giriş') totalEntry += h.stockCount;
            if (h.lastAction === 'Çıkış') totalExit += h.stockCount;
        });
        const currentBalance = totalEntry - totalExit;

        // Latest Item (for metadata like Company, Note of last action)
        const latestItem = history[0];

        // --- ADD SUMMARY ROW (Level 0) ---
        const summaryRow = worksheet.addRow([
            // Use latest date for summary? Or today's date? Let's use latest action date.
            new Date(latestItem.date).toLocaleDateString("tr-TR"),
            latestItem.company, // Valid assumption: Latest company is most relevant
            '-', // Waybill irrelevant for summary
            ref, // Material Reference (Key info)
            latestItem.lastAction, // Latest Action Status
            currentBalance, // TOTAL Calculated Balance
            `Toplam ${history.length} Hareket` // Note replacement
        ]);

        // Style Summary Row
        summaryRow.font = { bold: true };
        summaryRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF3F4F6' } // Light gray
        };
        // Outline Level 0 (Default, visible)

        // --- ADD HISTORY ROWS (Level 1) ---
        history.forEach(item => {
            const row = worksheet.addRow([
                new Date(item.date).toLocaleDateString("tr-TR"),
                item.company,
                item.waybillNo,
                item.materialReference,
                item.lastAction,
                item.stockCount, // Individual movement amount
                item.note
            ]);

            // Style History Row
            row.outlineLevel = 1; // Group underneath previous row
            row.alignment = { indent: 1 }; // Visual indent

            // Color code actions
            const actionCell = row.getCell('action');
            if (item.lastAction === 'Giriş') {
                actionCell.font = { color: { argb: 'FF059669' } }; // Green
            } else {
                actionCell.font = { color: { argb: 'FFDC2626' } }; // Red
            }
        });
    }

    // Generate Buffer
    const buffer = await worksheet.workbook.xlsx.writeBuffer();

    // Trigger Browser Download
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Envanter_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}
