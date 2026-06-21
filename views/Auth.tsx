import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { storageService } from '../services/storageService';
import { auth } from '../services/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { 
  User as UserIcon, Smartphone, ArrowLeft, ArrowRight,
  Sparkles, ShieldCheck, Bot, Loader2, KeyRound
} from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

// --- Custom CSS for Advanced Animations ---
const authStyles = `
  @keyframes float {
    0% { transform: translate(0px, 0px) rotate(0deg); }
    33% { transform: translate(30px, -50px) rotate(10deg); }
    66% { transform: translate(-20px, 20px) rotate(-5deg); }
    100% { transform: translate(0px, 0px) rotate(0deg); }
  }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 20px rgba(45, 212, 191, 0.2); }
    50% { box-shadow: 0 0 40px rgba(45, 212, 191, 0.5); }
  }
  @keyframes slideUpFade {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-float { animation: float 15s ease-in-out infinite; }
  .animate-float-delayed { animation: float 20s ease-in-out infinite reverse; }
  .glass-card {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
  }
  .input-focus-effect:focus-within {
    border-color: #5eead4;
    box-shadow: 0 0 0 4px rgba(94, 234, 212, 0.1);
    background: rgba(0, 0, 0, 0.25);
  }
  .anim-entry { animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .anim-delay-1 { animation-delay: 0.1s; }
  .anim-delay-2 { animation-delay: 0.2s; }
  .anim-delay-3 { animation-delay: 0.3s; }
`;

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  
  // OTP related states
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const failsafeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize Recaptcha Verifier
  useEffect(() => {
    try {
      const verifier = new RecaptchaVerifier(auth, 'invisible-recaptcha-container', {
        size: 'invisible',
        callback: () => {
          console.log("reCAPTCHA solved");
        }
      });
      setRecaptchaVerifier(verifier);
    } catch (e) {
      console.error("reCAPTCHA initialization failed: ", e);
    }

    return () => {
      if (failsafeTimerRef.current) clearTimeout(failsafeTimerRef.current);
    };
  }, []);

  // Normalize phone to E.164 (+98 for Iran)
  const normalizePhoneNumber = (phoneStr: string) => {
    let clean = phoneStr.trim().replace(/\s+/g, '');
    if (clean.startsWith('09')) {
      return '+98' + clean.slice(1);
    }
    if (clean.length === 10 && clean.startsWith('9')) {
      return '+98' + clean;
    }
    if (clean.startsWith('+')) {
      return clean;
    }
    if (clean.startsWith('9')) {
      return '+98' + clean;
    }
    return clean;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    const cleanPhone = phone.trim().replace(/\s+/g, '');
    if (cleanPhone.length < 10) {
      setError('شماره تلفن وارد شده صحیح نیست. لطفا یک تلفن معتبر وارد کنید.');
      return;
    }

    if (!isLogin && !name.trim()) {
      setError('نام و نام خانوادگی الزامی است.');
      return;
    }

    setLoading(true);

    try {
      const formattedPhone = normalizePhoneNumber(phone);
      console.log("Initiating OTP to format phone:", formattedPhone);

      let verifier = recaptchaVerifier;
      if (!verifier) {
        verifier = new RecaptchaVerifier(auth, 'invisible-recaptcha-container', {
          size: 'invisible'
        });
        setRecaptchaVerifier(verifier);
      }

      const cr = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      setConfirmationResult(cr);
      setOtpSent(true);
    } catch (err: any) {
      console.error("Error sending SMS OTP:", err);
      let errMsg = "خطا در ارسال پیامک فعال‌سازی. لطفا وضعیت اینترنت را چک کنید.";
      if (err.code === 'auth/invalid-phone-number') {
        errMsg = "شماره تلفن وارد شده معتبر نیست. لطفا شماره را چک کنید.";
      } else if (err.code === 'auth/too-many-requests') {
        errMsg = "تعداد درخواست‌های پیامک بیش از حد مجاز است. لطفا دقایقی دیگر تلاش کنید.";
      }
      setError(errMsg);
    } finally {
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

    setLoading(true);

    try {
      if (!confirmationResult) {
        throw new Error("نشست معتبر یافت نشد. لطفا مجدد تلاش کنید.");
      }

      const userCredential = await confirmationResult.confirm(otpCode.trim());
      const firebaseUser = userCredential.user;

      // Get or create Firestore profile under individual ID
      const userProfile = await storageService.getOrCreateUser(
        firebaseUser.uid,
        firebaseUser.phoneNumber || phone,
        isLogin ? undefined : name
      );

      console.log("SMS Verification Complete. Welcome:", userProfile.name);
      onLogin(userProfile);
    } catch (err: any) {
      console.error("Failed OTP verification:", err);
      let errMsg = "کد تایید وارد شده نامعتبر یا منقضی شده است.";
      if (err.code === 'auth/invalid-verification-code') {
        errMsg = "کد وارد شده صحیح نیست.";
      } else if (err.code === 'auth/code-expired') {
        errMsg = "کد تایید منقضی شده است؛ لطفا دوباره تلاش کنید.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetForm = () => {
    setOtpSent(false);
    setOtpCode('');
    setError(null);
  };

  return (
    <div 
      className="relative flex flex-col min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 text-white justify-center items-center"
      style={{ fontFamily: "'Vazirmatn', sans-serif" }}
    >
      <style>{authStyles}</style>

      {/* --- Native Invisible ReCAPTCHA Container --- */}
      <div id="invisible-recaptcha-container" className="hidden"></div>

      {/* --- Animated Background Elements --- */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-teal-500/20 rounded-full blur-[100px] animate-float pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] animate-float-delayed pointer-events-none" />
      <div className="absolute top-[40%] left-[20%] w-32 h-32 bg-purple-500/10 rounded-full blur-[60px] animate-pulse pointer-events-none" />

      <div className="w-full max-w-[360px] z-10 px-4">
        
        {/* --- Header / Logo --- */}
        <div className="mb-8 text-center anim-entry">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-teal-400 to-emerald-400 rounded-3xl shadow-[0_0_40px_-10px_rgba(45,212,191,0.5)] mb-4 rotate-6 transform hover:rotate-12 transition-transform duration-500">
             <Bot className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black mb-2 tracking-tight drop-shadow-lg flex items-center justify-center gap-2">
            شهریار
            <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
          </h1>
          <p className="text-teal-100 text-sm font-light opacity-90">دستیار هوشمند و بومی شهر رفسنجان</p>
        </div>

        {/* --- Main Glass Card --- */}
        <div className="glass-card p-1 rounded-[32px] anim-entry anim-delay-1">
          
          {/* Toggle Switch (Hidden when OTP Screen is active) */}
          {!otpSent && (
            <div className="relative flex bg-black/30 p-1 rounded-[28px] mb-6 mx-4 mt-4">
              <div 
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-teal-500 rounded-[24px] shadow-lg transition-all duration-300 ease-out ${isLogin ? 'right-1' : 'right-[50%]'}`} 
              />
              <button 
                type="button"
                className={`flex-1 relative z-10 py-3 text-sm font-bold transition-colors duration-300 ${isLogin ? 'text-white' : 'text-slate-300 hover:text-white'}`}
                onClick={() => { setIsLogin(true); setError(null); }}
              >
                ورود
              </button>
              <button 
                type="button"
                className={`flex-1 relative z-10 py-3 text-sm font-bold transition-colors duration-300 ${!isLogin ? 'text-white' : 'text-slate-300 hover:text-white'}`}
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
                  <div className="absolute right-3 top-3.5 text-teal-300/70 group-focus-within:text-teal-300 transition-colors">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    placeholder="نام و نام خانوادگی"
                    className="w-full bg-black/20 border border-white/10 rounded-2xl py-3.5 pr-11 pl-4 text-white placeholder-slate-400 focus:outline-none input-focus-effect transition-all duration-300 text-sm"
                    style={{ fontFamily: "'Vazirmatn', sans-serif" }}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!isLogin}
                  />
                </div>
              )}
              
              <div className="relative group anim-entry anim-delay-1">
                <div className="absolute right-3 top-3.5 text-teal-300/70 group-focus-within:text-teal-300 transition-colors">
                  <Smartphone className="w-5 h-5" />
                </div>
                <input
                  type="tel"
                  placeholder="شماره تلفن همراه (مثلا 09131234567)"
                  className="w-full bg-black/20 border border-white/10 rounded-2xl py-3.5 pr-11 pl-4 text-white placeholder-slate-400 focus:outline-none input-focus-effect transition-all duration-300 text-sm text-left dir-ltr"
                  style={{ direction: 'ltr', textAlign: 'right', fontFamily: "'Vazirmatn', sans-serif" }}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-center">
                  <p className="text-red-200 text-xs font-bold">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold py-4 rounded-2xl shadow-[0_10px_20px_-5px_rgba(20,184,166,0.4)] mt-4 flex items-center justify-center gap-3 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] anim-entry anim-delay-3"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                      <span className="text-lg">ارسال کد پیامکی تایید</span>
                      <div className="bg-white/20 p-1 rounded-full">
                          <ArrowLeft className="w-5 h-5" />
                      </div>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* --- VERIFY CODE SCREEN --- */
            <form onSubmit={handleVerifyOtp} className="px-5 py-6 space-y-4">
              <div className="text-center space-y-2 mb-4">
                <ShieldCheck className="w-12 h-12 text-teal-400 mx-auto animate-bounce" />
                <h3 className="text-lg font-bold text-teal-100">کد تایید را وارد کنید</h3>
                <p className="text-xs text-teal-200/70">
                  یک کد فعال‌سازی ۶ رقمی به شماره <span className="font-bold text-white dir-ltr inline-block">{phone}</span> ارسال شد.
                </p>
              </div>

              <div className="relative group">
                <div className="absolute right-3 top-3.5 text-teal-300/70 group-focus-within:text-teal-300 transition-colors">
                  <KeyRound className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="- - - - - -"
                  className="w-full bg-black/25 border border-white/10 rounded-2xl py-3.5 pr-11 pl-4 text-white text-center font-bold tracking-[0.5em] focus:outline-none input-focus-effect transition-all duration-300 text-lg"
                  style={{ fontFamily: "'Vazirmatn', sans-serif" }}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-center">
                  <p className="text-red-200 text-xs font-bold">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 text-sm"
                >
                  <ArrowRight className="w-4 h-4" />
                  ویرایش شماره
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold py-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all duration-300 text-sm"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>تایید و ورود</span>
                      <ShieldCheck className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>
        
        <div className="text-center mt-8 anim-entry anim-delay-3">
           <p className="text-teal-200/40 text-[10px] tracking-wider">
             طراحی شده با عشق برای مردم رفسنجان ❤️
           </p>
        </div>
      </div>
    </div>
  );
};
