import React, { useState } from 'react';
import { User } from '../types';
import { storageService } from '../services/storageService';
import { Sparkles, Bot, Loader2 } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

// Custom CSS for animations and glass effect
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
  .animate-float { animation: float 15s ease-in-out infinite; }
  .animate-float-delayed { animation: float 20s ease-in-out infinite reverse; }
  .glass-card {
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  }
  .anim-entry { animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .anim-delay-1 { animation-delay: 0.1s; }
  .anim-delay-2 { animation-delay: 0.2s; }
`;

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const userProfile = await storageService.googleLogin();
      console.log("Authenticated via Google successfully. Welcome: ", userProfile.name);
      onLogin(userProfile);
    } catch (err: any) {
      console.error("Google authentication failed:", err);
      let errMsg = "خطا در فرآیند احراز هویت با اکانت گوگل. لطفا وضعیت اینترنت خود را بسنجید.";
      if (err.code === 'auth/popup-closed-by-user') {
        errMsg = "پنجره ورود توسط کاربر بسته شد. جهت ورود باید فرآیند را تکمیل کنید.";
      } else if (err.code === 'auth/cancelled-popup-request') {
        errMsg = "درخواست ورود از طرف سیستم لغو گردید. لطفا دوباره تلاش کنید.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="relative flex flex-col min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white justify-center items-center"
      style={{ fontFamily: "'Vazirmatn', sans-serif" }}
    >
      <style>{authStyles}</style>

      {/* --- Animated Ambient Background Elements --- */}
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
        <div className="glass-card p-6 rounded-[32px] anim-entry anim-delay-1 flex flex-col items-center">
          
          <h2 className="text-lg font-bold text-center text-teal-100 mb-2">خوش آمدید</h2>
          <p className="text-slate-300 text-xs text-center leading-relaxed mb-6 font-light">
             برای ورود سریع و امن به سامانه دستیار هوشمند، از حساب کاربری گوگل خود استفاده نمایید. اطلاعات تکمیلی شما در برنامه محفوظ است.
          </p>

          {error && (
            <div className="w-full bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center mb-4 anim-entry">
              <p className="text-red-300 text-[11px] font-bold leading-relaxed">{error}</p>
            </div>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleLogin}
            className="w-full bg-white text-slate-800 hover:bg-slate-100 font-bold py-3.5 px-4 rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-all duration-300 active:scale-[0.98] border border-white/20 text-sm"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
            ) : (
              <>
                {/* Modern Inline SVG Google Icon */}
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5.04c1.67 0 3.2.58 4.38 1.71l3.27-3.27C17.65 1.54 15.01 1 12 1 7.35 1 3.4 3.73 1.58 7.68l3.96 3.07C6.46 7.61 8.98 5.04 12 5.04z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.44c-.28 1.47-1.11 2.71-2.36 3.55l3.67 2.84c2.15-1.98 3.39-4.89 3.39-8.55z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.54 10.75c-.24-.71-.38-1.47-.38-2.25s.14-1.54.38-2.25L1.58 3.18C.57 5.16 0 7.37 0 9.75s.57 4.59 1.58 6.57l3.96-3.07z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.67-2.84c-1.02.68-2.33 1.09-3.96 1.09-3.02 0-5.54-2.57-6.46-5.71L1.58 15.7C3.4 19.65 7.35 23 12 23z"
                  />
                </svg>
                <span className="font-bold">ورود با اکانت Google</span>
              </>
            )}
          </button>

        </div>
        
        <div className="text-center mt-8 anim-entry anim-delay-2">
           <p className="text-teal-200/20 text-[10px] tracking-widest font-light">
             طراحی دستیار هوشمند شهریار رفسنجان © ۱۴۰۵
           </p>
        </div>
      </div>
    </div>
  );
};
