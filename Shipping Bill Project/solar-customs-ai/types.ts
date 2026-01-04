export interface ShippingBillHeader {
  "SB NO.": string;
  "S/B Date": string;
  "LEO Date": string;
  "PORT CODE": string;
  "CUSTOMER NAME": string;
  "COUNTRY": string;
}

export interface Item {
  "H.S. Itch code": string;
  "PRODUCT GROUP": string;
  "Qty": string;
  "Unit": string;
  "FOB Value as per SB in INR": string;
  "DRAWBACK Receivable on fob": string;
  "RoDTEP RECEIVABLE": string;
  "SCHEME (ADV/DFIA/DRAWBACK)": string;
}

export interface Invoice {
  "FINAL INVOICE NO": string;
  "Total Invoice Value in FC as per SB": string;
  "INCOTERMS": string;
  "Currency of export": string;
  "Custom Exchange Rate in FC": string;
  "FREIGHT_TOTAL": string;
  "INSURANCE_TOTAL": string;
  "items": Item[];
}

export interface ExtractedData {
  "shipping_bill_header": ShippingBillHeader;
  "invoices": Invoice[];
}

export interface GridRow {
  id: string;
  
  // 1. Identification
  sbNo: string;
  sbDate: string;
  leoDate: string;
  customerName: string;
  finalInvoiceNo: string;
  productCategory: string; // Renamed from sbSolarOther
  portCode: string;
  incoterms: string;
  country: string;
  
  // 2. Product
  hsCode: string;
  productGroup: string;
  qty: string;
  unit: string;
  
  // 3. Values & Rates
  fobValueFC: string;
  currency: string;
  exchangeRate: string;
  leoExchangeRate: string;
  fobValueINR: string;
  fobValueLeoINR: string;
  
  // 4. Freight & Insurance
  freight: string;
  insurance: string;
  actualFreightInsuranceFC: string;
  
  // 5. Invoice Totals
  invoiceValueFC: string;
  paymentReceipt: string;
  paymentOutstanding: string;
  totalInvoiceValueINR: string;
  
  // 6. Schemes & Benefits
  scheme: string;
  dbkPercent: string;
  drawback: string;
  scrollDate: string;
  balDbk: string;
  
  // 7. RoDTEP
  rodtepPercent: string;
  rodtep: string;
  rodtepYN: string;
  balRodtep: string;
}