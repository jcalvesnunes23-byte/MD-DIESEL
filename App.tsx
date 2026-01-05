
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
  ShieldCheck,
  RefreshCw,
  X
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { ServiceOrder, VehicleType, PaymentMethod, ServiceItem } from './types';
import Input from './components/Input';

const SUPABASE_URL = 'https://zozuufcvskbmdsppexsy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvenV1ZmN2c2tibWRzcHBleHN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMDQxNTIsImV4cCI6MjA4Mjc4MDE1Mn0.HZDeCp7ydx4AF_TirhdBoNxZ62xpDkUmzBFBz2JyEvo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// @ts-ignore
const html2pdf = window.html2pdf;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'form' | 'list' | 'prices'>('form');
  const [savedOrders, setSavedOrders] = useState<ServiceOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [priceSearchTerm, setPriceSearchTerm] = useState(''); 
  const [loading, setLoading] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<ServiceOrder | null>(null);
  
  const [showSplash, setShowSplash] = useState(false);
  const [isSplashClosing, setIsSplashClosing] = useState(false);

  const [priceCatalog, setPriceCatalog] = useState<Record<string, number>>({});
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemValue, setNewItemValue] = useState<string>('');

  const [companyProfile, setCompanyProfile] = useState<ServiceOrder['company']>({
    name: 'MD DIESEL',
    cnpj: '57.833.594/0001-39',
    phone: '(27) 99526-1557',
    logoUrl: 'https://zozuufcvskbmdsppexsy.supabase.co/storage/v1/object/public/assets/logo_md_diesel.png'
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);
  };

  const getErrorMessage = (err: any): string => {
    if (!err) return "Erro desconhecido";
    if (typeof err === 'string') return err;
    const msg = err.message || err.error_description || (err.error && err.error.message);
    const details = err.details || "";
    if (msg) return `${msg} ${details ? `(${details})` : ""}`;
    try {
      return JSON.stringify(err);
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
    fetchInitialData(); 
  }, []);

  const parseJsonValue = (val: any) => {
    if (!val) return {};
    if (typeof val === 'object' && val !== null) return val;
    try { return JSON.parse(val); } catch { return {}; }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const localOrders = localStorage.getItem('md_diesel_orders_v2');
      const localCatalog = localStorage.getItem('md_diesel_catalog_v2');
      
      if (localOrders) setSavedOrders(JSON.parse(localOrders));
      if (localCatalog) setPriceCatalog(JSON.parse(localCatalog));

      const { data: catalogData, error: catalogError } = await supabase.from('settings').select('value').eq('id', 'price_catalog').maybeSingle();
      if (!catalogError && catalogData?.value) {
        const remoteCatalog = parseJsonValue(catalogData.value);
        setPriceCatalog(remoteCatalog);
        localStorage.setItem('md_diesel_catalog_v2', JSON.stringify(remoteCatalog));
      }

      const { data: ordersData, error: ordersError } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (!ordersError && ordersData) {
        const remoteOrders = ordersData.map(item => item.content as ServiceOrder);
        setSavedOrders(remoteOrders);
        localStorage.setItem('md_diesel_orders_v2', JSON.stringify(remoteOrders));
      }

    } catch (err) {
      console.error("Erro no fetch:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItemToCatalog = async () => {
    const desc = newItemDesc.trim().toUpperCase();
    const cleanValue = newItemValue.toString().replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    const valueNum = parseFloat(cleanValue);

    if (!desc || isNaN(valueNum)) {
      alert("⚠️ Preencha descrição e valor corretamente.");
      return;
    }
    
    setLoading(true);
    try {
      const updatedCatalog = { ...priceCatalog, [desc]: valueNum };
      setPriceCatalog(updatedCatalog);
      localStorage.setItem('md_diesel_catalog_v2', JSON.stringify(updatedCatalog));

      const { error: saveError } = await supabase.from('settings').upsert({ id: 'price_catalog', value: updatedCatalog }, { onConflict: 'id' });
      
      if (saveError) {
        console.warn("Falha no backup online:", getErrorMessage(saveError));
        alert("✅ Salvo no computador!");
      } else {
        alert(`✅ "${desc}" salvo no catálogo!`);
      }

      setNewItemDesc('');
      setNewItemValue('');
      
    } catch (err) {
      alert("Erro ao processar item: " + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromCatalog = async (keyToRemove: string) => {
    if (!window.confirm(`Excluir "${keyToRemove}"?`)) return;
    
    const nextCatalog = { ...priceCatalog };
    delete nextCatalog[keyToRemove];
    
    setPriceCatalog(nextCatalog);
    localStorage.setItem('md_diesel_catalog_v2', JSON.stringify(nextCatalog));
    
    setLoading(true);
    await supabase.from('settings').upsert({ id: 'price_catalog', value: nextCatalog });
    setLoading(false);
  };

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

  const [order, setOrder] = useState<ServiceOrder>(() => createInitialOrder(savedOrders, companyProfile));

  const handleSaveOS = async () => {
    if (!order.client.name || !order.vehicle.plate) {
      alert("Preencha cliente e placa.");
      return;
    }
    setLoading(true);
    try {
      const newOrders = [order, ...savedOrders.filter(o => o.id !== order.id)];
      setSavedOrders(newOrders);
      localStorage.setItem('md_diesel_orders_v2', JSON.stringify(newOrders));

      const { error } = await supabase.from('orders').upsert({
        id: order.id,
        client_name: order.client.name,
        vehicle_plate: order.vehicle.plate,
        total_value: calculateTotal(order),
        content: order
      });
      
      if (error) console.warn("Erro ao sincronizar OS online:", getErrorMessage(error));
      
      alert("Ordem de Serviço salva!");
      setActiveTab('list');
    } catch(err) {
      alert("Erro crítico: " + getErrorMessage(err));
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

  const filteredCatalog = useMemo(() => {
    const search = priceSearchTerm.toLowerCase().trim();
    return Object.entries(priceCatalog)
      .filter(([key]) => key.toLowerCase().includes(search))
      .sort(([a], [b]) => a.localeCompare(b));
  }, [priceCatalog, priceSearchTerm]);

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
            <button onClick={() => { setActiveTab('prices'); setPriceSearchTerm(''); }} className={`px-4 sm:px-6 py-2 rounded-lg text-[10px] sm:text-xs font-black transition-all ${activeTab === 'prices' ? 'bg-white text-[#1b2e85] shadow-lg' : 'text-white/70 hover:bg-white/10'}`}>TABELA</button>
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
                    <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest">Valores Fixos (Apenas estes somam)</h3>
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
                    <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest">Descrição Técnica (Informativo)</h3>
                  </div>
                  <button onClick={() => setOrder({...order, serviceItems: [...(order.serviceItems || []), { description: '', value: 0 }]})} className="bg-[#1b2e85] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-sky-600 transition-all flex items-center gap-2">
                    <Plus size={14} /> Adicionar Linha
                  </button>
                </div>
                <div className="space-y-3">
                  {(order.serviceItems || []).map((item, index) => (
                    <div key={index} className="flex gap-3 items-end group">
                      <div className="flex-1">
                        <Input 
                          label={index === 0 ? "Descrição do Serviço" : ""} 
                          value={item.description} 
                          onChange={e => {
                            const val = e.target.value;
                            const newItems = (order.serviceItems || []).map((it, i) => {
                              if (i === index) {
                                const suggestedPrice = priceCatalog[val.trim().toUpperCase()];
                                return { ...it, description: val, value: suggestedPrice || it.value };
                              }
                              return it;
                            });
                            setOrder({...order, serviceItems: newItems});
                          }} 
                        />
                      </div>
                      <div className="w-32">
                        <Input 
                          label={index === 0 ? "Valor Ref. (R$)" : ""} 
                          type="number" 
                          value={item.value} 
                          onChange={e => setOrder({...order, serviceItems: (order.serviceItems || []).map((it, i) => i === index ? {...it, value: Number(e.target.value)} : it)})} 
                        />
                        <span className="text-[8px] text-slate-400 font-bold uppercase block text-center mt-1">Não soma no total</span>
                      </div>
                      <button onClick={() => { const ni = [...(order.serviceItems || [])]; ni.splice(index, 1); setOrder({...order, serviceItems: ni})}} className="p-3 text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash size={18}/></button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="md:col-span-2 bg-[#1b2e85] rounded-[30px] p-8 flex flex-col justify-center items-center text-center shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign size={80} className="text-white"/></div>
                <span className="text-sky-300 text-[10px] font-black uppercase mb-2 tracking-widest">TOTAL FINAL (FIXOS)</span>
                <div className="text-6xl font-black text-white italic drop-shadow-xl">R$ {formatCurrency(calculateTotal(order))}</div>
              </section>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button onClick={handleSaveOS} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-6 rounded-2xl font-black text-xl shadow-xl transition-all border-b-4 border-emerald-800 flex items-center justify-center gap-3 active:scale-95">
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
              {filteredOrders.length > 0 ? filteredOrders.map(item => (
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
                    <button onClick={() => { if(window.confirm("Deseja realmente excluir esta OS?")) { 
                      const nextOrders = savedOrders.filter(o => o.id !== item.id);
                      setSavedOrders(nextOrders);
                      localStorage.setItem('md_diesel_orders_v2', JSON.stringify(nextOrders));
                      supabase.from('orders').delete().match({id: item.id});
                    }}} className="bg-white p-4 rounded-2xl text-red-500 border border-slate-200 flex justify-center items-center hover:bg-red-500 hover:text-white transition-all shadow-sm"><Trash2 size={20} /></button>
                  </div>
                </div>
              )) : (
                <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300">
                   <History size={48} className="mx-auto text-slate-200 mb-4" />
                   <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Nenhuma Ordem de Serviço encontrada.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'prices' && (
          <div className="space-y-6 animate-in fade-in duration-500 pb-12">
            <div className="bg-[#1b2e85] p-6 sm:p-10 rounded-[40px] shadow-2xl border-b-8 border-sky-600">
               <div className="flex items-center justify-between mb-8">
                 <h3 className="text-white font-black text-lg uppercase tracking-widest flex items-center gap-4 italic">
                    <PlusCircle size={24} className="text-sky-400" /> ADICIONAR AO CATÁLOGO
                 </h3>
                 <button onClick={fetchInitialData} className="p-3 hover:bg-white/10 rounded-full text-sky-400 transition-all border border-white/5 active:scale-90">
                    <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
                 </button>
               </div>
               <div className="flex flex-col sm:flex-row gap-6 items-end">
                  <div className="flex-1 w-full">
                    <label className="text-[10px] font-black text-sky-300 uppercase mb-2 block tracking-widest ml-1">DESCRIÇÃO DO SERVIÇO / PEÇA</label>
                    <input 
                      type="text" 
                      value={newItemDesc} 
                      onChange={e => setNewItemDesc(e.target.value)} 
                      placeholder="EX: TROCA DE ÓLEO" 
                      className="w-full bg-[#1e2a66] border-2 border-white/10 rounded-[20px] px-6 py-4 font-black text-white text-sm outline-none focus:border-sky-400 focus:bg-[#253585] transition-all placeholder:text-white/20 shadow-inner" 
                    />
                  </div>
                  <div className="w-full sm:w-48">
                    <label className="text-[10px] font-black text-sky-300 uppercase mb-2 block tracking-widest ml-1">VALOR (R$)</label>
                    <input 
                      type="text" 
                      value={newItemValue} 
                      onChange={e => setNewItemValue(e.target.value)} 
                      placeholder="0,00"
                      className="w-full bg-[#1e2a66] border-2 border-white/10 rounded-[20px] px-6 py-4 font-black text-white text-sm outline-none focus:border-sky-400 focus:bg-[#253585] transition-all shadow-inner" 
                    />
                  </div>
                  <button 
                    onClick={handleAddItemToCatalog} 
                    disabled={loading} 
                    className="w-full sm:w-auto bg-[#38bdf8] hover:bg-sky-300 text-[#1b2e85] px-10 h-[60px] rounded-[22px] font-black text-sm uppercase shadow-[0_10px_20px_-5px_rgba(56,189,248,0.5)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95 shrink-0 border-b-4 border-sky-600"
                  >
                    {loading ? <Loader2 size={22} className="animate-spin" /> : <Plus size={22} strokeWidth={3} />}
                    {loading ? 'GRAVANDO...' : 'SALVAR NO BANCO'}
                  </button>
               </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
               <div className="flex items-center gap-3">
                 <div className="bg-sky-50 p-2.5 rounded-xl text-[#1b2e85]">
                   <Search size={20} />
                 </div>
                 <div>
                   <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Consultar Tabela</h4>
                   <p className="text-[9px] text-slate-400 font-bold uppercase">{filteredCatalog.length} itens encontrados</p>
                 </div>
               </div>
               <div className="relative w-full sm:w-96">
                 <input 
                    type="text" 
                    value={priceSearchTerm}
                    onChange={e => setPriceSearchTerm(e.target.value)}
                    placeholder="Procurar serviço ou peça..." 
                    className="w-full pl-6 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-[#1b2e85] font-black text-xs uppercase transition-all shadow-inner" 
                 />
                 {priceSearchTerm && (
                   <button onClick={() => setPriceSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors">
                     <X size={18} />
                   </button>
                 )}
               </div>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden mt-2">
               <table className="w-full text-left">
                  <thead className="bg-[#111827] text-white">
                    <tr>
                      <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em]">Serviço / Peça</th>
                      <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-right">Preço Sugerido</th>
                      <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-center w-40">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCatalog.length > 0 ? filteredCatalog.map(([key, val]) => (
                      <tr key={key} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                        <td className="px-8 py-6 font-black text-slate-700 uppercase text-sm tracking-tight">{key}</td>
                        <td className="px-8 py-6 text-right font-black text-[#1b2e85] italic text-xl">R$ {formatCurrency(val as number)}</td>
                        <td className="px-8 py-6 text-center">
                          <button 
                            onClick={(e) => { e.preventDefault(); handleRemoveFromCatalog(key); }} 
                            className="p-4 text-red-400 hover:text-red-600 hover:bg-red-50 transition-all rounded-2xl flex items-center justify-center mx-auto border border-transparent hover:border-red-100"
                          >
                            <Trash2 size={24}/>
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={3} className="px-8 py-20 text-center text-slate-400 font-black uppercase tracking-widest text-xs">
                           <div className="flex flex-col items-center gap-4">
                              <Search size={40} className="text-slate-200" />
                              <p>{priceSearchTerm ? `Nenhum resultado para "${priceSearchTerm}"` : "Nenhum serviço cadastrado ainda."}</p>
                           </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
               </table>
            </div>
          </div>
        )}
      </main>

      {previewOrder && (
        <div className="fixed inset-0 bg-slate-900/95 z-[300] flex flex-col items-center p-4 overflow-y-auto no-print backdrop-blur-sm">
            <div className="max-w-[210mm] w-full flex justify-between items-center mb-6 bg-white/10 p-5 rounded-3xl backdrop-blur-xl border border-white/10 shadow-2xl">
                <button onClick={() => setPreviewOrder(null)} className="text-white font-black text-xs uppercase flex items-center gap-3 hover:text-sky-400 transition-colors"><ArrowLeft size={20}/> VOLTAR AO APP</button>
                <div className="flex gap-4">
                  <button onClick={() => downloadPDF(previewOrder)} className="bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs flex items-center gap-3 shadow-xl hover:bg-emerald-400 transition-all active:scale-95"><FileDown size={20}/> SALVAR PDF</button>
                  <button onClick={() => window.print()} className="bg-sky-400 text-[#1b2e85] px-8 py-4 rounded-2xl font-black uppercase text-xs flex items-center gap-3 shadow-xl hover:bg-sky-300 transition-all active:scale-95"><Printer size={20}/> IMPRIMIR</button>
                </div>
            </div>
            <div id="pdf-content-to-print" className="bg-white w-[210mm] min-h-[297mm] p-[20mm] text-slate-800 shadow-2xl relative flex flex-col mx-auto mb-20 rounded-sm">
                <div className="border-b-[6px] border-[#1b2e85] pb-8 mb-10 flex justify-between items-end">
                   <div>
                      <h2 className="text-5xl font-black text-[#1b2e85] italic leading-none tracking-tighter">{previewOrder?.company?.name || 'MD DIESEL'}</h2>
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3">GESTÃO DE MANUTENÇÃO - MECÂNICA PESADA</p>
                   </div>
                   <div className="text-right">
                      <div className="bg-[#1b2e85] text-white px-8 py-3 rounded-2xl font-black text-3xl italic shadow-lg">OS: {previewOrder?.id}</div>
                      <p className="mt-3 font-black text-slate-500 text-[11px] uppercase">EMISSÃO: {previewOrder?.date}</p>
                   </div>
                </div>
                
                <div className="grid grid-cols-2 gap-6 mb-10">
                   <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                      <h4 className="text-[9px] font-black text-[#1b2e85] uppercase mb-3 tracking-widest border-b border-slate-200 pb-2">DADOS DO CLIENTE</h4>
                      <p className="text-sm font-black uppercase mb-1">{previewOrder?.client?.name || 'CONSUMIDOR FINAL'}</p>
                      <p className="text-[11px] text-slate-500 font-bold uppercase">DOC: {previewOrder?.client?.idNumber || '---'}</p>
                   </div>
                   <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                      <h4 className="text-[9px] font-black text-[#1b2e85] uppercase mb-3 tracking-widest border-b border-slate-200 pb-2">TÉCNICO RESPONSÁVEL</h4>
                      <p className="text-sm font-black uppercase mb-1">{previewOrder?.mechanic?.name || 'MD DIESEL'}</p>
                      <p className="text-[11px] text-slate-500 font-bold uppercase">CNPJ: {previewOrder?.mechanic?.idNumber || '---'}</p>
                   </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 mb-10">
                   <h4 className="text-[9px] font-black text-[#1b2e85] uppercase mb-3 tracking-widest border-b border-slate-200 pb-2">VEÍCULO E DIAGNÓSTICO</h4>
                   <div className="grid grid-cols-3 gap-4">
                      <div><p className="text-[10px] text-slate-400 font-black uppercase">PLACA</p><p className="text-sm font-black uppercase">{previewOrder?.vehicle?.plate || '---'}</p></div>
                      <div><p className="text-[10px] text-slate-400 font-black uppercase">MARCA/MODELO</p><p className="text-sm font-black uppercase">{previewOrder?.vehicle?.brand || '---'}</p></div>
                      <div><p className="text-[10px] text-slate-400 font-black uppercase">KM / HORAS</p><p className="text-sm font-black uppercase">{previewOrder?.vehicle?.mileage || '---'}</p></div>
                   </div>
                </div>

                <div className="border border-slate-200 rounded-3xl mb-10 overflow-hidden flex-1 shadow-sm">
                   <table className="w-full text-left border-collapse">
                      <thead className="bg-[#f8fafc] border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">DESCRIÇÃO DOS SERVIÇOS EXECUTADOS</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right text-slate-500 w-40">VALOR REF. (R$)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(previewOrder?.serviceItems || []).map((item: ServiceItem, i: number) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-6 py-4 text-xs uppercase font-black text-slate-700">{item?.description || 'SERVIÇO NÃO DESCRITO'}</td>
                            <td className="px-6 py-4 text-sm text-right font-black text-slate-300 italic">R$ {formatCurrency(item?.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>

                <div className="grid grid-cols-2 gap-10 items-end mb-16">
                   <div className="bg-slate-900 text-white p-6 rounded-3xl border-l-8 border-sky-400 shadow-xl">
                      <p className="text-[8px] font-black text-sky-400 uppercase mb-2 tracking-[0.4em]">MÉTODO DE PAGAMENTO</p>
                      <p className="text-lg font-black uppercase italic tracking-wider">{previewOrder?.paymentMethod || 'PIX'}</p>
                   </div>
                   <div className="border-2 border-[#1b2e85] rounded-[32px] overflow-hidden shadow-lg bg-white">
                      <div className="px-6 py-3 flex justify-between bg-slate-50 border-b border-slate-100 text-[10px] font-black">
                         <span className="text-slate-400 uppercase tracking-widest">MÃO DE OBRA</span>
                         <span className="text-[#1b2e85]">R$ {formatCurrency(previewOrder?.values?.labor || 0)}</span>
                      </div>
                      <div className="px-6 py-3 flex justify-between bg-slate-50 border-b border-slate-100 text-[10px] font-black">
                         <span className="text-slate-400 uppercase tracking-widest">DESLOCAMENTO</span>
                         <span className="text-[#1b2e85]">R$ {formatCurrency(previewOrder?.values?.travel || 0)}</span>
                      </div>
                      <div className="p-6 bg-[#1b2e85] text-white flex justify-between items-center">
                         <span className="font-black text-xs uppercase tracking-[0.2em]">TOTAL GERAL</span>
                         <span className="text-4xl font-black italic tracking-tighter">R$ {formatCurrency(calculateTotal(previewOrder as ServiceOrder))}</span>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-20 border-t-2 border-slate-100 pt-10 text-center mt-auto">
                   <div className="flex flex-col items-center">
                      <div className="h-0.5 w-full max-w-[200px] bg-slate-300 mb-3"></div>
                      <p className="font-black text-[9px] text-slate-400 uppercase tracking-[0.3em]">ASSINATURA DO CLIENTE</p>
                   </div>
                   <div className="flex flex-col items-center">
                      <div className="h-0.5 w-full max-w-[200px] bg-slate-300 mb-3"></div>
                      <p className="font-black text-[9px] text-slate-400 uppercase tracking-[0.3em]">MECÂNICO RESPONSÁVEL</p>
                   </div>
                </div>
            </div>
        </div>
      )}
      
      <footer className="py-12 bg-white border-t border-slate-200 mt-auto text-center">
        <p className="text-slate-300 text-[10px] font-black uppercase tracking-[0.6em] italic">MD DIESEL • SISTEMA DE GESTÃO PROFISSIONAL</p>
      </footer>
    </div>
  );
};

export default App;
