
import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, 
  Truck, 
  ClipboardList, 
  DollarSign, 
  Save, 
  History, 
  Trash2, 
  Search,
  Loader2,
  Download,
  ArrowLeft,
  Printer,
  FileDown,
  Plus,
  Trash,
  PlusCircle,
  ShieldCheck
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { ServiceOrder, VehicleType, PaymentMethod, ServiceItem } from './types';
import Input from './components/Input';

// Fallbacks para garantir o funcionamento caso as env vars do Vercel não estejam presentes no preview
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zozuufcvskbmdsppexsy.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvenV1ZmN2c2tibWRzcHBleHN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMDQxNTIsImV4cCI6MjA4Mjc4MDE1Mn0.HZDeCp7ydx4AF_TirhdBoNxZ62xpDkUmzBFBz2JyEvo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// @ts-ignore
const html2pdf = window.html2pdf;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'form' | 'list' | 'prices'>('form');
  const [savedOrders, setSavedOrders] = useState<ServiceOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<ServiceOrder | null>(null);
  
  const [showSplash, setShowSplash] = useState(false);
  const [isSplashClosing, setIsSplashClosing] = useState(false);

  const [priceCatalog, setPriceCatalog] = useState<Record<string, number>>({});
  
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemValue, setNewItemValue] = useState<number>(0);

  const [companyProfile, setCompanyProfile] = useState<ServiceOrder['company']>({
    name: 'MD DIESEL',
    cnpj: '57.833.594/0001-39',
    phone: '(27) 99526-1557',
    logoUrl: 'https://zozuufcvskbmdsppexsy.supabase.co/storage/v1/object/public/assets/logo_md_diesel.png'
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);
  };

  /**
   * Extrator de erro ultra-robusto para evitar [object Object]
   */
  const getErrorMessage = (err: any): string => {
    if (!err) return "Erro desconhecido";
    if (typeof err === 'string') return err;
    
    if (err.message && typeof err.message === 'string') {
      let details = "";
      if (err.details) details = ` - ${err.details}`;
      if (err.hint) details += ` (Dica: ${err.hint})`;
      return `${err.message}${details}`;
    }

    if (err.error) return getErrorMessage(err.error);

    try {
      const result = JSON.stringify(err);
      return result === '{}' ? String(err) : result;
    } catch {
      return String(err);
    }
  };

  useEffect(() => {
    if (loading) {
      setShowSplash(true);
      setIsSplashClosing(false);
    } else if (showSplash) {
      setIsSplashClosing(true);
      const timer = setTimeout(() => {
        setShowSplash(false);
        setIsSplashClosing(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  useEffect(() => { 
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      fetchInitialData(); 
    } else {
      console.error("Configurações do Supabase ausentes. Verifique as variáveis de ambiente.");
    }
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: profileData } = await supabase.from('settings').select('value').eq('id', 'company_profile').maybeSingle();
      if (profileData?.value) setCompanyProfile(prev => ({ ...prev, ...(profileData.value as any) }));

      try {
        const { data: catalogData } = await supabase.from('settings').select('value').eq('id', 'price_catalog').maybeSingle();
        if (catalogData?.value) {
          const cat = catalogData.value as Record<string, number>;
          setPriceCatalog(cat || {});
          localStorage.setItem('md_diesel_catalog', JSON.stringify(cat || {}));
        } else {
          const localCat = localStorage.getItem('md_diesel_catalog');
          if (localCat) setPriceCatalog(JSON.parse(localCat) || {});
        }
      } catch (e) {
        const localCat = localStorage.getItem('md_diesel_catalog');
        if (localCat) setPriceCatalog(JSON.parse(localCat) || {});
      }

      const { data: ordersData } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (ordersData) {
        setSavedOrders(ordersData.map(item => item.content as ServiceOrder));
      }
    } catch (err) {
      console.error("Erro no carregamento:", err);
    } finally { setLoading(false); }
  };

  const handleAddItemToCatalog = async () => {
    const desc = newItemDesc.trim().toUpperCase();
    if (!desc) {
      alert("Informe a descrição do serviço.");
      return;
    }
    
    setLoading(true);
    const updatedCatalog = { ...priceCatalog, [desc]: newItemValue };

    try {
      setPriceCatalog(updatedCatalog);
      localStorage.setItem('md_diesel_catalog', JSON.stringify(updatedCatalog));
      
      const { error } = await supabase.from('settings').upsert(
        [{ id: 'price_catalog', value: updatedCatalog }],
        { onConflict: 'id' }
      );
      
      if (error) throw error;
      
      setNewItemDesc('');
      setNewItemValue(0);
      alert("Item cadastrado!");
    } catch (err) {
      alert("Erro ao sincronizar catálogo: " + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromCatalog = async (keyToRemove: string) => {
    if (!window.confirm(`Deseja excluir permanentemente o item "${keyToRemove}"?`)) return;
    
    setLoading(true);
    
    const nextCatalog = Object.keys(priceCatalog)
      .filter(key => key !== keyToRemove)
      .reduce((acc, key) => {
        acc[key] = priceCatalog[key];
        return acc;
      }, {} as Record<string, number>);

    try {
      setPriceCatalog(nextCatalog);
      localStorage.setItem('md_diesel_catalog', JSON.stringify(nextCatalog));
      
      const { error } = await supabase.from('settings').upsert(
        [{ id: 'price_catalog', value: nextCatalog }],
        { onConflict: 'id' }
      );
      
      if (error) throw error;
      
    } catch (err) {
      console.error("Erro de sincronização:", err);
      alert("Erro ao sincronizar exclusão com o servidor: " + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calcula o total considerando apenas Mão de Obra e Deslocamento.
   * Os itens da descrição técnica são apenas informativos.
   */
  const calculateTotal = (targetOrder: ServiceOrder): number => {
    if (!targetOrder) return 0;
    const labor = targetOrder.values?.labor || 0;
    const travel = targetOrder.values?.travel || 0;
    return labor + travel;
  };

  const getNextNumericId = (orders: ServiceOrder[]) => {
    if (!orders || orders.length === 0) return 1;
    const numericIds = orders.map(o => {
      const digits = o?.id?.replace(/\D/g, '') || '0';
      return parseInt(digits, 10);
    });
    return Math.max(...numericIds, 0) + 1;
  };

  const formatId = (num: number) => `OS-${String(num).padStart(4, '0')}`;

  const createInitialOrder = (ordersList: ServiceOrder[], currentCompany: any): ServiceOrder => {
    return {
      id: formatId(getNextNumericId(ordersList)),
      date: new Date().toISOString().split('T')[0],
      company: { ...currentCompany },
      client: { name: '', idNumber: '', phone: '' },
      mechanic: { name: 'MD Diesel', idNumber: '57833594000139' },
      vehicle: { type: VehicleType.TRUCK, brand: '', model: '', plate: '', mileage: '' },
      serviceDescription: '',
      serviceItems: [{ description: '', value: 0 }],
      values: { labor: 0, travel: 0 },
      paymentMethod: PaymentMethod.PIX,
      observations: '',
      signatures: { client: '', mechanic: '' }
    };
  };

  const [order, setOrder] = useState<ServiceOrder>(() => createInitialOrder([], companyProfile));

  const handleSave = async () => {
    if (!order.client.name || !order.vehicle.plate) {
      alert("Preencha cliente e placa.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('orders').upsert({
        id: order.id,
        client_name: order.client.name,
        vehicle_plate: order.vehicle.plate,
        total_value: calculateTotal(order),
        content: order
      });
      if (error) throw error;
      await fetchInitialData();
      alert("OS Salva!");
      setActiveTab('list');
    } catch(err) {
      alert("Erro ao gravar: " + getErrorMessage(err));
    } finally { setLoading(false); }
  };

  const downloadPDF = async (targetOrder: ServiceOrder) => {
    const element = document.getElementById('pdf-content-to-print');
    if (!element) return;
    setLoading(true);
    try {
      const opt = {
        margin: 0,
        filename: `OS_${targetOrder.id}.pdf`,
        image: { type: 'jpeg', quality: 1 },
        html2canvas: { scale: 3, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      await html2pdf().set(opt).from(element).save();
    } finally { setLoading(false); }
  };

  const filteredOrders = useMemo(() => {
    return savedOrders.filter(o => {
      const search = searchTerm.toLowerCase();
      return (o?.client?.name?.toLowerCase() || '').includes(search) || 
             (o?.vehicle?.plate?.toLowerCase() || '').includes(search);
    });
  }, [savedOrders, searchTerm]);

  return (
    <div className="min-h-screen flex flex-col text-slate-900 bg-[#f1f5f9] overflow-x-hidden">
      <header className="fixed top-0 left-0 right-0 h-[135px] lg:h-[90px] bg-[#1b2e85] text-white shadow-2xl z-[100] border-b-4 border-sky-500 flex items-center">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 flex flex-col lg:flex-row justify-between items-center gap-3">
          <div className="text-center lg:text-left">
             <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter leading-none text-glow italic">MD DIESEL</h1>
             <p className="text-[10px] sm:text-[11px] font-black text-sky-400 uppercase tracking-[0.4em] mt-1 lg:mt-2">MECÂNICA PESADA</p>
          </div>
          <nav className="flex bg-white/10 p-1 rounded-xl backdrop-blur-md border border-white/20">
            <button onClick={() => { setOrder(createInitialOrder(savedOrders, companyProfile)); setActiveTab('form'); }} className={`px-4 sm:px-6 py-2 rounded-lg text-[10px] sm:text-xs font-black transition-all ${activeTab === 'form' ? 'bg-white text-[#1b2e85] shadow-lg' : 'text-white/70 hover:bg-white/10'}`}>NOVA OS</button>
            <button onClick={() => { setActiveTab('list'); setSearchTerm(''); }} className={`px-4 sm:px-6 py-2 rounded-lg text-[10px] sm:text-xs font-black transition-all ${activeTab === 'list' ? 'bg-white text-[#1b2e85] shadow-lg' : 'text-white/70 hover:bg-white/10'}`}>HISTÓRICO</button>
            <button onClick={() => { setActiveTab('prices'); setSearchTerm(''); }} className={`px-4 sm:px-6 py-2 rounded-lg text-[10px] sm:text-xs font-black transition-all ${activeTab === 'prices' ? 'bg-white text-[#1b2e85] shadow-lg' : 'text-white/70 hover:bg-white/10'}`}>TABELA</button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full p-4 sm:p-6 flex-1 mt-[150px] lg:mt-[110px]">
        {showSplash && (
          <div className={`fixed inset-0 bg-[#1b2e85] z-[200] flex flex-col items-center justify-center transition-all duration-500 ${isSplashClosing ? 'animate-splash-out' : 'animate-splash-in'}`}>
            <h2 className="text-5xl sm:text-8xl font-black text-white italic tracking-tighter text-glow uppercase animate-pulse">MD Diesel</h2>
            <div className="h-1.5 w-32 bg-sky-400 mt-6 rounded-full shadow-lg"></div>
          </div>
        )}

        {activeTab === 'form' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-12">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
               <h2 className="text-xl font-black text-slate-800 uppercase italic">Registro de OS</h2>
               <div className="text-right">
                 <span className="text-[9px] font-black text-slate-400 block uppercase tracking-widest text-center">Nº</span>
                 <span className="text-2xl font-black text-[#1b2e85] italic">{order.id}</span>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <User size={18} className="text-[#1b2e85]" />
                  <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest">Dados do Cliente</h3>
                </div>
                <Input label="Nome ou Razão Social" value={order.client?.name || ''} onChange={e => setOrder({...order, client: {...order.client, name: e.target.value}})} placeholder="Nome do cliente" />
                <Input label="CPF/CNPJ" value={order.client?.idNumber || ''} onChange={e => setOrder({...order, client: {...order.client, idNumber: e.target.value}})} placeholder="000.000.000-00" />
              </section>

              <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 border-t-4 border-t-[#1b2e85]">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <ShieldCheck size={18} className="text-[#1b2e85]" />
                  <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest">Responsável Técnico</h3>
                </div>
                <Input label="Nome do Mecânico" value={order.mechanic?.name || ''} onChange={e => setOrder({...order, mechanic: {...order.mechanic, name: e.target.value}})} placeholder="Mecânico responsável" />
                <Input label="CPF/CNPJ" value={order.mechanic?.idNumber || ''} onChange={e => setOrder({...order, mechanic: {...order.mechanic, idNumber: e.target.value}})} placeholder="000.000.000-00" />
              </section>

              <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Truck size={18} className="text-[#1b2e85]" />
                  <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest">Dados do Veículo</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Placa" value={order.vehicle?.plate || ''} onChange={e => setOrder({...order, vehicle: {...order.vehicle, plate: e.target.value}})} placeholder="ABC-1234" />
                  <Input label="KM/Horas" value={order.vehicle?.mileage || ''} onChange={e => setOrder({...order, vehicle: {...order.vehicle, mileage: e.target.value}})} placeholder="00000" />
                </div>
                <Input label="Marca/Modelo" value={order.vehicle?.brand || ''} onChange={e => setOrder({...order, vehicle: {...order.vehicle, brand: e.target.value}})} placeholder="Ex: Scania R450" />
              </section>

              <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                 <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <DollarSign size={18} className="text-[#1b2e85]" />
                    <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest">Valores & Pagamento</h3>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <Input label="Mão de Obra (R$)" type="number" value={order.values?.labor || 0} onChange={e => setOrder({...order, values: {...order.values, labor: Number(e.target.value)}})} />
                    <Input label="Deslocamento (R$)" type="number" value={order.values?.travel || 0} onChange={e => setOrder({...order, values: {...order.values, travel: Number(e.target.value)}})} />
                 </div>
                 <div className="flex flex-col gap-1">
                   <label className="text-[11px] font-bold uppercase text-slate-500">Forma de Pagamento</label>
                   <select value={order.paymentMethod} onChange={e => setOrder({...order, paymentMethod: e.target.value as PaymentMethod})} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 font-medium text-slate-800 text-sm outline-none focus:border-[#1b2e85]">
                     {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                   </select>
                 </div>
              </section>

              <section className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={18} className="text-[#1b2e85]" />
                    <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest">Descrição Técnica dos Serviços</h3>
                  </div>
                  <button onClick={() => setOrder({...order, serviceItems: [...(order.serviceItems || []), { description: '', value: 0 }]})} className="bg-[#1b2e85] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-sky-600 transition-all flex items-center gap-2">
                    <Plus size={14} /> Adicionar Linha
                  </button>
                </div>
                <div className="space-y-3">
                  {(order.serviceItems || []).map((item, index) => (
                    <div key={index} className="flex gap-3 items-end group">
                      <div className="flex-1"><Input label={index === 0 ? "Descrição do Serviço" : ""} value={item.description} onChange={e => setOrder({...order, serviceItems: (order.serviceItems || []).map((it, i) => i === index ? {...it, description: e.target.value} : it)})} /></div>
                      <div className="w-32"><Input label={index === 0 ? "Valor Ref. (R$)" : ""} type="number" value={item.value} onChange={e => setOrder({...order, serviceItems: (order.serviceItems || []).map((it, i) => i === index ? {...it, value: Number(e.target.value)} : it)})} /></div>
                      <button onClick={() => { const ni = [...(order.serviceItems || [])]; ni.splice(index, 1); setOrder({...order, serviceItems: ni})}} className="p-3 text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash size={18}/></button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="md:col-span-2 bg-[#1b2e85] rounded-[30px] p-8 flex flex-col justify-center items-center text-center shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign size={80} className="text-white"/></div>
                <span className="text-sky-300 text-[10px] font-black uppercase mb-2 tracking-widest">TOTAL FINAL DA ORDEM</span>
                <div className="text-6xl font-black text-white italic drop-shadow-xl">R$ {formatCurrency(calculateTotal(order))}</div>
              </section>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button onClick={handleSave} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-6 rounded-2xl font-black text-xl shadow-xl transition-all border-b-4 border-emerald-800 flex items-center justify-center gap-3 active:scale-95">
                <Save size={26} /> SALVAR ORDEM DE SERVIÇO
              </button>
              <button onClick={() => setPreviewOrder(order)} className="bg-sky-600 hover:bg-sky-500 text-white px-10 py-6 rounded-2xl font-black text-xl shadow-xl transition-all border-b-4 border-sky-800 flex items-center justify-center gap-3 active:scale-95">
                <FileDown size={26} /> GERAR PREVIEW PDF
              </button>
            </div>
          </div>
        )}

        {activeTab === 'list' && (
          <div className="space-y-6 animate-in fade-in duration-500 pb-12">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
               <h2 className="text-xl font-black text-slate-800 uppercase italic">Histórico de OS</h2>
               <div className="relative w-full sm:w-80">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input type="text" placeholder="Buscar placa ou cliente..." className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1b2e85] font-bold text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
               </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOrders.map(item => (
                <div key={item?.id} className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden flex flex-col group border-b-4 border-b-slate-200 hover:border-b-[#1b2e85] transition-all">
                  <div className="p-7 flex-1">
                    <div className="flex justify-between items-start mb-5">
                      <span className="bg-[#1b2e85] text-white px-4 py-1.5 rounded-xl text-[10px] font-black italic">{item?.id}</span>
                      <span className="text-[10px] font-black text-slate-300 uppercase">{item?.date}</span>
                    </div>
                    <h4 className="font-black text-slate-900 text-xl uppercase truncate mb-1">{item?.client?.name || 'Sem Nome'}</h4>
                    <p className="text-[11px] font-black text-sky-600 uppercase tracking-widest">{item?.vehicle?.plate || '---'}</p>
                    <div className="pt-5 border-t border-slate-50 text-2xl font-black text-[#1b2e85] italic mt-4">R$ {formatCurrency(calculateTotal(item))}</div>
                  </div>
                  <div className="bg-slate-50 p-5 grid grid-cols-3 gap-3 border-t border-slate-100">
                    <button onClick={() => { setOrder(item); setActiveTab('form'); window.scrollTo({ top: 0, left: 0 }); }} className="bg-white p-4 rounded-2xl text-[#1b2e85] border border-slate-200 flex justify-center items-center hover:bg-[#1b2e85] hover:text-white transition-all shadow-sm"><History size={20} /></button>
                    <button onClick={() => setPreviewOrder(item)} className="bg-white p-4 rounded-2xl text-sky-600 border border-slate-200 flex justify-center items-center hover:bg-sky-600 hover:text-white transition-all shadow-sm"><Download size={20} /></button>
                    <button onClick={() => { if(window.confirm("Deseja realmente excluir esta OS?")) { supabase.from('orders').delete().match({id: item.id}).then(() => fetchInitialData()) } }} className="bg-white p-4 rounded-2xl text-red-500 border border-slate-200 flex justify-center items-center hover:bg-red-500 hover:text-white transition-all shadow-sm"><Trash2 size={20} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'prices' && (
          <div className="space-y-6 animate-in fade-in duration-500 pb-12">
            <div className="bg-[#1b2e85] p-8 rounded-3xl shadow-xl border-b-4 border-sky-500">
               <div className="flex items-center justify-between mb-6">
                 <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-3"><PlusCircle size={20} /> Cadastrar no Catálogo</h3>
                 {loading && <Loader2 className="animate-spin text-sky-400" size={24} />}
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-sky-300 uppercase mb-1.5 block">Descrição do Serviço / Peça</label>
                    <input type="text" value={newItemDesc} onChange={e => setNewItemDesc(e.target.value)} placeholder="Ex: TROCA DE TURBINA" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 font-black text-white text-xs outline-none focus:bg-white/20 placeholder:text-white/30" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-sky-300 uppercase mb-1.5 block">Valor (R$)</label>
                    <input type="number" value={newItemValue} onChange={e => setNewItemValue(Number(e.target.value))} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 font-black text-white text-xs outline-none focus:bg-white/20" />
                  </div>
                  <button onClick={handleAddItemToCatalog} disabled={loading} className="bg-sky-400 hover:bg-sky-300 text-[#1b2e85] py-3.5 rounded-xl font-black text-xs uppercase shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    <Plus size={18} /> {loading ? 'AGUARDE...' : 'CADASTRAR'}
                  </button>
               </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
               <table className="w-full text-left">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Serviço / Peça</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">Preço Sugerido</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center w-32">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceCatalog && Object.entries(priceCatalog).length > 0 ? Object.entries(priceCatalog).map(([key, val]) => (
                      <tr key={key} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-black text-slate-700 uppercase text-xs">{key}</td>
                        <td className="px-6 py-4 text-right font-black text-[#1b2e85] italic text-base">R$ {formatCurrency(val as number)}</td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={(e) => { e.preventDefault(); handleRemoveFromCatalog(key); }} 
                            disabled={loading}
                            className="p-3 text-red-500 hover:bg-red-50 transition-all rounded-xl disabled:opacity-50 flex items-center justify-center mx-auto"
                            title="Remover permanentemente"
                          >
                            <Trash2 size={20}/>
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">O catálogo está vazio.</td>
                      </tr>
                    )}
                  </tbody>
               </table>
            </div>
          </div>
        )}
      </main>

      {/* PREVIEW PDF */}
      {previewOrder && (
        <div className="fixed inset-0 bg-slate-900/90 z-[300] flex flex-col items-center p-4 overflow-y-auto no-print">
            <div className="max-w-[210mm] w-full flex justify-between items-center mb-6 bg-white/10 p-4 rounded-2xl backdrop-blur-md">
                <button onClick={() => setPreviewOrder(null)} className="text-white font-black text-xs uppercase flex items-center gap-2 hover:text-sky-400"><ArrowLeft size={18}/> FECHAR PREVIEW</button>
                <button onClick={() => downloadPDF(previewOrder)} className="bg-sky-400 text-[#1b2e85] px-6 py-3 rounded-xl font-black uppercase text-xs flex items-center gap-2 shadow-xl hover:bg-sky-300"><Printer size={18}/> IMPRIMIR / SALVAR PDF</button>
            </div>
            
            <div id="pdf-content-to-print" className="bg-white w-[210mm] min-h-[297mm] p-[15mm] text-slate-800 shadow-2xl relative flex flex-col">
                <div className="border-b-[5px] border-[#1b2e85] pb-6 mb-8 flex justify-between items-end">
                   <div>
                      <h2 className="text-4xl font-black text-[#1b2e85] italic leading-none">{previewOrder?.company?.name || 'MD DIESEL'}</h2>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">GESTÃO DE MANUTENÇÃO - MECÂNICA PESADA</p>
                   </div>
                   <div className="text-right">
                      <div className="bg-[#1b2e85] text-white px-6 py-2 rounded-xl font-black text-2xl italic">OS: {previewOrder?.id}</div>
                      <p className="mt-2 font-black text-slate-400 text-[10px]">DATA: {previewOrder?.date}</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="text-[8px] font-black text-[#1b2e85] uppercase mb-2 tracking-widest">DADOS DO CLIENTE</h4>
                      <p className="text-xs font-black uppercase">{previewOrder?.client?.name || '---'}</p>
                      <p className="text-[10px] text-slate-500 uppercase">DOC: {previewOrder?.client?.idNumber || '---'}</p>
                   </div>
                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="text-[8px] font-black text-[#1b2e85] uppercase mb-2 tracking-widest">RESPONSÁVEL TÉCNICO</h4>
                      <p className="text-xs font-black uppercase">{previewOrder?.mechanic?.name || '---'}</p>
                      <p className="text-[10px] text-slate-500 uppercase">DOC: {previewOrder?.mechanic?.idNumber || '---'}</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 gap-4 mb-8">
                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="text-[8px] font-black text-[#1b2e85] uppercase mb-2 tracking-widest">VEÍCULO</h4>
                      <p className="text-xs font-black uppercase">PLACA: {previewOrder?.vehicle?.plate || '---'} | MODELO: {previewOrder?.vehicle?.brand || '---'}</p>
                      <p className="text-[10px] text-slate-500">KM / HORAS: {previewOrder?.vehicle?.mileage || '---'}</p>
                   </div>
                </div>

                <div className="border border-slate-200 rounded-xl mb-8 overflow-hidden flex-1">
                   <table className="w-full text-left">
                      <thead className="bg-slate-100 border-b border-slate-200">
                        <tr><th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest">DESCRIÇÃO DOS SERVIÇOS</th><th className="px-4 py-3 text-[9px] font-black uppercase text-right w-32">VALOR REF.</th></tr>
                      </thead>
                      <tbody>
                        {(previewOrder?.serviceItems || []).map((item: ServiceItem, i: number) => (
                          <tr key={i} className="border-t border-slate-50">
                            <td className="px-4 py-2.5 text-xs uppercase font-medium">{item?.description || '---'}</td>
                            <td className="px-4 py-2.5 text-xs text-right font-bold">R$ {formatCurrency(item?.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>

                <div className="grid grid-cols-2 gap-8 items-end mb-12">
                   <div className="bg-slate-900 text-white p-5 rounded-2xl border-l-4 border-sky-400">
                      <p className="text-[7px] font-black text-sky-400 uppercase mb-1 tracking-widest">PAGAMENTO</p>
                      <p className="text-sm font-black uppercase italic">{previewOrder?.paymentMethod || 'Pix'}</p>
                   </div>
                   <div className="border-2 border-[#1b2e85] rounded-2xl overflow-hidden">
                      <div className="px-4 py-2 flex justify-between bg-slate-50 border-b border-slate-100 text-[9px] font-bold">
                         <span className="text-slate-400 uppercase">MÃO DE OBRA</span>
                         <span className="text-[#1b2e85]">R$ {formatCurrency(previewOrder?.values?.labor || 0)}</span>
                      </div>
                      <div className="px-4 py-2 flex justify-between bg-slate-50 border-b border-slate-100 text-[9px] font-bold">
                         <span className="text-slate-400 uppercase">DESLOCAMENTO</span>
                         <span className="text-[#1b2e85]">R$ {formatCurrency(previewOrder?.values?.travel || 0)}</span>
                      </div>
                      <div className="p-4 bg-[#1b2e85] text-white flex justify-between items-center">
                         <span className="font-black text-[10px] uppercase">VALOR TOTAL</span>
                         <span className="text-3xl font-black italic">R$ {formatCurrency(calculateTotal(previewOrder as ServiceOrder))}</span>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-16 border-t border-slate-200 pt-6 text-center mt-auto">
                   <div>
                      <div className="h-0.5 w-full bg-slate-300 mb-2"></div>
                      <p className="font-black text-[8px] text-slate-400 uppercase tracking-widest">ASSINATURA CLIENTE</p>
                   </div>
                   <div>
                      <div className="h-0.5 w-full bg-slate-300 mb-2"></div>
                      <p className="font-black text-[8px] text-slate-400 uppercase tracking-widest">MECÂNICO RESPONSÁVEL</p>
                   </div>
                </div>
            </div>
        </div>
      )}
      
      <footer className="py-12 bg-white border-t border-slate-200 mt-auto text-center">
        <p className="text-slate-300 text-[10px] font-black uppercase tracking-[0.6em] italic">MD DIESEL • GESTÃO DE MANUTENÇÃO PESADA</p>
      </footer>
    </div>
  );
};

export default App;
