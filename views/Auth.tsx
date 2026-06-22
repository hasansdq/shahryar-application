import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { storageService } from '../services/storageService';
import { auth, db } from '../services/firebase';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  ConfirmationResult
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  Sparkles, 
  Bot, 
  Loader2, 
  Phone, 
  User as UserIcon, 
  LogIn, 
  UserPlus, 
  ArrowRight, 
  Lock, 
  MessageSquare, 
  ShieldAlert, 
  CheckCircle2, 
  Mail 
} from 'lucide-react';

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

  .anim-entry { animation: slideUpFade 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
`;

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  // Mobile verification state
  const [phoneMode, setPhoneMode] = useState<'login' | 'register'>('login');
  
  // Inputs
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  
  // OTP states
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
  const [userOTPInput, setUserOTPInput] = useState('');
  const [otpTimer, setOtpTimer] = useState(120);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Firebase Confirmation
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Global errors & loading
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Validate mobile
  const validatePhone = (num: string) => {
    const clean = num.replace(/\D/g, '');
    return clean.startsWith('09') && clean.length === 11;
  };

  // Convert Iranian phone number (09xxxxxxxx) into E.164 standard +989xxxxxxxx
  const formatPhoneNumber = (num: string) => {
    let clean = num.replace(/\D/g, '');
    if (clean.startsWith('09')) {
      clean = clean.substring(1);
    }
    if (!clean.startsWith('98')) {
      clean = '98' + clean;
    }
    return '+' + clean;
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

  // Cleanup recaptcha and timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, []);

  const initRecaptchaVerifier = () => {
    if (!recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          // Captcha solved, can submit phone Standard Firebase Auth Flow
        },
        'expired-callback': () => {
          setError('اعتبار سنجی کپچا به پایان رسید. بارگذاری مجدد انجام دهید.');
        }
      });
    }
    return recaptchaVerifierRef.current;
  };

  // Request Phone Verification SMS Code
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
      // 1. Check if user already exists
      const userExists = await storageService.checkPhoneExists(cleanPhone);
      
      if (phoneMode === 'login' && !userExists) {
        setError('حسابی با این شماره تلفن یافت نشد. لطفاً ابتدا ثبت‌نام کنید.');
        setPhoneMode('register');
        setLoading(false);
        return;
      }
      
      if (phoneMode === 'register' && userExists) {
        setError('این شماره موبایل پیش‌تر ثبت‌نام شده است. لطفاً وارد حساب خود شوید.');
        setPhoneMode('login');
        setLoading(false);
        return;
      }

      // 2. Initialize standard recaptcha and request SMS from Firebase
      const verifier = initRecaptchaVerifier();
      const formattedNum = formatPhoneNumber(cleanPhone);
      const confirmation = await signInWithPhoneNumber(auth, formattedNum, verifier);
      
      setConfirmationResult(confirmation);
      setUserOTPInput('');
      setIsVerifyingOTP(true);
      startTimer();

    } catch (err: any) {
      console.error("Firebase SMS auth error:", err);
      let errMsg = 'خطا در ارتباط با سرور فایربیس. لطفاً قفل‌شکن را بررسی کرده و مجدداً تلاش فرمایید.';
      if (err.code === 'auth/captcha-check-failed') {
        errMsg = 'خطا در ارزیابی کپچا فایربیس. لطفاً بعداً تلاش کنید یا از ورود گوگل استفاده فرمایید.';
      } else if (err.code === 'auth/invalid-phone-number') {
        errMsg = 'شماره تلفن نامعتبر است.';
      } else if (err.code === 'auth/too-many-requests') {
        errMsg = 'بیش از حد مجاز تلاش کرده‌اید. ورود گوگل را برای ورود آنی امتحان فرمایید.';
      }
      setError(errMsg);
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  // Resend code via Standard flow
  const handleResendOTP = async () => {
    if (otpTimer > 0) return;
    setError(null);
    setLoading(true);
    try {
      const verifier = initRecaptchaVerifier();
      const formattedNum = formatPhoneNumber(phone.trim());
      const confirmation = await signInWithPhoneNumber(auth, formattedNum, verifier);
      setConfirmationResult(confirmation);
      setUserOTPInput('');
      startTimer();
    } catch (err: any) {
      setError('خطا در ارسال مجدد کد تأیید.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Submit standard SMS OTP confirmation
  const handleVerifyOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    const otpVal = userOTPInput.trim();
    if (otpVal.length !== 6) {
      setError('کد تأیید باید ۶ رقم باشد.');
      return;
    }

    if (!confirmationResult) {
      setError('نشست منقضی شده است. لطفاً روند را از ابتدا آغاز کنید.');
      return;
    }

    setLoading(true);
    try {
      const credResult = await confirmationResult.confirm(otpVal);
      const firebaseUser = credResult.user;

      // Check/create user document in Firestore `/users/{uid}`
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      let finalUser;
      if (!userSnap.exists()) {
        finalUser = {
          id: firebaseUser.uid,
          name: name.trim() || 'شهروند شهریار',
          phone: phone.trim(),
          joinedDate: new Date().toISOString(),
          learnedData: [],
          traits: []
        };
        await setDoc(userRef, finalUser);

        // create default categories
        const now = Date.now();
        const defaultCategories = [
          { id: `cat_todo_${now}`, userId: firebaseUser.uid, title: 'برای انجام', color: '#0d9488' },
          { id: `cat_inprog_${now}`, userId: firebaseUser.uid, title: 'در حال انجام', color: '#eab308' },
          { id: `cat_done_${now}`, userId: firebaseUser.uid, title: 'انجام شده', color: '#22c55e' }
        ];
        for (const cat of defaultCategories) {
          await setDoc(doc(db, 'categories', cat.id), cat);
        }
      } else {
        finalUser = userSnap.data() as User;
        if (!finalUser.phone) {
          finalUser.phone = phone.trim();
          await setDoc(userRef, finalUser, { merge: true });
        }
      }

      localStorage.setItem('shahryar_user_cache', JSON.stringify(finalUser));
      if (timerRef.current) clearInterval(timerRef.current);
      onLogin(finalUser);
    } catch (err: any) {
      console.error("Firebase Code Verification error:", err);
      let errMsg = 'کد تأیید نادرست است. مجدداً تلاش نمایید.';
      if (err.code === 'auth/invalid-verification-code') {
        errMsg = 'کد وارد شده معتبر نمی‌باشد. دوباره کاراکترها را بررسی فرمایید.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Google Login - Standard Direct SDK Call
  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      
      // Fetch or create user in Firestore
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);
      
      let finalUser;
      if (!userSnap.exists()) {
        finalUser = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'کاربر شهریار',
          phone: firebaseUser.phoneNumber || '',
          email: firebaseUser.email || '',
          joinedDate: new Date().toISOString(),
          learnedData: [],
          traits: []
        };
        await setDoc(userRef, finalUser);
        
        // default categories
        const now = Date.now();
        const defaultCategories = [
          { id: `cat_todo_${now}`, userId: firebaseUser.uid, title: 'برای انجام', color: '#0d9488' },
          { id: `cat_inprog_${now}`, userId: firebaseUser.uid, title: 'در حال انجام', color: '#eab308' },
          { id: `cat_done_${now}`, userId: firebaseUser.uid, title: 'انجام شده', color: '#22c55e' }
        ];
        for (const cat of defaultCategories) {
          await setDoc(doc(db, 'categories', cat.id), cat);
        }
      } else {
        finalUser = userSnap.data() as User;
      }
      
      localStorage.setItem('shahryar_user_cache', JSON.stringify(finalUser));
      onLogin(finalUser);
    } catch (err: any) {
      console.error("Standard Google SSO login error:", err);
      let errMsg = 'اتصال حساب گوگل ناموفق بود. لطفاً اینترنت و ابزار عبور از تحریم خود را بررسی نمایید.';
      if (err.code === 'auth/popup-closed-by-user') {
        errMsg = 'پنجره ورود گوگل بسته شد. لطفاً دوباره دکمه ورود را کلیک کرده و پنجره گوگل را تا زمان اتمام فرآیند ورود نبندید. (پیشنهاد می‌شود جهت اجرای بی‌نقص، برنامه را در تب جدید مرورگر باز کنید)';
      } else if (err.code === 'auth/cancelled-popup-request') {
        errMsg = 'درخواست ورود گوگل لغو شد. لطفاً مجدداً دکمه ورود را کلیک کنید.';
      } else if (err.code === 'auth/popup-blocked') {
        errMsg = 'مرورگر شما نمایش پاپ‌آپ ورود گوگل را مسدود کرده است. لطفاً اجازه باز شدن Popup را به مرورگر خود بدهید.';
      } else if (err.code === 'auth/network-request-failed') {
        errMsg = 'خطای اتصال شبکه فایربیس رخ داد. لطفاً از اتصال اینترنت یا ابزار عبور از محدودیت‌های شبکه خود اطمینان حاصل فرمایید.';
      } else if (err.message) {
        errMsg = `خطا در ورود با گوگل: ${err.message}`;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
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

      {/* Invisible container for recaptcha verifier */}
      <div id="recaptcha-container" className="hidden"></div>

      {/* --- Outer Glowing Cinematic Ambient Lights --- */}
      <div className="absolute top-[-15%] left-[-15%] w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-[140px] animate-float pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[600px] h-[600px] bg-emerald-600/8 rounded-full blur-[140px] animate-float-delayed pointer-events-none" />
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
          <p className="text-teal-200/55 text-xs font-semibold">دستیار فوق‌هوشمند شهروندی و مدیریت شخصی</p>
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
                  className="p-1.5 hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-white"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
                <span className="text-xs font-black text-teal-300">بازگشت و تصحیح شماره تلفن</span>
              </div>

              <div className="text-center bg-slate-950/40 rounded-3xl p-4 border border-slate-900">
                <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                  کد تأیید ۶ رقمی رسمی از طرف فایربیس به شماره همراه <span className="font-mono text-teal-300 text-sm font-black underline">{phone}</span> ارسال گردید.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-teal-300 font-extrabold pr-1 text-center">کد تأیید ۶ رقمی را وارد کنید</label>
                <div className="relative max-w-[210px] mx-auto">
                  <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={userOTPInput}
                    onChange={(e) => setUserOTPInput(e.target.value.replace(/\D/g, '').substring(0, 6))}
                    className="w-full bg-slate-950/60 border-2 border-slate-700/60 focus:border-teal-400 rounded-2xl py-4 pr-12 pl-4 text-white text-lg font-black font-mono text-center tracking-[12px] focus:outline-none focus:ring-4 focus:ring-teal-500/10 transition-all text-left"
                    placeholder="••••••"
                    maxLength={6}
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
                      دریافت پیامک تایید فایربیس
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
                <span className="flex-shrink mx-4 text-[10px] text-slate-500 font-extrabold">یا ورود با درگاه استاندارد گوگل</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              {/* Google Global Single-Click Standard SSO Entry */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 rounded-2xl py-3.5 pr-4 pl-4 font-bold flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] text-xs cursor-pointer shadow-md select-none disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <>
                    {/* Official Google Color Icon */}
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#EA4335"
                        d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.865-3.585-7.865-8s3.535-8 7.865-8c2.46 0 4.105 1.025 5.045 1.926l3.25-3.127C18.33 1.936 15.48 1 12.24 1 6.01 1 1 5.918 1 12s5.01 11 11.24 11c6.51 0 10.84-4.512 10.84-11 0-.742-.08-1.305-.18-1.715h-9.66z"
                      />
                    </svg>
                    ورود ایمن با حساب گوگل
                  </>
                )}
              </button>

            </div>
          )}

        </div>
        
        {/* Footer */}
        <div className="text-center mt-10 anim-entry">
           <p className="text-teal-200/15 text-[10px] tracking-widest font-light">
             سامانه رسمی پردازش ابری شهریار رفسنجان © ۱۴۰۵
           </p>
        </div>
      </div>
    </div>
  );
};
