// © 2026 Lai Long Charts. Bảo lưu mọi quyền.
import { store } from './util.js';

const DICT = {
  en: {
    cot: 'COT', seasonal: 'SEASONAL', charts: 'CHARTS',
    metals: 'METALS', grains: 'GRAINS & OILSEEDS', softs: 'SOFTS', energy: 'ENERGY', fx: 'CURRENCIES', crypto: 'CRYPTO',
    overview: 'ALL MARKETS', legacy: 'LEGACY', disagg: 'DISAGGREGATED', tff: 'TFF (FINANCIAL)',
    net: 'NET', longshort: 'LONG / SHORT', cotindex: 'COT INDEX', range: 'RANGE', lookback: 'LOOKBACK',
    weeks: 'w', long: 'LONG', short: 'SHORT', netpos: 'NET', chg: 'Δ W/W', pctoi: '% OI', group: 'GROUP',
    openint: 'OPEN INTEREST', price: 'PRICE', reportdate: 'REPORT DATE', market: 'MARKET', specnet: 'SPEC NET',
    commnet: 'COMM NET', smallnet: 'SMALL NET', idx52: 'IDX 52W', idx156: 'IDX 3Y', oi: 'OI',
    cotnote: 'COT Index = position of current net within its range over the lookback (0 = lowest, 100 = highest). Extremes (>80 / <20) often mark crowded positioning.',
    single: 'SINGLE', compare: 'COMPARE', grid: 'OVERVIEW GRID', years: 'YEARS', averages: 'AVERAGES',
    mode: 'MODE', ytd: '% YTD', rawprice: 'PRICE', avg: 'AVG', product: 'PRODUCT', products: 'PRODUCTS',
    base: 'BASE', custom: 'CUSTOM', from: 'FROM', perf: 'PERFORMANCE', corr: 'CORRELATION (DAILY RETURNS)',
    monthly: 'MONTHLY RETURNS %', quarterly: 'QUARTERLY RETURNS %', year: 'YEAR', ytdnow: 'YTD @ TODAY',
    fullyear: 'FULL YEAR', max: 'MAX', min: 'MIN', thisyear: 'This year', lastyear: 'Last year', avg5: '5Y avg',
    seasnote: 'Each line = % change since the last close of the previous year, plotted on the same calendar.',
    layout: 'LAYOUT', candles: 'CANDLES', line: 'LINE', vp: 'VOL PROFILE', live: 'LIVE', delayed: 'DELAYED',
    eod: 'END OF DAY', novol: 'NO CENTRAL VOLUME (SPOT FX)', loading: 'Loading…', nodata: 'No data',
    settings: 'SETTINGS', upcolor: 'Up color', downcolor: 'Down color', linecolor: 'Line color',
    bgcolor: 'Chart background', reset: 'Reset', close: 'Close', theme: 'THEME', dark: 'DARK', light: 'LIGHT',
    updated: 'Data updated', source: 'Sources: CFTC, Yahoo Finance (delayed), Binance (live)',
    closesin: 'Bar closes in', last: 'LAST', chgd: 'CHG', select: 'Select', none: 'none',
    nocot: 'No COT report for this market', clear: 'CLEAR', all: 'ALL',
  },
  vi: {
    cot: 'COT', seasonal: 'MÙA VỤ', charts: 'BIỂU ĐỒ',
    metals: 'KIM LOẠI', grains: 'NGŨ CỐC & HẠT DẦU', softs: 'NÔNG SẢN MỀM', energy: 'NĂNG LƯỢNG', fx: 'TIỀN TỆ', crypto: 'CRYPTO',
    overview: 'TẤT CẢ THỊ TRƯỜNG', legacy: 'LEGACY', disagg: 'DISAGGREGATED', tff: 'TFF (TÀI CHÍNH)',
    net: 'RÒNG', longshort: 'MUA / BÁN', cotindex: 'CHỈ SỐ COT', range: 'KHOẢNG', lookback: 'CHU KỲ',
    weeks: 'tuần', long: 'MUA', short: 'BÁN', netpos: 'RÒNG', chg: 'Δ TUẦN', pctoi: '% OI', group: 'NHÓM',
    openint: 'HỢP ĐỒNG MỞ (OI)', price: 'GIÁ', reportdate: 'NGÀY BÁO CÁO', market: 'THỊ TRƯỜNG', specnet: 'ĐẦU CƠ RÒNG',
    commnet: 'THƯƠNG MẠI RÒNG', smallnet: 'NHỎ LẺ RÒNG', idx52: 'CS 52T', idx156: 'CS 3N', oi: 'OI',
    cotnote: 'Chỉ số COT = vị trí của vị thế ròng hiện tại trong biên độ của chu kỳ (0 = thấp nhất, 100 = cao nhất). Vùng cực đoan (>80 / <20) thường báo hiệu vị thế quá đông.',
    single: 'MỘT SẢN PHẨM', compare: 'SO SÁNH', grid: 'TỔNG QUAN', years: 'NĂM', averages: 'TRUNG BÌNH',
    mode: 'CHẾ ĐỘ', ytd: '% TỪ ĐẦU NĂM', rawprice: 'GIÁ', avg: 'TB', product: 'SẢN PHẨM', products: 'SẢN PHẨM',
    base: 'MỐC', custom: 'TÙY CHỌN', from: 'TỪ', perf: 'HIỆU SUẤT', corr: 'TƯƠNG QUAN (LỢI NHUẬN NGÀY)',
    monthly: 'LỢI NHUẬN THEO THÁNG %', quarterly: 'LỢI NHUẬN THEO QUÝ %', year: 'NĂM', ytdnow: 'TỪ ĐẦU NĂM @ HÔM NAY',
    fullyear: 'CẢ NĂM', max: 'CAO NHẤT', min: 'THẤP NHẤT', thisyear: 'Năm nay', lastyear: 'Năm trước', avg5: 'TB 5 năm',
    seasnote: 'Mỗi đường = % thay đổi so với giá đóng cửa cuối năm trước, vẽ trên cùng một lịch.',
    layout: 'BỐ CỤC', candles: 'NẾN', line: 'ĐƯỜNG', vp: 'VOL PROFILE', live: 'REALTIME', delayed: 'TRỄ',
    eod: 'CUỐI NGÀY', novol: 'FOREX GIAO NGAY KHÔNG CÓ VOLUME TẬP TRUNG', loading: 'Đang tải…', nodata: 'Không có dữ liệu',
    settings: 'CÀI ĐẶT', upcolor: 'Màu tăng', downcolor: 'Màu giảm', linecolor: 'Màu đường',
    bgcolor: 'Nền biểu đồ', reset: 'Mặc định', close: 'Đóng', theme: 'GIAO DIỆN', dark: 'TỐI', light: 'SÁNG',
    updated: 'Cập nhật dữ liệu', source: 'Nguồn: CFTC, Yahoo Finance (trễ), Binance (realtime)',
    closesin: 'Nến đóng sau', last: 'GIÁ', chgd: 'THAY ĐỔI', select: 'Chọn', none: 'không',
    nocot: 'Thị trường này không có báo cáo COT', clear: 'BỎ CHỌN', all: 'TẤT CẢ',
  },
};

export const MONTHS = {
  en: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
  vi: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'],
};

export const lang = () => store.get('lang', 'en');
export const t = key => DICT[lang()][key] ?? DICT.en[key] ?? key;
export const name = sym => sym[lang()] || sym.en;
export const months = () => MONTHS[lang()];
