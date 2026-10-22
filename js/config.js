// © 2026 Lai Long Charts. Bảo lưu mọi quyền.
// Product catalogue. `cot` = file in data/cot/*, `price` = file in data/prices,
// `cotPrice` = price series drawn on the COT chart (same direction as the futures contract),
// `live` = shown live in the ticker tape (exchange markets are in exchanges.js).
export const GROUPS = ['metals', 'grains', 'softs', 'energy', 'fx', 'crypto'];

export const SYMBOLS = [
  { id: 'GOLD', code: 'GC', en: 'Gold', vi: 'Vàng', group: 'metals', cot: 'GOLD', price: 'GOLD' },
  { id: 'SILVER', code: 'SI', en: 'Silver', vi: 'Bạc', group: 'metals', cot: 'SILVER', price: 'SILVER' },
  { id: 'PLATINUM', code: 'PL', en: 'Platinum', vi: 'Bạch kim', group: 'metals', cot: 'PLATINUM', price: 'PLATINUM' },
  { id: 'PALLADIUM', code: 'PA', en: 'Palladium', vi: 'Paladi', group: 'metals', cot: 'PALLADIUM', price: 'PALLADIUM' },
  { id: 'COPPER', code: 'HG', en: 'Copper', vi: 'Đồng', group: 'metals', cot: 'COPPER', price: 'COPPER' },
  { id: 'ALUMINUM', code: 'ALI', en: 'Aluminum', vi: 'Nhôm', group: 'metals', cot: 'ALUMINUM', price: 'ALUMINUM' },
  { id: 'STEEL_HRC', code: 'HRC', en: 'Steel HRC', vi: 'Thép HRC', group: 'metals', cot: 'STEEL_HRC', price: 'STEEL_HRC' },
  { id: 'WHEAT', code: 'ZW', en: 'Wheat', vi: 'Lúa mì', group: 'grains', cot: 'WHEAT', price: 'WHEAT' },
  { id: 'CORN', code: 'ZC', en: 'Corn', vi: 'Ngô', group: 'grains', cot: 'CORN', price: 'CORN' },
  { id: 'SOYBEANS', code: 'ZS', en: 'Soybeans', vi: 'Đậu tương', group: 'grains', cot: 'SOYBEANS', price: 'SOYBEANS' },
  { id: 'SOY_OIL', code: 'ZL', en: 'Soybean Oil', vi: 'Dầu đậu tương', group: 'grains', cot: 'SOY_OIL', price: 'SOY_OIL' },
  { id: 'SOY_MEAL', code: 'ZM', en: 'Soybean Meal', vi: 'Khô đậu tương', group: 'grains', cot: 'SOY_MEAL', price: 'SOY_MEAL' },
  { id: 'COFFEE_ARABICA', code: 'KC', en: 'Coffee Arabica', vi: 'Cà phê Arabica', group: 'softs', cot: 'COFFEE_ARABICA', price: 'COFFEE_ARABICA' },
  { id: 'WTI', code: 'CL', en: 'WTI Crude', vi: 'Dầu WTI', group: 'energy', cot: 'WTI', price: 'WTI' },
  { id: 'BRENT', code: 'BZ', en: 'Brent Crude', vi: 'Dầu Brent', group: 'energy', cot: 'BRENT', price: 'BRENT' },
  { id: 'NATGAS', code: 'NG', en: 'Natural Gas', vi: 'Khí tự nhiên', group: 'energy', cot: 'NATGAS', price: 'NATGAS' },
  { id: 'RBOB', code: 'RB', en: 'RBOB Gasoline', vi: 'Xăng RBOB', group: 'energy', cot: 'RBOB', price: 'RBOB' },
  { id: 'HEATING_OIL', code: 'HO', en: 'Heating Oil (ULSD)', vi: 'Dầu sưởi (ULSD)', group: 'energy', cot: 'HEATING_OIL', price: 'HEATING_OIL' },
  { id: 'DXY', code: 'DXY', en: 'US Dollar Index', vi: 'Chỉ số USD', group: 'fx', cot: 'USD_INDEX', price: 'DXY' },
  { id: 'EUR', code: 'EURUSD', en: 'Euro', vi: 'Euro', group: 'fx', cot: 'EUR', price: 'EURUSD', cotPrice: 'EUR_FUT' },
  { id: 'JPY', code: 'USDJPY', en: 'Japanese Yen', vi: 'Yên Nhật', group: 'fx', cot: 'JPY', price: 'USDJPY', cotPrice: 'JPY_FUT' },
  { id: 'GBP', code: 'GBPUSD', en: 'British Pound', vi: 'Bảng Anh', group: 'fx', cot: 'GBP', price: 'GBPUSD', cotPrice: 'GBP_FUT' },
  { id: 'CAD', code: 'USDCAD', en: 'Canadian Dollar', vi: 'Đô la Canada', group: 'fx', cot: 'CAD', price: 'USDCAD', cotPrice: 'CAD_FUT' },
  { id: 'AUD', code: 'AUDUSD', en: 'Australian Dollar', vi: 'Đô la Úc', group: 'fx', cot: 'AUD', price: 'AUDUSD', cotPrice: 'AUD_FUT' },
  { id: 'CHF', code: 'USDCHF', en: 'Swiss Franc', vi: 'Franc Thụy Sĩ', group: 'fx', cot: 'CHF', price: 'USDCHF', cotPrice: 'CHF_FUT' },
  { id: 'CNY', code: 'USDCNY', en: 'Chinese Yuan', vi: 'Nhân dân tệ', group: 'fx', cot: null, price: 'USDCNY' },
  { id: 'BTC', code: 'BTCUSD', en: 'Bitcoin', vi: 'Bitcoin', group: 'crypto', cot: 'BTC', price: 'BTC', live: true },
  { id: 'ETH', code: 'ETHUSD', en: 'Ether', vi: 'Ether', group: 'crypto', cot: 'ETH', price: 'ETH', live: true },
];

