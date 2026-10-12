"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  MessageSquare, 
  Send, 
  RefreshCw, 
  Smartphone, 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  AlertCircle, 
  LogOut,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  Layers,
  Trash2,
  Hourglass,
  Gauge,
  X,
  Info,
  RotateCcw
} from "lucide-react";

interface WhatsAppTabProps {
  userRole: "ipa" | "financeiro" | "empresa" | null;
  savedNotificationPhone: string;
  onSaveNotificationPhone: (phone: string) => Promise<void>;
}

interface AntiBanConfig {
  daily_limit: number;
  min_delay_sec: number;
  max_delay_sec: number;
  typing_speed_ms: number;
  min_typing_sec?: number;
  max_typing_sec?: number;
  sent_today: number;
  last_reset_date?: string;
}

interface QueueItem {
  id: string;
  phone: string;
  message: string;
  media_url?: string;
  solicitacao_id?: string;
  status: "queued" | "typing" | "sent" | "failed" | "limit_reached";
  created_at: string;
  sent_at?: string;
  error?: string;
}

export default function WhatsAppTab({
  userRole,
  savedNotificationPhone,
  onSaveNotificationPhone,
}: WhatsAppTabProps) {
  const [statusData, setStatusData] = useState<{
    service_online: boolean;
    connected: boolean;
    logged_in?: boolean;
    phone?: string;
    push_name?: string;
    status?: string;
    message?: string;
  }>({ service_online: false, connected: false, status: "loading" });

  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [loadingQR, setLoadingQR] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Anti-Ban & Queue states
  const [config, setConfig] = useState<AntiBanConfig>({
    daily_limit: 15,
    min_delay_sec: 20,
    max_delay_sec: 45,
    typing_speed_ms: 100,
    sent_today: 0,
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

  // Queue state
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [clearingQueue, setClearingQueue] = useState(false);
  const [selectedFailedItem, setSelectedFailedItem] = useState<QueueItem | null>(null);
  const [retryingItem, setRetryingItem] = useState(false);


  // Phone settings
  const [phoneInput, setPhoneInput] = useState(savedNotificationPhone || "");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneSuccess, setPhoneSuccess] = useState(false);

  // Test send
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState(
    "Olá! Esta é uma notificação de teste do Sistema Financeiro IPA com simulação humana de digitação e espaçamento anti-ban."
  );
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Sync phoneInput if savedNotificationPhone changes
  useEffect(() => {
    if (savedNotificationPhone) {
      setPhoneInput(savedNotificationPhone);
    }
  }, [savedNotificationPhone]);

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status", { cache: "no-store" });
      const data = await res.json();
      setStatusData(data);
      if (data.connected) {
        setQrCodeImage(null);
      }
      return data;
    } catch {
      setStatusData({ service_online: false, connected: false, status: "offline" });
      return null;
    }
  }, []);

  // Fetch QR Code
  const fetchQR = useCallback(async () => {
    setLoadingQR(true);
    try {
      const res = await fetch("/api/whatsapp/qr", { cache: "no-store" });
      const data = await res.json();
      if (data.qr_code) {
        setQrCodeImage(data.qr_code);
      }
      if (data.connected) {
        setQrCodeImage(null);
        await fetchStatus();
      }
    } catch (err: any) {
      console.error("Erro ao carregar QR code:", err);
    } finally {
      setLoadingQR(false);
    }
  }, [fetchStatus]);

  // Fetch Anti-Ban Config
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/config", { cache: "no-store" });
      const data = await res.json();
      if (data.daily_limit) {
        setConfig(data);
      }
    } catch (err) {
      console.error("Erro ao carregar configurações anti-ban:", err);
    }
  }, []);

  // Fetch Message Queue
  const fetchQueue = useCallback(async () => {
    try {
      setLoadingQueue(true);
      const res = await fetch("/api/whatsapp/queue", { cache: "no-store" });
      const data = await res.json();
      if (data.items) {
        setQueueItems(data.items);
      }
      if (typeof data.sent_today === "number") {
        setConfig((prev) => ({
          ...prev,
          sent_today: data.sent_today,
          daily_limit: data.daily_limit || prev.daily_limit,
        }));
      }
    } catch (err) {
      console.error("Erro ao carregar fila:", err);
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  // Save Anti-Ban Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigSuccess(false);
    try {
      const res = await fetch("/api/whatsapp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        setConfigSuccess(true);
        setTimeout(() => setConfigSuccess(false), 3000);
      } else {
        alert("Erro ao salvar: " + (data.error || "Desconhecido"));
      }
    } catch (err: any) {
      alert("Erro ao salvar parâmetros: " + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  // Clear Pending Queue
  const handleClearQueue = async () => {
    if (!confirm("Deseja cancelar todas as mensagens pendentes na fila?")) return;
    setClearingQueue(true);
    try {
      const res = await fetch("/api/whatsapp/queue", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await fetchQueue();
        alert(data.message || "Fila limpa com sucesso!");
      }
    } catch (err: any) {
      alert("Erro ao limpar fila: " + err.message);
    } finally {
      setClearingQueue(false);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    if (!confirm("Tem certeza que deseja desconectar a sessão do WhatsApp?")) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/whatsapp/disconnect", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await fetchStatus();
        setQrCodeImage(null);
        setTestResult({ success: true, message: "WhatsApp desconectado com sucesso." });
      }
    } catch (err: any) {
      alert("Erro ao desconectar: " + err.message);
      } finally {
        setActionLoading(false);
      }
    };

    const handleRetrySend = async (item: QueueItem) => {
      setRetryingItem(true);
      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: item.phone,
            message: item.message,
            media_url: item.media_url,
            solicitacao_id: item.solicitacao_id,
          }),
        });
        const data = await res.json();
        if (data.success) {
          alert("Mensagem recolocada na fila com sucesso!");
          setSelectedFailedItem(null);
          await fetchQueue();
        } else {
          alert("Erro ao reenviar: " + (data.error || "Desconhecido"));
        }
      } catch (err: any) {
        alert("Erro ao reenviar: " + err.message);
      } finally {
        setRetryingItem(false);
      }
    };


  // Save phone number
  const handleSavePhone = async () => {
    if (!phoneInput.trim()) {
      alert("Digite um número de telefone válido.");
      return;
    }
    setSavingPhone(true);
    try {
      await onSaveNotificationPhone(phoneInput.trim());
      setPhoneSuccess(true);
      setTimeout(() => setPhoneSuccess(false), 3000);
    } catch (err: any) {
      alert("Erro ao salvar número: " + err.message);
    } finally {
      setSavingPhone(false);
    }
  };

  // Send test message
  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim() || !testMessage.trim()) {
      alert("Informe o telefone de destino e a mensagem.");
      return;
    }

    setSendingTest(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: testPhone,
          message: testMessage,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: `Mensagem adicionada à fila com sucesso! Ela será enviada com digitação humana simulada e intervalo de segurança.`,
        });
        await fetchQueue();
      } else {
        setTestResult({
          success: false,
          message: data.error || "Falha ao enfileirar mensagem.",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: "Erro de conexão: " + err.message,
      });
    } finally {
      setSendingTest(false);
    }
  };

  // Auto poll status, config & queue
  useEffect(() => {
    fetchStatus();
    fetchQR();
    fetchConfig();
    fetchQueue();

    const interval = setInterval(() => {
      fetchStatus().then((st) => {
        if (st && !st.connected) {
          fetchQR();
        }
      });
      fetchQueue();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchStatus, fetchQR, fetchConfig, fetchQueue]);

  const isConnected = statusData.connected && statusData.service_online;
  const isOnline = statusData.service_online;
  const quotaUsedPercent = Math.min(
    100,
    Math.round((config.sent_today / Math.max(1, config.daily_limit)) * 100)
  );
  const quotaRemaining = Math.max(0, config.daily_limit - config.sent_today);
  const isLimitReached = config.sent_today >= config.daily_limit;

  return (
    <motion.div
      key="whatsapp"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className="p-2.5 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-[950px] mx-auto w-full"
    >
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1a1a1a] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[17px] sm:text-[20px] font-bold tracking-tight text-[#eee]">
              Integração WhatsApp
            </h2>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 font-semibold">
              Whatsmeow Go
            </span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 font-semibold flex items-center gap-1">
              <ShieldCheck size={11} /> Anti-Ban Shield
            </span>
          </div>
          <p className="text-[11px] sm:text-[12px] text-[#666] mt-0.5">
            Fila inteligente de entrega com simulação de digitação humana e proteção contra banimento da Meta.
          </p>
        </div>

        {/* REFRESH STATUS BUTTON */}
        <button
          onClick={() => {
            fetchStatus();
            fetchQR();
            fetchQueue();
            fetchConfig();
          }}
          disabled={actionLoading || loadingQR}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111] hover:bg-[#181818] text-[#aaa] hover:text-white border border-[#222] text-[11px] font-medium transition-all cursor-pointer"
        >
          <RefreshCw size={13} className={loadingQR ? "animate-spin text-[#3B82F6]" : ""} />
          Atualizar Painel
        </button>
      </div>

      {/* TOP STATUS CARD */}
      <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl p-4 sm:p-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                isConnected
                  ? "bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]"
                  : isOnline
                  ? "bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]"
                  : "bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ef4444]"
              }`}
            >
              {isConnected ? <Wifi size={22} /> : isOnline ? <Clock size={22} /> : <WifiOff size={22} />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] sm:text-[14px] font-semibold text-[#ddd]">
                  Status do Motor:
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                    isConnected
                      ? "bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30"
                      : isOnline
                      ? "bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30"
                      : "bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isConnected ? "bg-[#10b981] animate-pulse" : isOnline ? "bg-[#f59e0b]" : "bg-[#ef4444]"
                    }`}
                  />
                  {isConnected
                    ? "Conectado e Protegido"
                    : isOnline
                    ? "Aguardando leitura do QR Code"
                    : "Serviço WhatsApp Offline"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#777] mt-1">
                {statusData.phone && (
                  <span>
                    Número Conectado: <strong className="text-[#ccc]">+{statusData.phone}</strong>
                  </span>
                )}
                {statusData.push_name && (
                  <span>
                    Identificação: <strong className="text-[#ccc]">{statusData.push_name}</strong>
                  </span>
                )}
                <span>Porta Local: <strong className="text-[#888]">5001</strong></span>
              </div>
            </div>
          </div>

          {isConnected && (
            <button
              onClick={handleDisconnect}
              disabled={actionLoading}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30 text-[11px] font-medium transition-colors cursor-pointer"
            >
              <LogOut size={13} />
              Desconectar Aparelho
            </button>
          )}
        </div>

        {!isOnline && (
          <div className="mt-3.5 pt-3 border-t border-[#1a1a1a] flex items-center gap-2 text-[11px] text-[#ef4444]">
            <AlertCircle size={14} className="shrink-0" />
            <span>
              O microserviço Whatsmeow Go não está rodando. Execute o arquivo <code>whatsapp-service/start.bat</code> para ativá-lo.
            </span>
          </div>
        )}
      </div>

      {/* QR CODE CONNECTION SECTION (When not connected) */}
      {!isConnected && isOnline && (
        <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="flex flex-col items-center justify-center p-4 bg-[#050505] rounded-xl border border-[#1a1a1a] min-h-[280px]">
            {loadingQR ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <RefreshCw size={26} className="animate-spin text-[#3B82F6]" />
                <span className="text-[12px] text-[#666]">Gerando QR Code...</span>
              </div>
            ) : qrCodeImage ? (
              <div className="flex flex-col items-center gap-3">
                <div className="p-2.5 bg-white rounded-lg shadow-xl border border-[#222]">
                  <img
                    src={qrCodeImage}
                    alt="WhatsApp QR Code"
                    className="w-[210px] h-[210px] object-contain rounded"
                  />
                </div>
                <p className="text-[10px] text-[#666] flex items-center gap-1">
                  <Clock size={11} /> Atualiza automaticamente a cada 20 segundos
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <Smartphone size={32} className="text-[#444]" />
                <p className="text-[12px] text-[#888]">Nenhum QR Code ativo no momento.</p>
                <button
                  onClick={fetchQR}
                  className="px-4 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[11px] font-semibold transition-colors"
                >
                  Gerar QR Code Agora
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-[14px] font-semibold text-[#eee]">Como conectar:</h3>
            <ol className="space-y-3 text-[12px] text-[#aaa]">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#1a1a1a] text-[#3B82F6] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border border-[#333]">
                  1
                </span>
                <span>Abra o <strong>WhatsApp</strong> no smartphone do setor IPA.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#1a1a1a] text-[#3B82F6] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border border-[#333]">
                  2
                </span>
                <span>Acesse o menu de configurações e selecione <strong>Aparelhos Conectados</strong>.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#1a1a1a] text-[#3B82F6] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border border-[#333]">
                  3
                </span>
                <span>Toque em <strong>Conectar um aparelho</strong> e aponte a câmera para o QR Code.</span>
              </li>
            </ol>

            <div className="p-3 bg-[#111] rounded-lg border border-[#1a1a1a] flex items-center gap-2.5 text-[11px] text-[#777]">
              <ShieldCheck size={16} className="text-[#10b981] shrink-0" />
              <span>Conexão direta com os servidores oficiais do WhatsApp via protocolo Whatsmeow Go.</span>
            </div>
          </div>
        </div>
      )}

      {/* ANTI-BAN SHIELD & QUOTA CARD */}
      <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] sm:text-[14px] font-semibold text-[#ddd] flex items-center gap-1.5">
                <Gauge size={16} className="text-[#3B82F6]" />
                Limite Diário de Disparos & Proteção Anti-Ban
              </h3>
            </div>
            <p className="text-[11px] text-[#666] mt-0.5">
              Evita bloqueios automatizados limitando o volume diário e emulando o ritmo de digitação de uma pessoa real.
            </p>
          </div>

          {/* QUOTA BADGE */}
          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className="text-[10px] text-[#777] block">Cota de Hoje</span>
              <span className={`text-[13px] font-bold ${isLimitReached ? "text-[#ef4444]" : "text-[#10b981]"}`}>
                {config.sent_today} / {config.daily_limit} mensagens
              </span>
            </div>
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="space-y-1.5">
          <div className="w-full bg-[#141414] rounded-full h-2 overflow-hidden border border-[#1f1f1f]">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isLimitReached
                  ? "bg-[#ef4444]"
                  : quotaUsedPercent > 70
                  ? "bg-[#f59e0b]"
                  : "bg-[#10b981]"
              }`}
              style={{ width: `${quotaUsedPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[#666]">
            <span>{quotaRemaining} envios restantes hoje</span>
            <span>Reseta automaticamente à meia-noite</span>
          </div>
        </div>

        {isLimitReached && (
          <div className="p-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg flex items-center gap-2 text-[11px] text-[#ef4444]">
            <ShieldAlert size={15} className="shrink-0" />
            <span>
              <strong>Limite diário de {config.daily_limit} mensagens atingido!</strong> As próximas mensagens ficarão retidas na fila com segurança para evitar banimento do chip.
            </span>
          </div>
        )}

        {/* FORM CONFIGURAÇÕES ANTI-BAN */}
        <form onSubmit={handleSaveConfig} className="pt-2 border-t border-[#1a1a1a] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* LIMITE DIARIO */}
            <div>
              <label className="text-[11px] font-medium text-[#888] block mb-1">
                Limite Máximo Diário
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={config.daily_limit}
                onChange={(e) =>
                  setConfig({ ...config, daily_limit: parseInt(e.target.value, 10) || 15 })
                }
                className="w-full bg-[#050505] border border-[#1a1a1a] focus:border-[#3B82F6] rounded-lg px-3 py-2 text-[12px] text-[#ccc] outline-none transition-colors"
              />
              <span className="text-[9px] text-[#555] block mt-0.5">Recomendado: 15 a 25/dia</span>
            </div>

            {/* ESPACAMENTO MINIMO / MAXIMO */}
            <div>
              <label className="text-[11px] font-medium text-[#888] block mb-1">
                Espaçamento entre Envios (segundos)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="5"
                  max="300"
                  placeholder="Mín"
                  value={config.min_delay_sec}
                  onChange={(e) =>
                    setConfig({ ...config, min_delay_sec: parseInt(e.target.value, 10) || 20 })
                  }
                  className="w-full bg-[#050505] border border-[#1a1a1a] focus:border-[#3B82F6] rounded-lg px-2.5 py-2 text-[12px] text-[#ccc] outline-none transition-colors"
                />
                <input
                  type="number"
                  min="10"
                  max="600"
                  placeholder="Máx"
                  value={config.max_delay_sec}
                  onChange={(e) =>
                    setConfig({ ...config, max_delay_sec: parseInt(e.target.value, 10) || 45 })
                  }
                  className="w-full bg-[#050505] border border-[#1a1a1a] focus:border-[#3B82F6] rounded-lg px-2.5 py-2 text-[12px] text-[#ccc] outline-none transition-colors"
                />
              </div>
              <span className="text-[9px] text-[#555] block mt-0.5">Variação aleatória (ex: 20s a 45s)</span>
            </div>

            {/* VELOCIDADE DE DIGITACAO */}
            <div>
              <label className="text-[11px] font-medium text-[#888] block mb-1">
                Velocidade de Digitação Humana
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="30"
                  max="300"
                  value={config.typing_speed_ms}
                  onChange={(e) =>
                    setConfig({ ...config, typing_speed_ms: parseInt(e.target.value, 10) || 100 })
                  }
                  className="w-full bg-[#050505] border border-[#1a1a1a] focus:border-[#3B82F6] rounded-lg px-3 py-2 text-[12px] text-[#ccc] outline-none transition-colors"
                />
                <span className="text-[11px] text-[#666] shrink-0">ms/letra</span>
              </div>
              <span className="text-[9px] text-[#555] block mt-0.5">
                Exibe &quot;Digitando...&quot; no WhatsApp
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-[11px] text-[#666]">
              <Sliders size={13} className="text-[#3B82F6]" />
              <span>Parâmetros aplicados dinamicamente no motor Whatsmeow Go</span>
            </div>

            <div className="flex items-center gap-2">
              {configSuccess && (
                <span className="text-[11px] text-[#10b981] flex items-center gap-1 animate-in fade-in">
                  <CheckCircle2 size={13} /> Salvo com sucesso!
                </span>
              )}
              <button
                type="submit"
                disabled={savingConfig}
                className="px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {savingConfig ? "Salvando..." : "Salvar Parâmetros Anti-Ban"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* MESSAGE QUEUE TABLE */}
      <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-[#3B82F6]" />
            <h3 className="text-[13px] sm:text-[14px] font-semibold text-[#ddd]">
              Fila de Mensagens em Tempo Real
            </h3>
            <span className="text-[10px] bg-[#1a1a1a] text-[#888] px-2 py-0.5 rounded-full font-mono">
              {queueItems.filter((i) => i.status === "queued" || i.status === "typing").length} pendentes
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchQueue}
              disabled={loadingQueue}
              className="p-1.5 rounded-lg bg-[#111] hover:bg-[#1a1a1a] text-[#777] hover:text-[#ccc] transition-colors"
              title="Atualizar fila"
            >
              <RefreshCw size={13} className={loadingQueue ? "animate-spin text-[#3B82F6]" : ""} />
            </button>
            {queueItems.some((i) => i.status === "queued") && (
              <button
                onClick={handleClearQueue}
                disabled={clearingQueue}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] text-[10px] font-semibold transition-colors"
              >
                <Trash2 size={12} /> Limpar Pendentes
              </button>
            )}
          </div>
        </div>

        {queueItems.length === 0 ? (
          <div className="py-8 text-center text-[#555] text-[11px] bg-[#080808] rounded-lg border border-[#141414]">
            Nenhuma mensagem na fila no momento. As notificações de pagamento aparecerão aqui quando disparadas.
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar border border-[#1a1a1a] rounded-lg">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-[#111] text-[#666] uppercase text-[9px] font-semibold tracking-wider border-b border-[#1a1a1a]">
                <tr>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Telefone</th>
                  <th className="px-3 py-2.5">Mensagem / Solicitação</th>
                  <th className="px-3 py-2.5 text-right">Data/Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141414]">
                {queueItems.slice(0, 15).map((item) => (
                  <tr key={item.id} className="hover:bg-[#0f0f0f] transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {item.status === "queued" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 font-medium text-[10px]">
                          <Hourglass size={11} className="animate-pulse" /> Na Fila
                        </span>
                      )}
                      {item.status === "typing" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 font-medium text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-ping" /> Digitando...
                        </span>
                      )}
                      {item.status === "sent" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 font-medium text-[10px]">
                          <CheckCircle2 size={11} /> Enviada
                        </span>
                      )}
                      {item.status === "limit_reached" && (
                        <button
                          type="button"
                          onClick={() => setSelectedFailedItem(item)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ef4444]/15 hover:bg-[#ef4444]/25 text-[#ef4444] border border-[#ef4444]/30 font-medium text-[10px] cursor-pointer transition-all hover:scale-105 active:scale-95"
                          title="Clique para ver o motivo"
                        >
                          <ShieldAlert size={11} /> Cota Atingida (Ver)
                        </button>
                      )}
                      {item.status === "failed" && (
                        <button
                          type="button"
                          onClick={() => setSelectedFailedItem(item)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#ef4444] border border-[#ef4444]/40 font-semibold text-[10px] cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm"
                          title="Clique para ver o motivo da falha"
                        >
                          <AlertCircle size={11} /> Falha - Ver Motivo
                        </button>
                      )}

                    </td>
                    <td className="px-3 py-2.5 font-mono text-[#ccc] whitespace-nowrap">
                      +{item.phone}
                    </td>
                    <td className="px-3 py-2.5 max-w-[320px] truncate text-[#aaa]">
                      {item.solicitacao_id && (
                        <span className="font-mono text-[#3B82F6] mr-1.5">#{item.solicitacao_id}</span>
                      )}
                      {item.message}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[#666] whitespace-nowrap">
                      {new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* NOTIFICATION DESTINATION SETTINGS */}
      <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl p-4 sm:p-5 space-y-3">
        <div>
          <h3 className="text-[13px] sm:text-[14px] font-semibold text-[#ddd]">
            Número do Setor IPA para Recebimento de Comprovantes
          </h3>
          <p className="text-[11px] text-[#666] mt-0.5">
            Cadastre o número de WhatsApp que receberá a notificação com os dados da solicitação e o comprovante anexado assim que o setor Financeiro confirmar o pagamento.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
          <div className="relative flex-1 max-w-[380px]">
            <input
              type="text"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="Ex: 5511999998888 ou (11) 99999-8888"
              className="w-full bg-[#050505] border border-[#1a1a1a] focus:border-[#3B82F6] rounded-lg px-3 py-2 text-[12px] text-[#ccc] placeholder:text-[#333] outline-none transition-colors"
            />
          </div>

          <button
            onClick={handleSavePhone}
            disabled={savingPhone}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {savingPhone ? "Salvando..." : "Salvar Telefone"}
          </button>

          {phoneSuccess && (
            <span className="flex items-center gap-1 text-[11px] text-[#10b981] animate-in fade-in">
              <CheckCircle2 size={13} /> Telefone salvo com sucesso!
            </span>
          )}
        </div>
      </div>

      {/* TEST SEND SECTION */}
      <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="text-[13px] sm:text-[14px] font-semibold text-[#ddd]">
            Teste de Envio com Fila Anti-Ban
          </h3>
          <p className="text-[11px] text-[#666] mt-0.5">
            Ao clicar em enviar, a mensagem entra na fila e executa a simulação de digitação em tempo real antes de entregar.
          </p>
        </div>

        <form onSubmit={handleSendTest} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="text-[11px] font-medium text-[#888] block mb-1">
                Telefone Destinatário (com DDD)
              </label>
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="Ex: 11999998888"
                className="w-full bg-[#050505] border border-[#1a1a1a] focus:border-[#3B82F6] rounded-lg px-3 py-2 text-[12px] text-[#ccc] placeholder:text-[#333] outline-none transition-colors"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-medium text-[#888] block mb-1">
                Mensagem de Teste
              </label>
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="w-full bg-[#050505] border border-[#1a1a1a] focus:border-[#3B82F6] rounded-lg px-3 py-2 text-[12px] text-[#ccc] outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="submit"
              disabled={sendingTest || !isConnected}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-[11px] font-semibold transition-all ${
                isConnected
                  ? "bg-[#10b981] hover:bg-[#059669] cursor-pointer"
                  : "bg-[#222] text-[#666] cursor-not-allowed"
              }`}
            >
              <Send size={12} className={sendingTest ? "animate-pulse" : ""} />
              {sendingTest ? "Enfileirando..." : "Enviar Mensagem para a Fila"}
            </button>

            {!isConnected && (
              <span className="text-[11px] text-[#777]">
                * Conecte o WhatsApp via QR Code acima para habilitar o envio.
              </span>
            )}
          </div>
        </form>

        {testResult && (
          <div
            className={`p-3 rounded-lg border text-[11px] flex items-center gap-2 animate-in fade-in ${
              testResult.success
                ? "bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]"
                : "bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ef4444]"
            }`}
          >
            {testResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      {/* MODAL DETALHES DA FALHA */}
      {selectedFailedItem && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedFailedItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[500px] bg-[#0c0c0c] border border-[#222] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
          >
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a] bg-[#111]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#ef4444]/15 border border-[#ef4444]/30 flex items-center justify-center text-[#ef4444]">
                  <AlertCircle size={18} />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-[#eee] leading-tight">
                    Motivo da Falha no Envio
                  </h3>
                  <p className="text-[11px] text-[#777]">
                    Diagnóstico do erro retornado pelo WhatsApp
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedFailedItem(null)}
                className="w-7 h-7 rounded-lg bg-[#181818] hover:bg-[#222] flex items-center justify-center text-[#888] hover:text-white transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
              {/* DADOS BÁSICOS */}
              <div className="grid grid-cols-2 gap-2.5 text-[11px] bg-[#070707] p-3.5 rounded-xl border border-[#1a1a1a]">
                <div>
                  <span className="text-[#666] block">Destinatário:</span>
                  <strong className="text-[#ccc] font-mono">+{selectedFailedItem.phone}</strong>
                </div>
                <div>
                  <span className="text-[#666] block">Solicitação:</span>
                  <strong className="text-[#3B82F6] font-mono">
                    {selectedFailedItem.solicitacao_id ? `#${selectedFailedItem.solicitacao_id}` : "Envio de Teste"}
                  </strong>
                </div>
                <div className="col-span-2 pt-2 border-t border-[#141414]">
                  <span className="text-[#666] block">Horário da Tentativa:</span>
                  <span className="text-[#aaa]">
                    {new Date(selectedFailedItem.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>

              {/* MOTIVO DO ERRO */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#ef4444] uppercase tracking-wider block">
                  Erro Reportado:
                </label>
                <div className="p-3.5 bg-[#ef4444]/10 border border-[#ef4444]/25 rounded-xl text-[#fca5a5] text-[12px] font-mono leading-relaxed break-words">
                  {selectedFailedItem.error || "Erro interno ao tentar entregar a mensagem pelo WhatsApp."}
                </div>
              </div>

              {/* DIAGNÓSTICO / EXPLICAÇÃO AMIGÁVEL */}
              <div className="p-3.5 bg-[#121212] border border-[#1e1e1e] rounded-xl text-[11px] space-y-2 text-[#aaa]">
                <h4 className="font-semibold text-[#ddd] flex items-center gap-1.5">
                  <Info size={13} className="text-[#3B82F6]" /> O que causou esta falha?
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-[#888]">
                  {selectedFailedItem.error?.toLowerCase().includes("limite") ? (
                    <li>
                      <strong>Limite diário de envios atingido:</strong> Para proteger seu número contra banimentos da Meta, o sistema pausou novos envios até o próximo dia.
                    </li>
                  ) : selectedFailedItem.error?.toLowerCase().includes("lid") ? (
                    <>
                      <li>
                        <strong>Divergência de 9º Dígito (Mapeamento LID):</strong> No Brasil, muitas contas foram registradas no WhatsApp no formato antigo de 8 dígitos ou no formato com 9 dígitos.
                      </li>
                      <li>
                        O serviço Whatsmeow Go agora ajusta e consulta o servidor da Meta automaticamente. Clique no botão <strong>"Tentar Novamente Agora"</strong> abaixo para reenviar.
                      </li>
                    </>
                  ) : selectedFailedItem.error?.toLowerCase().includes("not found") || selectedFailedItem.error?.toLowerCase().includes("não possui") || selectedFailedItem.error?.toLowerCase().includes("não está") || selectedFailedItem.error?.toLowerCase().includes("jid") ? (
                    <>
                      <li>
                        <strong>Número não localizado no WhatsApp:</strong> O telefone informado pode não possuir WhatsApp ativo ou o DDD/DDI foi digitado incorretamente.
                      </li>
                      <li>Verifique se o número possui DDD correto e se recebe mensagens no aplicativo oficial.</li>
                    </>
                  ) : selectedFailedItem.error?.toLowerCase().includes("connect") || selectedFailedItem.error?.toLowerCase().includes("logged") ? (
                    <li>
                      <strong>Desconexão momentânea:</strong> O WhatsApp do aparelho desconectou ou perdeu a conexão com a internet durante o envio.
                    </li>
                  ) : (
                    <>
                      <li>O número de destino pode não possuir WhatsApp ativo.</li>
                      <li>Verifique se o DDD (código de área) foi digitado corretamente.</li>
                      <li>Confirme se o aparelho conectado pelo QR Code possui acesso à internet.</li>
                    </>
                  )}
                </ul>
              </div>

              {/* PREVIEW DA MENSAGEM */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[#777] block">
                  Conteúdo da Mensagem:
                </label>
                <div className="p-3 bg-[#050505] border border-[#1a1a1a] rounded-xl text-[11px] text-[#888] max-h-[100px] overflow-y-auto whitespace-pre-wrap">
                  {selectedFailedItem.message}
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#1a1a1a] bg-[#111]">
              <button
                type="button"
                onClick={() => setSelectedFailedItem(null)}
                className="px-4 py-2 rounded-lg bg-[#181818] hover:bg-[#222] text-[#aaa] hover:text-white text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => handleRetrySend(selectedFailedItem)}
                disabled={retryingItem}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw size={12} className={retryingItem ? "animate-spin" : ""} />
                {retryingItem ? "Reenviando..." : "Tentar Novamente Agora"}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>

  );
}
