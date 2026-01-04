import React, { useState, useMemo } from 'react';
import { GridRow } from '../types';
import { Download, RefreshCw, Database, Trash2, Filter, IndianRupee, FileCheck, Search, Sun, Zap } from 'lucide-react';
import { utils, writeFile } from 'xlsx';

interface DataGridProps {
  rows: GridRow[];
  onReset: () => void;
  onRowChange: (id: string, field: keyof GridRow, value: string) => void;
  onDeleteRow: (id: string) => void;
}

export const DataGrid: React.FC<DataGridProps> = ({ rows, onReset, onRowChange, onDeleteRow }) => {
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const headers = [
    "Actions", "Sr. No.", "SB NO.", "S/B Date", "LEO Date", "Customer Name", "Final Invoice No.", 
    "Product Category", "Port Code", "Incoterms", "Country", "HS Code", "Description", 
    "Qty", "Unit", "FOB (FC)", "Currency", "Ex Rate", "LEO Rate", "FOB (INR)", "FOB LEO (INR)",
    "Frt+Ins (FC)", "Freight", "Insurance", "Total (FC)", "Paid", "Outstanding", "Total (INR)",
    "Scheme", "DBK %", "DBK Recv", "Scroll Date", "Bal DBK", "RoDTEP %", "RoDTEP Recv", "RoDTEP Y/N", "Bal RoDTEP"
  ];

  const exportToExcel = () => {
    if (rows.length === 0) return;
    const cleanRows = rows.map((r, i) => ({ "Serial No": i+1, ...r }));
    const ws = utils.json_to_sheet(cleanRows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Solar Grid Export");
    writeFile(wb, `solar_matrix_${new Date().getTime()}.xlsx`);
  };

  const REQUIRED_FIELDS: (keyof GridRow)[] = ['sbNo', 'sbDate', 'finalInvoiceNo', 'hsCode', 'fobValueINR', 'currency'];
  
  const filteredRows = useMemo(() => {
    let result = rows;
    if (showIssuesOnly) result = result.filter(row => REQUIRED_FIELDS.some(f => !row[f] || row[f] === '0' || row[f] === '0.00'));
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      result = result.filter(row => 
        row.sbNo.toLowerCase().includes(s) || 
        row.customerName.toLowerCase().includes(s) ||
        row.finalInvoiceNo.toLowerCase().includes(s)
      );
    }
    return result;
  }, [rows, showIssuesOnly, searchTerm]);

  const analytics = useMemo(() => {
    const totalFob = rows.reduce((sum, r) => sum + (parseFloat(r.fobValueINR.replace(/,/g, '')) || 0), 0);
    const count = new Set(rows.map(r => r.finalInvoiceNo)).size;
    const totalBenefit = rows.reduce((sum, r) => {
        const dbk = parseFloat(r.drawback.replace(/,/g, '')) || 0;
        const rod = parseFloat(r.rodtep.replace(/,/g, '')) || 0;
        return sum + dbk + rod;
    }, 0);
    return { totalFob, count, totalBenefit };
  }, [rows]);

  const InputCell = ({ id, field, value, align = "left", className = "" }: any) => {
    const isRequired = REQUIRED_FIELDS.includes(field);
    const hasError = isRequired && (!value || value === '0' || value === '0.00');
    return (
        <input 
            type="text" value={value} 
            onChange={(e) => onRowChange(id, field, e.target.value)}
            className={`w-full bg-transparent border-b-2 border-transparent focus:outline-none px-2 py-1.5 transition-all text-xs
                ${hasError ? 'bg-red-50 border-brand-primary text-brand-primary font-black' : 'focus:border-brand-secondary text-slate-800 font-semibold'} 
                ${className}`}
            style={{ textAlign: align }}
            spellCheck={false}
        />
    );
  };

  return (
    <div className="w-full animate-propel">
      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-8 border-t-4 border-brand-secondary shadow-xl rounded-3xl flex items-center justify-between">
            <div>
                <p className="text-[10px] font-black text-brand-secondary uppercase tracking-[0.3em] mb-1">Batch Analytics</p>
                <h3 className="text-4xl font-black text-brand-secondary tracking-tighter">{analytics.count}</h3>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl">
                <FileCheck className="w-8 h-8 text-brand-secondary" />
            </div>
        </div>
        <div className="bg-brand-primary p-8 shadow-2xl shadow-red-200 rounded-3xl flex items-center justify-between text-white overflow-hidden relative group">
            <Zap className="absolute -right-4 -bottom-4 w-24 h-24 text-white opacity-10 group-hover:scale-110 transition-transform" />
            <div className="relative z-10">
                <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.3em] mb-1">Matrix Value</p>
                <h3 className="text-4xl font-black tracking-tighter">₹{analytics.totalFob.toLocaleString()}</h3>
            </div>
            <IndianRupee className="w-8 h-8 text-white opacity-50 relative z-10" />
        </div>
        <div className="bg-brand-secondary p-8 shadow-xl rounded-3xl flex items-center justify-between text-white">
            <div>
                <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.3em] mb-1">Total Incentives</p>
                <h3 className="text-4xl font-black tracking-tighter text-white">₹{analytics.totalBenefit.toLocaleString()}</h3>
            </div>
            <Database className="w-8 h-8 text-white opacity-30" />
        </div>
      </div>

      {/* Grid Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 bg-white px-8 py-5 rounded-3xl shadow-lg border-b-4 border-brand-secondary">
        <div className="relative w-full md:w-[28rem]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-secondary/40" />
            <input 
                type="text" placeholder="Search Data Matrix..." value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-6 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary transition-all font-bold placeholder:text-slate-300"
            />
        </div>
        <div className="flex gap-4 w-full md:w-auto">
             <button onClick={() => setShowIssuesOnly(!showIssuesOnly)} 
                className={`flex items-center gap-3 px-6 py-3 text-[10px] font-black border-2 rounded-2xl uppercase tracking-[0.2em] transition-all
                    ${showIssuesOnly ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-brand-secondary border-slate-100 hover:border-brand-primary hover:text-brand-primary'}
                `}
             >
                <Filter className="w-4 h-4" /> {showIssuesOnly ? 'Show All' : 'Filter Incomplete'}
             </button>
             <button onClick={onReset} className="px-6 py-3 text-[10px] font-black text-slate-500 bg-white border-2 border-slate-100 rounded-2xl uppercase tracking-[0.2em] hover:bg-slate-50 transition-all">Flush Matrix</button>
             <button onClick={exportToExcel} className="flex items-center gap-3 px-8 py-3 text-[10px] font-black text-white bg-brand-primary hover:bg-red-700 rounded-2xl shadow-xl shadow-red-200 uppercase tracking-[0.2em] transition-all active:scale-95">
                Download Grid <Download className="w-4 h-4" />
             </button>
        </div>
      </div>

      {/* Main Table Interface */}
      <div className="relative overflow-hidden border-2 border-slate-200 rounded-[2.5rem] shadow-2xl bg-white mb-20">
        <div className="max-h-[700px] overflow-auto">
            <table className="w-full text-xs text-left text-slate-700 border-collapse">
            <thead className="text-[10px] text-white uppercase bg-brand-secondary sticky top-0 z-10 shadow-lg">
                <tr>
                    {headers.map((h, i) => (
                        <th key={i} className={`px-5 py-5 font-black border-r border-slate-800 whitespace-nowrap tracking-widest ${i === 0 ? 'sticky left-0 z-20 bg-brand-secondary' : ''}`}>
                            {h}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row, index) => (
                <tr key={row.id} className="hover:bg-red-50 transition-colors group">
                    <td className="px-4 py-4 text-center sticky left-0 z-10 bg-white group-hover:bg-red-50 border-r border-slate-100">
                        <button onClick={() => onDeleteRow(row.id)} className="text-slate-200 hover:text-brand-primary transition-all transform hover:scale-125">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </td>
                    <td className="px-5 py-4 text-brand-secondary/40 font-black text-center">{index + 1}</td>
                    <td className="px-5 py-4 font-black text-brand-secondary"><InputCell id={row.id} field="sbNo" value={row.sbNo} className="text-brand-secondary" /></td>
                    <td className="px-5 py-4"><InputCell id={row.id} field="sbDate" value={row.sbDate} /></td>
                    <td className="px-5 py-4 text-slate-400"><InputCell id={row.id} field="leoDate" value={row.leoDate} /></td>
                    <td className="px-5 py-4 font-bold min-w-[300px]"><InputCell id={row.id} field="customerName" value={row.customerName} /></td>
                    <td className="px-5 py-4 font-black text-brand-secondary"><InputCell id={row.id} field="finalInvoiceNo" value={row.finalInvoiceNo} /></td>
                    <td className="px-5 py-4 font-black text-brand-primary bg-red-50/20"><InputCell id={row.id} field="productCategory" value={row.productCategory} className="text-brand-primary" /></td>
                    <td className="px-5 py-4"><InputCell id={row.id} field="portCode" value={row.portCode} /></td>
                    <td className="px-5 py-4 text-center"><InputCell id={row.id} field="incoterms" value={row.incoterms} align="center" className="bg-slate-100 rounded-lg px-2 text-[9px] font-black" /></td>
                    <td className="px-5 py-4"><InputCell id={row.id} field="country" value={row.country} /></td>
                    <td className="px-5 py-4 font-mono text-brand-secondary font-black"><InputCell id={row.id} field="hsCode" value={row.hsCode} /></td>
                    <td className="px-5 py-4 min-w-[350px]"><InputCell id={row.id} field="productGroup" value={row.productGroup} /></td>
                    <td className="px-5 py-4 text-right font-black"><InputCell id={row.id} field="qty" value={row.qty} align="right" /></td>
                    <td className="px-5 py-4 text-center font-black text-slate-300"><InputCell id={row.id} field="unit" value={row.unit} align="center" /></td>
                    <td className="px-5 py-4 text-right font-mono"><InputCell id={row.id} field="fobValueFC" value={row.fobValueFC} align="right" /></td>
                    <td className="px-5 py-4 text-center font-black text-brand-secondary"><InputCell id={row.id} field="currency" value={row.currency} align="center" /></td>
                    <td className="px-5 py-4 text-right"><InputCell id={row.id} field="exchangeRate" value={row.exchangeRate} align="right" /></td>
                    <td className="px-5 py-4 text-right"><InputCell id={row.id} field="leoExchangeRate" value={row.leoExchangeRate} align="right" /></td>
                    <td className="px-5 py-4 text-right font-black text-brand-secondary bg-slate-50"><InputCell id={row.id} field="fobValueINR" value={row.fobValueINR} align="right" /></td>
                    <td className="px-5 py-4 text-right"><InputCell id={row.id} field="fobValueLeoINR" value={row.fobValueLeoINR} align="right" /></td>
                    <td className="px-5 py-4 text-right bg-red-50 font-black"><InputCell id={row.id} field="actualFreightInsuranceFC" value={row.actualFreightInsuranceFC} align="right" /></td>
                    <td className="px-5 py-4 text-right text-slate-400"><InputCell id={row.id} field="freight" value={row.freight} align="right" /></td>
                    <td className="px-5 py-4 text-right text-slate-400"><InputCell id={row.id} field="insurance" value={row.insurance} align="right" /></td>
                    <td className="px-5 py-4 text-right font-black bg-slate-50"><InputCell id={row.id} field="invoiceValueFC" value={row.invoiceValueFC} align="right" /></td>
                    <td className="px-5 py-4 text-right italic text-slate-300"><InputCell id={row.id} field="paymentReceipt" value={row.paymentReceipt} align="right" /></td>
                    <td className="px-5 py-4 text-right text-status-error font-black"><InputCell id={row.id} field="paymentOutstanding" value={row.paymentOutstanding} align="right" /></td>
                    <td className="px-5 py-4 text-right font-black text-brand-secondary"><InputCell id={row.id} field="totalInvoiceValueINR" value={row.totalInvoiceValueINR} align="right" /></td>
                    <td className="px-5 py-4 font-black uppercase text-[9px] text-slate-400 text-center"><InputCell id={row.id} field="scheme" value={row.scheme} align="center" /></td>
                    <td className="px-5 py-4 text-right text-slate-400"><InputCell id={row.id} field="dbkPercent" value={row.dbkPercent} align="right" /></td>
                    <td className="px-5 py-4 text-right font-black text-status-success bg-green-50/20"><InputCell id={row.id} field="drawback" value={row.drawback} align="right" /></td>
                    <td className="px-5 py-4 text-center text-slate-400"><InputCell id={row.id} field="scrollDate" value={row.scrollDate} align="center" /></td>
                    <td className="px-5 py-4 text-right italic text-slate-300"><InputCell id={row.id} field="balDbk" value={row.balDbk} align="right" /></td>
                    <td className="px-5 py-4 text-right text-slate-400"><InputCell id={row.id} field="rodtepPercent" value={row.rodtepPercent} align="right" /></td>
                    <td className="px-5 py-4 text-right font-black text-status-success bg-green-50/20"><InputCell id={row.id} field="rodtep" value={row.rodtep} align="right" /></td>
                    <td className="px-5 py-4 text-center font-black"><InputCell id={row.id} field="rodtepYN" value={row.rodtepYN} align="center" /></td>
                    <td className="px-5 py-4 text-right italic text-slate-300"><InputCell id={row.id} field="balRodtep" value={row.balRodtep} align="right" /></td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
        {/* Matrix Footer */}
        <div className="bg-brand-secondary px-8 py-5 flex justify-between items-center text-white">
            <div className="flex items-center gap-3">
                <Sun className="w-5 h-5 text-brand-primary animate-spin-slow" />
                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">Solar Protocol Matrix Active</span>
            </div>
            <div className="text-[9px] font-black text-white bg-white/10 px-5 py-2 rounded-full border border-white/20 uppercase tracking-[0.2em]">
                {filteredRows.length} ROWS IN ACTIVE MATRIX
            </div>
        </div>
      </div>
    </div>
  );
};