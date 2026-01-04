import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { DataGrid } from './components/DataGrid';
import { processShippingBill } from './services/geminiService';
import { ExtractedData, GridRow } from './types';
import { Sun, Zap, FileText, Database } from 'lucide-react';

export interface FileStatus {
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
}

const STORAGE_KEY = 'solar_customs_extract_red_v1';

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState<FileStatus[]>([]);
  const [gridData, setGridData] = useState<GridRow[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gridData));
  }, [gridData]);

  const parseFloatSafe = (value: string | undefined): number => {
    if (!value) return 0;
    const cleanValue = value.toString().replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleanValue);
    return isNaN(num) ? 0 : num;
  };

  const flattenData = (data: ExtractedData): GridRow[] => {
    const rows: GridRow[] = [];
    const header = data.shipping_bill_header;
    data.invoices.forEach((inv) => {
      const exRate = parseFloatSafe(inv["Custom Exchange Rate in FC"]);
      const totalFreightFC = parseFloatSafe(inv["FREIGHT_TOTAL"]);
      const totalInsuranceFC = parseFloatSafe(inv["INSURANCE_TOTAL"]);
      const itemCount = inv.items.length || 1;

      inv.items.forEach((item, itemIndex) => {
        const fobINR = parseFloatSafe(item["FOB Value as per SB in INR"]);
        const rodtepVal = parseFloatSafe(item["RoDTEP RECEIVABLE"]);
        const drawbackVal = parseFloatSafe(item["DRAWBACK Receivable on fob"]);
        const fobFCNum = exRate > 0 ? (fobINR / exRate) : 0;
        const itemFreightFC = totalFreightFC / itemCount;
        const itemInsuranceFC = totalInsuranceFC / itemCount;
        const itemInvoiceValueFCNum = fobFCNum + itemFreightFC + itemInsuranceFC;

        rows.push({
          id: `${inv["FINAL INVOICE NO"]}-${itemIndex}-${Math.random().toString(36).substr(2, 9)}`,
          sbNo: header["SB NO."] || "",
          sbDate: header["S/B Date"] || "",
          leoDate: header["LEO Date"] || "",
          customerName: header["CUSTOMER NAME"] || "",
          finalInvoiceNo: inv["FINAL INVOICE NO"] || "",
          productCategory: item["PRODUCT GROUP"] || "GENERAL", 
          portCode: header["PORT CODE"] || "",
          incoterms: inv["INCOTERMS"] || "",
          country: header["COUNTRY"] || "",
          hsCode: item["H.S. Itch code"] || "",
          productGroup: item["PRODUCT GROUP"] || "UNSPECIFIED", 
          qty: item.Qty || "",
          unit: item.Unit || "",
          fobValueFC: fobFCNum.toFixed(2),
          currency: inv["Currency of export"] || "",
          exchangeRate: inv["Custom Exchange Rate in FC"] || "",
          leoExchangeRate: inv["Custom Exchange Rate in FC"] || "",
          fobValueINR: item["FOB Value as per SB in INR"] || "",
          fobValueLeoINR: item["FOB Value as per SB in INR"] || "",
          freight: itemFreightFC.toFixed(2),
          insurance: itemInsuranceFC.toFixed(2),
          actualFreightInsuranceFC: (itemFreightFC + itemInsuranceFC).toFixed(2),
          invoiceValueFC: itemInvoiceValueFCNum.toFixed(2),
          paymentReceipt: "0.00",
          paymentOutstanding: itemInvoiceValueFCNum.toFixed(2),
          totalInvoiceValueINR: (itemInvoiceValueFCNum * exRate).toFixed(2),
          scheme: item["SCHEME (ADV/DFIA/DRAWBACK)"] || "DRAWBACK",
          dbkPercent: fobINR > 0 ? ((drawbackVal / fobINR) * 100).toFixed(2) + "%" : "",
          drawback: item["DRAWBACK Receivable on fob"] || "",
          scrollDate: "",
          balDbk: item["DRAWBACK Receivable on fob"] || "",
          rodtepPercent: fobINR > 0 ? ((rodtepVal / fobINR) * 100).toFixed(2) + "%" : "",
          rodtep: item["RoDTEP RECEIVABLE"] || "",
          rodtepYN: rodtepVal > 0 ? "Y" : "N",
          balRodtep: item["RoDTEP RECEIVABLE"] || "",
        });
      });
    });
    return rows;
  };

  const handleRowChange = (id: string, field: keyof GridRow, value: string) => {
    setGridData(prev => prev.map(row => {
      if (row.id === id) {
        const updatedRow = { ...row, [field]: value };
        if (field === 'paymentReceipt' || field === 'invoiceValueFC') {
          const invVal = parseFloat(updatedRow.invoiceValueFC.replace(/[^0-9.-]/g, '')) || 0;
          const paid = parseFloat(updatedRow.paymentReceipt.replace(/[^0-9.-]/g, '')) || 0;
          updatedRow.paymentOutstanding = Math.max(0, invVal - paid).toFixed(2);
        }
        return updatedRow;
      }
      return row;
    }));
  };

  const handleDeleteRow = (id: string) => {
    if (window.confirm("Delete record from matrix permanently?")) setGridData(prev => prev.filter(row => row.id !== id));
  };

  const handleFileSelect = async (files: File[]) => {
    setLoading(true);
    setUploadStatuses(files.map(f => ({ name: f.name, status: 'pending' })));
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadStatuses(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'processing' } : s));
        try {
            const extractedJson = await processShippingBill(file);
            const rows = flattenData(extractedJson);
            setGridData(prev => [...prev, ...rows]);
            setUploadStatuses(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'completed' } : s));
        } catch (err: any) {
            setUploadStatuses(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'error', message: err.message || "Extraction Failed" } : s));
        }
    }
    setLoading(false);
  };

  const handleReset = () => {
    if(window.confirm("Purge all data from Solar Grid?")) {
        setGridData([]);
        setUploadStatuses([]);
        localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <div className="min-h-screen bg-brand-light flex flex-col font-sans">
      <Header />
      <main className="flex-1 relative w-full z-10 py-16 px-4 max-w-7xl mx-auto">
          {gridData.length === 0 && (
              <div className="text-center mb-16 animate-propel">
                  <div className="inline-flex items-center gap-2 py-2 px-6 bg-brand-secondary text-white text-[10px] font-black uppercase mb-8 rounded-full shadow-2xl shadow-blue-200">
                      <Zap className="w-4 h-4 text-brand-primary fill-brand-primary" />
                      Solar Matrix Intelligence 2.5
                  </div>
                  <h2 className="text-6xl md:text-8xl font-black tracking-tighter text-brand-secondary mb-8 leading-[0.9]">
                      SHIPPING BILL <br className="hidden md:block" />
                      <span className="text-brand-primary">MATRIX</span>
                  </h2>
                  <p className="text-xl text-brand-secondary leading-relaxed max-w-2xl mx-auto font-bold opacity-70">
                      Red-Navy high-frequency extraction for Indian Customs documents. Powered by Gemini vision.
                  </p>
                  <div className="flex justify-center gap-10 mt-16 opacity-30">
                      <Sun className="w-10 h-10 text-brand-primary animate-spin-slow" />
                      <Database className="w-10 h-10 text-brand-secondary" />
                      <FileText className="w-10 h-10 text-brand-primary" />
                  </div>
              </div>
          )}
          
          <FileUpload onFileSelect={handleFileSelect} isLoading={loading} fileStatuses={uploadStatuses} />

          {gridData.length > 0 && (
              <div className="mt-16">
                <DataGrid rows={gridData} onReset={handleReset} onRowChange={handleRowChange} onDeleteRow={handleDeleteRow} />
              </div>
          )}
      </main>
      
      <footer className="bg-brand-secondary text-white py-16 mt-auto border-t-[10px] border-brand-primary">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-4">
                <div className="bg-brand-primary p-2 rounded-2xl shadow-lg"><Sun className="w-8 h-8 text-white" /></div>
                <div className="flex flex-col">
                  <span className="text-2xl font-black tracking-tighter">SOLAR <span className="text-brand-primary">CUSTOMS</span></span>
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em]">Matrix Data Node</span>
                </div>
            </div>
            <div className="text-[10px] text-white/40 font-black uppercase tracking-[0.3em] text-center md:text-right">
                &copy; {new Date().getFullYear()} Solar Matrix Tech Group. <br/> Integrated Customs Extraction Protocol.
            </div>
        </div>
      </footer>
    </div>
  );
};

export default App;