import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { storageService } from '../services/storageService';
import { 
  User as UserIcon, Smartphone, ArrowLeft, ArrowRight,
  Sparkles, ShieldCheck, Bot, Loader2, KeyRound, CheckCircle, MessageSquare
} from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

// Custom CSS for animations
const authStyles = `
  @keyframes float {
    0% { transform: translate(0px, 0px) rotate(0deg); }
    33% { transform: translate(30px, -50px) rotate(10deg); }
    66% { transform: translate(-20px, 20px) rotate(-5deg); }
    100% { transform: translate(0px, 0px) rotate(0deg); }
  }
  @keyframes slideUpFade {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideDownMessage {
    0% { transform: translateY(-100px); opacity: 0; }
    10% { transform: translateY(16px); opacity: 1; }
    90% { transform: translateY(16px); opacity: 1; }
    100% { transform: translateY(-100px); opacity: 0; }
  }
  .animate-float { animation: float 15s ease-in-out infinite; }
  .animate-float-delayed { animation: float 20s ease-in-out infinite reverse; }
  .glass-card {
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  }
  .input-focus-effect:focus-within {
    border-color: #5eead4;
    box-shadow: 0 0 0 4px rgba(94, 234, 212, 0.1);
    background: rgba(0, 0, 0, 0.3);
  }
  .anim-entry { animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .anim-delay-1 { animation-delay: 0.1s; }
  .anim-delay-2 { animation-delay: 0.2s; }
  .anim-delay-3 { animation-delay: 0.3s; }
  .animate-sms-alert {
    animation: slideDownMessage 7.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
`;

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  
  // Custom Adaptive Verification System
  const [otpSent, setOtpSent] = useState(false);
  const [expectedOtp, setExpectedOtp] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showSMSNotify, setShowSMSNotify] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    const cleanPhone = phone.trim().replace(/\s+/g, '');
    if (cleanPhone.length < 10) {
      setError('شماره تلفن وارد شده صحیح نیست. لطفاً یک تلفن معتبر وارد کنید.');
      return;
    }

    if (!isLogin && !name.trim()) {
      setError('نام و نام خانوادگی الزامی است.');
      return;
    }

    setLoading(true);

    try {
      // 1. Fire up database validation check
      const phoneExists = await storageService.checkPhoneExists(cleanPhone);

      if (isLogin) {
        if (!phoneExists) {
          setError('کاربری با این شماره یافت نشد؛ جهت عضویت لطفاً وارد زبانه "ثبت نام جدید" شوید.');
          setLoading(false);
          return;
        }
      } else {
        if (phoneExists) {
          setError('این شماره همراه قبلاً در سیستم ثبت شده است. لطفاً از بخش ورود استفاده کنید.');
          setLoading(false);
          return;
        }
      }

      // 2. Generate and trigger interactive Shahryar SMS simulator code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setExpectedOtp(code);
      
      // Delay to make it look highly authentic and responsive
      setTimeout(() => {
        setOtpSent(true);
        setLoading(false);
        setShowSMSNotify(true);
        
        // Auto hide notification after 7 seconds
        setTimeout(() => {
          setShowSMSNotify(false);
        }, 7500);
      }, 900);

    } catch (err: any) {
      console.error("Auth send code error:", err);
      setError("خطا در برقراری ارتباط با پایگاه داده. وضعیت شبکه را بررسی کنید.");
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (otpCode.trim().length !== 6) {
      setError('کد تایید باید ۶ رقمی باشد.');
      return;
    }

    if (otpCode.trim() !== expectedOtp) {
      setError('کد فعال‌سازی وارد شده صحیح نیست؛ لطفاً مجدداً امتحان کنید.');
      return;
    }

    setLoading(true);

    try {
      let userProfile: User;
      if (isLogin) {
        userProfile = await storageService.firebaseLogin(phone);
      } else {
        userProfile = await storageService.firebaseRegister(phone, name);
      }

      console.log("Firebase Auth Authenticated successfully. Welcome: ", userProfile.name);
      onLogin(userProfile);
    } catch (err: any) {
      console.error("Firebase auth mapped link failed:", err);
      setError(err?.message || "خطا در پردازش اطلاعات کاربر در سرور فایربیس.");
      setLoading(false);
    }
  };

  const handleResetForm = () => {
    setOtpSent(false);
    setOtpCode('');
    setError(null);
    setShowSMSNotify(false);
  };

  const cleanPhoneInput = (val: string) => {
    // Only allow numbers
    const numbersOnly = val.replace(/\D/g, '');
    setPhone(numbersOnly);
  };

  return (
    <div 
      className="relative flex flex-col min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white justify-center items-center"
      style={{ fontFamily: "'Vazirmatn', sans-serif" }}
    >
      <style>{authStyles}</style>

      {/* --- Adaptive SMS Notification Toast --- */}
      {showSMSNotify && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="w-full max-w-sm bg-slate-900/95 border border-teal-500/30 text-white rounded-2xl p-4 shadow-2xl flex items-start gap-3 pointer-events-auto animate-sms-alert">
            <div className="bg-teal-500/20 p-2.5 rounded-xl text-teal-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="flex-1 text-right">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-slate-400">پیامک - هم‌اکنون</span>
                <span className="text-xs font-bold text-teal-400">سامانه پیامکی شهریار</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-semibold">
                کد تایید ورود به برنامه شهریار شما: <span className="font-bold text-teal-300 text-sm tracking-widest">{expectedOtp}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* --- Animated Ambient Background --- */}
      <div className="absolute top-[-10%] left-[-10%] w-[450px] h-[450px] bg-teal-500/10 rounded-full blur-[120px] animate-float pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[130px] animate-float-delayed pointer-events-none" />

      <div className="w-full max-w-[360px] z-10 px-4">
        
        {/* --- Header / Logo --- */}
        <div className="mb-6 text-center anim-entry">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-teal-400 to-emerald-400 rounded-3xl shadow-[0_0_40px_-5px_rgba(45,212,191,0.3)] mb-4 rotate-6 transform hover:rotate-12 transition-transform duration-500">
             <Bot className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black mb-1.5 tracking-tight drop-shadow-lg flex items-center justify-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-emerald-300">
            شهریار
            <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
          </h1>
          <p className="text-slate-400 text-xs font-medium">پایگاه داده هوشمند و بومی رفسنجان</p>
        </div>

        {/* --- Main Glass Card --- */}
        <div className="glass-card p-1 rounded-[32px] anim-entry anim-delay-1">
          
          {/* Toggle Switch */}
          {!otpSent && (
            <div className="relative flex bg-black/40 p-1 rounded-[28px] mb-5 mx-4 mt-4 border border-white/5">
              <div 
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-gradient-to-r from-teal-500 to-emerald-500 rounded-[24px] shadow-lg transition-all duration-300 ease-out ${isLogin ? 'right-1' : 'right-[50%]'}`} 
              />
              <button 
                type="button"
                className={`flex-1 relative z-10 py-3.5 text-xs font-bold transition-colors duration-300 ${isLogin ? 'text-white font-black' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => { setIsLogin(true); setError(null); }}
              >
                ورود شهروندی
              </button>
              <button 
                type="button"
                className={`flex-1 relative z-10 py-3.5 text-xs font-bold transition-colors duration-300 ${!isLogin ? 'text-white font-black' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => { setIsLogin(false); setError(null); }}
              >
                ثبت نام جدید
              </button>
            </div>
          )}

          {!otpSent ? (
            /* --- ENTER PHONE NUMBER SCREEN --- */
            <form onSubmit={handleSendOtp} className="px-5 pb-6 space-y-4">
              
              {!isLogin && (
                <div className="relative group anim-entry">
                  <div className="absolute right-3.5 top-3.5 text-slate-400 group-focus-within:text-teal-400 transition-colors">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="نام و نام خانوادگی خود را بنویسید"
                    className="w-full bg-slate-950/40 border border-white/10 rounded-2xl py-3.5 pr-11 pl-4 text-white placeholder-slate-500 focus:outline-none input-focus-effect transition-all duration-300 text-sm"
                    style={{ fontFamily: "'Vazirmatn', sans-serif" }}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}
              
              <div className="relative group anim-entry anim-delay-1">
                <div className="absolute right-3.5 top-3.5 text-slate-400 group-focus-within:text-teal-400 transition-colors">
                  <Smartphone className="w-5 h-5" />
                </div>
                <input
                  type="tel"
                  required
                  placeholder="شماره تلفن همراه (مثلا 09131234567)"
                  className="w-full bg-slate-950/40 border border-white/10 rounded-2xl py-3.5 pr-11 pl-4 text-white placeholder-slate-500 focus:outline-none input-focus-effect transition-all duration-300 text-sm text-left dir-ltr"
                  style={{ direction: 'ltr', textAlign: 'right', fontFamily: "'Vazirmatn', sans-serif" }}
                  value={phone}
                  onChange={(e) => cleanPhoneInput(e.target.value)}
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center anim-entry">
                  <p className="text-red-300 text-[11px] font-bold leading-relaxed">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold py-4 rounded-2xl shadow-[0_10px_20px_-5px_rgba(20,184,166,0.25)] mt-4 flex items-center justify-center gap-3 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] anim-entry anim-delay-3"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                      <span className="text-sm font-black">دریافت کد تایید یکبار مصرف</span>
                      <div className="bg-white/10 p-1 rounded-full">
                          <ArrowLeft className="w-4 h-4" />
                      </div>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* --- VERIFY CODE SCREEN --- */
            <form onSubmit={handleVerifyOtp} className="px-5 py-6 space-y-4">
              <div className="text-center space-y-2 mb-4">
                <CheckCircle className="w-12 h-12 text-teal-400 mx-auto animate-pulse" />
                <h3 className="text-lg font-bold text-teal-100">درخواست با موفقیت ارسال شد</h3>
                <p className="text-xs text-slate-400 leading-relaxed px-1">
                  کد تایید ۶ رقمی به شماره <span className="font-bold text-white dir-ltr inline-block text-sm">{phone}</span> ارسال گردید. آن را وارد کنید یا از پیامک شبیه‌سازی بالا بخوانید.
                </p>
              </div>

              <div className="relative group">
                <div className="absolute right-3.5 top-3.5 text-slate-400 group-focus-within:text-teal-400 transition-colors">
                  <KeyRound className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="- - - - - -"
                  className="w-full bg-slate-950/40 border border-white/10 rounded-2xl py-3.5 pr-11 pl-4 text-white text-center font-bold tracking-[0.5em] focus:outline-none input-focus-effect transition-all duration-300 text-lg"
                  style={{ fontFamily: "'Vazirmatn', sans-serif" }}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                  <p className="text-red-300 text-[11px] font-bold leading-relaxed">{error}</p>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-1.5 transition-all duration-300 text-xs border border-white/5"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  ویرایش شماره
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold py-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all duration-300 text-xs"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span className="font-black">تایید نهایی و ورود</span>
                      <ShieldCheck className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>
        
        <div className="text-center mt-8 anim-entry anim-delay-3">
           <p className="text-teal-200/20 text-[10px] tracking-widest font-light">
             طراحی دستیار هوشمند شهریار رفسنجان © ۱۴۰۵
           </p>
        </div>
      </div>
    </div>
  );
};
