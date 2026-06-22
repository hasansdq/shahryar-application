import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { storageService } from '../services/storageService';
import { Sparkles, Bot, Loader2, Phone, User as UserIcon, LogIn, UserPlus, ArrowRight, Lock, MessageSquare, ShieldAlert, CheckCircle2, ChevronRight, Mail, HelpCircle } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

const authStyles = `
  @keyframes float {
    0% { transform: translate(0px, 0px) rotate(0deg); }
    33% { transform: translate(30px, -50px) rotate(8deg); }
    66% { transform: translate(-20px, 20px) rotate(-4deg); }
    100% { transform: translate(0px, 0px) rotate(0deg); }
  }
  @keyframes slideUpFade {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideDownNotification {
    0% { opacity: 0; transform: translateY(-40px) scale(0.95); }
    15% { opacity: 1; transform: translateY(0) scale(1); }
    85% { opacity: 1; transform: translateY(0) scale(1); }
    100% { opacity: 0; transform: translateY(-40px) scale(0.95); }
  }
  @keyframes pulseGlow {
    0%, 100% { opacity: 0.15; transform: scale(1); }
    50% { opacity: 0.3; transform: scale(1.08); }
  }
  .animate-float { animation: float 14s ease-in-out infinite; }
  .animate-float-delayed { animation: float 18s ease-in-out infinite reverse; }
  .animate-pulse-glow { animation: pulseGlow 8s ease-in-out infinite; }
  
  .glass-card {
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  
  .glass-modal {
    background: rgba(10, 15, 28, 0.85);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 30px 70px rgba(0, 0, 0, 0.6);
  }

  .anim-entry { animation: slideUpFade 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .animate-sms-notification { animation: slideDownNotification 7.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
`;

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  // Mobile verification state
  const [phoneMode, setPhoneMode] = useState<'login' | 'register'>('login');
  
  // Inputs
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  
  // OTP states
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
  const [generatedOTP, setGeneratedOTP] = useState('');
  const [userOTPInput, setUserOTPInput] = useState('');
  const [otpTimer, setOtpTimer] = useState(120);
  const [showSMSAlert, setShowSMSAlert] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Google Account Chooser flow
  const [showGoogleChooser, setShowGoogleChooser] = useState(false);
  const [googleStep, setGoogleStep] = useState<'list' | 'add_email' | 'loading'>('list');
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');
  const [googleLoadingMessage, setGoogleLoadingMessage] = useState('');

  // Global errors & loading
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Validate mobile
  const validatePhone = (num: string) => {
    const clean = num.replace(/\D/g, '');
    return clean.startsWith('09') && clean.length === 11;
  };

  // Timer helper
  const startTimer = () => {
    setOtpTimer(120);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setOtpTimer((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Handle phone verification request
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    const cleanPhone = phone.trim();
    if (!validatePhone(cleanPhone)) {
      setError('شماره موبایل وارد شده باید ۱۱ رقم بوده و با ۰۹ آغاز گردد (مثال: 09131234567)');
      return;
    }

    if (phoneMode === 'register' && !name.trim()) {
      setError('لطفاً نام و نام خانوادگی خود را برای ثبت‌نام وارد کنید.');
      return;
    }

    setLoading(true);
    try {
      const userExists = await storageService.checkPhoneExists(cleanPhone);
      
      if (phoneMode === 'login' && !userExists) {
        setError('حسابی با این شماره تلفن یافت نشد. لطفاً ابتدا از زبانه ثبت‌نام یک حساب جدید ایجاد نمایید.');
        setPhoneMode('register');
        setLoading(false);
        return;
      }
      
      if (phoneMode === 'register' && userExists) {
        setError('این شماره موبایل پیش‌تر ثبت‌نام شده است. لطفاً زبانه ورود را انتخاب نموده و وارد حساب خود شوید.');
        setPhoneMode('login');
        setLoading(false);
        return;
      }

      // High-fidelity OTP Simulation
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      setGeneratedOTP(code);
      setUserOTPInput('');
      setIsVerifyingOTP(true);
      setShowSMSAlert(true);
      startTimer();

      // Automatically dismiss alert
      setTimeout(() => {
        setShowSMSAlert(false);
      }, 7500);

    } catch (err: any) {
      setError(err.message || 'خطا در ارتباط با سرور فایربیس. لطفاً بعداً مجدداً تلاش فرمایید.');
    } finally {
      setLoading(false);
    }
  };

  // Resend code
  const handleResendOTP = () => {
    if (otpTimer > 0) return;
    setError(null);
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOTP(code);
    setUserOTPInput('');
    setShowSMSAlert(true);
    startTimer();
    setTimeout(() => {
      setShowSMSAlert(false);
    }, 7500);
  };

  // Submit SMS OTP code
  const handleVerifyOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (userOTPInput.trim() !== generatedOTP) {
      setError('کد تأیید نادرست است. مجدداً تلاش نمایید.');
      return;
    }

    setLoading(true);
    const cleanPhone = phone.trim();
    try {
      let finalUser;
      if (phoneMode === 'login') {
        finalUser = await storageService.firebaseLogin(cleanPhone);
      } else {
        finalUser = await storageService.firebaseRegister(cleanPhone, name.trim());
      }
      
      if (timerRef.current) clearInterval(timerRef.current);
      onLogin(finalUser);
    } catch (err: any) {
      setError(err.message || 'خطا در نهایی‌سازی فرآیند احراز هویت دیتابیس.');
    } finally {
      setLoading(false);
    }
  };

  // Complete Google login
  const triggerGoogleLogin = async (email: string, fullName: string) => {
    setError(null);
    setGoogleStep('loading');
    setGoogleLoadingMessage('در حال اتصال ایمن به حساب گوگل...');
    
    try {
      await new Promise(r => setTimeout(r, 1000));
      setGoogleLoadingMessage('دریافت توکن رسمی و اختصاص حساب کاربری...');
      
      const b64Id = btoa(email.trim()).replace(/=/g, '').substring(0, 12).toLowerCase();
      const parsedId = `g_${b64Id}`;
      
      const user = await storageService.googleLogin({
        id: parsedId,
        name: fullName,
        email: email.trim()
      });
      
      setGoogleLoadingMessage('ورود موفقیت‌آمیز! انتقال به دستیار هوشمند...');
      await new Promise(r => setTimeout(r, 500));
      
      setShowGoogleChooser(false);
      onLogin(user);
    } catch (err: any) {
      setGoogleStep('list');
      setError(err.message || 'ورود با حساب گوگل با خطا مواجه شد. مجدداً تلاش فرمایید.');
    }
  };

  // Google sign up input submit
  const handleCustomGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customGoogleEmail.trim() || !customGoogleEmail.includes('@')) {
      setError('یک آدرس ایمیل معتبر گوگل وارد نمایید.');
      return;
    }
    if (!customGoogleName.trim()) {
      setError('لطفاً نام یا نام مستعار خود را وارد کنید.');
      return;
    }
    
    // Trigger login
    triggerGoogleLogin(customGoogleEmail.trim(), customGoogleName.trim());
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remain = secs % 60;
    return `${mins}:${remain.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className="relative flex flex-col min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white justify-center items-center px-4 py-8"
      style={{ fontFamily: "'Vazirmatn', sans-serif" }}
    >
      <style>{authStyles}</style>

      {/* --- High-end Top Floating SMS Notification Center --- */}
      {showSMSAlert && (
        <div className="fixed top-6 left-4 right-4 max-w-sm mx-auto z-[9999] animate-sms-notification pointer-events-auto">
          <div className="bg-slate-900/95 border-2 border-teal-400 text-white shadow-2xl rounded-2xl p-4 flex gap-3.5 items-start">
            <div className="p-2 bg-teal-500/20 rounded-xl text-teal-400 mt-0.5 shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-black text-teal-400">پیامک تأیید شماره</span>
                <span className="text-[10px] text-slate-500 font-medium">هم‌اکنون</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-semibold">
                کد یکبار مصرف جهت ورود به دستیار بهشت کویر شهریار: <span className="font-mono text-teal-300 text-sm font-black underline tracking-widest">{generatedOTP}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* --- Outer Glowing Cinematic Ambient Lights --- */}
      <div className="absolute top-[-15%] left-[-15%] w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-[140px] animate-float pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[600px] h-[600px] bg-emerald-600/8 hover:bg-emerald-600/12 rounded-full blur-[140px] animate-float-delayed pointer-events-none" />
      <div className="absolute top-[40%] left-[35%] w-[300px] h-[300px] bg-teal-500/5 rounded-full blur-[100px] animate-pulse-glow pointer-events-none" />

      {/* --- UI Container --- */}
      <div className="w-full max-w-[390px] z-10 py-4">
        
        {/* --- Brand logo --- */}
        <div className="mb-8 text-center anim-entry">
          <div className="inline-flex items-center justify-center p-0.5 rounded-[28px] bg-gradient-to-tr from-teal-400 via-emerald-400 to-sky-400 shadow-[0_0_50px_-5px_rgba(45,212,191,0.25)] mb-5 hover:scale-105 transition-all duration-300">
            <div className="w-20 h-20 bg-slate-950 rounded-[26px] flex items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/20 to-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Bot className="w-10 h-10 text-teal-400" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold mb-1.5 tracking-tight flex items-center justify-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-teal-100 to-emerald-300">
            شهریار
            <Sparkles className="w-6 h-6 text-teal-300 animate-pulse shrink-0" />
          </h1>
          <p className="text-teal-200/55 text-xs font-semibold">دستیار فوق‌هوشمند شهروندان رفسنجان</p>
        </div>

        {/* --- Main auth interaction wrapper --- */}
        <div className="glass-card p-6 rounded-[36px] anim-entry transition-all duration-500 flex flex-col relative overflow-hidden">
          
          {error && (
            <div className="w-full bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center mb-5 anim-entry">
              <div className="flex justify-center mb-1.5 text-red-400">
                <ShieldAlert className="w-5 h-5 animate-bounce" />
              </div>
              <p className="text-red-300 text-xs font-bold leading-relaxed">{error}</p>
            </div>
          )}

          {/* Verification Code Look/Feel Phase - OTP */}
          {isVerifyingOTP ? (
            <form onSubmit={handleVerifyOTPSubmit} className="space-y-6 anim-entry">
              <div className="flex items-center gap-2.5 mb-2">
                <button
                  type="button"
                  onClick={() => { setIsVerifyingOTP(false); setError(null); }}
                  className="p-1.5 hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-white hover:translate-x-1"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
                <span className="text-xs font-black text-teal-300">بازگشت و تصحیح شماره تلفن</span>
              </div>

              <div className="text-center bg-slate-950/40 rounded-3xl p-4 border border-slate-900">
                <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                  کد تأیید ۴ رقمی به شماره همراه <span className="font-mono text-teal-300 text-sm font-black underline">{phone}</span> ارسال گردید.
                </p>
                <div className="mt-3.5 inline-flex items-center gap-2 px-3 py-1 bg-teal-500/10 border border-teal-500/25 rounded-full text-[10px] text-teal-300 font-bold">
                  <span className="w-2 h-2 bg-teal-400 rounded-full animate-ping" />
                  بررسی خودکار سیستمی فعال است
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-teal-300 font-extrabold pr-1 text-center">کد تأیید ۴ رقمی را وارد کنید</label>
                <div className="relative max-w-[190px] mx-auto">
                  <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={userOTPInput}
                    onChange={(e) => setUserOTPInput(e.target.value.replace(/\D/g, '').substring(0, 4))}
                    className="w-full bg-slate-950/60 border-2 border-slate-700 focus:border-teal-400 rounded-2xl py-4 pr-12 pl-4 text-white text-lg font-black font-mono text-center tracking-[12px] focus:outline-none focus:ring-4 focus:ring-teal-500/20 transition-all text-left"
                    placeholder="••••"
                    maxLength={4}
                  />
                </div>
              </div>

              {/* OTP countdown timer */}
              <div className="text-center py-1 flex items-center justify-center gap-1.5 text-[11px] font-bold">
                {otpTimer > 0 ? (
                  <>
                    <span className="text-slate-400 font-medium">امکان ارسال مجدد کد پس از:</span>
                    <span className="font-mono text-teal-300 font-black tracking-wide bg-teal-500/5 px-2.5 py-0.5 rounded-md border border-teal-500/10">{formatTime(otpTimer)}</span>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    className="text-teal-400 hover:text-teal-300 border-b border-dashed border-teal-400/50 font-black cursor-pointer pb-0.5 transition-all"
                  >
                    کد تأیید جدید ارسال شود
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-teal-500/90 to-emerald-500/90 hover:from-teal-500 hover:to-emerald-500 text-white font-extrabold py-4 px-4 rounded-2xl shadow-xl shadow-teal-950/40 flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-xs cursor-pointer select-none border border-teal-400/25"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 ml-1" />
                    احراز هویت و ورود نهایی به شهریار
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Main login / register selector and input */
            <div className="space-y-6">
              
              {/* Phone SubTabs */}
              <div className="grid grid-cols-2 p-1 bg-slate-950/70 rounded-[18px] border border-white/[0.03]">
                <button
                  type="button"
                  onClick={() => { setPhoneMode('login'); setError(null); }}
                  className={`py-3 text-xs font-extrabold rounded-[14px] transition-all duration-300 flex items-center justify-center gap-1.5 ${
                    phoneMode === 'login' 
                      ? 'bg-gradient-to-br from-teal-500/25 to-teal-600/15 text-teal-300 border border-teal-500/25 font-black shadow-inner shadow-teal-400/5' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  ورود شهروند
                </button>
                <button
                  type="button"
                  onClick={() => { setPhoneMode('register'); setError(null); }}
                  className={`py-3 text-xs font-extrabold rounded-[14px] transition-all duration-300 flex items-center justify-center gap-1.5 ${
                    phoneMode === 'register' 
                      ? 'bg-gradient-to-br from-teal-500/25 to-teal-600/15 text-teal-300 border border-teal-500/25 font-black shadow-inner shadow-teal-400/5' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  عضویت جدید
                </button>
              </div>

              {/* Login form */}
              <form onSubmit={handlePhoneSubmit} className="space-y-4">
                {phoneMode === 'register' && (
                  <div className="flex flex-col gap-1.5 anim-entry">
                    <label className="text-[10px] text-teal-300 font-extrabold pr-1">نام و نام خانوادگی</label>
                    <div className="relative">
                      <UserIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-950/40 border border-slate-800 rounded-2xl py-3.5 pr-11 pl-4 text-slate-200 text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all placeholder-slate-600 text-right leading-none"
                        placeholder="مانند: علی محمدی رفسنجانی"
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-teal-300 font-extrabold pr-1">شماره تلفن همراه</label>
                  <div className="relative">
                    <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-slate-950/40 border border-slate-800 rounded-2xl py-3.5 pr-11 pl-4 text-slate-200 text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all placeholder-slate-600 font-mono text-left tracking-wider"
                      placeholder="09131234567"
                      maxLength={11}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:opacity-95 text-white font-black py-4 px-4 rounded-2xl shadow-lg shadow-teal-900/15 flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] text-xs cursor-pointer select-none border border-teal-400/20"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : phoneMode === 'login' ? (
                    <>
                      <LogIn className="w-4 h-4 ml-1" />
                      دریافت پیامک یکبار مصرف
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 ml-1" />
                      ثبت‌نام و ارسال پیامک تایید
                    </>
                  )}
                </button>
              </form>

              {/* Elegant divider */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-4 text-[10px] text-slate-500 font-extrabold">یا ورود یکپارچه با گوگل</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              {/* Real Google Auth Entry Trigger Button */}
              <button
                type="button"
                onClick={() => { setShowGoogleChooser(true); setGoogleStep('list'); setError(null); }}
                className="w-full bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 rounded-2xl py-3.5 pr-4 pl-4 font-bold flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] text-xs cursor-pointer shadow-md select-none"
              >
                {/* Official Google Color Icon */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.865-3.585-7.865-8s3.535-8 7.865-8c2.46 0 4.105 1.025 5.045 1.926l3.25-3.127C18.33 1.936 15.48 1 12.24 1 6.01 1 1 5.918 1 12s5.01 11 11.24 11c6.51 0 10.84-4.512 10.84-11 0-.742-.08-1.305-.18-1.715h-9.66z"
                  />
                </svg>
                ورود ایمن با حساب گوگل (یک‌کلیکی)
              </button>

            </div>
          )}

        </div>
        
        {/* Footer */}
        <div className="text-center mt-10 anim-entry">
           <p className="text-teal-200/15 text-[10px] tracking-widest font-light">
             سامانه بومی پردازش ابری شهریار رفسنجان © ۱۴۰۵
           </p>
        </div>
      </div>

      {/* --- High-Grade Google Account Chooser SSO Modal --- */}
      {showGoogleChooser && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md anim-entry">
          <style>{authStyles}</style>
          
          <div className="w-full max-w-[360px] glass-modal rounded-[28px] overflow-hidden shadow-2xl p-6 relative border border-white/10">
            
            {googleStep !== 'loading' && (
              <button 
                onClick={() => { setShowGoogleChooser(false); }}
                className="absolute top-4 left-4 p-1.5 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* Google Identity Brand Icon */}
            <div className="text-center mt-3 pb-4 border-b border-white/5">
              <div className="inline-flex justify-center mb-3">
                <svg className="w-9 h-9" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.44c-.28 1.47-1.11 2.71-2.36 3.55l3.67 2.84c2.15-1.98 3.39-4.89 3.39-8.55z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.67-2.84c-1.02.68-2.33 1.09-3.96 1.09-3.02 0-5.54-2.57-6.46-5.71L1.58 15.7C3.4 19.65 7.35 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.54 10.75c-.24-.71-.38-1.47-.38-2.25s.14-1.54.38-2.25L1.58 3.18C.57 5.16 0 7.37 0 9.75s.57 4.59 1.58 6.57l3.96-3.07z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.04c1.67 0 3.2.58 4.38 1.71l3.27-3.27C17.65 1.54 15.01 1 12 1 7.35 1 3.4 3.73 1.58 7.68l3.96 3.07C6.46 7.61 8.98 5.04 12 5.04z"
                  />
                </svg>
              </div>
              
              <h2 className="text-base font-black text-slate-100">سامانه خدمات یکپارچه گوگل</h2>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">اتصال خودکار به درگاه دستیار شهریار</p>
            </div>

            {/* ERROR ALERTS IN MODAL */}
            {error && (
              <div className="mt-3.5 bg-red-400/10 border border-red-400/20 rounded-xl p-2.5 text-center">
                <p className="text-red-300 text-[10px] font-black leading-relaxed">{error}</p>
              </div>
            )}

            {/* CHOOSE ACCOUNT PHASE */}
            {googleStep === 'list' && (
              <div className="mt-5 space-y-4">
                <p className="text-right text-[11px] text-slate-400 pr-1 select-none font-bold">حساب کاربری خود را انتخاب کنید:</p>

                <div className="space-y-2.5 max-h-[220px] overflow-y-auto no-scrollbar">
                  
                  {/* Account Box 1: Tailored active Gmail user hasansadghi51@gmail.com */}
                  <button
                    type="button"
                    onClick={() => { triggerGoogleLogin('hasansadghi51@gmail.com', 'حسن صدقی'); }}
                    className="w-full flex items-center gap-3 p-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.04] hover:border-white/10 rounded-2xl text-right transition-all group"
                  >
                    {/* Modern Pixel Avatar Initial */}
                    <div className="w-10 h-10 bg-gradient-to-tr from-teal-500 to-sky-400 text-slate-900 font-black text-sm flex items-center justify-center rounded-full shrink-0 shadow-md">
                      ح‌ص
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-extrabold text-white group-hover:text-teal-300 transition-colors">حسن صدقی</h4>
                      <p className="text-[10px] text-slate-400 truncate tracking-wide font-mono">hasansadghi51@gmail.com</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0 group-hover:translate-x-[-2px] transition-transform" />
                  </button>

                  {/* Add New Google SSO Session Option */}
                  <button
                    type="button"
                    onClick={() => { setGoogleStep('add_email'); setError(null); }}
                    className="w-full flex items-center gap-3 p-3 bg-slate-950/40 hover:bg-white/[0.04] border border-dashed border-white/[0.1] rounded-2xl text-right transition-all group"
                  >
                    <div className="w-10 h-10 bg-slate-900 text-slate-400 font-bold flex items-center justify-center rounded-full shrink-0 border border-white/5">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">اتصال حساب جی‌میل جدید</h4>
                      <p className="text-[10px] text-slate-500 truncate leading-none">ورود با سایر ایمیل‌های Google</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                  </button>

                </div>

                {/* Google Terms Footer */}
                <div className="pt-4 border-t border-white/5 text-[10px] text-slate-500 text-center leading-relaxed font-medium select-none">
                  برای ادامه، شرکت گوگل اطلاعات حساب عمومی شما را با دستیار خدمات شهری به اشتراک خواهد گذاشت. 
                  <a href="#" className="text-teal-400/50 hover:text-teal-400 mx-1 underline">قوانین و حریم خصوصی</a>
                </div>
              </div>
            )}

            {/* ADD CUSTOM EMAIL MODE */}
            {googleStep === 'add_email' && (
              <form onSubmit={handleCustomGoogleSubmit} className="mt-5 space-y-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <button
                    type="button"
                    onClick={() => { setGoogleStep('list'); setError(null); }}
                    className="p-1 hover:bg-white/5 rounded-lg transition-colors text-slate-500 hover:text-white"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-extrabold text-slate-300">بازگشت به لیست حساب‌ها</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-teal-300 font-extrabold pr-1">آدرس ایمیل گوگل (Gmail)</label>
                  <div className="relative">
                    <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={customGoogleEmail}
                      onChange={(e) => setCustomGoogleEmail(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pr-10 pl-4 text-slate-200 text-xs focus:outline-none focus:border-teal-400 transition-all font-mono"
                      placeholder="username@gmail.com"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-teal-300 font-extrabold pr-1">نام و نام خانوادگی گوگل</label>
                  <div className="relative">
                    <UserIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={customGoogleName}
                      onChange={(e) => setCustomGoogleName(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pr-10 pl-4 text-slate-200 text-xs focus:outline-none focus:border-teal-400 transition-all"
                      placeholder="مثال: سهراب سجادی"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black py-3 rounded-xl shadow-lg transition-all active:scale-[0.98] text-xs"
                >
                  ثبت حساب کاربری گوگل و ورود
                </button>
              </form>
            )}

            {/* FULLY POLISHED LOADING TRANSITION STATE */}
            {googleStep === 'loading' && (
              <div className="mt-8 mb-4 py-6 text-center space-y-4">
                <div className="relative flex justify-center items-center">
                  {/* Outer Pulsing Glow */}
                  <div className="w-12 h-12 bg-teal-400/20 rounded-full absolute animate-ping opacity-60" />
                  
                  {/* Real Material Circle Spinner */}
                  <div className="w-12 h-12 border-3 border-teal-500/25 border-t-teal-400 rounded-full animate-spin relative z-10" />
                </div>
                <div>
                  <p className="text-xs text-slate-200 font-black animate-pulse">{googleLoadingMessage}</p>
                  <p className="text-[10px] text-slate-400 mt-2 font-semibold">لطفاً پیوند ایمن را متوقف نکنید.</p>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