export const BY_ID = Object.fromEntries(SYMBOLS.map(s => [s.id, s]));

// COT trader groups per report. `spec` marks the main speculator group.
export const COT_GROUPS = {
  legacy: [
    { k: 'nc', en: 'Non-Commercial (Speculators)', vi: 'Đầu cơ (Non-Commercial)', short: 'SPEC', color: '#ffa028', spec: true },
    { k: 'c', en: 'Commercial (Hedgers)', vi: 'Thương mại (Phòng hộ)', short: 'COMM', color: '#4aa8ff' },
    { k: 'nr', en: 'Non-Reportable (Small)', vi: 'Nhỏ lẻ (Non-Reportable)', short: 'SMALL', color: '#c678dd' },
  ],
  disagg: [
    { k: 'mm', en: 'Managed Money', vi: 'Quỹ đầu cơ (Managed Money)', short: 'MM', color: '#ffa028', spec: true },
    { k: 'pm', en: 'Producer / Merchant', vi: 'Nhà SX / Thương mại', short: 'PROD', color: '#4aa8ff' },
    { k: 'sw', en: 'Swap Dealers', vi: 'Swap Dealers', short: 'SWAP', color: '#2ec4b6' },
    { k: 'or', en: 'Other Reportables', vi: 'Tổ chức khác', short: 'OTHER', color: '#e5c07b' },
    { k: 'nr', en: 'Non-Reportable (Small)', vi: 'Nhỏ lẻ (Non-Reportable)', short: 'SMALL', color: '#c678dd' },
  ],
  tff: [
    { k: 'lm', en: 'Leveraged Funds', vi: 'Quỹ đòn bẩy (Lev. Funds)', short: 'LEV', color: '#ffa028', spec: true },
    { k: 'am', en: 'Asset Managers', vi: 'Quản lý tài sản', short: 'ASSET', color: '#4aa8ff' },
    { k: 'd', en: 'Dealers', vi: 'Dealer (Ngân hàng)', short: 'DEALER', color: '#2ec4b6' },
    { k: 'or', en: 'Other Reportables', vi: 'Tổ chức khác', short: 'OTHER', color: '#e5c07b' },
    { k: 'nr', en: 'Non-Reportable (Small)', vi: 'Nhỏ lẻ (Non-Reportable)', short: 'SMALL', color: '#c678dd' },
  ],
};

export const SERIES_COLORS = ['#ffa028', '#4aa8ff', '#2ec4b6', '#ff5c8a', '#c678dd', '#e5c07b',
  '#98c379', '#56b6c2', '#f78c6c', '#82aaff', '#ff6e6e', '#c3e88d', '#ffcb6b', '#89ddff'];
