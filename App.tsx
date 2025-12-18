
import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Trash2, Plus, ArrowLeft, Download, FileText, DollarSign, FileSpreadsheet, RotateCcw, Smartphone, X, Mail, Sparkles, Database, HardDrive, AlertTriangle, ShieldCheck, Key, HelpCircle, ExternalLink, Settings, PlayCircle, RefreshCw, CheckCircle2, WifiOff, Copy, Check, Search, FolderOpen, CloudUpload, Monitor, Rocket, Globe, ChevronRight } from 'lucide-react';
import { S1aFormState, Transaction, AppView, TaxPayerInfo } from './types';
import VoiceInput from './components/VoiceInput';
import PreviewS1a from './components/PreviewS1a';
import InstallPWA from './components/InstallPWA';
import { parseTransactionFromAudio, transcribeAudio, transcribeStandardizedInfo } from './services/geminiService';
import { exportToDoc, exportToExcel, generateExcelBlob } from './utils/exportUtils';
import { saveToDB, loadFromDB, clearDB } from './services/db';

const SAMPLE_DATA: S1aFormState = {
  info: {
    name: "Nguyễn Văn A",
    address: "123 Đường Láng, Hà Nội",
    taxId: "8000123456",
    location: "Cửa hàng Tạp hóa Số 1",
    period: "Tháng 10/2023"
  },
  transactions: [
    { id: '1', date: "01/10/2023", description: "Bán hàng tạp hóa lẻ", amount: 2500000 },
    { id: '2', date: "02/10/2023", description: "Cung cấp dịch vụ giao hàng", amount: 500000 },
  ]
};

