/// <reference types="vite/client" />

interface ElectronItemInput {
	name: string;
	current_stock_amount: number;
	unit_price?: number;
	cost_price?: number;
	selling_price?: number;
	entry_date?: string;
}

interface ElectronItemUpdate extends Partial<ElectronItemInput> {
	id: number;
}

interface ElectronExpenseInput {
	category: string;
	amount: number;
	staff_name: string;
	staff_pic_url?: string | null;
	description?: string | null;
	date?: string;
}

interface ElectronSaleInput {
	buyer_name: string;
	item_name: string;
	item_id?: number | null;
	quantity: number;
	unit_price?: number;
	total_amount: number;
	date?: string;
}

interface ElectronUserInput {
	username: string;
	role: string;
	details?: string | Record<string, string> | null;
}

interface ElectronUserUpdate extends Partial<ElectronUserInput> {
	id: number;
}

interface ElectronDashboardSummary {
	totalRevenue: number;
	totalExpenses: number;
	profitOrLoss: number;
}

interface Window {
	electronAPI: {
		addItem: (item: ElectronItemInput) => Promise<{ id: number; entry_date: string }>;
		getItems: () => Promise<
			Array<{
				id: number;
				name: string;
				current_stock_amount: number;
				unit_price: number;
				entry_date: string;
			}>
		>;
		getItem: (id: number) => Promise<
			| {
					id: number;
					name: string;
					current_stock_amount: number;
					unit_price: number;
					entry_date: string;
				}
			| undefined
		>;
		updateItem: (item: ElectronItemUpdate) => Promise<
			| {
					id: number;
					name: string;
					current_stock_amount: number;
					unit_price: number;
					entry_date: string;
				}
			| null
		>;
		deleteItem: (id: number) => Promise<{ deleted: boolean }>;
		addExpense: (expense: ElectronExpenseInput) => Promise<{ id: number; date: string }>;
		getExpenses: () => Promise<
			Array<{
				id: number;
				category: string;
				amount: number;
				staff_name: string;
				staff_pic_url: string | null;
				description: string | null;
				date: string;
			}>
		>;
		recordSale: (sale: ElectronSaleInput) => Promise<{ id: number; date: string }>;
		getSales: () => Promise<
			Array<{
				id: number;
				buyer_name: string;
				item_name: string;
				quantity: number;
				total_amount: number;
				date: string;
			}>
		>;
		getReportData: (filters: {
			type: "Sales" | "Expenses" | "Inventory" | "All Items";
			range: "daily" | "weekly" | "monthly" | "custom";
			startDate?: string | null;
			endDate?: string | null;
		}) => Promise<
			Array<{
				date: string;
				item_name: string;
				category: string;
				amount: number;
			}>
		>;
		addUser: (user: ElectronUserInput) => Promise<{ id: number }>;
		getUsers: () => Promise<
			Array<{
				id: number;
				username: string;
				role: string;
				details: string | null;
			}>
		>;
		updateUser: (user: ElectronUserUpdate) => Promise<
			| {
					id: number;
					username: string;
					role: string;
					details: string | null;
				}
			| null
		>;
		deleteUser: (id: number) => Promise<{ deleted: boolean }>;
		getDashboardSummary: () => Promise<ElectronDashboardSummary>;
	};
	saloonAPI: {
		fetchAllItems: () => Promise<
			Array<{
				id: number;
				name: string;
				price: number;
				category: string | null;
			}>
		>;
		updateItem: (data: {
			id: number;
			name?: string;
			price?: number;
			category?: string | null;
		}) => Promise<
			| {
				id: number;
				name: string;
				price: number;
				category: string | null;
			}
			| null
		>;
	};
}
