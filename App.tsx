
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  User, 
  Truck, 
  ClipboardList, 
  DollarSign, 
  Save, 
  PlusCircle, 
  History, 
  Trash2, 
  Search,
  Loader2,
  Download,
  Settings,
  Calendar,
  CreditCard,
  FileText,
  ArrowLeft,
  Printer,
  FileDown
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { ServiceOrder, VehicleType, PaymentMethod } from './types';
import Input from './components/Input';

const SUPABASE_URL = 'https://zozuufcvskbmdsppexsy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvenV1ZmN2c2tibWRzcHBleHN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMDQxNTIsImV4cCI6MjA4Mjc4MDE1Mn0.HZDeCp7ydx4AF_TirhdBoNxZ62xpDkUmzBFBz2JyEvo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// @ts-ignore
const html2pdf = window.html2pdf;

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'list'>('form');
  const [savedOrders, setSavedOrders] = useState<ServiceOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<ServiceOrder | null>(null);
  const [currentLogo, setCurrentLogo] = useState('https://zozuufcvskbmdsppexsy.supabase.co/storage/v1/object/public/assets/logo_md_diesel.png');

  const getNextNumericId = (orders: ServiceOrder[]) => {
    if (!orders || orders.length === 0) return 1;
    const numericIds = orders.map(o => {
      const digits = o.id.replace(/\D/g, '');
      return digits ? parseInt(digits, 10) : 0;
    });
    const maxId = Math.max(...numericIds, 0);
    return maxId + 1;
  };

  const formatId = (num: number) => `OS-${String(num).padStart(4, '0')}`;

  const createInitialOrder = (ordersList: ServiceOrder[]): ServiceOrder => {
    const nextNum = getNextNumericId(ordersList);
    return {
      id: formatId(nextNum),
      date: new Date().toISOString().split('T')[0],
      company: { name: 'MD DIESEL', cnpj: '', phone: '', logoUrl: currentLogo },
      client: { name: '', idNumber: '', phone: '' },
      vehicle: { type: VehicleType.TRUCK, brand: '', model: '', plate: '', mileage: '' },
      serviceDescription: '',
      values: { labor: 0, travel: 0 },
      paymentMethod: PaymentMethod.PIX,
      observations: '',
      signatures: { client: '', mechanic: '' }
    };
  };

  const [order, setOrder] = useState<ServiceOrder>(() => createInitialOrder([]));

  useEffect(() => { fetchInitialData(); }, []);

  useEffect(() => {
    if (activeTab === 'form' && !order.client.name && !order.vehicle.plate) {
      const nextId = formatId(getNextNumericId(savedOrders));
      if (order.id !== nextId) {
        setOrder(prev => ({ ...prev, id: nextId }));
      }
    }
  }, [savedOrders, activeTab]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: settingsData } = await supabase.from('settings').select('value').eq('id', 'official_logo').single();
      if (settingsData?.value) setCurrentLogo(settingsData.value);
      const { data: ordersData, error: ordersError } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (ordersError) throw ordersError;
      if (ordersData) {
        const mappedOrders = ordersData.map(item => item.content as ServiceOrder);
        setSavedOrders(mappedOrders);
      }
    } catch (err) {
      const localData = localStorage.getItem('md_diesel_orders');
      if (localData) setSavedOrders(JSON.parse(localData));
    } finally { setLoading(false); }
  };

  const handleNewOrder = () => {
    setOrder(createInitialOrder(savedOrders));
    setActiveTab('form');
    window.scrollTo(0, 0);
  };

  const handleSave = async () => {
    if (!order.client.name || !order.vehicle.plate) {
      alert("Por favor, preencha o nome do cliente e a placa.");
      return;
    }
    setLoading(true);
    try {
      const orderToSave = { ...order, company: { ...order.company, logoUrl: currentLogo } };
      await supabase.from('orders').upsert({
        id: order.id,
        client_name: order.client.name,
        vehicle_plate: order.vehicle.plate,
        total_value: order.values.labor + order.values.travel,
        content: orderToSave
      });
      const exists = savedOrders.find(o => o.id === order.id);
      const newOrders = exists 
        ? savedOrders.map(o => o.id === order.id ? orderToSave : o) 
        : [orderToSave, ...savedOrders];
      setSavedOrders(newOrders);
      localStorage.setItem('md_diesel_orders', JSON.stringify(newOrders));
      alert("Ordem de Serviço salva!");
      setActiveTab('list');
    } catch(err) {
      alert("Erro ao salvar no servidor.");
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    const msg = `🛑 EXCLUIR OS ${id}?\n\nEsta ordem será apagada permanentemente do sistema. Confirma?`;
    if (!window.confirm(msg)) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('orders').delete().match({ id: id });
      if (error) throw error;
      setSavedOrders(prev => {
        const filtered = prev.filter(o => o.id !== id);
        localStorage.setItem('md_diesel_orders', JSON.stringify(filtered));
        return filtered;
      });
      alert(`A OS ${id} foi excluída com sucesso.`);
    } catch (err) {
      alert("Falha na exclusão. Verifique sua conexão.");
    } finally { setLoading(false); }
  };

  const downloadPDF = async (targetOrder: ServiceOrder) => {
    const element = document.getElementById('pdf-content-to-print');
    if (!element) return;
    setLoading(true);
    try {
      const opt = {
        margin: 0,
        filename: `OS_${targetOrder.id}_MD_DIESEL.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      await html2pdf().set(opt).from(element).save();
    } finally { setLoading(false); }
  };

  const filteredOrders = useMemo(() => {
    const filtered = savedOrders.filter(o => 
      o.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return filtered.sort((a, b) => {
      const numA = parseInt(a.id.replace(/\D/g, '') || "0", 10);
      const numB = parseInt(b.id.replace(/\D/g, '') || "0", 10);
      return numB - numA;
    });
  }, [savedOrders, searchTerm]);

  if (previewOrder) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center p-4 no-print animate-in zoom-in-95 duration-300">
        <div className="max-w-[210mm] w-full flex justify-between items-center mb-6">
           <button onClick={() => setPreviewOrder(null)} className="flex items-center gap-2 text-white/50 hover:text-white font-black text-xs uppercase transition-all">
             <ArrowLeft size={18} /> VOLTAR
           </button>
           <button onClick={() => downloadPDF(previewOrder)} className="bg-sky-500 hover:bg-sky-400 text-white px-8 py-3 rounded-xl font-black shadow-xl flex items-center gap-3 text-sm uppercase">
             <Printer size={20} /> BAIXAR PDF
           </button>
        </div>

        <div id="pdf-content-to-print" className="bg-white w-[210mm] h-[297mm] p-[15mm] text-slate-800 flex flex-col shadow-2xl relative overflow-hidden">
            <div className="border-b-[4px] border-[#1b2e85] pb-4 mb-6 flex justify-between items-end">
               <div>
                  <h2 className="text-5xl font-black text-[#1b2e85] tracking-tighter mb-1 uppercase italic">MD DIESEL</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mecânica Pesada Diesel</p>
               </div>
               <div className="text-right">
                  <div className="bg-[#1b2e85] text-white px-5 py-2 rounded-xl font-black text-xl italic inline-block">OS: {previewOrder.id}</div>
                  <p className="mt-2 font-black text-slate-400 text-[10px] uppercase">Emitido: {new Date(previewOrder.date).toLocaleDateString('pt-BR')}</p>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
               <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <h4 className="text-[8px] font-black text-[#1b2e85] uppercase mb-2">CLIENTE</h4>
                  <p className="text-lg font-black text-slate-900 leading-tight uppercase">{previewOrder.client.name || '---'}</p>
                  <p className="text-[10px] text-slate-500">Documento/CPF: {previewOrder.client.idNumber || '---'}</p>
               </div>
               <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <h4 className="text-[8px] font-black text-[#1b2e85] uppercase mb-2">VEÍCULO</h4>
                  <p className="text-lg font-black text-slate-900 leading-tight uppercase">{previewOrder.vehicle.brand} {previewOrder.vehicle.model}</p>
                  <p className="text-[10px] text-slate-500 font-bold">Placa: <span className="text-[#1b2e85]">{previewOrder.vehicle.plate || '---'}</span></p>
               </div>
            </div>

            <div className="border border-slate-200 rounded-3xl p-8 mb-6 flex-1 max-h-[550px]">
               <h4 className="text-[9px] font-black text-[#1b2e85] uppercase mb-4">Relatório de Serviços</h4>
               <div className="text-[13px] font-medium leading-relaxed whitespace-pre-wrap text-slate-700">
                  {previewOrder.serviceDescription || 'Sem descrição.'}
               </div>
            </div>

            <div className="grid grid-cols-2 gap-6 items-end mb-8">
               <div className="bg-slate-900 text-white p-6 rounded-2xl">
                  <p className="text-[8px] font-black text-sky-400 uppercase tracking-widest mb-1">Pagamento</p>
                  <p className="text-xl font-black uppercase italic">{previewOrder.paymentMethod}</p>
               </div>
               <div className="border-2 border-[#1b2e85] rounded-2xl overflow-hidden">
                  <div className="px-4 py-2 flex justify-between border-b bg-slate-50 text-[10px] font-bold">
                     <span>MÃO DE OBRA</span>
                     <span>R$ {previewOrder.values.labor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="px-4 py-2 flex justify-between border-b bg-slate-50 text-[10px] font-bold">
                     <span>DESLOCAMENTO</span>
                     <span>R$ {previewOrder.values.travel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="p-4 bg-[#1b2e85] text-white flex justify-between items-center">
                     <span className="font-black text-[10px]">TOTAL</span>
                     <span className="text-2xl font-black">R$ {(previewOrder.values.labor + previewOrder.values.travel).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
               </div>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-10 text-center pb-4">
                <div className="border-t border-slate-400 pt-2"><p className="font-black text-[9px] uppercase">ASSINATURA CLIENTE</p></div>
                <div className="border-t border-slate-400 pt-2"><p className="font-black text-[9px] uppercase">MD DIESEL - MECÂNICA</p></div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col text-slate-900 bg-[#f1f5f9] overflow-x-hidden">
      {/* CABEÇALHO ULTRA COMPACTO E FIXO */}
      <header className="fixed top-0 left-0 right-0 h-[120px] lg:h-[90px] bg-[#1b2e85] text-white shadow-2xl z-[100] border-b-4 border-sky-500 flex items-center">
        <div className="absolute top-0 left-0 w-full h-full bg-black/10 pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 flex flex-col lg:flex-row justify-between items-center relative z-10 gap-3 lg:gap-0">
          <div className="text-center lg:text-left">
             <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter leading-none text-glow italic">
               MD DIESEL
             </h1>
             <p className="text-[10px] sm:text-[11px] font-black text-sky-400 uppercase tracking-[0.4em] mt-1 lg:mt-2">
               MECÂNICA PESADA
             </p>
          </div>
          
          <nav className="flex bg-white/10 p-1 rounded-xl backdrop-blur-md border border-white/20">
            <button 
              onClick={handleNewOrder} 
              className={`px-6 sm:px-8 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'form' ? 'bg-white text-[#1b2e85] shadow-lg' : 'text-white/70 hover:bg-white/10'}`}
            >
              NOVA OS
            </button>
            <button 
              onClick={() => setActiveTab('list')} 
              className={`px-6 sm:px-8 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'list' ? 'bg-white text-[#1b2e85] shadow-lg' : 'text-white/70 hover:bg-white/10'}`}
            >
              HISTÓRICO
            </button>
          </nav>
        </div>
      </header>

      {/* Margem superior reduzida para colar no novo cabeçalho */}
      <main className="max-w-5xl mx-auto w-full p-4 sm:p-6 flex-1 mt-[140px] lg:mt-[110px]">
        {loading && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center pointer-events-none">
            <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-200">
              <Loader2 size={40} className="text-[#1b2e85] animate-spin" />
              <p className="font-black text-[10px] uppercase tracking-widest text-[#1b2e85]">Sincronizando...</p>
            </div>
          </div>
        )}

        {activeTab === 'form' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-12">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
               <h2 className="text-xl font-black text-slate-800 uppercase italic">Registro de OS</h2>
               <div className="text-right">
                 <span className="text-[9px] font-black text-slate-400 block uppercase tracking-widest">Nº</span>
                 <span className="text-2xl font-black text-[#1b2e85] italic">{order.id}</span>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <User size={18} className="text-[#1b2e85]" />
                  <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest">Dados do Cliente</h3>
                </div>
                <Input label="Nome ou Razão Social" value={order.client.name} onChange={e => setOrder({...order, client: {...order.client, name: e.target.value}})} placeholder="Ex: Transportadora Santos" />
                <Input label="CPF/CNPJ" value={order.client.idNumber} onChange={e => setOrder({...order, client: {...order.client, idNumber: e.target.value}})} placeholder="000.000.000-00" />
                <Input label="WhatsApp" value={order.client.phone} onChange={e => setOrder({...order, client: {...order.client, phone: e.target.value}})} placeholder="(00) 00000-0000" />
              </section>

              <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Truck size={18} className="text-[#1b2e85]" />
                  <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest">Dados do Veículo</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Placa" value={order.vehicle.plate} onChange={e => setOrder({...order, vehicle: {...order.vehicle, plate: e.target.value}})} placeholder="AAA-0000" />
                  <Input label="KM/Horas" value={order.vehicle.mileage} onChange={e => setOrder({...order, vehicle: {...order.vehicle, mileage: e.target.value}})} placeholder="000.000" />
                </div>
                <Input label="Marca/Modelo" value={order.vehicle.brand} onChange={e => setOrder({...order, vehicle: {...order.vehicle, brand: e.target.value}})} placeholder="Ex: Scania R450 / Volvo FH" />
              </section>

              <section className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                  <ClipboardList size={18} className="text-[#1b2e85]" />
                  <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest">Descrição do Serviço</h3>
                </div>
                <textarea 
                  value={order.serviceDescription}
                  onChange={e => setOrder({...order, serviceDescription: e.target.value})}
                  className="w-full h-64 bg-slate-50 border-2 border-slate-100 rounded-xl p-6 font-bold text-slate-700 outline-none focus:border-[#1b2e85] focus:bg-white transition-all resize-none text-sm shadow-inner"
                  placeholder="Relatório técnico das manutenções..."
                />
              </section>

              <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <DollarSign size={18} className="text-[#1b2e85]" />
                  <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest">Financeiro</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Mão de Obra (R$)" type="number" value={order.values.labor} onChange={e => setOrder({...order, values: {...order.values, labor: Number(e.target.value)}})} />
                  <Input label="Deslocamento (R$)" type="number" value={order.values.travel} onChange={e => setOrder({...order, values: {...order.values, travel: Number(e.target.value)}})} />
                </div>
                <select 
                  value={order.paymentMethod}
                  onChange={e => setOrder({...order, paymentMethod: e.target.value as PaymentMethod})}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-black text-slate-800 outline-none focus:border-[#1b2e85] text-xs cursor-pointer transition-all"
                >
                  {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </section>

              <section className="bg-[#1b2e85] rounded-[30px] p-8 flex flex-col justify-center items-center text-center shadow-xl border-4 border-sky-400/20">
                <span className="text-sky-300 text-[10px] font-black uppercase mb-2 tracking-[0.2em]">VALOR TOTAL</span>
                <div className="text-4xl sm:text-5xl font-black text-white italic">
                  R$ {(order.values.labor + order.values.travel).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </section>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button onClick={handleSave} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-6 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 border-b-4 border-emerald-800">
                <Save size={24} /> SALVAR ORDEM
              </button>
              <button onClick={() => order.client.name ? setPreviewOrder(order) : alert("Preencha o nome do cliente.")} className="bg-sky-600 hover:bg-sky-500 text-white px-10 py-6 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 border-b-4 border-sky-800">
                GERAR PDF
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500 pb-12">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
               <h2 className="text-xl font-black text-slate-800 uppercase italic">Histórico</h2>
               <div className="relative w-full sm:w-80">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input 
                   type="text" 
                   placeholder="Pesquisar..." 
                   className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1b2e85] font-bold text-xs" 
                   value={searchTerm} 
                   onChange={e => setSearchTerm(e.target.value)} 
                 />
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOrders.map(item => (
                <div key={item.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl transition-all overflow-hidden flex flex-col group">
                  <div className="p-6 flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <span className="bg-[#1b2e85] text-white px-3 py-1 rounded-lg text-[9px] font-black italic shadow-md">{item.id}</span>
                      <span className="text-[9px] font-bold text-slate-300 uppercase">{new Date(item.date).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <h4 className="font-black text-slate-900 text-lg uppercase truncate mb-1">{item.client.name}</h4>
                    <p className="text-[10px] font-black text-sky-600 uppercase tracking-widest mb-4">{item.vehicle.plate}</p>
                    <div className="pt-4 border-t border-slate-50 text-2xl font-black text-slate-900">
                      <span className="text-[10px] font-bold text-slate-300 mr-2 uppercase">Total</span>
                      R$ {(item.values.labor + item.values.travel).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 grid grid-cols-3 gap-2 border-t border-slate-100">
                    <button onClick={() => { setOrder(item); setActiveTab('form'); window.scrollTo(0,0); }} className="bg-white p-3 rounded-xl text-[#1b2e85] border border-slate-200 flex justify-center items-center hover:bg-[#1b2e85] hover:text-white transition-all shadow-sm">
                      <History size={18} />
                    </button>
                    <button onClick={() => setPreviewOrder(item)} className="bg-white p-3 rounded-xl text-sky-600 border border-slate-200 flex justify-center items-center hover:bg-sky-600 hover:text-white transition-all shadow-sm">
                      <Download size={18} />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="bg-white p-3 rounded-xl text-red-500 border border-slate-200 flex justify-center items-center hover:bg-red-500 hover:text-white transition-all shadow-sm">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      
      <footer className="py-10 bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-slate-300 text-[10px] font-black uppercase tracking-[0.5em] italic">MD DIESEL • SISTEMA GESTOR</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