export default function App() {
  const [view, setView] = useState<AppView>(AppView.EDIT);
  const [data, setData] = useState<S1aFormState>(SAMPLE_DATA);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [processingField, setProcessingField] = useState<string | null>(null); 
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [apiKeyError, setApiKeyError] = useState(false);

  useEffect(() => {
    const initData = async () => {
      const savedData = await loadFromDB();
      if (savedData) setData(savedData);
      setIsLoaded(true);
      
      const isApiKeyMissing = !process.env.API_KEY || process.env.API_KEY === "" || process.env.API_KEY === "undefined";
      if (isApiKeyMissing) {
        setApiKeyError(true);
      }
    };
    initData();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    saveToDB(data).catch(err => console.error("Lỗi lưu DB:", err));
  }, [data, isLoaded]);

  const handleReset = async () => {
    await clearDB();
    setData(SAMPLE_DATA);
    setShowResetConfirm(false);
  };

  const handleInfoChange = (field: keyof TaxPayerInfo, value: string) => {
    setData(prev => ({ ...prev, info: { ...prev.info, [field]: value } }));
  };

  const handleError = (e: any) => {
    if (e.message === "API_KEY_MISSING") {
      setApiKeyError(true);
      setAiFeedback("Lỗi: Chưa có API Key");
    } else {
      setAiFeedback("Lỗi kết nối AI. Thử lại sau.");
    }
    setTimeout(() => setAiFeedback(null), 3000);
  };

  const handleVoiceForField = async (field: keyof TaxPayerInfo, label: string, audioBase64: string, mimeType: string) => {
    setProcessingField(field);
    try {
      const text = await transcribeStandardizedInfo(audioBase64, label, mimeType);
      if (text) handleInfoChange(field, text);
    } catch (e) {
      handleError(e);
    } finally {
      setProcessingField(null);
    }
  };

  const addTransaction = () => {
    const newTrans: Transaction = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('vi-VN'),
      description: "",
      amount: 0
    };
    setData(prev => ({ ...prev, transactions: [...prev.transactions, newTrans] }));
  };

  const updateTransaction = (id: string, field: keyof Transaction, value: string | number) => {
    setData(prev => ({
      ...prev,
      transactions: prev.transactions.map(t => t.id === id ? { ...t, [field]: value } : t)
    }));
  };

  const handleVoiceForTransactionDesc = async (id: string, audioBase64: string, mimeType: string) => {
    setProcessingField(`trans-${id}`);
    try {
      const text = await transcribeAudio(audioBase64, mimeType);
      if (text) updateTransaction(id, 'description', text);
    } catch (e) {
      handleError(e);
    } finally {
      setProcessingField(null);
    }
  };

  const removeTransaction = (id: string) => {
    setData(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => t.id !== id)
    }));
  };

  const handleSmartVoiceAdd = async (audioBase64: string, mimeType: string) => {
    if (!audioBase64) return;
    setIsProcessingAI(true);
    setAiFeedback("AI đang phân tích...");
    try {
      const result = await parseTransactionFromAudio(audioBase64, mimeType);
      const newTrans: Transaction = {
        id: Date.now().toString(),
        date: result.date || new Date().toLocaleDateString('vi-VN'),
        description: result.description || "Giao dịch mới",
        amount: result.amount || 0
      };
      setData(prev => ({ ...prev, transactions: [...prev.transactions, newTrans] }));
      setAiFeedback("Đã thêm thành công!");
      setTimeout(() => setAiFeedback(null), 3000);
    } catch (e) {
      handleError(e);
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleSaveToDrive = () => {
    exportToExcel(data);
    const confirmed = window.confirm("File Excel đã được tải xuống máy.\n\nNhấn OK để mở Google Drive và tải file này lên để lưu trữ.");
    if (confirmed) {
      window.open('https://drive.google.com/drive/my-drive', '_blank');
    }
  };

  const handleSendExcel = async () => {
    const excelBlob = generateExcelBlob(data);
    const safeName = (data.info.name || 'S1a').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '_');
    const fileName = `${safeName}_S1a.xls`;
    const file = new File([excelBlob], fileName, { type: 'application/vnd.ms-excel' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Sổ doanh thu AI',
          text: `Gửi sổ doanh thu của ${data.info.name}`,
        });
      } catch (error) {
        fallbackEmail(fileName);
      }
    } else {
      fallbackEmail(fileName);
    }
  };

  const fallbackEmail = (fileName: string) => {
    alert(`Tệp ${fileName} sẽ được tải xuống. Hãy đính kèm tệp này vào Email.`);
    exportToExcel(data);
    setTimeout(() => {
      const subject = encodeURIComponent(`Sổ chi tiết doanh thu S1a-HKD - ${data.info.name}`);
      window.location.href = `mailto:?subject=${subject}`;
    }, 1000);
  };

  const formatAmountInput = (amount: number): string => {
    if (amount === 0) return "";
    return amount.toLocaleString('vi-VN');
  };

  const parseAmountInput = (value: string): number => {
    const cleanValue = value.replace(/\./g, '').replace(/[^0-9]/g, '');
    const num = parseInt(cleanValue, 10);
    return isNaN(num) ? 0 : num;
  };

  const renderEditView = () => (
    <div className="space-y-6 pb-32">
      {/* Status Bar - Minimal */}
      <div className="flex items-center justify-between bg-white/50 backdrop-blur-sm px-4 py-2.5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-1.5">
             <div className={`w-2 h-2 rounded-full ${apiKeyError ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
             <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">AI Status: {apiKeyError ? 'Offline' : 'Ready'}</span>
           </div>
        </div>
      </div>

      {/* Main Forms */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-black text-indigo-900 mb-5 flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600"><BookOpen className="w-5 h-5" /></div>
          Thông tin chung
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { label: "Họ tên HKD", key: "name" as const, placeholder: "Nguyễn Văn A" },
            { label: "Mã số thuế", key: "taxId" as const, placeholder: "0123456789" },
            { label: "Địa chỉ", key: "address" as const, placeholder: "Số nhà, Tên đường...", full: true },
            { label: "Địa điểm KD", key: "location" as const, placeholder: "Chợ, Cửa hàng...", full: true },
            { label: "Kỳ kê khai", key: "period" as const, placeholder: "Tháng 10/2023" }
          ].map((field) => (
            <div key={field.key} className={`${field.full ? 'md:col-span-2' : ''}`}>
              <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">{field.label}</label>
              <div className="flex items-center gap-2 group">
                <input
                  type="text"
                  value={data.info[field.key]}
                  onChange={(e) => handleInfoChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="block w-full rounded-2xl border-gray-200 bg-gray-50/50 border p-3.5 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-sm transition-all outline-none"
                />
                <VoiceInput onAudioCapture={(audio, mime) => handleVoiceForField(field.key, field.label, audio, mime)} isProcessing={processingField === field.key} compact />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-black text-indigo-900 flex items-center gap-2 mb-5">
          <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center text-green-600"><DollarSign className="w-5 h-5" /></div>
          Doanh thu chi tiết
        </h2>
        <div className="space-y-4">
          {data.transactions.map((item) => (
            <div key={item.id} className="relative p-5 rounded-2xl bg-gray-50/50 border border-gray-100 flex flex-col gap-3 group hover:bg-white hover:shadow-md transition-all">
              <div className="flex items-center justify-between gap-4">
                <input type="text" value={item.date} onChange={(e) => updateTransaction(item.id, 'date', e.target.value)} className="bg-white px-3 py-1.5 rounded-xl border border-gray-100 text-xs font-bold text-gray-500 w-28 text-center" />
                <button onClick={() => removeTransaction(item.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex gap-2 items-center bg-white rounded-xl border border-gray-100 px-3 py-1">
                  <textarea value={item.description} onChange={(e) => updateTransaction(item.id, 'description', e.target.value)} rows={1} className="w-full bg-transparent text-sm py-2 resize-none outline-none font-medium" placeholder="Nội dung bán hàng..." />
                  <VoiceInput onAudioCapture={(audio, mime) => handleVoiceForTransactionDesc(item.id, audio, mime)} isProcessing={processingField === `trans-${item.id}`} compact className="shrink-0 scale-90" />
                </div>
                <div className="w-32 bg-indigo-50 rounded-xl border border-indigo-100 px-3 py-2 text-right">
                   <input 
                    type="text" 
                    inputMode="numeric"
                    value={formatAmountInput(item.amount)} 
                    onChange={(e) => updateTransaction(item.id, 'amount', parseAmountInput(e.target.value))} 
                    className="w-full text-right bg-transparent text-sm font-black text-indigo-900 outline-none" 
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={addTransaction} className="mt-6 w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all">
          <Plus className="w-5 h-5" /> Thêm giao dịch mới
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 z-50 pointer-events-none">
        <div className="max-w-xl mx-auto flex items-center gap-3 pointer-events-auto">
          <button onClick={() => setShowResetConfirm(true)} className="p-4 bg-white text-gray-400 rounded-3xl shadow-2xl border border-gray-100 active:scale-90 transition-all shrink-0"><RotateCcw className="w-6 h-6" /></button>
          <div className="flex-1 flex items-center gap-3 bg-indigo-950 px-5 py-3 rounded-full border border-white/10 shadow-2xl backdrop-blur-xl relative overflow-hidden group">
            <div className="relative flex-1 overflow-hidden">
               <p className="text-xs text-white font-black uppercase tracking-tighter truncate">{isProcessingAI ? "AI đang lắng nghe..." : aiFeedback ? aiFeedback : "Nhấn Micro để nói"}</p>
               {!isProcessingAI && !aiFeedback && <p className="text-[10px] text-white/50 truncate italic">VD: "Hôm nay bán được 5 triệu"</p>}
            </div>
            <VoiceInput onAudioCapture={handleSmartVoiceAdd} isProcessing={isProcessingAI} className="bg-white text-indigo-950 shadow-xl scale-125" />
          </div>
          <button onClick={() => setView(AppView.PREVIEW)} className="bg-indigo-600 text-white p-4 rounded-3xl font-black shadow-2xl hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0"><FileText className="w-6 h-6" /></button>
        </div>
      </div>

      <InstallPWA />

      {showResetConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-6 backdrop-blur-md">
          <div className="bg-white rounded-[40px] max-sm:mx-4 max-w-sm w-full p-10 shadow-2xl text-center border border-gray-100">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6"><AlertTriangle className="w-10 h-10" /></div>
            <h3 className="text-2xl font-black text-gray-900 mb-3 uppercase tracking-tight">Xóa tất cả?</h3>
            <p className="text-gray-500 text-sm mb-8">Hành động này không thể hoàn tác.</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleReset} className="w-full bg-red-600 text-white py-5 rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-red-100">Xác nhận xóa</button>
              <button onClick={() => setShowResetConfirm(false)} className="w-full bg-gray-100 text-gray-700 py-5 rounded-3xl font-black uppercase tracking-widest">Hủy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderPreviewView = () => (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <div className="sticky top-4 z-50 bg-white/80 backdrop-blur-xl border border-white/20 shadow-2xl p-4 rounded-3xl flex items-center justify-between mb-8 mx-4">
        <button onClick={() => setView(AppView.EDIT)} className="flex items-center gap-2 text-indigo-900 font-black uppercase text-xs tracking-widest px-4 py-2 hover:bg-indigo-50 rounded-xl transition-all">
          <ArrowLeft className="w-4 h-4" /> Sửa sổ
        </button>
        <div className="flex gap-2">
          <button onClick={handleSendExcel} className="p-3 bg-green-600 text-white rounded-2xl shadow-lg active:scale-90 transition-all"><Mail className="w-5 h-5" /></button>
          <button onClick={handleSaveToDrive} className="p-3 bg-indigo-900 text-white rounded-2xl shadow-lg active:scale-90 transition-all"><HardDrive className="w-5 h-5" /></button>
        </div>
      </div>
      <div className="overflow-auto pb-20 px-4">
         <PreviewS1a data={data} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <header className="bg-indigo-950 px-6 py-10 md:py-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500 rounded-full -translate-y-1/2 translate-x-1/2 opacity-20 blur-[100px]"></div>
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="flex flex-col items-center md:items-start text-center md:text-left gap-4">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
               <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
               <p className="text-white/80 font-black text-[10px] uppercase tracking-[0.2em]">Cục Thuế Tỉnh Điện Biên</p>
            </div>
            <h1 className="text-4xl md:text-7xl font-black text-white uppercase tracking-tighter leading-none mt-2">
              Sổ doanh thu <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">AI</span>
            </h1>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-4 md:p-6 -mt-10 md:-mt-16 relative z-20">
        {view === AppView.EDIT ? renderEditView() : renderPreviewView()}
      </main>
    </div>
  );
}
