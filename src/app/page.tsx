"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import imageCompression from "browser-image-compression";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { supabase } from "@/lib/supabase";
import AuthScreen from "@/components/AuthScreen";
import {
  LayoutDashboard,
  FileText,
  DollarSign,
  BarChart3,
  Settings,
  Plus,
  UploadCloud,
  Bell,
  ChevronDown,
  X,
  Building2,
  Users,
  Copy,
  Calendar,
  Check,
  CheckCircle2,
  CreditCard,
  ArrowRight,
  PanelLeft,
  ChevronRight,
  Lock,
  Menu,
  LogOut,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────
   TYPES
   ────────────────────────────────────────────────────────────── */

interface Solicitacao {
  id: string;
  clinica: string;
  cliente: string;
  qtdColaboradores: number;
  valor: number;
  statusIPA: "Enviado" | "Rascunho" | "Aguardando NF" | "Concluído" | "Pendente Aprovação";
  statusFinanceiro: "Pendente" | "Pago" | "Cancelado";
  data: string;
  data_atendimento?: string;
  cidade: string;
  estado: string;
  colaboradoresList: string[];
  db_id?: string;
  created_at?: string;
  comprovante_url?: string;
  comprovante_size?: string;
  nota_fiscal_url?: string;
  nota_fiscal_size?: string;
  solicitado_por_nome?: string;
  aprovado_por_nome?: string;
}

type RightPanel = "none" | "nova" | "detalhes" | "editar";
type NavTab = "dashboard" | "ipa" | "financeiro" | "relatorios" | "configuracoes" | "acessos";

/* ──────────────────────────────────────────────────────────────
   MOCK DATA (matching design spec)
   ────────────────────────────────────────────────────────────── */

const initialData: Solicitacao[] = [];

/* ──────────────────────────────────────────────────────────────
   CURRENCY FORMATTER
   ────────────────────────────────────────────────────────────── */

function brl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/* ──────────────────────────────────────────────────────────────
   MAIN DASHBOARD
   ────────────────────────────────────────────────────────────── */

function DashboardSGF({ session, userRole }: { session: any, userRole: "ipa" | "financeiro" | "empresa" | null }) {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [mobileViewMode, setMobileViewMode] = useState<"table" | "cards">("cards");
  const [rightPanel, setRightPanel] = useState<RightPanel>("none");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<"mes" | "dia">("mes");
  const [financeDateFilter, setFinanceDateFilter] = useState<"all"|"hoje"|"amanha"|"semana"|"atrasados">("all");

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const chartData = useMemo(() => {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();
    
    const dadosMes = new Array(12).fill(0);
    const diasNoMes = new Date(anoAtual, mesAtual + 1, 0).getDate();
    const dadosDia = new Array(diasNoMes).fill(0);
    
    solicitacoes.forEach(s => {
      const parts = s.data.split('/');
      if (parts.length === 3) {
        const dia = parseInt(parts[0], 10);
        const mes = parseInt(parts[1], 10) - 1;
        const ano = parseInt(parts[2], 10);
        
        if (ano === anoAtual) {
          dadosMes[mes]++;
          if (mes === mesAtual && dia >= 1 && dia <= diasNoMes) {
            dadosDia[dia - 1]++;
          }
        }
      }
    });

    const maxMes = Math.max(...dadosMes, 1);
    const maxDia = Math.max(...dadosDia, 1);

    return {
      meses: dadosMes.map(v => ({ valor: v, altura: (v / maxMes) * 100 })),
      dias: dadosDia.map(v => ({ valor: v, altura: (v / maxDia) * 100 })),
      diasNoMes
    };
  }, [solicitacoes]);

  // Cadastro Modal
  type ModalType = "none" | "clinica" | "empresa";
  const [modalCadastro, setModalCadastro] = useState<ModalType>("none");
  const [mockClinicas, setMockClinicas] = useState<any[]>([]);
  const [mockEmpresas, setMockEmpresas] = useState<any[]>([]);

  // Form state
  const [formClinica, setFormClinica] = useState("");
  const [formEstado, setFormEstado] = useState("Selecione");
  const [formCidade, setFormCidade] = useState("");
  const [formCliente, setFormCliente] = useState("");
  const [formColabInput, setFormColabInput] = useState("");
  const [formColabs, setFormColabs] = useState<string[]>([]);
  const [formValor, setFormValor] = useState("R$ 0,00");
  const [formPix, setFormPix] = useState("");
  const [formDataAtendimento, setFormDataAtendimento] = useState("");

  // Mock Access State
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);

  // Derived user info
  const userName = session?.user?.user_metadata?.nome || "Usuário";
  const userInitials = userName.substring(0, 2).toUpperCase();
  const roleLabel = userRole === "financeiro" ? "Setor Financeiro" : userRole === "empresa" ? "Empresa Cliente" : "Setor IPA";
  const hasNovasSolicitacoes = userRole === "financeiro" && solicitacoes.some(s => s.statusFinanceiro === 'Pendente');

  // Configurações state
  const [notifAlertsEnabled, setNotifAlertsEnabled] = useState(true);
  const [notifSecEnabled, setNotifSecEnabled] = useState(false);
  const [notifEmail, setNotifEmail] = useState("");

  // Fetch data on mount
  useEffect(() => {
    if (session) {
      fetchDashboardData();
    }
  }, [session]);

  const fetchDashboardData = async () => {
    // 1. Fetch Clinicas
    const { data: clinicas } = await supabase.from('clinicas').select('*').order('nome');
    if (clinicas) setMockClinicas(clinicas);

    // 2. Fetch Empresas
    const { data: empresas } = await supabase.from('empresas_clientes').select('*').order('nome');
    if (empresas) setMockEmpresas(empresas);

    // 3. Fetch Solicitacoes
    const { data: sols } = await supabase
      .from('solicitacoes')
      .select(`
        *,
        clinicas (nome),
        empresas_clientes (nome),
        colaboradores_solicitacao (nome)
      `)
      .order('created_at', { ascending: false });

    if (sols) {
      const formattedSols: Solicitacao[] = sols.map((s: any) => ({
        id: `#${s.visual_id.toString().padStart(4, '0')}`,
        db_id: s.id, // Store real ID to update later
        created_at: s.created_at,
        clinica: s.clinicas?.nome || "Desconhecida",
        cliente: s.empresas_clientes?.nome || "Desconhecida",
        qtdColaboradores: s.qtd_colaboradores,
        valor: Number(s.valor),
        statusIPA: s.status_ipa,
        statusFinanceiro: s.status_financeiro,
        data: new Date(s.created_at).toLocaleDateString("pt-BR") + " — " + new Date(s.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        data_atendimento: s.data_atendimento ? new Date(s.data_atendimento).toLocaleDateString("pt-BR", {timeZone: 'UTC'}) : undefined,
        cidade: s.cidade,
        estado: s.estado,
        colaboradoresList: s.colaboradores_solicitacao?.map((c: any) => c.nome) || [],
        comprovante_url: s.comprovante_url,
        comprovante_size: s.comprovante_size,
        nota_fiscal_url: s.nota_fiscal_url,
        nota_fiscal_size: s.nota_fiscal_size,
        solicitado_por_nome: s.solicitado_por_nome,
        aprovado_por_nome: s.aprovado_por_nome,
      }));
      setSolicitacoes(formattedSols);
    }

    // 4. Fetch Pending Users
    const { data: users } = await supabase.from('user_roles').select('*').eq('status', 'pendente');
    if (users) {
      setPendingUsers(users.map(u => ({
        id: u.user_id,
        nome: u.nome || "Usuário",
        email: u.email || "Sem e-mail",
        roleRequested: u.role
      })));
    }

    // 5. Fetch User Preferences
    if (session?.user?.id) {
      const { data: prefData } = await supabase
        .from('user_roles')
        .select('notif_alerts_enabled, notif_sec_enabled, notif_email')
        .eq('user_id', session.user.id)
        .single();
        
      if (prefData) {
        setNotifAlertsEnabled(prefData.notif_alerts_enabled ?? true);
        setNotifSecEnabled(prefData.notif_sec_enabled ?? false);
        if (prefData.notif_email) setNotifEmail(prefData.notif_email);
      }
    }
  };

  const updatePreference = async (key: string, value: any) => {
    if (key === 'notif_alerts_enabled') setNotifAlertsEnabled(value);
    if (key === 'notif_sec_enabled') setNotifSecEnabled(value);
    if (key === 'notif_email') setNotifEmail(value);

    if (session?.user?.id) {
      await supabase.from('user_roles').update({ [key]: value }).eq('user_id', session.user.id);
    }
  };

  const handleAprovar = async (id: string) => {
    const { error } = await supabase.from('user_roles').update({ status: 'aprovado' }).eq('user_id', id);
    if (!error) {
      setPendingUsers(prev => prev.filter(u => u.id !== id));
      alert("Usuário aprovado e acesso liberado!");
    } else {
      alert("Erro ao aprovar: " + error.message);
    }
  };

  const handleRejeitar = async (id: string) => {
    const { error } = await supabase.from('user_roles').update({ status: 'rejeitado' }).eq('user_id', id);
    if (!error) {
      setPendingUsers(prev => prev.filter(u => u.id !== id));
      alert("Acesso rejeitado.");
    } else {
      alert("Erro ao rejeitar: " + error.message);
    }
  };

  const handleSelectClinica = (nome: string) => {
    setFormClinica(nome);
    const c = mockClinicas.find((x) => x.nome === nome);
    if (c) {
      if (c.estado) setFormEstado(c.estado);
      if (c.cidade) setFormCidade(c.cidade);
      if (c.chave_pix) setFormPix(c.chave_pix);
      else setFormPix("");
    } else {
      setFormPix("");
    }
  };

  // Detail state
  const [copiedId, setCopiedId] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<string | null>(null);
  const [uploadedNF, setUploadedNF] = useState<string | null>(null);
  const [uploadedNFSize, setUploadedNFSize] = useState<string | null>(null);

  const selectedReq = solicitacoes.find((s) => s.id === selectedId) ?? null;

  // PDF Export
  const exportPDF = async () => {
    const reportElement = document.getElementById("relatorios-content");
    if (!reportElement) return;
    try {
      const canvas = await html2canvas(reportElement, { backgroundColor: "#080808" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save("relatorio_financeiro.pdf");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
    }
  };

  // Stats
  const totalSolicitacoes = solicitacoes.length;
  const totalAprovadas = solicitacoes.filter((s) => s.statusIPA === "Enviado").length;
  const totalEmPagamento = solicitacoes.filter((s) => s.statusFinanceiro === "Pendente" && s.statusIPA === "Enviado").length;
  const valorTotal = solicitacoes.reduce((sum, s) => sum + s.valor, 0);

  // Date Helpers for Trends
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const isThisMonth = (d: string | undefined) => {
    if (!d) return false;
    const date = new Date(d);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  };
  
  const isLastMonth = (d: string | undefined) => {
    if (!d) return false;
    const date = new Date(d);
    return date.getMonth() === prevMonth && date.getFullYear() === prevMonthYear;
  };

  const getTrend = (currentValue: number, previousValue: number) => {
    if (previousValue === 0) return currentValue > 0 ? "+100% este mês" : "0% este mês";
    const diff = ((currentValue - previousValue) / previousValue) * 100;
    return `${diff > 0 ? '+ ' : ''}${diff.toFixed(0)}% este mês`;
  };

  // Trends
  const solThisMonth = solicitacoes.filter(s => isThisMonth(s.created_at)).length;
  const solLastMonth = solicitacoes.filter(s => isLastMonth(s.created_at)).length;
  const trendSolicitacoes = getTrend(solThisMonth, solLastMonth);

  const aprovadasThisMonth = solicitacoes.filter(s => isThisMonth(s.created_at) && s.statusIPA === "Enviado").length;
  const aprovadasLastMonth = solicitacoes.filter(s => isLastMonth(s.created_at) && s.statusIPA === "Enviado").length;
  const trendAprovadas = getTrend(aprovadasThisMonth, aprovadasLastMonth);

  const emPagamentoThisMonth = solicitacoes.filter(s => isThisMonth(s.created_at) && s.statusFinanceiro === "Pendente" && s.statusIPA === "Enviado").length;
  const emPagamentoLastMonth = solicitacoes.filter(s => isLastMonth(s.created_at) && s.statusFinanceiro === "Pendente" && s.statusIPA === "Enviado").length;
  const trendEmPagamento = getTrend(emPagamentoThisMonth, emPagamentoLastMonth);

  const valorThisMonth = solicitacoes.filter(s => isThisMonth(s.created_at)).reduce((sum, s) => sum + s.valor, 0);
  const valorLastMonth = solicitacoes.filter(s => isLastMonth(s.created_at)).reduce((sum, s) => sum + s.valor, 0);
  const trendValor = getTrend(valorThisMonth, valorLastMonth);

  // Handlers
  const openNovaSolicitacao = useCallback(() => {
    setSelectedId(null);
    setRightPanel("nova");
  }, []);

  const openDetalhes = useCallback((id: string) => {
    setSelectedId(id);
    setRightPanel("detalhes");
    const current = solicitacoes.find(s => s.id === id);
    if (current && current.comprovante_url) {
      setUploadedFile(current.comprovante_url);
      setUploadedFileSize(current.comprovante_size || null);
    } else {
      setUploadedFile(null);
      setUploadedFileSize(null);
    }
    if (current && current.nota_fiscal_url) {
      setUploadedNF(current.nota_fiscal_url);
      setUploadedNFSize(current.nota_fiscal_size || null);
    } else {
      setUploadedNF(null);
      setUploadedNFSize(null);
    }
  }, [solicitacoes]);

  const closePanel = useCallback(() => {
    setRightPanel("none");
    setSelectedId(null);
    setFormColabs([]);
    setFormClinica("");
    setFormCliente("");
    setFormValor("R$ 0,00");
    setFormPix("");
    setFormCidade("");
    setFormEstado("Selecione");
    setFormDataAtendimento("");
    setUploadedFile(null);
    setUploadedFileSize(null);
    setUploadedNF(null);
    setUploadedNFSize(null);
  }, []);

  const addColab = useCallback(() => {
    if (formColabInput.trim()) {
      setFormColabs(prev => [...prev, formColabInput.trim()]);
      setFormColabInput("");
    }
  }, [formColabInput]);

  const removeColab = useCallback((index: number) => {
    setFormColabs(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleEdit = useCallback((id: string) => {
    const current = solicitacoes.find(s => s.id === id);
    if (!current) return;
    
    setSelectedId(id);
    setFormClinica(current.clinica);
    setFormCliente(current.cliente);
    setFormEstado(current.estado);
    setFormCidade(current.cidade);
    setFormValor(brl(current.valor));
    setFormColabs(current.colaboradoresList);
    if (current.data_atendimento) {
      // Postgres returns YYYY-MM-DD or DD/MM/YYYY
      const parts = current.data_atendimento.split('/');
      if (parts.length === 3) {
        setFormDataAtendimento(`${parts[2]}-${parts[1]}-${parts[0]}`);
      } else {
        setFormDataAtendimento(current.data_atendimento);
      }
    } else {
      setFormDataAtendimento("");
    }
    const c = mockClinicas.find(cl => cl.nome === current.clinica);
    if (c) {
      setFormPix(c.chave_pix || "");
    }
    setRightPanel("editar");
  }, [solicitacoes, mockClinicas]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;

    const clinicaDb = mockClinicas.find(c => c.nome === formClinica);
    const empresaDb = userRole === "empresa" ? { id: "resolve-later", nome: "" } : mockEmpresas.find(c => c.nome === formCliente);
    if (!clinicaDb) return alert("Selecione a clínica terceirizada.");
    if (userRole !== "empresa" && !empresaDb) return alert("Selecione a empresa cliente.");

    setIsSubmitting(true);

    try {
        if (formPix) {
          await supabase.from("clinicas").update({ chave_pix: formPix }).eq("id", clinicaDb.id);
        }

        const valorNumerico = parseFloat(formValor.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
        if (valorNumerico <= 0) {
          alert("Por favor, informe o valor da solicitação.");
          setIsSubmitting(false);
          return;
        }

        const finalColabs = [...formColabs];
        if (formColabInput.trim()) {
          finalColabs.push(formColabInput.trim());
        }

        if (finalColabs.length === 0) {
          alert("Por favor, adicione pelo menos o nome de um colaborador.");
          setIsSubmitting(false);
          return;
        }

        let finalEmpresaId = "";
        let finalEstado = (formEstado && formEstado !== "Selecione") ? formEstado : (clinicaDb.estado || "RN");
        let finalCidade = (formCidade && formCidade !== "Desconhecida" && formCidade.trim() !== "") ? formCidade : (clinicaDb.cidade || "Natal");

        if (userRole === "empresa") {
          const { data: myRole } = await supabase
            .from('user_roles')
            .select('empresa_cnpj, empresa_cliente_id')
            .eq('user_id', session.user.id)
            .single();

          if (myRole?.empresa_cliente_id) {
            finalEmpresaId = myRole.empresa_cliente_id;
            const { data: myEmpresa } = await supabase
              .from('empresas_clientes')
              .select('id, estado, cidade')
              .eq('id', finalEmpresaId)
              .maybeSingle();

            if (myEmpresa) {
              if (myEmpresa.estado && myEmpresa.estado !== "Selecione") finalEstado = myEmpresa.estado;
              if (myEmpresa.cidade) finalCidade = myEmpresa.cidade;
            }
          } else if (myRole?.empresa_cnpj) {
            const cleanCnpj = myRole.empresa_cnpj.replace(/\D/g, "");
            const { data: myEmpresa } = await supabase
              .from('empresas_clientes')
              .select('id, estado, cidade')
              .or(`cnpj.eq.${cleanCnpj},cnpj.eq.${myRole.empresa_cnpj}`)
              .limit(1)
              .maybeSingle();

            if (myEmpresa) {
              finalEmpresaId = myEmpresa.id;
              if (myEmpresa.estado && myEmpresa.estado !== "Selecione") finalEstado = myEmpresa.estado;
              if (myEmpresa.cidade) finalCidade = myEmpresa.cidade;
            }
          }

          if (!finalEmpresaId) {
            alert("Erro: não foi possível identificar sua empresa logada. Contate o suporte do IPA.");
            setIsSubmitting(false);
            return;
          }
        } else {
          const empresaDb = mockEmpresas.find(c => c.nome === formCliente);
          if (!empresaDb) {
            alert("Selecione a empresa cliente.");
            setIsSubmitting(false);
            return;
          }
          finalEmpresaId = empresaDb.id;
        }

        if (rightPanel === "editar" && selectedId) {
          const current = solicitacoes.find(s => s.id === selectedId);
          if (current && current.db_id) {
            // Update solicitacao
            const { error: solError } = await supabase.from('solicitacoes').update({
              clinica_id: clinicaDb.id,
              empresa_cliente_id: finalEmpresaId,
              estado: finalEstado,
              cidade: finalCidade,
              qtd_colaboradores: finalColabs.length,
              valor: valorNumerico,
              data_atendimento: formDataAtendimento ? formDataAtendimento : null,
            }).eq('id', current.db_id);

            if (solError) throw solError;

            // Re-create colaboradores (delete old and insert new)
            await supabase.from('colaboradores_solicitacao').delete().eq('solicitacao_id', current.db_id);
            if (finalColabs.length > 0) {
              const colabsData = finalColabs.map(nome => ({
                solicitacao_id: current.db_id,
                nome: nome
              }));
              await supabase.from('colaboradores_solicitacao').insert(colabsData);
            }
          }
        } else {
          // Create solicitacao
          const { data: novaSol, error: solError } = await supabase.from('solicitacoes').insert({
            clinica_id: clinicaDb.id,
            empresa_cliente_id: finalEmpresaId,
            estado: finalEstado,
            cidade: finalCidade,
            qtd_colaboradores: finalColabs.length,
            valor: valorNumerico,
            status_ipa: userRole === "empresa" ? "Pendente Aprovação" : "Enviado",
            status_financeiro: "Pendente",
            data_atendimento: formDataAtendimento ? formDataAtendimento : null,
            solicitado_por_nome: userName,
            created_by: session?.user?.id || null,
          }).select().single();

          if (solError) throw solError;

          // Create colaboradores
          if (finalColabs.length > 0) {
            const colabsData = finalColabs.map(nome => ({
              solicitacao_id: novaSol.id,
              nome: nome
            }));
            await supabase.from('colaboradores_solicitacao').insert(colabsData);
          }
        }

        await fetchDashboardData(); // Refetch
        alert(userRole === "empresa" ? "Solicitação enviada com sucesso! Aguarde a aprovação do setor IPA." : "Solicitação salva com sucesso!");
        
        setRightPanel("none");
        // Reset form
        setFormClinica("");
        setFormCidade("");
        setFormCliente("");
        setFormValor("R$ 0,00");
        setFormColabs([]);
        setFormPix("");
      } catch (error: any) {
        alert("Erro ao salvar solicitação: " + error.message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [formClinica, formCliente, formColabs, formValor, formPix, formCidade, formEstado, mockClinicas, mockEmpresas, rightPanel, selectedId, solicitacoes, formColabInput, formDataAtendimento, isSubmitting, userRole, userName, session, fetchDashboardData]
  );

  const togglePayment = useCallback(async () => {
    if (!selectedId) return;
    const current = solicitacoes.find(s => s.id === selectedId);
    if (!current || !current.db_id) return;

    const novoStatus = current.statusFinanceiro === "Pago" ? "Pendente" : "Pago";
    const novoStatusIPA = novoStatus === "Pago" ? "Aguardando NF" : "Enviado";
    
    // Update UI immediately (optimistic UI)
    setSolicitacoes((prev) =>
      prev.map((s) =>
        s.id === selectedId
          ? { ...s, statusFinanceiro: novoStatus, statusIPA: novoStatusIPA }
          : s
      )
    );

    // Update in DB
    const { error } = await supabase.from('solicitacoes').update({ status_financeiro: novoStatus, status_ipa: novoStatusIPA }).eq('id', current.db_id);
    if (error) {
      alert("Erro ao confirmar pagamento: " + error.message);
      // Revert if error
      await fetchDashboardData();
    }
  }, [selectedId, solicitacoes]);

  const handleAprovarSolicitacao = useCallback(async () => {
    if (!selectedId) return;
    const current = solicitacoes.find(s => s.id === selectedId);
    if (!current || !current.db_id) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('solicitacoes').update({ 
        status_ipa: "Enviado",
        approved_by: session?.user?.id,
        aprovado_por_nome: userName
      }).eq('id', current.db_id);
      
      if (error) throw error;
      
      alert("Solicitação aprovada e enviada ao financeiro!");
      await fetchDashboardData();
    } catch (err: any) {
      alert("Erro ao aprovar solicitação: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedId, solicitacoes, session, userName]);

  const handleSaveDetalhes = useCallback(async () => {
    if (!selectedId) return;
    const current = solicitacoes.find(s => s.id === selectedId);
    if (!current || !current.db_id) return;

    const updateData: any = {};
    if (uploadedFile !== current.comprovante_url) {
      updateData.comprovante_url = uploadedFile;
      updateData.comprovante_size = uploadedFileSize;
    }
    if (uploadedNF !== current.nota_fiscal_url) {
      updateData.nota_fiscal_url = uploadedNF;
      updateData.nota_fiscal_size = uploadedNFSize;
      if (uploadedNF) {
        updateData.status_ipa = "Concluído";
      }
    }

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase.from('solicitacoes').update(updateData).eq('id', current.db_id);
      if (error) {
        alert("Erro ao salvar alterações: " + error.message);
        return;
      }
    }
    
    alert("Alterações salvas com sucesso!");
    setRightPanel("none");
    setSelectedId(null);
    setUploadedFile(null);
    setUploadedFileSize(null);
    setUploadedNF(null);
    setUploadedNFSize(null);
    await fetchDashboardData();
  }, [selectedId, solicitacoes, uploadedFile, uploadedFileSize, uploadedNF, uploadedNFSize]);

  const copyId = useCallback(() => {
    if (!selectedReq) return;
    navigator.clipboard.writeText(selectedReq.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  }, [selectedReq]);

  /* ──────────────────────────────────────────────────────────────
     NAV ITEMS CONFIG
     ────────────────────────────────────────────────────────────── */

  const navItems: { id: NavTab; icon: React.ReactNode; label: string }[] = [
    { id: "dashboard", icon: <LayoutDashboard size={18} strokeWidth={1.5} />, label: "Dashboard" },
    ...(userRole === "ipa" ? [{ id: "ipa" as NavTab, icon: <FileText size={18} strokeWidth={1.5} />, label: "Setor IPA" }] : []),
    ...(userRole === "financeiro" ? [{ id: "financeiro" as NavTab, icon: <DollarSign size={18} strokeWidth={1.5} />, label: "Financeiro" }] : []),
    ...(userRole === "empresa" ? [{ id: "ipa" as NavTab, icon: <FileText size={18} strokeWidth={1.5} />, label: "Minhas Solicitações" }] : []),
    ...(userRole !== "empresa" ? [{ id: "relatorios" as NavTab, icon: <BarChart3 size={18} strokeWidth={1.5} />, label: "Relatórios" }] : []),
    ...(userRole === "ipa" ? [{ id: "acessos" as NavTab, icon: <Users size={18} strokeWidth={1.5} />, label: "Acessos" }] : []),
    { id: "configuracoes", icon: <Settings size={18} strokeWidth={1.5} />, label: "Configurações" },
  ];

  /* ──────────────────────────────────────────────────────────────
     RENDER
     ────────────────────────────────────────────────────────────── */

  return (
    <div className="flex h-screen w-screen bg-[#080808] text-[#F5F5F5] overflow-hidden">
      {/* Mobile Overlay */}
      {!sidebarCollapsed && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40" 
          onClick={() => setSidebarCollapsed(true)} 
        />
      )}
      {/* ═══ SIDEBAR ═══ */}
      <aside
        className={`${
          sidebarCollapsed ? "-translate-x-full md:translate-x-0 w-[240px] md:w-[68px]" : "translate-x-0 w-[240px]"
        } absolute md:relative z-50 h-full bg-[#080808] border-r border-[#1a1a1a] flex flex-col shrink-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group/sidebar`}
      >
        {/* Toggle Button — appears at right edge */}
        <button
          onClick={() => setSidebarCollapsed((p) => !p)}
          className="absolute -right-3 top-20 z-30 w-6 h-6 bg-[#111] border border-[#1a1a1a] rounded-full flex items-center justify-center text-[#555] hover:text-white hover:bg-[#3B82F6] hover:border-[#3B82F6] transition-all duration-200 shadow-lg opacity-0 group-hover/sidebar:opacity-100 focus:opacity-100"
          title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          <ChevronRight
            size={13}
            strokeWidth={2}
            className={`transition-transform duration-300 ${sidebarCollapsed ? "rotate-0" : "rotate-180"}`}
          />
        </button>

        {/* Logo — interactive with expand/collapse */}
        <button
          onClick={() => setSidebarCollapsed((p) => !p)}
          className="h-16 flex items-center border-b border-[#1a1a1a] shrink-0 cursor-pointer hover:bg-[#0f0f0f] transition-colors overflow-hidden"
        >
          <div className={`flex items-center transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            sidebarCollapsed ? "pl-[18px]" : "pl-5"
          }`}>
            {/* Logo Mark — collapsed shows only "A"; expanding reveals "IP" */}
            <div
              role="img"
              aria-label="Logo IPA"
              className={`relative h-7 shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                sidebarCollapsed ? "w-[32px]" : "w-[68px]"
              }`}
            >
              <img
                src="/logo-ip.png"
                alt=""
                className={`absolute right-0 top-0 h-full w-auto max-w-none transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                  sidebarCollapsed ? "opacity-0 -translate-x-2" : "opacity-100 translate-x-0"
                }`}
              />
              <img src="/logo-a.png" alt="" className="absolute right-0 top-0 h-full w-auto max-w-none" />
            </div>
            {/* Tagline */}
            <div className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
              sidebarCollapsed ? "w-0 ml-0 opacity-0" : "w-auto ml-3 opacity-100"
            }`}>
              <span className="text-[7px] tracking-[0.14em] text-[#555] font-semibold uppercase whitespace-nowrap select-none block leading-[1.2]">
                SOLICITAÇÕES
              </span>
              <span className="text-[7px] tracking-[0.14em] text-[#555] font-semibold uppercase whitespace-nowrap select-none block leading-[1.2]">
                APROVAÇÕES
              </span>
              <span className="text-[7px] tracking-[0.14em] text-[#555] font-semibold uppercase whitespace-nowrap select-none block leading-[1.2]">
                PAGAMENTOS
              </span>
            </div>
          </div>
        </button>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-lg text-[13px] font-medium transition-all duration-200 ${
                  sidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } ${
                  isActive
                    ? "bg-[#3B82F6]/10 text-[#3B82F6]"
                    : "text-[#555] hover:text-[#999] hover:bg-[#111]"
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className={`overflow-hidden transition-all duration-300 whitespace-nowrap ${
                  sidebarCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                }`}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-2 py-3 border-t border-[#1a1a1a] shrink-0">
          <div className={`flex items-center rounded-lg hover:bg-[#111] cursor-pointer transition-colors ${
            sidebarCollapsed ? "justify-center px-0 py-2" : "gap-2.5 px-2.5 py-2"
          }`}>
            <div className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[11px] font-semibold text-[#666] shrink-0 uppercase">
              {userInitials}
            </div>
            <div className={`overflow-hidden transition-all duration-300 ${
              sidebarCollapsed ? "w-0 opacity-0" : "w-auto opacity-100 flex-1 min-w-0"
            }`}>
              <p className="text-[12px] font-medium text-[#ccc] truncate whitespace-nowrap capitalize">{userName}</p>
              <p className="text-[10px] text-[#444] truncate whitespace-nowrap">{roleLabel}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              className={`p-1.5 rounded-md hover:bg-[#EF4444]/10 hover:text-[#EF4444] text-[#444] shrink-0 transition-all duration-300 ${
                sidebarCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100 flex"
              }`}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ═══ MAIN CONTENT AREA ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 sm:h-16 border-b border-[#1a1a1a] bg-[#080808] flex items-center justify-between px-3 sm:px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Hamburger for mobile */}
            <button 
              onClick={() => setSidebarCollapsed(false)}
              className="md:hidden w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg hover:bg-[#1a1a1a] text-[#888] transition-colors"
            >
              <Menu size={18} />
            </button>
            <h1 className="text-[13px] sm:text-[15px] font-semibold tracking-tight">Dashboard</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border border-[#1a1a1a] bg-[#0c0c0c] hover:bg-[#151515] text-[#555] hover:text-[#888] transition-colors">
              <Bell size={15} strokeWidth={1.5} />
              {hasNovasSolicitacoes && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[#0c0c0c]"></span>
              )}
            </button>
            <div className="hidden md:flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 bg-[#0c0c0c] border border-[#1a1a1a] hover:bg-[#151515] rounded-full transition-colors">
              <div className="w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[10px] font-semibold text-[#888] uppercase">
                {userInitials}
              </div>
              <span className="text-[12px] font-medium text-[#999] capitalize">{userName}</span>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border border-[#1a1a1a] bg-[#0c0c0c] hover:bg-[#EF4444]/10 text-[#555] hover:text-[#EF4444] transition-colors"
            >
              <LogOut size={15} strokeWidth={1.5} />
            </button>
          </div>
        </header>

        {/* Content Row: Dashboard + Side Panel */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          {/* ── DASHBOARD SECTION ── */}
          {/* ── MAIN CONTENT SECTION ── */}
          <section className="flex-1 min-w-0 overflow-y-auto no-scrollbar flex flex-col">
            <AnimatePresence mode="wait">
            {activeTab === "dashboard" && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ type: "spring", bounce: 0, duration: 0.4 }} className="p-2.5 sm:p-4 md:p-6 space-y-2.5 sm:space-y-4 md:space-y-5 max-w-[1200px]">
                {/* STAT CARDS */}
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                  <StatCard
                    label="Solicitações"
                    value={String(totalSolicitacoes).padStart(2, "0")}
                    trend={trendSolicitacoes}
                    icon={<FileText size={13} strokeWidth={1.5} />}
                  />
                  <StatCard
                    label="Aprovadas"
                    value={String(totalAprovadas).padStart(2, "0")}
                    trend={trendAprovadas}
                    icon={<CheckCircle2 size={13} strokeWidth={1.5} />}
                  />
                  <StatCard
                    label="Em pagamento"
                    value={String(totalEmPagamento).padStart(2, "0")}
                    trend={trendEmPagamento}
                    icon={<CreditCard size={13} strokeWidth={1.5} />}
                  />
                  <StatCard
                    label="Valor total"
                    value={brl(valorTotal)}
                    trend={trendValor}
                    icon={<DollarSign size={13} strokeWidth={1.5} />}
                    isWide
                  />
                </div>

                {/* TABLE / CARDS CONTAINER */}
                <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl overflow-hidden">
                  {/* Table Header */}
                  <div className="flex items-center justify-between px-3.5 py-2.5 sm:px-5 sm:py-3.5 border-b border-[#1a1a1a]">
                    <div className="flex items-center gap-2">
                      <h2 className="text-[12px] sm:text-[14px] font-semibold text-[#eee]">Solicitações recentes</h2>
                      <span className="text-[9px] sm:text-[10px] bg-[#141414] border border-[#222] text-[#888] px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded-full font-mono">
                        {solicitacoes.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                      {/* Mobile View Toggle */}
                      <div className="sm:hidden flex bg-[#111] border border-[#222] rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => setMobileViewMode("cards")}
                          className={`px-2 py-0.5 text-[9px] font-semibold rounded transition-colors ${
                            mobileViewMode === "cards" ? "bg-[#252525] text-white" : "text-[#666] hover:text-[#aaa]"
                          }`}
                        >
                          Cards
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobileViewMode("table")}
                          className={`px-2 py-0.5 text-[9px] font-semibold rounded transition-colors ${
                            mobileViewMode === "table" ? "bg-[#252525] text-white" : "text-[#666] hover:text-[#aaa]"
                          }`}
                        >
                          Tabela
                        </button>
                      </div>

                      <button className="hidden sm:inline-flex text-[11px] text-[#555] hover:text-[#999] transition-colors font-medium">
                        Ver todas <ArrowRight size={12} className="inline ml-0.5" />
                      </button>

                      {(userRole === "ipa" || userRole === "empresa") && (
                        <button
                          onClick={openNovaSolicitacao}
                          className="bg-[#3B82F6] hover:bg-[#2563EB] text-white px-2.5 py-1 sm:pl-3 sm:pr-3.5 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition-colors flex items-center gap-1 sm:gap-1.5"
                        >
                          <span className="hidden sm:inline">Nova Solicitação</span>
                          <span className="sm:hidden">+ Nova</span>
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Empty state */}
                  {solicitacoes.length === 0 ? (
                    <div className="py-8 text-center text-[#555] text-[11px]">
                      Nenhuma solicitação encontrada.
                    </div>
                  ) : (
                    <>
                      {/* MOBILE: CARDS VIEW */}
                      {mobileViewMode === "cards" && (
                        <div className="sm:hidden divide-y divide-[#1a1a1a]/60">
                          {solicitacoes.map((item) => {
                            const isActive = item.id === selectedId && rightPanel === "detalhes";
                            return (
                              <div
                                key={item.id}
                                onClick={() => openDetalhes(item.id)}
                                className={`p-3 transition-colors cursor-pointer active:bg-[#151515] flex flex-col gap-1.5 ${
                                  isActive ? "bg-[#141414]" : "hover:bg-[#0e0e0e]"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[10px] text-[#777] bg-[#141414] px-1.5 py-0.5 rounded border border-[#222]">
                                      {item.id}
                                    </span>
                                    {item.data && (
                                      <span className="text-[10px] text-[#555]">{item.data}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <StatusPill
                                      label={item.statusIPA}
                                      variant={item.statusIPA === "Rascunho" ? "muted" : "default"}
                                    />
                                    <StatusPill
                                      label={item.statusFinanceiro}
                                      variant={
                                        item.statusFinanceiro === "Pago"
                                          ? "blue"
                                          : item.statusFinanceiro === "Cancelado"
                                          ? "red"
                                          : "default"
                                      }
                                    />
                                  </div>
                                </div>
                                <div className="flex items-end justify-between gap-2 mt-0.5">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[12px] font-semibold text-[#eee] truncate leading-tight">
                                      {item.clinica}
                                    </p>
                                    <p className="text-[10px] text-[#666] truncate mt-0.5">
                                      {item.cliente}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-[12px] font-bold text-[#3B82F6]">
                                      {brl(item.valor)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* MOBILE: COMPACT TABLE (when toggled on mobile) */}
                      {mobileViewMode === "table" && (
                        <div className="sm:hidden overflow-x-hidden">
                          <table className="w-full text-left table-fixed">
                            <thead>
                              <tr className="border-b border-[#1a1a1a]">
                                <th className="w-[58px] px-2 py-2 text-[9px] font-semibold text-[#444] uppercase tracking-wider">ID</th>
                                <th className="px-2 py-2 text-[9px] font-semibold text-[#444] uppercase tracking-wider">Clínica / Cliente</th>
                                <th className="w-[74px] px-2 py-2 text-[9px] font-semibold text-[#444] uppercase tracking-wider text-right">Valor</th>
                                <th className="w-[84px] px-2 py-2 text-[9px] font-semibold text-[#444] uppercase tracking-wider text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {solicitacoes.map((item) => {
                                const isActive = item.id === selectedId && rightPanel === "detalhes";
                                return (
                                  <tr
                                    key={item.id}
                                    onClick={() => openDetalhes(item.id)}
                                    className={`border-b border-[#1a1a1a]/50 cursor-pointer text-[11px] spring-hover ${
                                      isActive ? "bg-[#111]" : "hover:bg-[#0f0f0f]"
                                    }`}
                                  >
                                    <td className="px-2 py-2 font-mono text-[10px] text-[#555] truncate">{item.id}</td>
                                    <td className="px-2 py-2 min-w-0">
                                      <div className="font-medium text-[#ddd] text-[11px] truncate leading-tight">{item.clinica}</div>
                                      <div className="text-[9px] text-[#666] truncate mt-0.5">{item.cliente}</div>
                                    </td>
                                    <td className="px-2 py-2 text-[#888] font-medium text-right text-[10px] truncate">{brl(item.valor)}</td>
                                    <td className="px-2 py-2 text-right">
                                      <div className="flex flex-col gap-0.5 items-end">
                                        <StatusPill
                                          label={item.statusIPA}
                                          variant={item.statusIPA === "Rascunho" ? "muted" : "default"}
                                        />
                                        <StatusPill
                                          label={item.statusFinanceiro}
                                          variant={
                                            item.statusFinanceiro === "Pago"
                                              ? "blue"
                                              : item.statusFinanceiro === "Cancelado"
                                              ? "red"
                                              : "default"
                                          }
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* DESKTOP TABLE (sm and above) */}
                      <div className="hidden sm:block overflow-x-auto no-scrollbar">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-[#1a1a1a]">
                              {["ID", "Clínica", "Empresa Cliente", "Valor", "Status IPA", "Status Financeiro"].map(
                                (th) => (
                                  <th
                                    key={th}
                                    className="px-4 py-3 md:px-5 md:py-3.5 text-[10px] font-semibold text-[#444] uppercase tracking-wider whitespace-nowrap"
                                  >
                                    {th}
                                  </th>
                                )
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {solicitacoes.map((item) => {
                              const isActive = item.id === selectedId && rightPanel === "detalhes";
                              return (
                                <tr
                                  key={item.id}
                                  onClick={() => openDetalhes(item.id)}
                                  className={`border-b border-[#1a1a1a]/50 cursor-pointer text-[12px] spring-hover ${
                                    isActive ? "bg-[#111]" : "hover:bg-[#0f0f0f]"
                                  }`}
                                >
                                  <td className="px-4 py-3 md:px-5 md:py-3 font-mono text-[11px] text-[#555]">{item.id}</td>
                                  <td className="px-4 py-3 md:px-5 md:py-3 font-medium text-[#ddd]">{item.clinica}</td>
                                  <td className="px-4 py-3 md:px-5 md:py-3 text-[#666]">{item.cliente}</td>
                                  <td className="px-4 py-3 md:px-5 md:py-3 text-[#888] font-medium">{brl(item.valor)}</td>
                                  <td className="px-4 py-3 md:px-5 md:py-3">
                                    <StatusPill
                                      label={item.statusIPA}
                                      variant={item.statusIPA === "Rascunho" ? "muted" : "default"}
                                    />
                                  </td>
                                  <td className="px-4 py-3 md:px-5 md:py-3">
                                    <StatusPill
                                      label={item.statusFinanceiro}
                                      variant={
                                        item.statusFinanceiro === "Pago"
                                          ? "blue"
                                          : item.statusFinanceiro === "Cancelado"
                                          ? "red"
                                          : "default"
                                      }
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "ipa" && (
              <motion.div key="ipa" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ type: "spring", bounce: 0, duration: 0.4 }} className="p-2.5 sm:p-4 md:p-6 space-y-2.5 sm:space-y-4 md:space-y-5 max-w-[1200px]">
                {/* TABLE / CARDS CONTAINER */}
                <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl overflow-hidden">
                  {/* Table Header */}
                  <div className="flex items-center justify-between px-3.5 py-2.5 sm:px-5 sm:py-3.5 border-b border-[#1a1a1a]">
                    <div className="flex items-center gap-2">
                      <h2 className="text-[12px] sm:text-[14px] font-semibold text-[#eee]">Minhas Solicitações</h2>
                      <span className="text-[9px] sm:text-[10px] bg-[#141414] border border-[#222] text-[#888] px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded-full font-mono">
                        {solicitacoes.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                      {/* Mobile View Toggle */}
                      <div className="sm:hidden flex bg-[#111] border border-[#222] rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => setMobileViewMode("cards")}
                          className={`px-2 py-0.5 text-[9px] font-semibold rounded transition-colors ${
                            mobileViewMode === "cards" ? "bg-[#252525] text-white" : "text-[#666] hover:text-[#aaa]"
                          }`}
                        >
                          Cards
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobileViewMode("table")}
                          className={`px-2 py-0.5 text-[9px] font-semibold rounded transition-colors ${
                            mobileViewMode === "table" ? "bg-[#252525] text-white" : "text-[#666] hover:text-[#aaa]"
                          }`}
                        >
                          Tabela
                        </button>
                      </div>

                      <button
                        onClick={openNovaSolicitacao}
                        className="bg-[#3B82F6] hover:bg-[#2563EB] text-white px-2.5 py-1 sm:pl-3 sm:pr-3.5 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition-colors flex items-center gap-1 sm:gap-1.5"
                      >
                        <span className="hidden sm:inline">Nova Solicitação</span>
                        <span className="sm:hidden">+ Nova</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Empty state */}
                  {solicitacoes.length === 0 ? (
                    <div className="py-8 text-center text-[#555] text-[11px]">
                      Nenhuma solicitação encontrada.
                    </div>
                  ) : (
                    <>
                      {/* MOBILE: CARDS VIEW */}
                      {mobileViewMode === "cards" && (
                        <div className="sm:hidden divide-y divide-[#1a1a1a]/60">
                          {solicitacoes.map((item) => {
                            const isActive = item.id === selectedId && rightPanel === "detalhes";
                            return (
                              <div
                                key={item.id}
                                onClick={() => openDetalhes(item.id)}
                                className={`p-3 transition-colors cursor-pointer active:bg-[#151515] flex flex-col gap-1.5 ${
                                  isActive ? "bg-[#141414]" : "hover:bg-[#0e0e0e]"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[10px] text-[#777] bg-[#141414] px-1.5 py-0.5 rounded border border-[#222]">
                                      {item.id}
                                    </span>
                                    {item.data && (
                                      <span className="text-[10px] text-[#555]">{item.data}</span>
                                    )}
                                  </div>
                                  <StatusPill
                                    label={item.statusIPA}
                                    variant={item.statusIPA === "Rascunho" ? "muted" : "default"}
                                  />
                                </div>
                                <div className="flex items-end justify-between gap-2 mt-0.5">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[12px] font-semibold text-[#eee] truncate leading-tight">
                                      {item.clinica}
                                    </p>
                                    <p className="text-[10px] text-[#666] truncate mt-0.5">
                                      {item.cliente}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-[12px] font-bold text-[#3B82F6]">
                                      {brl(item.valor)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* MOBILE: COMPACT TABLE (when toggled on mobile) */}
                      {mobileViewMode === "table" && (
                        <div className="sm:hidden overflow-x-hidden">
                          <table className="w-full text-left table-fixed">
                            <thead>
                              <tr className="border-b border-[#1a1a1a]">
                                <th className="w-[58px] px-2 py-2 text-[9px] font-semibold text-[#444] uppercase tracking-wider">ID</th>
                                <th className="px-2 py-2 text-[9px] font-semibold text-[#444] uppercase tracking-wider">Clínica / Cliente</th>
                                <th className="w-[74px] px-2 py-2 text-[9px] font-semibold text-[#444] uppercase tracking-wider text-right">Valor</th>
                                <th className="w-[84px] px-2 py-2 text-[9px] font-semibold text-[#444] uppercase tracking-wider text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {solicitacoes.map((item) => {
                                const isActive = item.id === selectedId && rightPanel === "detalhes";
                                return (
                                  <tr
                                    key={item.id}
                                    onClick={() => openDetalhes(item.id)}
                                    className={`border-b border-[#1a1a1a]/50 cursor-pointer text-[11px] spring-hover ${
                                      isActive ? "bg-[#111]" : "hover:bg-[#0f0f0f]"
                                    }`}
                                  >
                                    <td className="px-2 py-2 font-mono text-[10px] text-[#555] truncate">{item.id}</td>
                                    <td className="px-2 py-2 min-w-0">
                                      <div className="font-medium text-[#ddd] text-[11px] truncate leading-tight">{item.clinica}</div>
                                      <div className="text-[9px] text-[#666] truncate mt-0.5">{item.cliente}</div>
                                    </td>
                                    <td className="px-2 py-2 text-[#888] font-medium text-right text-[10px] truncate">{brl(item.valor)}</td>
                                    <td className="px-2 py-2 text-right">
                                      <StatusPill
                                        label={item.statusIPA}
                                        variant={item.statusIPA === "Rascunho" ? "muted" : "default"}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* DESKTOP TABLE (sm and above) */}
                      <div className="hidden sm:block overflow-x-auto no-scrollbar">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-[#1a1a1a]">
                              {["ID", "Clínica", "Empresa Cliente", "Valor", "Status IPA"].map(
                                (th) => (
                                  <th
                                    key={th}
                                    className="px-4 py-3 md:px-5 md:py-3.5 text-[10px] font-semibold text-[#444] uppercase tracking-wider whitespace-nowrap"
                                  >
                                    {th}
                                  </th>
                                )
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {solicitacoes.map((item) => {
                              const isActive = item.id === selectedId && rightPanel === "detalhes";
                              return (
                                <tr
                                  key={item.id}
                                  onClick={() => openDetalhes(item.id)}
                                  className={`border-b border-[#1a1a1a]/50 cursor-pointer text-[12px] spring-hover ${
                                    isActive ? "bg-[#111]" : "hover:bg-[#0f0f0f]"
                                  }`}
                                >
                                  <td className="px-4 py-3 md:px-5 md:py-3 font-mono text-[11px] text-[#555]">{item.id}</td>
                                  <td className="px-4 py-3 md:px-5 md:py-3 font-medium text-[#ddd]">{item.clinica}</td>
                                  <td className="px-4 py-3 md:px-5 md:py-3 text-[#666]">{item.cliente}</td>
                                  <td className="px-4 py-3 md:px-5 md:py-3 text-[#888] font-medium">{brl(item.valor)}</td>
                                  <td className="px-4 py-3 md:px-5 md:py-3">
                                    <StatusPill
                                      label={item.statusIPA}
                                      variant={item.statusIPA === "Rascunho" ? "muted" : "default"}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "financeiro" && (
              <motion.div key="financeiro" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ type: "spring", bounce: 0, duration: 0.4 }} className="p-2.5 sm:p-4 md:p-6 space-y-2.5 sm:space-y-4 md:space-y-5 max-w-[1200px]">
                {/* STATS for Finance */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  <StatCard
                    label="Pendentes"
                    value={String(totalEmPagamento).padStart(2, "0")}
                    trend="Requer atenção"
                    icon={<FileText size={13} strokeWidth={1.5} />}
                  />
                  <StatCard
                    label="Pagas"
                    value={String(solicitacoes.filter(s => s.statusFinanceiro === 'Pago').length).padStart(2, "0")}
                    trend="Tudo certo"
                    icon={<CheckCircle2 size={13} strokeWidth={1.5} />}
                  />
                  <StatCard
                    label="Valor a pagar"
                    value={brl(solicitacoes.filter(s => s.statusFinanceiro === 'Pendente').reduce((sum, s) => sum + s.valor, 0))}
                    trend="Total pendente"
                    icon={<DollarSign size={13} strokeWidth={1.5} />}
                    isWide
                    className="col-span-2 sm:col-span-1"
                  />
                </div>

                {/* TABLE / CARDS CONTAINER */}
                <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-2.5 sm:px-5 sm:py-3.5 border-b border-[#1a1a1a]">
                    <div className="flex items-center justify-between sm:justify-start gap-2">
                      <h2 className="text-[12px] sm:text-[14px] font-semibold text-[#eee]">Aprovações e Pagamentos</h2>
                      {/* Mobile View Toggle */}
                      <div className="sm:hidden flex bg-[#111] border border-[#222] rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => setMobileViewMode("cards")}
                          className={`px-2 py-0.5 text-[9px] font-semibold rounded transition-colors ${
                            mobileViewMode === "cards" ? "bg-[#252525] text-white" : "text-[#666] hover:text-[#aaa]"
                          }`}
                        >
                          Cards
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobileViewMode("table")}
                          className={`px-2 py-0.5 text-[9px] font-semibold rounded transition-colors ${
                            mobileViewMode === "table" ? "bg-[#252525] text-white" : "text-[#666] hover:text-[#aaa]"
                          }`}
                        >
                          Tabela
                        </button>
                      </div>
                    </div>
                    <select
                      value={financeDateFilter}
                      onChange={(e) => setFinanceDateFilter(e.target.value as any)}
                      className="bg-[#080808] border border-[#222] text-[#ccc] text-[10px] sm:text-[11px] px-2.5 py-1.5 rounded-lg outline-none cursor-pointer hover:border-[#333] transition-colors w-full sm:w-auto"
                    >
                      <option value="all">Todas as Datas</option>
                      <option value="hoje">Para Hoje</option>
                      <option value="amanha">Para Amanhã</option>
                      <option value="semana">Próximos 7 dias</option>
                      <option value="atrasados">Atrasados</option>
                    </select>
                  </div>

                  {(() => {
                    const filteredFinance = solicitacoes.filter(s => {
                      if (s.statusIPA === "Rascunho") return false;
                      if (financeDateFilter !== "all") {
                        if (!s.data_atendimento) return false;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        let targetDateStr = s.data_atendimento;
                        if (targetDateStr.includes('/')) {
                          const parts = targetDateStr.split('/');
                          if (parts.length === 3) targetDateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
                        }
                        const itemDate = new Date(targetDateStr + "T00:00:00");
                        const diffTime = itemDate.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (financeDateFilter === "hoje") return diffDays === 0;
                        if (financeDateFilter === "amanha") return diffDays === 1;
                        if (financeDateFilter === "semana") return diffDays >= 0 && diffDays <= 7;
                        if (financeDateFilter === "atrasados") return diffDays < 0 && s.statusFinanceiro === 'Pendente';
                      }
                      return true;
                    });

                    if (filteredFinance.length === 0) {
                      return (
                        <div className="py-8 text-center text-[#555] text-[11px]">
                          Nenhuma aprovação ou pagamento pendente.
                        </div>
                      );
                    }

                    return (
                      <>
                        {/* MOBILE: CARDS VIEW */}
                        {mobileViewMode === "cards" && (
                          <div className="sm:hidden divide-y divide-[#1a1a1a]/60">
                            {filteredFinance.map((item) => {
                              const isActive = item.id === selectedId && rightPanel === "detalhes";
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => openDetalhes(item.id)}
                                  className={`p-3 transition-colors cursor-pointer active:bg-[#151515] flex flex-col gap-1.5 ${
                                    isActive ? "bg-[#141414]" : "hover:bg-[#0e0e0e]"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono text-[10px] text-[#777] bg-[#141414] px-1.5 py-0.5 rounded border border-[#222]">
                                        {item.id}
                                      </span>
                                      {item.data && (
                                        <span className="text-[10px] text-[#555]">{item.data}</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <StatusPill
                                        label={item.statusFinanceiro}
                                        variant={
                                          item.statusFinanceiro === "Pago"
                                            ? "blue"
                                            : item.statusFinanceiro === "Cancelado"
                                            ? "red"
                                            : "default"
                                        }
                                      />
                                      <button className="text-[10px] px-2 py-0.5 rounded bg-[#3B82F6]/10 text-[#3B82F6] font-medium border border-[#3B82F6]/20">
                                        {item.statusFinanceiro === "Pendente" ? "Pagar" : "Ver"}
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-end justify-between gap-2 mt-0.5">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[12px] font-semibold text-[#eee] truncate leading-tight">
                                        {item.clinica}
                                      </p>
                                      <p className="text-[10px] text-[#666] truncate mt-0.5">
                                        {item.cliente}
                                      </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className="text-[12px] font-bold text-[#3B82F6]">
                                        {brl(item.valor)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* MOBILE: COMPACT TABLE (when toggled on mobile) */}
                        {mobileViewMode === "table" && (
                          <div className="sm:hidden overflow-x-hidden">
                            <table className="w-full text-left table-fixed">
                              <thead>
                                <tr className="border-b border-[#1a1a1a]">
                                  <th className="w-[58px] px-2 py-2 text-[9px] font-semibold text-[#444] uppercase tracking-wider">ID</th>
                                  <th className="px-2 py-2 text-[9px] font-semibold text-[#444] uppercase tracking-wider">Clínica / Cliente</th>
                                  <th className="w-[74px] px-2 py-2 text-[9px] font-semibold text-[#444] uppercase tracking-wider text-right">Valor</th>
                                  <th className="w-[84px] px-2 py-2 text-[9px] font-semibold text-[#444] uppercase tracking-wider text-right">Ação</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredFinance.map((item) => {
                                  const isActive = item.id === selectedId && rightPanel === "detalhes";
                                  return (
                                    <tr
                                      key={item.id}
                                      onClick={() => openDetalhes(item.id)}
                                      className={`border-b border-[#1a1a1a]/50 cursor-pointer text-[11px] spring-hover ${
                                        isActive ? "bg-[#111]" : "hover:bg-[#0f0f0f]"
                                      }`}
                                    >
                                      <td className="px-2 py-2 font-mono text-[10px] text-[#555] truncate">{item.id}</td>
                                      <td className="px-2 py-2 min-w-0">
                                        <div className="font-medium text-[#ddd] text-[11px] truncate leading-tight">{item.clinica}</div>
                                        <div className="text-[9px] text-[#666] truncate mt-0.5">{item.cliente}</div>
                                      </td>
                                      <td className="px-2 py-2 text-[#888] font-medium text-right text-[10px] truncate">{brl(item.valor)}</td>
                                      <td className="px-2 py-2 text-right">
                                        <button className="text-[10px] px-2 py-0.5 rounded bg-[#3B82F6]/10 text-[#3B82F6] font-medium border border-[#3B82F6]/20">
                                          {item.statusFinanceiro === "Pendente" ? "Pagar" : "Ver"}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* DESKTOP TABLE (sm and above) */}
                        <div className="hidden sm:block overflow-x-auto no-scrollbar">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-[#1a1a1a]">
                                {["ID", "Clínica", "Empresa Cliente", "Valor", "Status Financeiro", "Ação"].map(
                                  (th) => (
                                    <th
                                      key={th}
                                      className="px-4 py-3 md:px-5 md:py-3.5 text-[10px] font-semibold text-[#444] uppercase tracking-wider whitespace-nowrap"
                                    >
                                      {th}
                                    </th>
                                  )
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {filteredFinance.map((item) => {
                                const isActive = item.id === selectedId && rightPanel === "detalhes";
                                return (
                                  <tr
                                    key={item.id}
                                    onClick={() => openDetalhes(item.id)}
                                    className={`border-b border-[#1a1a1a]/50 cursor-pointer text-[12px] spring-hover ${
                                      isActive ? "bg-[#111]" : "hover:bg-[#0f0f0f]"
                                    }`}
                                  >
                                    <td className="px-4 py-3 md:px-5 md:py-3 font-mono text-[11px] text-[#555]">{item.id}</td>
                                    <td className="px-4 py-3 md:px-5 md:py-3 font-medium text-[#ddd]">{item.clinica}</td>
                                    <td className="px-4 py-3 md:px-5 md:py-3 text-[#666]">{item.cliente}</td>
                                    <td className="px-4 py-3 md:px-5 md:py-3 text-[#888] font-medium">{brl(item.valor)}</td>
                                    <td className="px-4 py-3 md:px-5 md:py-3">
                                      <StatusPill
                                        label={item.statusFinanceiro}
                                        variant={
                                          item.statusFinanceiro === "Pago"
                                            ? "blue"
                                            : item.statusFinanceiro === "Cancelado"
                                            ? "red"
                                            : "default"
                                        }
                                      />
                                    </td>
                                    <td className="px-4 py-3 md:px-5 md:py-3">
                                      <button className="text-[11px] text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors">
                                        {item.statusFinanceiro === "Pendente" ? "Processar" : "Ver"}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </motion.div>
            )}

            {activeTab === "relatorios" && (
              <motion.div key="relatorios" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ type: "spring", bounce: 0, duration: 0.4 }} className="p-2.5 sm:p-4 md:p-6 space-y-2.5 sm:space-y-4 md:space-y-5 max-w-[1200px]" id="relatorios-content">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[15px] sm:text-[18px] font-bold tracking-tight text-[#eee]">Relatórios Gerenciais</h2>
                  <button className="bg-[#111] hover:bg-[#1a1a1a] border border-[#222] text-[#ccc] pl-3 pr-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1.5" onClick={exportPDF} data-html2canvas-ignore>
                    Exportar PDF
                    <ArrowRight size={13} />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Left Column - Metrics */}
                  <div className="space-y-5">
                    <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl p-5">
                      <h3 className="text-[12px] font-semibold text-[#888] mb-4 uppercase tracking-wider">Métricas de Solicitações (IPA)</h3>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-[11px] mb-1.5"><span className="text-[#666]">Enviadas para o Financeiro</span><span className="font-medium text-[#ccc]">{solicitacoes.filter(s => s.statusIPA === 'Enviado').length}</span></div>
                          <div className="w-full bg-[#111] rounded-full h-1.5 overflow-hidden"><div className="bg-[#3B82F6] h-1.5 rounded-full" style={{ width: `${(solicitacoes.filter(s => s.statusIPA === 'Enviado').length / Math.max(solicitacoes.length, 1)) * 100}%` }}></div></div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] mb-1.5"><span className="text-[#666]">Em Rascunho</span><span className="font-medium text-[#ccc]">{solicitacoes.filter(s => s.statusIPA === 'Rascunho').length}</span></div>
                          <div className="w-full bg-[#111] rounded-full h-1.5 overflow-hidden"><div className="bg-[#555] h-1.5 rounded-full" style={{ width: `${(solicitacoes.filter(s => s.statusIPA === 'Rascunho').length / Math.max(solicitacoes.length, 1)) * 100}%` }}></div></div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl p-5">
                      <h3 className="text-[12px] font-semibold text-[#888] mb-4 uppercase tracking-wider">Performance Financeira</h3>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-[11px] mb-1.5"><span className="text-[#666]">Taxa de Pagamento Concluído</span><span className="font-medium text-[#2dd4bf]">{((solicitacoes.filter(s => s.statusFinanceiro === 'Pago').length / Math.max(solicitacoes.length, 1)) * 100).toFixed(0)}%</span></div>
                          <div className="w-full bg-[#111] rounded-full h-1.5 overflow-hidden"><div className="bg-[#2dd4bf] h-1.5 rounded-full" style={{ width: `${(solicitacoes.filter(s => s.statusFinanceiro === 'Pago').length / Math.max(solicitacoes.length, 1)) * 100}%` }}></div></div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] mb-1.5"><span className="text-[#666]">Pagamentos Pendentes</span><span className="font-medium text-[#fbbf24]">{((solicitacoes.filter(s => s.statusFinanceiro === 'Pendente').length / Math.max(solicitacoes.length, 1)) * 100).toFixed(0)}%</span></div>
                          <div className="w-full bg-[#111] rounded-full h-1.5 overflow-hidden"><div className="bg-[#fbbf24] h-1.5 rounded-full" style={{ width: `${(solicitacoes.filter(s => s.statusFinanceiro === 'Pendente').length / Math.max(solicitacoes.length, 1)) * 100}%` }}></div></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Volume */}
                  <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl p-5 flex flex-col min-h-[300px]">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[12px] font-semibold text-[#888] uppercase tracking-wider">Volume de Solicitações</h3>
                      <div className="flex bg-[#111] border border-[#222] rounded-lg p-0.5">
                        <button
                          onClick={() => setReportPeriod("mes")}
                          className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${reportPeriod === "mes" ? "bg-[#3B82F6] text-white" : "text-[#666] hover:text-[#ccc]"}`}
                        >
                          Por Mês (Este ano)
                        </button>
                        <button
                          onClick={() => setReportPeriod("dia")}
                          className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${reportPeriod === "dia" ? "bg-[#3B82F6] text-white" : "text-[#666] hover:text-[#ccc]"}`}
                        >
                          Por Dia (Este mês)
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 flex items-end justify-between gap-1.5 pt-10">
                       {reportPeriod === "mes" ? (
                         chartData.meses.map((item: { valor: number, altura: number }, i: number) => (
                           <div key={`mes-${i}`} className="w-full bg-[#1a1a1a] hover:bg-[#3B82F6] transition-colors rounded-t-sm group relative" style={{ height: `${Math.max(item.altura, 2)}%` }}>
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-[9px] text-[#888] transition-opacity pointer-events-none whitespace-nowrap bg-[#111] border border-[#222] px-2 py-0.5 rounded">
                                {item.valor} unid.
                              </div>
                           </div>
                         ))
                       ) : (
                         chartData.dias.map((item: { valor: number, altura: number }, i: number) => (
                           <div key={`dia-${i}`} className="w-full bg-[#1a1a1a] hover:bg-[#3B82F6] transition-colors rounded-t-sm group relative" style={{ height: `${Math.max(item.altura, 2)}%` }}>
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-[9px] text-[#888] transition-opacity pointer-events-none whitespace-nowrap z-10 bg-[#111] border border-[#222] px-2 py-0.5 rounded">
                                {item.valor} unid.
                              </div>
                           </div>
                         ))
                       )}
                    </div>
                    <div className="flex justify-between mt-4 text-[10px] text-[#555] uppercase font-semibold">
                      {reportPeriod === "mes" ? (
                        <><span>Jan</span><span>Dez</span></>
                      ) : (
                        <><span>01</span><span>{String(chartData.diasNoMes).padStart(2, '0')}</span></>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "configuracoes" && (
              <motion.div key="configuracoes" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ type: "spring", bounce: 0, duration: 0.4 }} className="p-2.5 sm:p-4 md:p-6 space-y-2.5 sm:space-y-4 md:space-y-5 max-w-[800px] mx-auto w-full">
                <h2 className="text-[15px] sm:text-[18px] font-bold tracking-tight text-[#eee] mb-4 sm:mb-6">Configurações do Sistema</h2>
                
                <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl overflow-hidden">
                  <div className="p-5 border-b border-[#1a1a1a]">
                    <h3 className="text-[14px] font-semibold text-[#ddd] mb-1">Meu Perfil</h3>
                    <p className="text-[11px] text-[#666]">Gerencie suas informações pessoais e cargo.</p>
                  </div>
                  
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-[#999]">Nome Completo</label>
                        <input type="text" value={session?.user?.user_metadata?.nome || ""} disabled className="w-full bg-[#050505] border border-[#1a1a1a] rounded-lg px-3 py-2 text-[12px] text-[#555] outline-none cursor-not-allowed" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-[#999]">E-mail corporativo</label>
                        <input type="email" value={session?.user?.email || ""} disabled className="w-full bg-[#050505] border border-[#1a1a1a] rounded-lg px-3 py-2 text-[12px] text-[#555] outline-none cursor-not-allowed" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[#999]">Nível de Acesso (Role)</label>
                      <input type="text" value={userRole === "ipa" ? "Setor IPA (Criar Solicitações)" : "Financeiro (Aprovações)"} disabled className="w-full bg-[#050505] border border-[#111] rounded-lg px-3 py-2 text-[12px] text-[#555] outline-none cursor-not-allowed" />
                      <p className="text-[10px] text-[#555] mt-1">Seu nível de acesso é definido pelo administrador e gerido pelas políticas RLS do Supabase.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl overflow-hidden">
                  <div className="p-5 border-b border-[#1a1a1a]">
                    <h3 className="text-[14px] font-semibold text-[#ddd] mb-1">Notificações</h3>
                    <p className="text-[11px] text-[#666]">Controle como você deseja ser alertado pelo sistema.</p>
                  </div>
                  
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        {userRole === "financeiro" ? (
                          <>
                            <p className="text-[12px] font-medium text-[#ccc]">Atualizações de Solicitações</p>
                            <p className="text-[11px] text-[#666]">Receber e-mail quando o setor IPA enviar ou editar solicitações.</p>
                          </>
                        ) : (
                          <>
                            <p className="text-[12px] font-medium text-[#ccc]">Atualizações de Pagamentos</p>
                            <p className="text-[11px] text-[#666]">Receber e-mail quando o setor Financeiro confirmar pagamentos.</p>
                          </>
                        )}
                      </div>
                      <button 
                        onClick={() => updatePreference('notif_alerts_enabled', !notifAlertsEnabled)}
                        className={`w-10 h-[22px] flex items-center rounded-full p-[3px] transition-colors ${notifAlertsEnabled ? "bg-[#3B82F6]" : "bg-[#222]"}`}
                      >
                        <div className={`w-4 h-4 rounded-full shadow-sm transition-transform ${notifAlertsEnabled ? "bg-white translate-x-[18px]" : "bg-[#888] translate-x-0"}`}></div>
                      </button>
                    </div>

                    {notifAlertsEnabled && (
                      <div className="pt-2 pb-1 animate-in slide-in-from-top-2 fade-in duration-200">
                        <label className="text-[11px] font-medium text-[#888] block mb-1.5">E-mail para recebimento</label>
                        <input 
                          type="email" 
                          value={notifEmail}
                          onChange={(e) => setNotifEmail(e.target.value)}
                          onBlur={(e) => updatePreference('notif_email', e.target.value)}
                          placeholder="exemplo@empresa.com.br"
                          className="w-full max-w-[400px] bg-[#050505] border border-[#1a1a1a] focus:border-[#3B82F6] rounded-lg px-3 py-2 text-[12px] text-[#ccc] placeholder:text-[#333] outline-none transition-colors" 
                        />
                      </div>
                    )}
                    
                    <div className="h-px bg-[#1a1a1a]" />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[12px] font-medium text-[#ccc]">Alertas de Segurança</p>
                        <p className="text-[11px] text-[#666]">Notificar sobre novos acessos à sua conta.</p>
                      </div>
                      <button 
                        onClick={() => updatePreference('notif_sec_enabled', !notifSecEnabled)}
                        className={`w-10 h-[22px] flex items-center rounded-full p-[3px] transition-colors ${notifSecEnabled ? "bg-[#3B82F6]" : "bg-[#222]"}`}
                      >
                        <div className={`w-4 h-4 rounded-full shadow-sm transition-transform ${notifSecEnabled ? "bg-white translate-x-[18px]" : "bg-[#888] translate-x-0"}`}></div>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white px-5 py-2 rounded-lg text-[12px] font-semibold transition-colors" onClick={() => alert('Configurações salvas com sucesso!')}>
                    Salvar Alterações
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === "acessos" && (
              <motion.div key="acessos" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ type: "spring", bounce: 0, duration: 0.4 }} className="p-2.5 sm:p-4 md:p-6 space-y-2.5 sm:space-y-4 md:space-y-5 max-w-[800px] mx-auto w-full">
                <h2 className="text-[15px] sm:text-[18px] font-bold tracking-tight text-[#eee] mb-4 sm:mb-6">Controle de Acessos</h2>
                <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#1a1a1a]">
                    <h3 className="text-[14px] font-semibold text-[#ddd]">Usuários Pendentes</h3>
                    <p className="text-[11px] text-[#666]">Aprove ou rejeite o acesso de novos membros à plataforma.</p>
                  </div>
                  {pendingUsers.length === 0 ? (
                    <div className="p-10 text-center text-[#555] text-[12px]">
                      Nenhum usuário pendente no momento.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#1a1a1a]">
                      {pendingUsers.map(user => (
                        <div key={user.id} className="p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#111] transition-colors">
                          <div className="flex flex-col gap-0.5 sm:gap-1">
                            <span className="text-[12px] sm:text-[13px] font-semibold text-[#ccc]">{user.nome}</span>
                            <span className="text-[10px] sm:text-[11px] text-[#666]">{user.email}</span>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                            <span className="text-[9px] sm:text-[10px] bg-[#1a1a1a] text-[#888] px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md font-medium uppercase tracking-wider">
                              Solicita: {user.roleRequested}
                            </span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleRejeitar(user.id)} className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-[#EF4444]/20 text-[#EF4444] hover:bg-[#EF4444]/10 text-[10px] sm:text-[11px] font-semibold transition-colors">Rejeitar</button>
                              <button onClick={() => handleAprovar(user.id)} className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[10px] sm:text-[11px] font-semibold transition-colors">Aprovar Acesso</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            </AnimatePresence>
          </section>

          {/* ── RIGHT PANEL (slides in) ── */}
          <AnimatePresence>
            {rightPanel !== "none" && (
              <motion.aside
                key="right-panel-mobile"
                initial={{ x: "100%", opacity: 0.5 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 0 }}
                transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                className="md:hidden absolute inset-y-0 right-0 z-50 w-full bg-[#0c0c0c] flex flex-col shrink-0 shadow-[0_0_40px_rgba(0,0,0,0.5)]"
              >
              {rightPanel === "nova" || rightPanel === "editar" ? (
                <NovaSolicitacaoPanel
                  isEditing={rightPanel === "editar"}
                  userRole={userRole}
                  onClose={closePanel}
                  onOpenCadastro={(type) => setModalCadastro(type)}
                  mockClinicas={mockClinicas}
                  mockEmpresas={mockEmpresas}
                  formClinica={formClinica}
                  setFormClinica={handleSelectClinica}
                  formEstado={formEstado}
                  setFormEstado={setFormEstado}
                  formCidade={formCidade}
                  setFormCidade={setFormCidade}
                  formCliente={formCliente}
                  setFormCliente={setFormCliente}
                  formColabInput={formColabInput}
                  setFormColabInput={setFormColabInput}
                  formColabs={formColabs}
                  addColab={addColab}
                  removeColab={removeColab}
                  formValor={formValor}
                  setFormValor={setFormValor}
                  formPix={formPix}
                  setFormPix={setFormPix}
                  formDataAtendimento={formDataAtendimento}
                  setFormDataAtendimento={setFormDataAtendimento}
                  onSubmit={handleSubmit}
                  isSubmitting={isSubmitting}
                />
              ) : selectedReq ? (
                <DetalhesPanel
                  req={selectedReq}
                  onClose={closePanel}
                  copiedId={copiedId}
                  onCopyId={copyId}
                  onTogglePayment={togglePayment}
                  uploadedFile={uploadedFile}
                  setUploadedFile={setUploadedFile}
                  uploadedFileSize={uploadedFileSize}
                  setUploadedFileSize={setUploadedFileSize}
                  uploadedNF={uploadedNF}
                  setUploadedNF={setUploadedNF}
                  uploadedNFSize={uploadedNFSize}
                  setUploadedNFSize={setUploadedNFSize}
                  userRole={userRole}
                  onSave={handleSaveDetalhes}
                  onEdit={() => handleEdit(selectedReq.id)}
                  onAprovar={handleAprovarSolicitacao}
                />
              ) : null}
              </motion.aside>
            )}
          </AnimatePresence>

          {/* DESKTOP */}
          <AnimatePresence>
            {rightPanel !== "none" && (
              <motion.aside
                key="right-panel-desktop"
                initial={{ marginRight: -380, opacity: 0.5 }}
                animate={{ marginRight: 0, opacity: 1 }}
                exit={{ marginRight: -380, opacity: 0 }}
                transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                className="hidden md:flex relative z-40 w-[380px] bg-[#0c0c0c] border-l border-[#1a1a1a] flex-col shrink-0 shadow-[0_0_40px_rgba(0,0,0,0.5)]"
              >
              {rightPanel === "nova" || rightPanel === "editar" ? (
                <NovaSolicitacaoPanel
                  isEditing={rightPanel === "editar"}
                  userRole={userRole}
                  onClose={closePanel}
                  onOpenCadastro={(type) => setModalCadastro(type)}
                  mockClinicas={mockClinicas}
                  mockEmpresas={mockEmpresas}
                  formClinica={formClinica}
                  setFormClinica={handleSelectClinica}
                  formEstado={formEstado}
                  setFormEstado={setFormEstado}
                  formCidade={formCidade}
                  setFormCidade={setFormCidade}
                  formCliente={formCliente}
                  setFormCliente={setFormCliente}
                  formColabInput={formColabInput}
                  setFormColabInput={setFormColabInput}
                  formColabs={formColabs}
                  addColab={addColab}
                  removeColab={removeColab}
                  formValor={formValor}
                  setFormValor={setFormValor}
                  formPix={formPix}
                  setFormPix={setFormPix}
                  formDataAtendimento={formDataAtendimento}
                  setFormDataAtendimento={setFormDataAtendimento}
                  onSubmit={handleSubmit}
                  isSubmitting={isSubmitting}
                />
              ) : selectedReq ? (
                <DetalhesPanel
                  req={selectedReq}
                  onClose={closePanel}
                  copiedId={copiedId}
                  onCopyId={copyId}
                  onTogglePayment={togglePayment}
                  uploadedFile={uploadedFile}
                  setUploadedFile={setUploadedFile}
                  uploadedFileSize={uploadedFileSize}
                  setUploadedFileSize={setUploadedFileSize}
                  uploadedNF={uploadedNF}
                  setUploadedNF={setUploadedNF}
                  uploadedNFSize={uploadedNFSize}
                  setUploadedNFSize={setUploadedNFSize}
                  userRole={userRole}
                  onSave={handleSaveDetalhes}
                  onEdit={() => handleEdit(selectedReq.id)}
                  onAprovar={handleAprovarSolicitacao}
                />
              ) : null}
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* ── CADASTRO MODAL (CNPJ) ── */}
      {modalCadastro !== "none" && (
        <CadastroEmpresaModal
          type={modalCadastro}
          onClose={() => setModalCadastro("none")}
          onSuccess={(newData) => {
            if (modalCadastro === "clinica") {
               setMockClinicas([...mockClinicas, { ...newData }]);
               setFormClinica(newData.nome);
               if (newData.uf) setFormEstado(newData.uf);
               if (newData.municipio) setFormCidade(newData.municipio);
               if (newData.chave_pix) setFormPix(newData.chave_pix);
            } else {
               setMockEmpresas([...mockEmpresas, { ...newData }]);
               setFormCliente(newData.nome);
               if (newData.uf) setFormEstado(newData.uf);
               if (newData.municipio) setFormCidade(newData.municipio);
            }
            setModalCadastro("none");
          }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUBCOMPONENTS
   ══════════════════════════════════════════════════════════════ */

/* ── Stat Card ── */
function StatCard({
  label,
  value,
  trend,
  icon,
  isWide,
  className,
}: {
  label: string;
  value: string;
  trend: string;
  icon: React.ReactNode;
  isWide?: boolean;
  className?: string;
}) {
  return (
    <div className={`bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl p-2.5 sm:p-4 flex flex-col justify-between min-h-[76px] sm:min-h-[110px] group hover:border-[#252525] transition-colors ${className || ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] sm:text-[11px] font-medium text-[#666] truncate">{label}</span>
        <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-md border border-[#1a1a1a] flex items-center justify-center text-[#444] group-hover:text-[#666] transition-colors shrink-0">
          {icon}
        </div>
      </div>
      <div>
        <p className={`font-semibold text-[#eee] tracking-tight leading-none ${isWide ? "text-[14px] sm:text-[20px]" : "text-[17px] sm:text-[26px]"}`}>
          {value}
        </p>
        <p className="text-[9px] sm:text-[10px] text-[#2dd4bf] font-medium mt-1 sm:mt-1.5 truncate">{trend}</p>
      </div>
    </div>
  );
}

/* ── Status Pill ── */
function StatusPill({
  label,
  variant,
}: {
  label: string;
  variant: "default" | "blue" | "red" | "muted";
}) {
  const styles: Record<typeof variant, string> = {
    default: "bg-[#111] border-[#1a1a1a] text-[#777]",
    blue: "bg-[#3B82F6]/10 border-[#3B82F6]/20 text-[#3B82F6]",
    red: "bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444]",
    muted: "bg-[#111] border-[#1a1a1a] text-[#555]",
  };

  const dotStyles: Record<typeof variant, string> = {
    default: "bg-[#555]",
    blue: "bg-[#3B82F6]",
    red: "bg-[#EF4444]",
    muted: "bg-[#444]",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 sm:gap-1.5 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-medium border whitespace-nowrap ${styles[variant]}`}
    >
      <span className={`w-1 h-1 sm:w-[5px] sm:h-[5px] rounded-full shrink-0 ${dotStyles[variant]}`} />
      <span>{label}</span>
    </span>
  );
}

/* ── Panel Header ── */
function PanelHeader({ title, onClose, onEdit }: { title: string; onClose: () => void; onEdit?: () => void }) {
  return (
    <div className="h-12 sm:h-14 px-3.5 sm:px-5 flex items-center justify-between border-b border-[#1a1a1a] shrink-0">
      <h2 className="text-[12px] sm:text-[13px] font-semibold text-[#ddd]">{title}</h2>
      <div className="flex items-center gap-2">
        {onEdit && (
          <button 
            onClick={onEdit}
            className="px-3 py-1 rounded bg-[#111] hover:bg-[#1a1a1a] text-[#888] hover:text-[#bbb] text-[11px] font-medium transition-colors border border-[#1a1a1a]"
          >
            Editar
          </button>
        )}
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-md text-[#555] hover:text-[#999] hover:bg-[#151515] transition-colors"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

/* ── Input Field ── */
function InputField({
  label,
  hint,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-[#999]">{label}</label>
      {hint && <p className="text-[10px] text-[#444]">{hint}</p>}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#080808] border border-[#1a1a1a] focus:border-[#3B82F6] rounded-lg px-3 py-2 text-[12px] text-[#ccc] placeholder:text-[#333] outline-none transition-colors"
      />
    </div>
  );
}

/* ── Nova Solicitação Panel ── */
function NovaSolicitacaoPanel({
  isEditing,
  userRole,
  onClose,
  onOpenCadastro,
  mockClinicas,
  mockEmpresas,
  formClinica,
  setFormClinica,
  formEstado,
  setFormEstado,
  formCidade,
  setFormCidade,
  formCliente,
  setFormCliente,
  formColabInput,
  setFormColabInput,
  formColabs,
  addColab,
  removeColab,
  formValor,
  setFormValor,
  formPix,
  setFormPix,
  formDataAtendimento,
  setFormDataAtendimento,
  onSubmit,
  isSubmitting,
}: {
  isEditing?: boolean;
  onClose: () => void;
  onOpenCadastro: (type: "clinica" | "empresa") => void;
  mockClinicas: { id: string, nome: string }[];
  mockEmpresas: { id: string, nome: string }[];
  formClinica: string;
  setFormClinica: (v: string) => void;
  formEstado: string;
  setFormEstado: (v: string) => void;
  formCidade: string;
  setFormCidade: (v: string) => void;
  formCliente: string;
  setFormCliente: (v: string) => void;
  formColabInput: string;
  setFormColabInput: (v: string) => void;
  formColabs: string[];
  addColab: () => void;
  removeColab: (i: number) => void;
  formValor: string;
  setFormValor: (v: string) => void;
  formPix: string;
  setFormPix: (v: string) => void;
  formDataAtendimento: string;
  setFormDataAtendimento: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  userRole?: "ipa" | "financeiro" | "empresa" | null;
}) {
  return (
    <>
      <PanelHeader title={isEditing ? "EDITAR SOLICITAÇÃO" : "NOVA SOLICITAÇÃO (IPA)"} onClose={onClose} />
      <form onSubmit={onSubmit} className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
        <div className="p-3.5 sm:p-5 space-y-3 sm:space-y-4 flex-1">
          {/* Clínica */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[#999]">Clínica Terceirizada</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={formClinica}
                  onChange={(e) => setFormClinica(e.target.value)}
                  className="w-full appearance-none bg-[#080808] border border-[#1a1a1a] focus:border-[#3B82F6] rounded-lg px-3 py-2 text-[12px] text-[#ccc] outline-none transition-colors cursor-pointer"
                >
                  <option value="">Selecione uma clínica...</option>
                  {mockClinicas.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
              </div>
              <button type="button" onClick={() => onOpenCadastro("clinica")} className="w-9 h-9 bg-[#111] border border-[#1a1a1a] hover:border-[#333] text-[#666] hover:text-white rounded-lg flex items-center justify-center transition-colors shrink-0">
                <Plus size={15} />
              </button>
            </div>
          </div>

          {/* Estado / Cidade (Oculto para Empresa) */}
          {userRole !== "empresa" && (
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-[11px] font-semibold text-[#999]">Estado</label>
                <div className="relative">
                  <select
                    value={formEstado}
                    onChange={(e) => setFormEstado(e.target.value)}
                    className="w-full appearance-none bg-[#080808] border border-[#1a1a1a] focus:border-[#3B82F6] rounded-lg px-3 py-2 text-[12px] text-[#ccc] outline-none transition-colors cursor-pointer"
                  >
                    <option>Selecione</option>
                    <option>RN</option>
                    <option>SP</option>
                    <option>RJ</option>
                    <option>CE</option>
                    <option>PE</option>
                    <option>BA</option>
                    <option>MG</option>
                  </select>
                  <ChevronDown
                    size={13}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none"
                  />
                </div>
              </div>
              <div className="col-span-3 space-y-1">
                <label className="text-[11px] font-semibold text-[#999]">Cidade</label>
                <input
                  type="text"
                  value={formCidade}
                  onChange={(e) => setFormCidade(e.target.value)}
                  placeholder="Ex: Mossoró"
                  className="w-full bg-[#080808] border border-[#1a1a1a] focus:border-[#3B82F6] rounded-lg px-3 py-2 text-[12px] text-[#ccc] placeholder:text-[#333] outline-none transition-colors"
                />
              </div>
            </div>
          )}

          {/* Data Atendimento (Oculto para Empresa) */}
          {userRole !== "empresa" && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#999]">Data do Atendimento</label>
              <input
                type="date"
                value={formDataAtendimento}
                onChange={(e) => setFormDataAtendimento(e.target.value)}
                className="w-full bg-[#080808] border border-[#1a1a1a] focus:border-[#3B82F6] rounded-lg px-3 py-2 text-[12px] text-[#ccc] outline-none transition-colors [color-scheme:dark]"
                required
              />
            </div>
          )}

          {/* PIX (Vinculado à Clínica) */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[#999]">Chave PIX da Clínica</label>
            <input
              type="text"
              value={formPix}
              onChange={(e) => setFormPix(e.target.value)}
              placeholder="CNPJ, E-mail, Telefone ou Aleatória"
              className="w-full bg-[#080808] border border-[#1a1a1a] focus:border-[#3B82F6] rounded-lg px-3 py-2 text-[12px] text-[#ccc] placeholder:text-[#333] outline-none transition-colors"
            />
            <p className="text-[9px] text-[#555]">Esta chave será salva para a clínica selecionada.</p>
          </div>

          {/* Empresa (Oculto para Empresa) */}
          {userRole !== "empresa" && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#999]">Empresa Cliente</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={formCliente}
                    onChange={(e) => setFormCliente(e.target.value)}
                    className="w-full appearance-none bg-[#080808] border border-[#1a1a1a] focus:border-[#3B82F6] rounded-lg px-3 py-2 text-[12px] text-[#ccc] outline-none transition-colors cursor-pointer"
                  >
                    <option value="">Selecione uma empresa...</option>
                    {mockEmpresas.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                </div>
                <button type="button" onClick={() => onOpenCadastro("empresa")} className="w-9 h-9 bg-[#111] border border-[#1a1a1a] hover:border-[#333] text-[#666] hover:text-white rounded-lg flex items-center justify-center transition-colors shrink-0">
                  <Plus size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Colaboradores */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-[#999]">Colaboradores</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formColabInput}
                onChange={(e) => setFormColabInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addColab();
                  }
                }}
                placeholder="Nome do colaborador"
                className="flex-1 bg-[#080808] border border-[#1a1a1a] focus:border-[#3B82F6] rounded-lg px-3 py-2 text-[12px] text-[#ccc] placeholder:text-[#333] outline-none transition-colors"
              />
              <button
                type="button"
                onClick={addColab}
                className="w-9 h-9 bg-[#111] border border-[#1a1a1a] hover:border-[#333] text-[#666] hover:text-white rounded-lg flex items-center justify-center transition-colors shrink-0"
              >
                <Plus size={15} />
              </button>
            </div>
            <div className="space-y-1">
              {formColabs.map((nome, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#080808] border border-[#1a1a1a] text-[11px] text-[#777]"
                >
                  <span>{nome}</span>
                  <button
                    type="button"
                    onClick={() => removeColab(i)}
                    className="text-[#444] hover:text-[#999] transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Valor */}
          <InputField
            label="Valor total do exame"
            placeholder="R$ 0,00"
            value={formValor}
            onChange={setFormValor}
          />
        </div>

        {/* Submit */}
        <div className="p-5 border-t border-[#1a1a1a] shrink-0">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-white hover:bg-[#eee] disabled:bg-[#ccc] disabled:cursor-not-allowed text-[#080808] font-semibold text-[12px] py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {isSubmitting ? "Salvando..." : isEditing ? "Salvar Edição" : "Enviar para Financeiro"}
            {!isSubmitting && <ArrowRight size={14} />}
          </button>
        </div>
      </form>
    </>
  );
}

/* ── Detalhes da Solicitação Panel ── */
function DetalhesPanel({
  req,
  onClose,
  copiedId,
  onCopyId,
  onTogglePayment,
  uploadedFile,
  setUploadedFile,
  uploadedFileSize,
  setUploadedFileSize,
  uploadedNF,
  setUploadedNF,
  uploadedNFSize,
  setUploadedNFSize,
  userRole,
  onSave,
  onEdit,
  onAprovar,
}: {
  req: Solicitacao;
  onClose: () => void;
  copiedId: boolean;
  onCopyId: () => void;
  onTogglePayment: () => void;
  uploadedFile: string | null;
  setUploadedFile: (v: string | null) => void;
  uploadedFileSize: string | null;
  setUploadedFileSize: (v: string | null) => void;
  uploadedNF: string | null;
  setUploadedNF: (v: string | null) => void;
  uploadedNFSize: string | null;
  setUploadedNFSize: (v: string | null) => void;
  userRole: "ipa" | "financeiro" | "empresa" | null;
  onSave: () => void;
  onEdit: () => void;
  onAprovar: () => void;
}) {
  const isPago = req.statusFinanceiro === "Pago";
  const canEditPayment = userRole === "financeiro";
  const canUploadNF = userRole === "ipa" && (req.statusIPA === "Aguardando NF" || req.statusIPA === "Concluído");

  return (
    <>
      <PanelHeader 
        title="Detalhes da Solicitação" 
        onClose={onClose} 
        onEdit={userRole === "ipa" && req.statusFinanceiro === "Pendente" ? onEdit : undefined}
      />
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
        <div className="p-3.5 sm:p-5 space-y-3.5 sm:space-y-5 flex-1">
          {/* ID */}
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-[#eee] tracking-tight">{req.id}</span>
            <button
              onClick={onCopyId}
              className="p-1 rounded hover:bg-[#151515] text-[#555] hover:text-[#999] transition-colors"
            >
              {copiedId ? (
                <Check size={13} className="text-[#2dd4bf]" />
              ) : (
                <Copy size={13} strokeWidth={1.5} />
              )}
            </button>
          </div>

          {/* Metadata */}
          <div className="space-y-3">
            <MetaRow icon={<Building2 size={14} />} label="Clínica" value={req.clinica} />
            <MetaRow icon={<Building2 size={14} />} label="Empresa Cliente" value={req.cliente} />
            <MetaRow icon={<Calendar size={14} />} label="Solicitado em" value={req.data} />
            {req.data_atendimento && (
              <MetaRow icon={<Calendar size={14} />} label="Data Atendimento" value={req.data_atendimento} />
            )}
            <MetaRow icon={<Users size={14} />} label="Colaboradores" value={String(req.qtdColaboradores)} />
            
            {req.colaboradoresList && req.colaboradoresList.length > 0 && (
              <div className="pl-6 pt-1 flex flex-col gap-1">
                {req.colaboradoresList.map((colab, i) => (
                  <span key={i} className="text-[11px] text-[#666] before:content-['-'] before:mr-1.5">{colab}</span>
                ))}
              </div>
            )}
            
            {req.solicitado_por_nome && (
              <MetaRow icon={<Users size={14} />} label="Solicitado por" value={req.solicitado_por_nome} />
            )}
            {req.aprovado_por_nome && (
              <MetaRow icon={<Users size={14} />} label="Aprovado por" value={req.aprovado_por_nome} />
            )}

            <MetaRow icon={<DollarSign size={14} />} label="Valor" value={brl(req.valor)} />
          </div>

          <div className="h-px bg-[#1a1a1a]" />

          {/* Aprovação IPA */}
          {userRole === "ipa" && req.statusIPA === "Pendente Aprovação" && (
            <div className="space-y-4">
              <h3 className="text-[12px] font-semibold text-[#ddd]">Aprovação</h3>
              <p className="text-[11px] text-[#888]">Esta solicitação foi enviada pela Empresa Cliente e aguarda aprovação para ir ao Financeiro.</p>
              <button
                onClick={onAprovar}
                className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white px-6 py-2.5 rounded-xl text-[12px] font-semibold transition-colors"
              >
                Aprovar Solicitação
              </button>
            </div>
          )}

          {/* Pagamento (Condicional por aba) */}
          {canEditPayment ? (
            <div className="space-y-4">
              <h3 className="text-[12px] font-semibold text-[#ddd]">Pagamento</h3>

              {/* Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#666]">Confirmar pagamento</span>
                <button
                  type="button"
                  onClick={onTogglePayment}
                  className={`w-10 h-[22px] flex items-center rounded-full p-[3px] transition-colors duration-200 ${
                    isPago ? "bg-[#3B82F6]" : "bg-[#222]"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                      isPago ? "translate-x-[18px]" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Upload Zone */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-[#666]">Comprovante</span>
                <label className="flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-[#1a1a1a] hover:border-[#3B82F6]/40 bg-[#080808] cursor-pointer transition-colors group">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      
                      try {
                        setUploadedFile("Enviando...");
                        const fileExt = f.name.split('.').pop();
                        const fileName = `${Math.random()}.${fileExt}`;
                        // We use db_id to structure folders inside the bucket
                        const filePath = `${req.db_id}/${fileName}`;
                        
                        let finalFile = f;
                        
                        // Compress if it's an image
                        if (f.type.startsWith("image/")) {
                          const options = {
                            maxSizeMB: 0.5,
                            maxWidthOrHeight: 1920,
                            useWebWorker: true,
                          };
                          finalFile = await imageCompression(f, options) as File;
                        } else if (f.type === "application/pdf") {
                          if (f.size > 2 * 1024 * 1024) {
                            alert("O arquivo PDF é maior que 2MB. Por favor, utilize um arquivo menor.");
                            setUploadedFile(null);
                            setUploadedFileSize(null);
                            return;
                          }
                        }
                        
                        const fileSizeInKb = (finalFile.size / 1024).toFixed(0) + " KB";
                        
                        const { error: uploadError, data } = await supabase.storage
                          .from('comprovantes')
                          .upload(filePath, finalFile, {
                            upsert: true
                          });
                          
                        if (uploadError) {
                          throw uploadError;
                        }
                        
                        // Set the path in state so it gets saved to db on "Salvar Alterações"
                        setUploadedFile(data.path);
                        setUploadedFileSize(fileSizeInKb);
                      } catch (error: any) {
                        alert("Erro no upload: " + error.message);
                        setUploadedFile(null);
                        setUploadedFileSize(null);
                      }
                    }}
                  />
                  <UploadCloud
                    size={22}
                    strokeWidth={1.5}
                    className="text-[#444] group-hover:text-[#3B82F6] transition-colors mb-2"
                  />
                  {uploadedFile ? (
                    <div className="flex items-center gap-2 z-10 relative">
                      <p className="text-[11px] text-[#3B82F6] font-medium truncate max-w-[200px]">
                        {uploadedFile.replace(`${req.db_id}/`, '')}
                        {uploadedFileSize && <span className="text-[#888] font-normal ml-1">({uploadedFileSize})</span>}
                      </p>
                      {uploadedFile !== "Enviando..." && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(uploadedFile, 60);
                            if (data?.signedUrl) {
                              window.open(data.signedUrl, '_blank');
                            } else {
                              alert("Erro ao baixar arquivo: " + (error?.message || "Desconhecido"));
                            }
                          }}
                          className="p-1.5 rounded bg-[#111] hover:bg-[#1a1a1a] text-[#3B82F6] transition-colors"
                          title="Baixar Arquivo"
                        >
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="text-[11px] text-[#555]">Arraste o comprovante para cá</p>
                      <p className="text-[9px] text-[#333] mt-0.5">PDF, JPG ou JPEG</p>
                    </>
                  )}
                </label>
              </div>

              {/* Read-only Nota Fiscal for Financeiro */}
              {uploadedNF && (
                <div className="flex flex-col gap-2 pt-4 border-t border-[#1a1a1a]">
                  <span className="text-[11px] text-[#666]">Nota Fiscal Recebida</span>
                  <div 
                    onClick={async () => {
                      const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(uploadedNF, 60);
                      if (data?.signedUrl) {
                        window.open(data.signedUrl, '_blank');
                      } else {
                        alert("Erro ao baixar arquivo: " + (error?.message || "Desconhecido"));
                      }
                    }}
                    className="flex items-center justify-between p-3 bg-[#080808] border border-[#1a1a1a] rounded-lg hover:border-[#3B82F6]/50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText size={16} className="text-[#3B82F6] shrink-0" />
                      <span className="text-[11px] text-[#ddd] font-medium truncate group-hover:text-[#3B82F6] transition-colors">{uploadedNF.replace(`${req.db_id}/`, '')}</span>
                      {uploadedNFSize && <span className="text-[#888] text-[10px] whitespace-nowrap shrink-0">({uploadedNFSize})</span>}
                    </div>
                    <ArrowRight size={12} className="text-[#555] group-hover:text-[#3B82F6] transition-colors shrink-0" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-[12px] font-semibold text-[#ddd]">Status de Pagamento</h3>
              <div className="flex items-center gap-3 bg-[#080808] border border-[#1a1a1a] rounded-lg p-3">
                <StatusPill
                  label={req.statusFinanceiro}
                  variant={
                    req.statusFinanceiro === "Pago"
                      ? "blue"
                      : req.statusFinanceiro === "Cancelado"
                      ? "red"
                      : "default"
                  }
                />
                <span className="text-[11px] text-[#666]">Aguardando processamento pelo setor Financeiro.</span>
              </div>
              
              {/* Read-only Comprovante for IPA */}
              {uploadedFile && (
                <div className="flex flex-col gap-2 pt-2">
                  <span className="text-[11px] text-[#666]">Comprovante Anexado</span>
                  <div 
                    onClick={async () => {
                      const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(uploadedFile, 60);
                      if (data?.signedUrl) {
                        window.open(data.signedUrl, '_blank');
                      } else {
                        alert("Erro ao baixar arquivo: " + (error?.message || "Desconhecido"));
                      }
                    }}
                    className="flex items-center justify-between p-3 bg-[#080808] border border-[#1a1a1a] rounded-lg hover:border-[#3B82F6]/50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText size={16} className="text-[#3B82F6] shrink-0" />
                      <span className="text-[11px] text-[#ddd] font-medium truncate group-hover:text-[#3B82F6] transition-colors">{uploadedFile.replace(`${req.db_id}/`, '')}</span>
                      {uploadedFileSize && <span className="text-[#888] text-[10px] whitespace-nowrap shrink-0">({uploadedFileSize})</span>}
                    </div>
                    <ArrowRight size={12} className="text-[#555] group-hover:text-[#3B82F6] transition-colors shrink-0" />
                  </div>
                </div>
              )}

              {/* Upload Zone Nota Fiscal for IPA */}
              {canUploadNF && (
                <div className="space-y-1.5 pt-4 border-t border-[#1a1a1a]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#ddd]">Nota Fiscal</span>
                    {req.statusIPA === 'Concluído' && <span className="text-[10px] text-[#2dd4bf] font-medium">Concluído</span>}
                  </div>
                  <label className="flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-[#1a1a1a] hover:border-[#3B82F6]/40 bg-[#080808] cursor-pointer transition-colors group">
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        
                        try {
                          setUploadedNF("Enviando...");
                          const fileExt = f.name.split('.').pop();
                          const fileName = `nf_${Math.random()}.${fileExt}`;
                          const filePath = `${req.db_id}/${fileName}`;
                          
                          let finalFile = f;
                          
                          if (f.type.startsWith("image/")) {
                            const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true };
                            finalFile = await imageCompression(f, options) as File;
                          } else if (f.type === "application/pdf") {
                            if (f.size > 2 * 1024 * 1024) {
                              alert("O arquivo PDF é maior que 2MB.");
                              setUploadedNF(null);
                              setUploadedNFSize(null);
                              return;
                            }
                          }
                          
                          const fileSizeInKb = (finalFile.size / 1024).toFixed(0) + " KB";
                          
                          const { error: uploadError, data } = await supabase.storage.from('comprovantes').upload(filePath, finalFile, { upsert: true });
                          if (uploadError) throw uploadError;
                          
                          setUploadedNF(data.path);
                          setUploadedNFSize(fileSizeInKb);
                        } catch (error: any) {
                          alert("Erro no upload: " + error.message);
                          setUploadedNF(null);
                          setUploadedNFSize(null);
                        }
                      }}
                    />
                    <UploadCloud size={22} strokeWidth={1.5} className="text-[#444] group-hover:text-[#3B82F6] transition-colors mb-2" />
                    {uploadedNF ? (
                      <div className="flex items-center gap-2 z-10 relative">
                        <p className="text-[11px] text-[#3B82F6] font-medium truncate max-w-[200px]">
                          {uploadedNF.replace(`${req.db_id}/`, '')}
                          {uploadedNFSize && <span className="text-[#888] font-normal ml-1">({uploadedNFSize})</span>}
                        </p>
                        {uploadedNF !== "Enviando..." && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(uploadedNF, 60);
                              if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                              else alert("Erro ao baixar: " + (error?.message || "Desconhecido"));
                            }}
                            className="p-1.5 rounded bg-[#111] hover:bg-[#1a1a1a] text-[#3B82F6] transition-colors"
                          >
                            <ArrowRight size={12} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="text-[11px] text-[#555]">Arraste a Nota Fiscal para cá</p>
                        <p className="text-[9px] text-[#333] mt-0.5">PDF, JPG ou JPEG</p>
                      </>
                    )}
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="p-5 border-t border-[#1a1a1a] shrink-0">
          <button 
            onClick={onSave}
            className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold text-[12px] py-2.5 rounded-lg transition-colors"
          >
            Salvar Alterações
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Meta Row (Detalhes) ── */
function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-2.5 text-[10px] sm:text-[11px]">
      <span className="text-[#444] shrink-0">{icon}</span>
      <span className="text-[#555] w-24 sm:w-28 shrink-0">{label}</span>
      <span className="text-[#ccc] font-medium text-right flex-1 truncate">{value}</span>
    </div>
  );
}

/* ── Modal de Cadastro de CNPJ ── */
function CadastroEmpresaModal({
  type,
  onClose,
  onSuccess
}: {
  type: "clinica" | "empresa",
  onClose: () => void,
  onSuccess: (data: { id: string, nome: string, uf?: string, municipio?: string, chave_pix?: string }) => void
}) {
  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<any>(null);

  const fetchCnpj = async () => {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) return alert("CNPJ inválido. Digite 14 números.");
    
    setLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const data = await res.json();
      setDados(data);
    } catch (e) {
      alert("Erro ao buscar CNPJ. Verifique o número e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!dados) return;
    
    setLoading(true);
    try {
      const table = type === "clinica" ? "clinicas" : "empresas_clientes";
      const insertData = {
        cnpj: dados.cnpj,
        razao_social: dados.razao_social || dados.nome_fantasia || dados.nome,
        nome: dados.nome_fantasia || dados.razao_social || dados.nome || "Sem Nome",
        cep: dados.cep,
        logradouro: dados.logradouro,
        numero: dados.numero,
        bairro: dados.bairro,
        cidade: dados.municipio,
        estado: dados.uf,
        telefone: dados.ddd_telefone_1 || dados.telefone,
        email: dados.email
      };

      const { data, error } = await supabase.from(table).insert(insertData).select().single();

      if (error) throw error;

      onSuccess({ 
        id: data.id, 
        nome: data.nome,
        uf: data.estado,
        municipio: data.cidade
      });
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="h-14 px-6 flex items-center justify-between border-b border-[#1a1a1a]">
          <h2 className="text-[14px] font-semibold text-[#ddd]">
            Cadastrar nova {type === "clinica" ? "Clínica" : "Empresa Cliente"}
          </h2>
          <button onClick={onClose} type="button" className="text-[#555] hover:text-[#eee] transition-colors"><X size={16} /></button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* CNPJ Search */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-[#999]">CNPJ da {type === "clinica" ? "Clínica" : "Empresa"}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="Apenas números..."
                className="flex-1 bg-[#080808] border border-[#1a1a1a] focus:border-[#3B82F6] rounded-lg px-4 py-2.5 text-[13px] text-[#ccc] outline-none transition-colors"
                maxLength={18}
              />
              <button 
                type="button"
                onClick={fetchCnpj} 
                disabled={loading}
                className="bg-[#111] border border-[#1a1a1a] hover:bg-[#1a1a1a] hover:border-[#333] text-[#ccc] px-5 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? "Buscando..." : "Buscar Receita"}
              </button>
            </div>
          </div>

          {/* Fetched Data Display */}
          {dados && (
            <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl p-5 space-y-4 animate-in slide-in-from-bottom-2 duration-300">
              <div>
                <p className="text-[10px] text-[#666] uppercase font-semibold mb-1">Razão Social</p>
                <p className="text-[13px] text-[#eee] font-medium">{dados.razao_social}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-[#666] uppercase font-semibold mb-1">Nome Fantasia</p>
                  <p className="text-[12px] text-[#ccc]">{dados.nome_fantasia || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#666] uppercase font-semibold mb-1">Telefone</p>
                  <p className="text-[12px] text-[#ccc]">{dados.ddd_telefone_1 || "Não informado"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-[#666] uppercase font-semibold mb-1">Endereço Completo</p>
                  <p className="text-[12px] text-[#ccc]">{`${dados.logradouro}, ${dados.numero}${dados.complemento ? ' - ' + dados.complemento : ''} - ${dados.bairro}, ${dados.municipio} - ${dados.uf}`}</p>
                  <p className="text-[11px] text-[#666] mt-0.5">CEP: {dados.cep}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-[#1a1a1a] flex justify-end gap-3 bg-[#0a0a0a]">
          <button type="button" onClick={onClose} className="px-5 py-2 text-[12px] font-semibold text-[#888] hover:text-[#ccc] transition-colors">Cancelar</button>
          <button 
            type="button"
            onClick={handleSave} 
            disabled={!dados}
            className="bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#1a1a1a] disabled:text-[#555] text-white px-6 py-2 rounded-lg text-[12px] font-semibold transition-colors"
          >
            Cadastrar e Selecionar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   PAGE WRAPPER (AUTH)
   ────────────────────────────────────────────────────────────── */

export default function Page() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<"ipa" | "financeiro" | "empresa" | null>(null);

  const fetchRole = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_my_role');
    if (!error && data) {
      setUserRole(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchRole();
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchRole();
      else {
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchRole]);

  if (loading) {
    return <div className="min-h-screen w-screen bg-[#050505] flex items-center justify-center text-[#888] text-[13px]">Autenticando...</div>;
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (session && !userRole) {
    return (
      <div className="min-h-screen w-screen bg-[#050505] flex items-center justify-center p-4">
        <div className="max-w-[400px] bg-[#0c0c0c] border border-[#1a1a1a] rounded-2xl p-8 text-center space-y-4 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-[100px] -right-[100px] w-[200px] h-[200px] bg-[#EF4444]/10 blur-[80px] rounded-full pointer-events-none" />
          
          <div className="w-16 h-16 bg-[#111] border border-[#1a1a1a] rounded-full flex items-center justify-center mx-auto mb-6 relative z-10">
            <Lock size={24} className="text-[#555]" />
          </div>
          <h2 className="text-[18px] font-bold text-white tracking-tight relative z-10">Acesso Pendente</h2>
          <p className="text-[13px] text-[#888] leading-relaxed relative z-10">
            Sua conta foi criada, mas seu acesso ainda não foi aprovado. Você não tem permissão para ler ou escrever dados até que o Administrador do Setor IPA aprove o seu usuário.
          </p>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="mt-6 text-[12px] text-[#3B82F6] hover:text-white transition-colors relative z-10 font-medium"
          >
            Sair da conta
          </button>
        </div>
      </div>
    );
  }

  return <DashboardSGF session={session} userRole={userRole} />;
}
