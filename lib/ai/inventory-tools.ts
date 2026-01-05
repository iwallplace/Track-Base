import { prisma } from "@/lib/db";

// Tool Definitions for Gemini Function Calling
export const INVENTORY_TOOLS = {
    getLowStockItems: {
        name: "getLowStockItems",
        description: "Get a list of items with stock count below 20 (Critical Level).",
        parameters: { type: "object", properties: {}, required: [] },
    },
    getCompanyStock: {
        name: "getCompanyStock",
        description: "Get total stock and item details for a specific company.",
        parameters: {
            type: "object",
            properties: {
                companyName: {
                    type: "string",
                    description: "The name of the company (e.g., 'Siemens', 'Viko', 'Legrand')"
                }
            },
            required: ["companyName"]
        }
    },
    searchInventory: {
        name: "searchInventory",
        description: "Search for specific items by name or reference code.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Search term (e.g., 'otomat', 'kablo', 'REF-123')"
                }
            },
            required: ["query"]
        }
    },
    getDashboardSummary: {
        name: "getDashboardSummary",
        description: "Get general dashboard statistics: Total stock, critical items count, etc.",
        parameters: { type: "object", properties: {}, required: [] }
    }
};

// Actual Function Implementations
export const runInventoryTool = async (name: string, args: any) => {
    console.log(`🛠️ Running Tool: ${name}`, args);

    switch (name) {
        case "getLowStockItems":
            return await prisma.inventoryItem.findMany({
                where: { stockCount: { lt: 20, gt: 0 } },
                take: 10,
                select: { materialReference: true, stockCount: true, company: true }
            });

        case "getCompanyStock":
            const items = await prisma.inventoryItem.findMany({
                where: { company: { contains: args.companyName } },
                take: 5,
                orderBy: { stockCount: 'desc' }
            });
            const total = await prisma.inventoryItem.aggregate({
                where: { company: { contains: args.companyName } },
                _sum: { stockCount: true }
            });
            return {
                totalStock: total._sum.stockCount ?? 0,
                topItems: items
            };

        case "searchInventory":
            return await prisma.inventoryItem.findMany({
                where: {
                    OR: [
                        { materialReference: { contains: args.query } },
                        // company search is handled by getCompanyStock, but adding here as backup
                        { company: { contains: args.query } }
                    ]
                },
                take: 5
            });

        case "getDashboardSummary":
            const totalStock = await prisma.inventoryItem.aggregate({ _sum: { stockCount: true } });
            const lowStock = await prisma.inventoryItem.count({ where: { stockCount: { lt: 20, gt: 0 } } });
            return {
                totalStock: totalStock._sum.stockCount || 0,
                criticalItems: lowStock,
                status: "Normal"
            };

        default:
            return { error: "Tool not found" };
    }
};
