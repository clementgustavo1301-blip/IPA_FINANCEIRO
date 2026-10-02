"use client";

import React, { useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { Lock, Loader2, ArrowRight, User, Briefcase, Eye, EyeOff, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Registration fields
  const [nome, setNome] = useState("");
  const [empresaNome, setEmpresaNome] = useState("");
  const [empresaCnpj, setEmpresaCnpj] = useState("");
  const [role, setRole] = useState<"ipa" | "financeiro" | "empresa">("ipa");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // If identifier doesn't have @, check if it's a domainless username
    const formattedEmail = identifier.includes("@")
      ? identifier.trim()
      : `${identifier.trim().toLowerCase()}@sgf.ipa`;

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: formattedEmail,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: formattedEmail,
          password,
          options: {
            data: {
              role: role,
              nome: nome,
              ...(role === "empresa"
                ? {
                    empresa_nome: empresaNome,
                    empresa_cnpj: empresaCnpj,
                  }
                : {}),
            },
          },
        });
        if (error) throw error;

        alert("Solicitação enviada com sucesso! Aguarde a aprovação do administrador do setor IPA.");
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || "Erro na autenticação. Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  };

  const handleCnpjBlur = async () => {
    const cleanCnpj = empresaCnpj.replace(/\D/g, "");
    if (cleanCnpj.length === 14) {
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
        if (res.ok) {
          const data = await res.json();
          if (data.razao_social) {
            setEmpresaNome(data.razao_social);
          } else if (data.nome_fantasia) {
            setEmpresaNome(data.nome_fantasia);
          }
        }
      } catch (err) {
        console.error("Erro ao buscar CNPJ", err);
      }
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#08080a] text-white selection:bg-white/20 selection:text-white overflow-hidden relative font-sans">
      {/* ══════════════════════════════════════════════════════════════
          LEFT PANE — Sleek Moody Desk Photography & Official Branding
         ══════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex w-[55%] relative flex-col justify-center overflow-hidden bg-black select-none">
        {/* Background Desk Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/login-bg.jpg"
            alt="Office workspace background"
            fill
            priority
            className="object-cover object-left opacity-80 filter brightness-105 contrast-110"
          />
          {/* Lighter gradient overlay to still merge into the right side nicely without darkening the left too much */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#08080a]/40 to-[#08080a]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#08080a]/60 via-transparent to-transparent" />
        </div>

        {/* Angular Geometric Facet with subtle light reflection line */}
        <div
          className="absolute top-0 left-0 w-[42%] h-[60%] z-[1] pointer-events-none"
          style={{
            clipPath: "polygon(0 0, 100% 0, 0 100%)",
            background: "linear-gradient(135deg, rgba(18,18,22,0.4) 0%, rgba(10,10,12,0.1) 100%)",
          }}
        />
        {/* Crisp Highlight Diagonal Edge */}
        <div
          className="absolute top-0 left-0 w-[42.2%] h-[60.3%] z-[2] pointer-events-none"
          style={{
            clipPath: "polygon(0 0, 100% 0, 0 100%)",
            borderRight: "1px solid rgba(255, 255, 255, 0.18)",
            boxShadow: "0 0 25px rgba(255,255,255,0.06)",
          }}
        />

        {/* Content Container */}
        <div className="relative z-10 px-16 xl:px-24 max-w-[620px]">
          {/* IPA Official Logo Component */}
          <div className="flex flex-col items-start">
            <svg
              width="210"
              height="80"
              viewBox="0 0 340 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
            >
              {/* Letter I */}
              <rect x="0" y="2" width="32" height="116" rx="2" fill="currentColor" />

              {/* Letter P */}
              <path
                d="M58 2 H124 C154 2 174 20 174 48 C174 76 154 94 124 94 H90 V118 H58 V2 Z M90 30 V66 H122 C137 66 143 59 143 48 C143 37 137 30 122 30 H90 Z"
                fill="currentColor"
              />

              {/* Letter A (Modern open geometric triangle matching the brand) */}
              <path
                d="M 248 0 L 316 118 H 283 L 248 54 L 213 118 H 180 L 248 0 Z"
                fill="currentColor"
              />
            </svg>

            {/* Logo Subtitle */}
            <p className="text-[13px] text-white/90 font-medium tracking-[0.03em] leading-[1.45] mt-3">
              Inteligência e Planejamento em
              <br />
              Ações de Saúde e Segurança
            </p>
          </div>

          {/* Minimalist Horizontal Line Divider */}
          <div className="w-9 h-[2px] bg-neutral-600 my-9" />

          {/* SGF Branding Block */}
          <div className="space-y-1">
            <h1 className="text-[54px] font-black text-white tracking-tight leading-none">
              SGF
            </h1>
            <p className="text-[11px] font-bold text-neutral-400 tracking-[0.24em] uppercase pt-1">
              SISTEMA DE GESTÃO FINANCEIRA
            </p>
          </div>

          <p className="text-[#888892] text-[13.5px] leading-relaxed mt-7 font-normal max-w-[340px]">
            Mais controle, agilidade e integração
            <br />
            entre o IPA e o setor Financeiro.
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          RIGHT PANE — High-End Floating Dark Login Card
         ══════════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-6 sm:p-10 relative bg-[#09090b]">
        {/* Subtle background ambient light */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] bg-white/[0.02] blur-[120px] rounded-full pointer-events-none" />

        {/* Floating Card */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px] bg-[#111114] border border-[#232328] rounded-[24px] p-8 sm:p-11 shadow-[0_24px_70px_rgba(0,0,0,0.85)] relative z-10"
        >
          {/* Top Line Accent */}
          <div className="w-8 h-[2px] bg-[#3f3f46] mb-8 rounded-full" />

          {/* Header */}
          <div className="mb-7">
            <p className="text-[14px] text-[#a1a1aa] font-normal">
              {isLogin ? "Bem-vindo ao" : "Criar acesso no"}
            </p>
            <h2 className="text-[34px] sm:text-[36px] font-black text-white tracking-tight leading-tight mt-1">
              SGF IPA
            </h2>
            <p className="text-[13px] text-[#71717a] leading-relaxed mt-2">
              {isLogin
                ? "Faça login para acessar o sistema e gerenciar suas operações."
                : "Preencha os dados abaixo para solicitar o acesso."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="popLayout">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] p-3 rounded-xl font-medium text-center overflow-hidden"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Registration-only fields */}
            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-3"
                >
                  {/* Nome Completo */}
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <User size={17} className="text-[#71717a] group-focus-within:text-white transition-colors" />
                    </div>
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                      placeholder="Nome completo"
                      className="w-full bg-[#18181b] border border-[#27272a] focus:border-neutral-400 rounded-xl pl-10 pr-4 py-3 text-[14px] text-white placeholder:text-[#52525b] outline-none transition-all"
                    />
                  </div>

                  {/* Seleção do Perfil / Setor */}
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Briefcase size={17} className="text-[#71717a] group-focus-within:text-white transition-colors" />
                    </div>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as "ipa" | "financeiro" | "empresa")}
                      className="w-full bg-[#18181b] border border-[#27272a] focus:border-neutral-400 rounded-xl pl-10 pr-4 py-3 text-[14px] text-neutral-300 outline-none transition-all cursor-pointer appearance-none"
                    >
                      <option value="ipa">Setor IPA (Operacional)</option>
                      <option value="financeiro">Setor Financeiro</option>
                      <option value="empresa">Empresa Cliente (Solicitações)</option>
                    </select>
                  </div>

                  {/* Campos específicos caso seja Empresa */}
                  {role === "empresa" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-3"
                    >
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Building2 size={17} className="text-[#71717a] group-focus-within:text-white transition-colors" />
                        </div>
                        <input
                          type="text"
                          value={empresaCnpj}
                          onChange={(e) => setEmpresaCnpj(e.target.value)}
                          onBlur={handleCnpjBlur}
                          required
                          placeholder="CNPJ da Empresa"
                          className="w-full bg-[#18181b] border border-[#27272a] focus:border-neutral-400 rounded-xl pl-10 pr-4 py-3 text-[14px] text-white placeholder:text-[#52525b] outline-none transition-all"
                        />
                      </div>
                      <input
                        type="text"
                        value={empresaNome}
                        onChange={(e) => setEmpresaNome(e.target.value)}
                        required
                        placeholder="Razão Social / Nome da Empresa"
                        className="w-full bg-[#18181b] border border-[#27272a] focus:border-neutral-400 rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-[#52525b] outline-none transition-all"
                      />
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Usuário */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User size={18} className="text-[#71717a] group-focus-within:text-white transition-colors" />
              </div>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                placeholder="Usuário"
                autoComplete="username"
                className="w-full bg-[#18181b] border border-[#27272a] focus:border-neutral-400 rounded-xl pl-11 pr-4 py-3.5 text-[14px] text-white placeholder:text-[#52525b] outline-none transition-all"
              />
            </div>

            {/* Input Senha */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock size={18} className="text-[#71717a] group-focus-within:text-white transition-colors" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Senha"
                autoComplete="current-password"
                className="w-full bg-[#18181b] border border-[#27272a] focus:border-neutral-400 rounded-xl pl-11 pr-11 py-3.5 text-[14px] text-white placeholder:text-[#52525b] outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#71717a] hover:text-white transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* High Contrast White Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#f4f4f5] hover:bg-white text-black font-semibold text-[14px] py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-[0_2px_12px_rgba(255,255,255,0.06)] active:scale-[0.99]"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin text-black" />
              ) : (
                <>
                  <span>{isLogin ? "Entrar" : "Solicitar Acesso"}</span>
                  <ArrowRight size={17} strokeWidth={2.4} />
                </>
              )}
            </button>
          </form>

          {/* SGF IPA Divider matching mockup */}
          <div className="flex items-center justify-center gap-3.5 my-7">
            <div className="w-9 h-[1px] bg-[#27272a]" />
            <span className="text-[11px] font-semibold text-[#52525b] tracking-wider uppercase">
              SGF IPA
            </span>
            <div className="w-9 h-[1px] bg-[#27272a]" />
          </div>

          {/* Toggle Login / Cadastro */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
              }}
              className="text-[12.5px] text-[#71717a] hover:text-[#d4d4d8] transition-colors"
            >
              {isLogin ? "Não possui conta? Solicitar cadastro" : "Já possui conta? Fazer login"}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
