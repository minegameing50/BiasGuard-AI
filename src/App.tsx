import React, { useState, useCallback, useEffect } from 'react';
import Papa from 'papaparse';
import { Upload, FileText, AlertTriangle, ShieldAlert, LayoutDashboard, Database, Eye, BarChart3, Settings, LogOut, Search, HelpCircle, CheckCircle, Download, Briefcase, Globe, FileDown, X, BookOpen, Info, MessageSquare } from 'lucide-react';
import { analyzeDatasetBias, BiasReport } from './services/geminiService';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, YAxis, Legend } from 'recharts';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function App() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [step, setStep] = useState<'upload' | 'configure'>('upload');
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [sensitiveCol, setSensitiveCol] = useState('');
  const [targetCol, setTargetCol] = useState('');
  const [demographicRates, setDemographicRates] = useState<any>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<BiasReport | null>(null);
  const [history, setHistory] = useState<{name: string, date: string, score: number, report: BiasReport}[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showFixes, setShowFixes] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [feedbackSubject, setFeedbackSubject] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [deepAudit, setDeepAudit] = useState(true);
  const [smartRedaction, setSmartRedaction] = useState(false);
  const [autoCompliance, setAutoCompliance] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const handleSaveSettings = () => {
    setIsSavingSettings(true);
    setTimeout(() => {
      setIsSavingSettings(false);
    }, 800);
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackSubject.trim() || !feedbackMessage.trim()) return;
    setIsSubmittingFeedback(true);
    setFeedbackError(null);
    try {
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const { db, handleFirestoreError } = await import('./firebase');
      
      const feedbackData = {
        subject: feedbackSubject.trim(),
        message: feedbackMessage.trim(),
        createdAt: serverTimestamp(),
        status: 'open'
      };
      
      try {
        await addDoc(collection(db, 'feedback'), feedbackData);
      } catch (err) {
        handleFirestoreError(err, 'create', 'feedback');
      }
      
      setFeedbackSuccess(true);
      setFeedbackSubject('');
      setFeedbackMessage('');
      setTimeout(() => setFeedbackSuccess(false), 3000);
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to submit feedback.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);

  const downloadReport = () => {
    if (!report) return;
    
    try {
      const data = report;
      const doc = new jsPDF();
      let yPos = 20;

      const addText = (text: string, size: number, isBold: boolean, color: number[], isList: boolean = false) => {
        doc.setFontSize(size);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setTextColor(color[0], color[1], color[2]);
        const lines = doc.splitTextToSize(text, 180 - (isList ? 10 : 0));
        
        if (yPos + (lines.length * 6) > 280) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.text(lines, isList ? 24 : 14, yPos);
        yPos += (lines.length * (size > 14 ? 8 : 6)) + 2;
      };

      const severity = data.fairnessScore < 40 ? "High" : data.fairnessScore < 80 ? "Medium" : "Low";
      
      addText('BiasGuard Fairness Report', 22, true, [30, 58, 138]);
      yPos += 2;
      
      addText(`File: ${file?.name || 'Dataset'}`, 12, true, [51, 65, 85]);
      addText(`Generated On: ${new Date().toISOString().split('T')[0]}`, 10, false, [100, 116, 139]);
      yPos += 8;

      addText('OVERVIEW', 14, true, [15, 23, 42]);
      addText(`Fairness Score: ${data.fairnessScore}/100`, 12, false, [51, 65, 85]);
      addText(`Risk Level: ${data.fairnessScore < 60 ? 'High Risk' : 'Low Risk'}`, 12, false, [51, 65, 85]);
      addText(`Bias Severity: ${severity}`, 12, false, [51, 65, 85]);
      addText(`Confidence: ${data.confidence || 'High (AI-based)'}`, 12, false, [51, 65, 85]);
      yPos += 8;

      addText('DETECTED BIAS', 14, true, [15, 23, 42]);
      addText(data.biasTypes?.map((b: any) => b.name).join(", ") || 'None detected.', 12, false, [51, 65, 85]);
      yPos += 8;

      addText('SUMMARY', 14, true, [15, 23, 42]);
      const summary = data.fairnessScore < 60 
      ? "This dataset shows significant bias and needs correction."
      : "This dataset appears relatively fair.";
      addText(summary, 12, false, [51, 65, 85]);
      yPos += 8;

      addText('AI EXPLANATION', 14, true, [15, 23, 42]);
      addText(data.explanation || 'No explanation available.', 12, false, [51, 65, 85]);
      yPos += 8;

      addText('SUGGESTED MITIGATIONS', 14, true, [15, 23, 42]);
      if (data.suggestions && data.suggestions.length > 0) {
        data.suggestions.forEach((s: string, i: number) => {
          addText(`${i + 1}. ${s}`, 12, false, [51, 65, 85], true);
        });
      } else {
        addText('None available.', 12, false, [51, 65, 85]);
      }
      
      doc.save(`BiasGuard_Report_${file?.name || 'dataset'}.pdf`);
    } catch (e: any) {
      setError(`Failed to generate PDF: ${e.message}`);
    }
  };

  const getFix = () => {
    if (report?.suggestions && report.suggestions.length > 0) {
      setShowFixes(true);
    } else {
      setError("No suggestions available. Try re-running the analysis.");
    }
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile); setError(null); setReport(null); setShowFixes(false); setLoading(false);
    Papa.parse(selectedFile, {
      header: true, skipEmptyLines: true,
      complete: (results) => {
        try {
          if (results.errors.length > 0) throw new Error("Failed to parse file. Please ensure it's a valid CSV.");
          const data = results.data;
          
          if (!data || data.length === 0) {
            throw new Error("Empty file uploaded.");
          }
          
          const columns = Object.keys(data[0] as object);
          
          setCsvData(data);
          setCsvColumns(columns);
          setSensitiveCol(columns[0] || '');
          setTargetCol(columns[1] || columns[0] || '');
          setStep('configure');
          
        } catch (err: any) {
          setError(err.message || "An error occurred during file parsing.");
        }
      },
      error: () => { setError("Failed to read file."); setLoading(false); }
    });
  };

  const downloadTotalOutcomeList = () => {
    if (!csvData || csvData.length === 0) return;
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      
      doc.setFontSize(18);
      doc.text('BiasGuard - Total Outcome Full List', 14, 22);
      
      doc.setFontSize(12);
      doc.text(`Sensitive Attribute: ${sensitiveCol}`, 14, 32);
      doc.text(`Target Outcome: ${targetCol}`, 14, 40);
      doc.text(`Total Records: ${csvData.length}`, 14, 48);

      const head = [['Row No.', ...csvColumns]];
      const body = csvData.map((row, index) => [
        String(index + 2),
        ...csvColumns.map(col => String(row[col] || ''))
      ]);

      autoTable(doc, {
        startY: 55,
        head: head,
        body: body,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
          0: { cellWidth: 15 } 
        }
      });
      
      doc.save(`BiasGuard_Total_Outcome_List.pdf`);
    } catch (e: any) {
      setError(`Failed to generate PDF: ${e.message}`);
    }
  };

  const downloadPDFReport = (group: string, outcome: string) => {
    try {
      const filteredData = csvData
        .map((row, index) => ({ ...row, _OriginalRowIndex: index + 2 }))
        .filter((row) => String(row[sensitiveCol] || 'Unknown') === group && String(row[targetCol] || 'Unknown') === outcome);
      
      if (filteredData.length === 0) {
        setError(`No rows found for ${group} and ${outcome}`);
        return;
      }
      
      const doc = new jsPDF({ orientation: 'landscape' });
      
      doc.setFontSize(18);
      doc.text(`BiasGuard - Detail Report`, 14, 22);
      
      doc.setFontSize(12);
      doc.text(`Sensitive Attribute (${sensitiveCol}): ${group}`, 14, 32);
      doc.text(`Outcome (${targetCol}): ${outcome}`, 14, 40);
      doc.text(`Total Rows: ${filteredData.length}`, 14, 48);
      
      // Auto table
      const head = [['Row No.', ...csvColumns]];
      const body = filteredData.map(row => [
        String(row._OriginalRowIndex),
        ...csvColumns.map(col => String(row[col] !== undefined ? row[col] : ''))
      ]);
      
      autoTable(doc, {
        startY: 55,
        head: head,
        body: body,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
        headStyles: { fillColor: [59, 130, 246] },
        horizontalPageBreak: true,
        horizontalPageBreakRepeat: 0,
        columnStyles: {
          0: { cellWidth: 15 } // Row No. doesn't need to be very wide
        }
      });
      
      doc.save(`BiasGuard_Detail_${group}_${outcome}.pdf`);
    } catch (e: any) {
      setError(`Failed to generate PDF: ${e.message}`);
    }
  };

  const computeRatesAndAnalyze = async () => {
    if (sensitiveCol === targetCol) {
      setError("Target column and sensitive attribute cannot be the same.");
      return;
    }
    setLoading(true);
    setStep('upload'); // Transition to normal loading view
    try {
      // Compute demographic outcome rates
      const rates: Record<string, { total: number; outcomes: Record<string, number>; positiveRate?: string }> = {};
      
      csvData.forEach(row => {
        const sVal = String(row[sensitiveCol] || 'Unknown');
        const tVal = String(row[targetCol] || 'Unknown');
        
        if (!rates[sVal]) rates[sVal] = { total: 0, outcomes: {} };
        rates[sVal].total++;
        rates[sVal].outcomes[tVal] = (rates[sVal].outcomes[tVal] || 0) + 1;
      });

      // Calculate percentage for each outcome to pass to AI
      Object.keys(rates).forEach(group => {
        const groupData = rates[group];
        // Find the most frequent outcome or pass all percentages
        groupData.positiveRate = Object.entries(groupData.outcomes)
          .map(([outcome, count]) => `${outcome}: ${Math.round((count / groupData.total) * 100)}%`)
          .join(", ");
      });

      setDemographicRates(rates);

      const analysisReport = await analyzeDatasetBias(csvColumns, csvData.length > 5000 ? csvData.slice(0, 5000) : csvData, sensitiveCol, targetCol, rates);
      setReport(analysisReport);
      setHistory(prev => [{
        name: file?.name || 'dataset.csv',
        date: new Date().toLocaleDateString(),
        score: analysisReport.fairnessScore,
        report: analysisReport
      }, ...prev]);
    } catch (err: any) {
      setError(err.message || "An error occurred during analysis.");
      setStep('configure'); // Go back if error
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "text/csv" || droppedFile.name.endsWith('.csv')) processFile(droppedFile);
      else setError("Please upload a valid CSV file.");
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) processFile(e.target.files[0]);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-[var(--success)]";
    if (score >= 60) return "text-[var(--warning)]";
    return "text-[var(--danger)]";
  };
  
  const demographicChartData = React.useMemo(() => {
    if (!demographicRates) return [];
    return Object.entries(demographicRates).map(([group, data]: [string, any]) => {
      // Create a unique object incorporating the count mapping directly to reduce chart recalculation lag
      const result: any = { name: group };
      Object.entries(data.outcomes).forEach(([outcome, count]: [string, any]) => {
         const percentage = Math.round((count / data.total) * 100);
         // Storing both the percentage to graph and the string visualization
         result[`${outcome}`] = percentage;
         result[`_raw_${outcome}`] = count;
      });
      result._total = data.total;
      return result;
    });
  }, [demographicRates]);

  const outcomeKeys = React.useMemo(() => {
    if (!demographicRates) return [];
    const keys = new Set<string>();
    Object.values(demographicRates).forEach((d: any) => {
      Object.keys(d.outcomes).forEach(k => keys.add(k));
    });
    return Array.from(keys);
  }, [demographicRates]);

  const colors = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6"];

  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--text-main)] overflow-hidden font-sans">
      {/* Sidebar Navigation - Responsive */}
      <AnimatePresence>
        {(isMenuOpen || isDesktop) && (
          <>
            {/* Backdrop for mobile */}
            {isMenuOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMenuOpen(false)}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] md:hidden"
              />
            )}
            
            <motion.aside 
              initial={!isDesktop ? { x: -300 } : false}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={cn(
                "fixed inset-y-0 left-0 w-[280px] bg-[var(--sidebar-bg)] border-r border-[var(--border)] flex flex-col shrink-0 z-[70] md:relative md:w-[260px] md:z-auto transition-all",
                !isMenuOpen && "hidden md:flex"
              )}
            >
              <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[var(--accent)] rounded-xl text-white flex justify-center items-center shadow-lg shadow-blue-500/20">
                    <ShieldAlert size={24} />
                  </div>
                  <span className="text-xl font-bold tracking-tight">BiasGuard AI</span>
                </div>
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 md:hidden"
                >
                  <LogOut size={18} className="rotate-180" />
                </button>
              </div>

              <nav className="flex-1 px-4 py-2 flex flex-col gap-1 overflow-y-auto">
                <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
                <NavItem icon={<Upload size={18} />} label="New Bias Audit" onClick={() => { setReport(null); setFile(null); setCsvData([]); setCsvColumns([]); setSensitiveCol(''); setTargetCol(''); setStep('upload'); setActiveTab('dashboard'); }} />
                <NavItem icon={<Database size={18} />} label="Data Library" active={activeTab === 'library'} onClick={() => setActiveTab('library')} />
                <NavItem icon={<ShieldAlert size={18} />} label="Bias Detection" active={activeTab === 'detection'} onClick={() => setActiveTab('detection')} />
                <NavItem icon={<Eye size={18} />} label="Decision Explainers" active={activeTab === 'explainers'} onClick={() => setActiveTab('explainers')} />
                <NavItem icon={<AlertTriangle size={18} />} label="Mitigation Hub" active={activeTab === 'mitigation'} onClick={() => setActiveTab('mitigation')} />
                <NavItem icon={<BarChart3 size={18} />} label="Fairness Reports" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
                <NavItem icon={<Settings size={18} />} label="System Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
              </nav>

              <div className="p-4 border-t border-[var(--border)] mt-auto flex flex-col gap-1">
                <button 
                  onClick={() => setActiveTab('feedback')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                    activeTab === 'feedback' ? "bg-blue-50 text-blue-600" : "text-[var(--text-secondary)] hover:bg-slate-50 hover:text-[var(--text-primary)]"
                  )}
                >
                  <MessageSquare size={18} /> Feedback
                </button>
                <button 
                  onClick={() => setIsHelpOpen(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-slate-50 hover:text-[var(--text-primary)] transition-all"
                >
                  <Info size={18} /> About & Help
                </button>
                
                <div className="mt-4 px-2 pt-2 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)] text-center">
                  <p className="font-semibold text-slate-500 mb-0.5">BiasGuard Audit System</p>
                  <p>Version 1.0.0 &copy; {new Date().getFullYear()}</p>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">
        <header className="h-[70px] border-b border-[var(--border)] bg-white/80 backdrop-blur-md flex items-center justify-between px-4 md:px-8 sticky top-0 z-40">
          <div className="flex items-center gap-3 md:gap-4 flex-1">
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="p-2 -ml-2 rounded-lg hover:bg-slate-100 md:hidden transition-colors"
            >
              <div className="w-5 h-0.5 bg-slate-600 mb-1 rounded-full"></div>
              <div className="w-5 h-0.5 bg-slate-600 mb-1 rounded-full"></div>
              <div className="w-5 h-0.5 bg-slate-600 rounded-full"></div>
            </button>
            <div className="relative max-w-xs md:max-w-md w-full hidden xs:block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="w-full bg-slate-50 border border-[var(--border)] rounded-full py-1.5 pl-9 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => setIsHelpOpen(true)}
              className="p-2 rounded-full hover:bg-slate-100 transition-colors"
              title="Help & Tutorial"
            >
              <HelpCircle size={18} className="text-[var(--text-muted)]" />
            </button>
          </div>
        </header>

        <main className="p-4 md:p-8 max-w-[1200px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <>
              {step === 'upload' && !report && !loading && (
                <>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-3xl bg-slate-900 text-white p-6 md:p-12 border border-slate-800 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden min-h-[400px] md:min-h-[450px]"
                  >
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 blur-[100px] rounded-full -mr-48 -mt-48"></div>
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-600/10 blur-[100px] rounded-full -ml-48 -mb-48"></div>
                    
                    <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                      className={cn("absolute inset-0 z-10 flex flex-col items-center justify-center transition-all duration-300 p-8", isDragging ? "bg-blue-600/10 backdrop-blur-sm" : "")}>
                      <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/30">
                        <Upload size={28} className="text-blue-400" />
                      </div>
                      <h1 className="text-2xl md:text-5xl font-black mb-6 tracking-tight leading-[1.1] px-4 max-w-2xl">
                        Ensuring Fairness in <span className="text-blue-500">Automated Decisions</span>
                      </h1>
                      <p className="text-slate-400 mb-10 max-w-xl text-base md:text-xl leading-relaxed px-4">
                        Thoroughly inspect datasets for hidden unfairness and discrimination in hiring, loans, and medical care systems.
                      </p>
                      <div className="relative z-20 pointer-events-auto">
                        <input type="file" accept=".csv" onChange={handleFileInput} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <div className="bg-[var(--accent)] hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center transition-all shadow-lg shadow-blue-600/30 active:scale-95 border-2 border-white/20">
                          <FileText size={20} className="mr-2" />
                          Upload New Dataset
                        </div>
                      </div>
                      <p className="mt-6 text-sm text-slate-500">Only CSV files supported. Max file size: 50MB.</p>
                      
                      {error && (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                          className="mt-8 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-3 text-sm font-medium">
                          <AlertTriangle size={18} />{error}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                  
                  <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 pb-12">
                    <div className="bg-white p-8 rounded-3xl border border-[var(--border)] shadow-sm hover:shadow-md transition-all group">
                      <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <Eye size={28} />
                      </div>
                      <h3 className="text-xl font-bold mb-3">1. Measure</h3>
                      <p className="text-sm text-[var(--text-muted)] leading-relaxed font-medium">
                        We scan your data to give you a <span className="text-blue-600 font-bold">Fairness Score</span>. This number shows how balanced your system is and exactly where it might be leaning too far in one direction.
                      </p>
                    </div>
                    <div className="bg-white p-8 rounded-3xl border border-[var(--border)] shadow-sm hover:shadow-md transition-all group">
                      <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <AlertTriangle size={28} />
                      </div>
                      <h3 className="text-xl font-bold mb-3">2. Flag</h3>
                      <p className="text-sm text-[var(--text-muted)] leading-relaxed font-medium">
                        Our AI automatically spots patterns of discrimination. We <span className="text-amber-600 font-bold">highlight hidden biases</span> (like age or gender) that could unfairly change people's lives.
                      </p>
                    </div>
                    <div className="bg-white p-8 rounded-3xl border border-[var(--border)] shadow-sm hover:shadow-md transition-all group">
                      <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <ShieldAlert size={28} />
                      </div>
                      <h3 className="text-xl font-bold mb-3">3. Fix</h3>
                      <p className="text-sm text-[var(--text-muted)] leading-relaxed font-medium">
                        We don't just find problems; we help solve them. Follow our <span className="text-emerald-600 font-bold">step-by-step guides</span> to adjust your models and make your automated decisions fair for everyone.
                      </p>
                    </div>
                  </div>

                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-12 bg-white rounded-3xl border border-[var(--border)] p-6 md:p-8 flex flex-col gap-8 shadow-sm"
                  >
                    <div className="flex flex-col md:flex-row gap-6 md:items-center">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><Briefcase size={20} className="text-blue-500" /> Use Case Example</h3>
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-colors cursor-default">
                          <p className="text-slate-700 font-medium text-[15px] italic leading-relaxed">
                            "This dataset simulates a hiring system where bias can affect candidate selection."
                          </p>
                        </div>
                      </div>
                      <div className="flex-1">
                         <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><Globe size={20} className="text-emerald-500" /> Real Impact</h3>
                         <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-colors cursor-default">
                           <p className="text-slate-700 font-medium text-[15px] italic leading-relaxed">
                             "This system can be used in hiring, banking, and AI systems to prevent unfair decisions."
                           </p>
                         </div>
                      </div>
                    </div>

                    <div className="pt-8 border-t border-slate-100">
                       <h3 className="text-lg font-bold mb-6 text-center text-slate-800">System Impact: Before vs After</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                          <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none z-10">
                            <div className="w-10 h-10 bg-white rounded-full border border-slate-200 flex items-center justify-center shadow-sm -ml-4" style={{marginTop: "20px"}}>
                              <span className="text-lg">→</span>
                            </div>
                          </div>
                          
                          {/* Before */}
                          <div className="bg-red-50/50 p-6 rounded-2xl border border-red-100 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-red-400"></div>
                            <p className="text-red-800 font-bold mb-4 flex items-center gap-2 text-lg"><AlertTriangle size={20}/> BEFORE: Biased Dataset</p>
                            <ul className="space-y-3 text-sm text-red-700/80 font-medium">
                               <li className="flex items-center gap-3"><div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-[10px]">❌</div> Gender heavily influences approval</li>
                               <li className="flex items-center gap-3"><div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-[10px]">❌</div> Unfair weighting on zip codes</li>
                               <li className="flex items-center gap-3"><div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-[10px]">❌</div> High risk of compliance failure</li>
                            </ul>
                          </div>
                          
                          {/* After */}
                          <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-400"></div>
                            <p className="text-emerald-800 font-bold mb-4 flex items-center gap-2 text-lg"><CheckCircle size={20}/> AFTER: Improved Dataset</p>
                            <ul className="space-y-3 text-sm text-emerald-700/80 font-medium">
                               <li className="flex items-center gap-3"><div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-[10px]">✅</div> Balanced candidate selection</li>
                               <li className="flex items-center gap-3"><div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-[10px]">✅</div> Blind to protected attributes</li>
                               <li className="flex items-center gap-3"><div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-[10px]">✅</div> Fair and compliant AI models</li>
                            </ul>
                          </div>
                       </div>
                    </div>
                  </motion.div>
                </>
              )}

              {step === 'configure' && !loading && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-3xl mx-auto mt-12 bg-white rounded-3xl border border-[var(--border)] p-8 shadow-sm"
                >
                    <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-100">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                            <Database size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">Configure Analysis</h2>
                            <p className="text-slate-500 font-medium">Select the target and sensitive attributes from {file?.name}</p>
                        </div>
                    </div>

                    <div className="space-y-6 mb-10">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Target Outcome (What are we predicting/deciding?)</label>
                            <select 
                                value={targetCol}
                                onChange={(e) => setTargetCol(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition-all"
                            >
                                {csvColumns.map(col => <option key={col} value={col}>{col}</option>)}
                            </select>
                            <p className="text-xs text-slate-500 mt-2 ml-1">E.g., LoanApproved, HiredYes, Admitted</p>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Sensitive Feature (What could cause bias?)</label>
                            <select 
                                value={sensitiveCol}
                                onChange={(e) => setSensitiveCol(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition-all"
                            >
                                {csvColumns.map(col => <option key={col} value={col}>{col}</option>)}
                            </select>
                            <p className="text-xs text-slate-500 mt-2 ml-1">E.g., Gender, Race, Age</p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button 
                            onClick={() => { setStep('upload'); setFile(null); }}
                            className="px-6 py-3 rounded-xl font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all flex-1"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={computeRatesAndAnalyze}
                            className="bg-[var(--accent)] hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex-1 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all"
                        >
                            <BarChart3 size={18} /> Run Statistical Analysis
                        </button>
                    </div>
                </motion.div>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="relative mb-8">
                    <div className="w-20 h-20 border-4 border-slate-200 border-t-[var(--accent)] rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ShieldAlert size={32} className="text-[var(--accent)] animate-pulse" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-[var(--text-main)] mb-2">Analyzing Fairness</h3>
                  <p className="text-[var(--text-muted)] font-medium animate-pulse">Running Gemini AI models on your features...</p>
                </div>
              )}

              {report && !loading && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-1 md:grid-cols-12 gap-6"
                >
                  <div className="md:col-span-12 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold tracking-tight">Fairness Analysis Report</h2>
                      <p className="text-xs text-[var(--text-muted)] truncate max-w-[280px] md:max-w-none">Dataset: {file?.name || 'current_dataset.csv'}</p>
                    </div>
                    <button 
                      onClick={() => { setReport(null); setFile(null); }} 
                      className="w-full md:w-auto px-4 py-2 bg-white border border-[var(--border)] rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                    >
                      <Upload size={16} /> New Analysis
                    </button>
                  </div>

                  <div className="md:col-span-12 lg:col-span-4 bg-[#0a0f1c] text-white rounded-3xl p-6 shadow-[var(--shadow-card)] flex flex-col justify-between">
                    <div>
                      <h2 className="text-xl font-black mb-6 flex items-center gap-2 w-full border-b border-white/10 pb-4">
                         <FileText size={20} className="text-blue-400" /> Bias Report Card
                      </h2>
                      <div className="space-y-4 text-sm font-medium">
                        <p className="flex justify-between items-center">
                           <span className="text-slate-400">Fairness Score:</span> 
                           <span className={cn("font-black text-lg", report.fairnessScore < 60 ? "text-red-400" : "text-emerald-400")}>{report.fairnessScore}/100</span>
                        </p>
                        <p className="flex justify-between items-center">
                           <span className="text-slate-400">Risk Level:</span> 
                           <span className={cn("font-bold px-2 py-1 rounded-md text-xs uppercase tracking-wider", report.fairnessScore < 60 ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400")}>
                             {report.fairnessScore < 60 ? "High Risk" : "Low Risk"}
                           </span>
                        </p>
                        <p className="flex justify-between items-center">
                           <span className="text-slate-400">Bias Severity:</span> 
                           <span className="font-bold">{report.fairnessScore < 40 ? "🔴 High" : report.fairnessScore < 80 ? "🟡 Medium" : "🟢 Low"}</span>
                        </p>
                        <p className="flex justify-between items-center">
                           <span className="text-slate-400">Scanned Rows:</span> 
                           <span className="font-bold">{csvData.length.toLocaleString()} (100%)</span>
                        </p>
                        <p className="flex justify-between items-center">
                           <span className="text-slate-400">Detected Bias:</span> 
                           <span className="text-right max-w-[150px] truncate text-white">{report.biasTypes?.map(b => b.name).join(", ") || "None"}</span>
                        </p>
                        <p className="flex justify-between items-center">
                           <span className="text-slate-400">Confidence:</span> 
                           <span className="text-blue-400">{report.confidence || "High (AI-based)"}</span>
                        </p>
                      </div>
                    </div>
                    
                    <button onClick={downloadReport} className="w-full mt-8 py-3 bg-[var(--accent)] hover:bg-blue-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                       <Download size={18} /> Download Report
                    </button>
                  </div>

                  <div className="md:col-span-12 lg:col-span-8 bg-white rounded-3xl border border-[var(--border)] p-8 shadow-[var(--shadow-card)] flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-bold text-xl">AI Explanation</h3>
                      {report.confidence && (
                         <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold border border-slate-200 shadow-sm">
                           Confidence: <span className="text-blue-600">{report.confidence}</span>
                         </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {!report.biasTypes || report.biasTypes.length === 0 ? (
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-bold border border-emerald-100 flex items-center gap-1 shadow-sm">🟢 No Bias</span>
                      ) : (
                        report.biasTypes.map((bias, i) => {
                          const isHigh = bias.value > 60;
                          const isMed = bias.value > 30 && bias.value <= 60;
                          return (
                            <span key={i} className={cn("px-3 py-1 rounded-full text-sm font-bold border flex items-center gap-1 shadow-sm",
                              isHigh ? "bg-red-50 text-red-700 border-red-100" : isMed ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                            )}>
                                {isHigh ? "🔴" : isMed ? "🟡" : "🟢"} {bias.name}
                            </span>
                          )
                        })
                      )}
                    </div>

                    <p className="text-slate-600 leading-relaxed font-medium mb-6">{report.explanation}</p>
                    
                    <div style={{marginTop: "20px"}}>
                      <h3 className="font-bold text-lg mb-2">Fairness Tracker:</h3>
                      <div style={{
                        width: "100%",
                        height: "20px",
                        background: "#333",
                        borderRadius: "10px"
                      }}>
                        <div style={{
                          width: `${report.fairnessScore}%`,
                          height: "100%",
                          background: report.fairnessScore > 50 ? "green" : "red",
                          borderRadius: "10px",
                          transition: "width 1s ease-in-out"
                        }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-12 lg:col-span-6 bg-white rounded-3xl border border-[var(--border)] p-6 shadow-[var(--shadow-card)] flex flex-col">
                    <h3 className="font-bold text-lg mb-6">Bias Details & Impact</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={report.biasTypes} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                        <XAxis dataKey="name" stroke="#8884d8" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="md:col-span-12 lg:col-span-6 bg-white rounded-3xl border border-[var(--border)] p-6 shadow-[var(--shadow-card)] flex flex-col">
                    <h3 className="font-bold text-lg mb-6">Demographic Outcome Rates (%)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={demographicChartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                        <XAxis dataKey="name" stroke="#8884d8" />
                        <YAxis />
                        <Tooltip 
                          formatter={(value, name) => [`${value}%`, name]}
                          cursor={{fill: 'transparent'}}
                        />
                        <Legend />
                        {outcomeKeys.map((key, index) => (
                           <Bar key={key} dataKey={key} fill={colors[index % colors.length]} radius={[4, 4, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="md:col-span-12 bg-white rounded-3xl border border-[var(--border)] p-6 shadow-[var(--shadow-card)] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-lg mb-0">Demographic Outcome Detail List</h3>
                      <button 
                        onClick={downloadTotalOutcomeList}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors"
                      >
                        <FileDown size={16} /> Download Full List
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {demographicChartData.map((data, idx) => (
                        <div key={idx} className="p-4 border border-slate-100 rounded-xl bg-slate-50 flex flex-col gap-2 shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: colors[idx % colors.length] }} />
                          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                             <div className="font-bold text-slate-800 text-lg ml-2">{data.name}</div>
                             <div className="text-xs font-semibold text-slate-500">Total: {data._total} rows</div>
                          </div>
                          <div className="flex flex-col gap-1.5 mt-1 ml-2">
                             {outcomeKeys.map(key => (
                               data[key] !== undefined && (
                                 <div key={key} className="flex justify-between items-center text-sm p-1 -mx-1 rounded-md hover:bg-slate-100 transition-colors">
                                   <div className="font-medium text-slate-600 flex items-center gap-2">
                                     <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[outcomeKeys.indexOf(key) % colors.length] }} />
                                     {key}
                                   </div>
                                   <div className="flex items-center gap-3">
                                     <div className="font-bold tabular-nums">
                                        {data[key]}% <span className="text-slate-400 font-normal text-xs ml-1">({data[`_raw_${key}`]})</span>
                                     </div>
                                     <button 
                                       onClick={() => downloadPDFReport(data.name, key)}
                                       className="p-1 px-2 flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-100/60 hover:bg-blue-100 hover:text-blue-800 transition-colors rounded"
                                       title="Download list of users in this category"
                                     >
                                       <FileDown size={14} />
                                       List
                                     </button>
                                   </div>
                                 </div>
                               )
                             ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-12 bg-white rounded-3xl border border-[var(--border)] p-6 shadow-[var(--shadow-card)] flex flex-col justify-center">
                    {!showFixes ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-8">
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                           <ShieldAlert size={32} />
                        </div>
                        <h3 className="font-bold text-xl mb-2">Want to resolve these issues?</h3>
                        <p className="text-slate-500 mb-6 text-sm max-w-sm">Use our AI to automatically generate actionable engineering strategies to balance this dataset.</p>
                        <button 
                          onClick={getFix}
                          className="bg-[var(--accent)] text-white px-6 py-3 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-2"
                        >
                          Suggest Fix ✨
                        </button>
                      </div>
                    ) : (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col h-full">
                        <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                           <span className="text-[var(--accent)]">✨</span> AI Response
                        </h3>
                        <ul className="space-y-3">
                          {report.suggestions?.map((suggestion, idx) => (
                            <li key={idx} className="flex gap-3 text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                              <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                              <span className="text-sm font-medium leading-relaxed">{suggestion}</span>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </>
          )}

          {activeTab === 'library' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Data Library</h2>
              {history.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border border-[var(--border)] border-dashed text-center">
                  <Database className="mx-auto text-slate-300 mb-4" size={48} />
                  <p className="text-slate-500 font-medium">Your audited datasets will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {history.map((item, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-3xl border border-[var(--border)] shadow-sm hover:shadow-md transition-all group">
                      <div className="w-12 h-12 bg-blue-50 text-[var(--accent)] rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Database size={24} />
                      </div>
                      <h3 className="font-bold mb-1 truncate">{item.name}</h3>
                      <p className="text-xs text-[var(--text-muted)] mb-4">Audited on {item.date}</p>
                      <div className="flex items-center justify-between mt-auto">
                        <span className={cn("text-sm font-black", getScoreColor(item.score))}>{item.score}% Score</span>
                        <button onClick={() => { setReport(item.report); setActiveTab('dashboard'); }} className="text-xs font-bold text-[var(--accent)] hover:underline">View Audit →</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'detection' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Bias Detection Hub</h2>
              {report ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {report.biasTypes.map((bias, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-3xl border border-[var(--border)] shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                           <h3 className="font-bold text-lg capitalize">{bias.name}</h3>
                           <span className={cn("px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600")}>
                             {bias.value} Impact
                           </span>
                        </div>
                      </div>
                   ))}
                 </div>
              ) : <div className="bg-white p-12 rounded-3xl border border-[var(--border)] text-center text-slate-500 font-medium">Please run a Fairness Analysis from the dashboard to see detailed detection results.</div>}
            </div>
          )}

          {activeTab === 'explainers' && (
             <div className="space-y-6">
                <h2 className="text-2xl font-bold">Decision Explainers</h2>
                {report ? (
                  <div className="bg-white p-8 rounded-3xl border border-[var(--border)] shadow-sm max-w-3xl">
                     <h3 className="font-bold mb-8 text-lg">AI Simple Explanation:</h3>
                     <p className="text-slate-600 leading-relaxed font-medium">{report.explanation}</p>
                  </div>
                ) : <div className="bg-white p-12 rounded-3xl border border-[var(--border)] text-center text-slate-500 font-medium">Decision explainers require a successful dataset audit.</div>}
             </div>
          )}

          {activeTab === 'mitigation' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Mitigation Hub</h2>
              {report ? (
                <div className="bg-white p-8 rounded-3xl border border-[var(--border)] shadow-sm hover:shadow-md transition-all">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-6">
                    <ShieldAlert size={20} />
                  </div>
                  <h3 className="font-bold text-xl mb-4 text-slate-900">Suggested Strategies</h3>
                  <ul className="space-y-4">
                      {report.suggestions.map((step, sIdx) => (
                        <li key={sIdx} className="text-sm flex gap-4 text-slate-600 font-medium leading-relaxed">
                            <span className="w-5 h-5 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 text-[10px] font-black border border-slate-100">{sIdx + 1}</span>
                            {step}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : <div className="bg-white p-12 rounded-3xl border border-[var(--border)] text-center text-slate-500 font-medium">Run an audit to unlock custom mitigation strategies for your specific model risks.</div>}
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Fairness Reports Archive</h2>
              <div className="bg-white rounded-3xl border border-[var(--border)] overflow-hidden shadow-sm">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="p-5 text-xs font-black uppercase tracking-widest text-slate-400">Document</th>
                        <th className="p-5 text-xs font-black uppercase tracking-widest text-slate-400">Date Audited</th>
                        <th className="p-5 text-xs font-black uppercase tracking-widest text-slate-400">Bias Risk</th>
                        <th className="p-5 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {history.map((h, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                             <td className="p-5 text-sm font-bold tracking-tight">{h.name}</td>
                             <td className="p-5 text-sm text-[var(--text-muted)] font-medium">{h.date}</td>
                             <td className="p-5">
                                <div className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter", 
                                  h.score >= 80 ? 'bg-emerald-50 text-emerald-600' : h.score >= 60 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600')}>
                                   <div className={cn("w-1.5 h-1.5 rounded-full", h.score >= 80 ? 'bg-emerald-500' : h.score >= 60 ? 'bg-amber-500' : 'bg-red-500')} />
                                   {h.score >= 80 ? 'Safe Access' : h.score >= 60 ? 'Moderate Risk' : 'High Risk Alert'}
                                </div>
                             </td>
                             <td className="p-5 text-right">
                                <button onClick={() => { setReport(h.report); setActiveTab('dashboard'); }} className="px-4 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all">Re-open Report</button>
                             </td>
                          </tr>
                       ))}
                       {history.length === 0 && (
                         <tr><td colSpan={4} className="p-20 text-center text-slate-400 font-medium">No archived reports available. Start an audit to generate your first report.</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
             <div className="space-y-6">
                <h2 className="text-2xl font-bold">System Configuration</h2>
                <div className="bg-white p-8 rounded-3xl border border-[var(--border)] shadow-sm max-w-xl">
                   <div className="space-y-6">
                      <div className="flex justify-between items-center p-5 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all group">
                         <div>
                            <div className="text-sm font-bold tracking-tight">Deep Audit Engine</div>
                            <div className="text-[11px] text-slate-500 font-medium">Uses Gemini 2.0 Flash (with 1.5 Flash fallback) for exhaustive relational scanning.</div>
                         </div>
                         <div 
                           onClick={() => setDeepAudit(!deepAudit)}
                           className={cn("w-12 h-6 rounded-full relative cursor-pointer transition-colors", deepAudit ? "bg-blue-100 group-hover:bg-blue-200" : "bg-slate-100 group-hover:bg-slate-200")}
                         >
                           <div className={cn("absolute top-1 w-4 h-4 rounded-full shadow-sm transition-all", deepAudit ? "right-1 bg-[var(--accent)]" : "left-1 bg-slate-400")} />
                         </div>
                      </div>
                      <div className="flex justify-between items-center p-5 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all group">
                         <div>
                            <div className="text-sm font-bold tracking-tight">Smart Redaction (PII)</div>
                            <div className="text-[11px] text-slate-500 font-medium">Mask sensitive demographic identifiers during ingestion.</div>
                         </div>
                         <div 
                           onClick={() => setSmartRedaction(!smartRedaction)}
                           className={cn("w-12 h-6 rounded-full relative cursor-pointer transition-colors", smartRedaction ? "bg-blue-100 group-hover:bg-blue-200" : "bg-slate-100 group-hover:bg-slate-200")}
                         >
                           <div className={cn("absolute top-1 w-4 h-4 rounded-full shadow-sm transition-all", smartRedaction ? "right-1 bg-[var(--accent)]" : "left-1 bg-slate-400")} />
                         </div>
                      </div>
                      <div className="flex justify-between items-center p-5 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all group">
                         <div>
                            <div className="text-sm font-bold tracking-tight">Automated Compliance</div>
                            <div className="text-[11px] text-slate-500 font-medium">Enforce GDPR and AI Act fairness requirements.</div>
                         </div>
                         <div 
                           onClick={() => setAutoCompliance(!autoCompliance)}
                           className={cn("w-12 h-6 rounded-full relative cursor-pointer transition-colors", autoCompliance ? "bg-blue-100 group-hover:bg-blue-200" : "bg-slate-100 group-hover:bg-slate-200")}
                         >
                           <div className={cn("absolute top-1 w-4 h-4 rounded-full shadow-sm transition-all", autoCompliance ? "right-1 bg-[var(--accent)]" : "left-1 bg-slate-400")} />
                         </div>
                      </div>
                   </div>
                   <button 
                     onClick={handleSaveSettings}
                     disabled={isSavingSettings}
                     className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center disabled:opacity-80 active:scale-95"
                   >
                     {isSavingSettings ? (
                       <span className="flex items-center gap-2">
                         <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin"></div>
                         Saving...
                       </span>
                     ) : "Save Changes"}
                   </button>
                </div>
             </div>
          )}

          {activeTab === 'feedback' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Feedback</h2>
              <div className="bg-white p-8 rounded-3xl border border-[var(--border)] shadow-sm max-w-xl">
                 <p className="text-slate-600 mb-6 text-sm">We're constantly improving BiasGuard to better detect and explain AI biases. Share your thoughts or report an issue below.</p>
                 
                 {feedbackSuccess ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl flex items-center gap-4 text-emerald-800"
                    >
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                        <CheckCircle size={24} className="text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">Thank you for your feedback!</h4>
                        <p className="text-xs mt-1 text-emerald-600">Your message has been successfully submitted and will be reviewed by our team.</p>
                      </div>
                    </motion.div>
                 ) : (
                     <form onSubmit={(e) => { e.preventDefault(); handleFeedbackSubmit(); }}>
                       {feedbackError && (
                         <div className="mb-4 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl flex items-center gap-2">
                           <AlertTriangle size={18} />
                           {feedbackError}
                         </div>
                       )}
                       <div className="space-y-4">
                          <div>
                          <label className="block text-xs font-bold text-slate-700 tracking-tight uppercase mb-2">Subject</label>
                          <input 
                            type="text" 
                            required
                            maxLength={200}
                            value={feedbackSubject}
                            onChange={(e) => setFeedbackSubject(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" 
                            placeholder="E.g., Feature Request, Bug Report" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 tracking-tight uppercase mb-2">Message</label>
                          <textarea 
                            required
                            maxLength={5000}
                            value={feedbackMessage}
                            onChange={(e) => setFeedbackMessage(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm min-h-[150px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" 
                            placeholder="Enter your feedback here..."
                          ></textarea>
                        </div>
                     </div>
                     <button 
                       type="submit" 
                       disabled={isSubmittingFeedback || !feedbackSubject.trim() || !feedbackMessage.trim()}
                       className="w-full mt-6 py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                     >
                       {isSubmittingFeedback ? (
                         <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                       ) : (
                         <>
                           <MessageSquare size={16} /> Submit Feedback
                         </>
                       )}
                     </button>
                   </form>
                 )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Help Modal */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsHelpOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white max-w-2xl w-full max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden relative z-10 flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Instructions & Tutorial</h2>
                    <p className="text-sm text-slate-500">Learn how to use BiasGuard Effectively</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsHelpOpen(false)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 text-slate-600 space-y-8">
                <section>
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 mb-3">
                    <Upload size={18} className="text-blue-500" />
                    1. Upload Your Data
                  </h3>
                  <p className="leading-relaxed text-sm">
                    Start by uploading a CSV dataset from your system. BiasGuard analyzes structured tabular data. Make sure your dataset contains columns for demographics (e.g., race, gender, age) and outcomes (e.g., loan approval, hiring status).
                  </p>
                </section>
                
                <section>
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 mb-3">
                    <Settings size={18} className="text-blue-500" />
                    2. Configure Parameters
                  </h3>
                  <p className="leading-relaxed text-sm">
                    Once the file is read, you need to map two critical columns:
                  </p>
                  <ul className="list-disc ml-5 mt-2 text-sm space-y-1">
                    <li><strong>Sensitive Attribute:</strong> The demographic group column you want to test for bias against.</li>
                    <li><strong>Target Outcome:</strong> The column representing the decision or label assigned to each row.</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 mb-3">
                    <ShieldAlert size={18} className="text-blue-500" />
                    3. AI Bias Analysis
                  </h3>
                  <p className="leading-relaxed text-sm">
                    BiasGuard will calculate statistical disparity and employ Gemini's Deep Audit Engine to evaluate the dataset. Wait for the analysis to complete. The system will give you a Fairness Score out of 100 and identify risks like Disparate Impact or Representation Bias.
                  </p>
                </section>

                <section>
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 mb-3">
                    <AlertTriangle size={18} className="text-blue-500" />
                    4. Explanations & Mitigation
                  </h3>
                  <p className="leading-relaxed text-sm">
                    Review the findings. In the Dashboard:
                  </p>
                  <ul className="list-disc ml-5 mt-2 text-sm space-y-1">
                    <li>Switch to the <strong>Detailed Report</strong> to see exact rows that experienced severe negative biases.</li>
                    <li>Download row-level analysis or summary PDFs.</li>
                    <li>Click on <strong>Request AI Mitigation Strategies</strong> to get step-by-step techniques for addressing these blind spots in your data pipeline.</li>
                  </ul>
                  <div className="bg-blue-50 text-blue-800 p-4 rounded-xl mt-4 text-sm flex gap-3">
                    <Info size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <strong>Note:</strong> BiasGuard currently evaluates standard tabular classification outcomes. Your uploaded data never leaves this secure session.
                    </div>
                  </div>
                </section>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick, badge }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, badge?: React.ReactNode }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all font-semibold text-sm",
        active 
          ? "bg-blue-50 text-[var(--accent)] shadow-sm" 
          : "text-[var(--text-muted)] hover:bg-slate-50 hover:text-[var(--text-main)]"
      )}
    >
      <div className="flex items-center gap-3">
        {icon}
        {label}
      </div>
      {badge}
    </div>
  );
}
