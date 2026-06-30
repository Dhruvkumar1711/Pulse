import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithGoogle, 
  loginAsDemoUser,
  signUpWithEmailAndPasswordCustom,
  signInWithEmailAndPasswordCustom
} from '../lib/firebase';
import { NeumorphicContainer, NeumorphicButton, NeumorphicInput } from './Neumorphic';
import { DESIGN_TOKENS, getDesignTokens } from '../lib/designTokens';
import { 
  Sparkles, 
  ArrowRight, 
  Chrome, 
  ShieldAlert, 
  MonitorPlay,
  LayoutDashboard,
  Clock,
  Calendar,
  Bell,
  Flame,
  Mic,
  Bot,
  Zap,
  Check,
  TrendingUp,
  RefreshCw,
  Info,
  CalendarDays,
  Plus,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react';

interface OnboardingProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onLoginSuccess: (user: any) => void;
}

interface TourStop {
  id: number;
  title: string;
  badge: string;
  desc: string;
  anchorX: number; // Percentage from left of mockup
  anchorY: number; // Percentage from top of mockup
  labelPosition: {
    left?: string;
    right?: string;
    top?: string;
    bottom?: string;
  };
  leaderPath: string; // SVG path relative to mockup coordinates
  highlightedCard: 'backlog' | 'calendar' | 'goals' | 'insights' | 'voice' | 'alert' | 'agent';
  detailedDesc: string;
}

const TOUR_STOPS: TourStop[] = [
  {
    id: 1,
    title: "Intelligent Task Prioritization",
    badge: "AI PRIORITIZATION",
    desc: "Gemini ranks every task by urgency and effort automatically.",
    anchorX: 25,
    anchorY: 28,
    labelPosition: { left: "-280px", top: "10%" },
    leaderPath: "M 25 28 L 10 20 L -10 10",
    highlightedCard: 'backlog',
    detailedDesc: "Our deep learning models read your task descriptions, dependencies, and deadlines. It automatically groups them by importance (A1 to C3) and assigns effort estimates so you never wonder what to do next."
  },
  {
    id: 2,
    title: "AI-Powered Scheduling",
    badge: "AI SCHEDULER",
    desc: "Turns your task list into a real timeline.",
    anchorX: 75,
    anchorY: 42,
    labelPosition: { left: "10%", bottom: "-120px" },
    leaderPath: "M 75 42 L 60 55 L 40 68",
    highlightedCard: 'calendar',
    detailedDesc: "Pulse allocates dedicated high-energy focus slots tailored to your peak work hours. Click 'Plan My Day' and watch your unstructured list seamlessly transform into a focused timeline."
  },
  {
    id: 3,
    title: "Calendar Integration",
    badge: "GCAL SYNC",
    desc: "Two-way sync with Google Calendar, no double-booking.",
    anchorX: 84,
    anchorY: 15,
    labelPosition: { right: "-280px", top: "5%" },
    leaderPath: "M 84 15 L 102 10 L 115 15",
    highlightedCard: 'calendar',
    detailedDesc: "Enjoy bulletproof, real-time bidirectional integration with Google Calendar. Every event is synced instantly both ways, preventing conflicts and double-bookings."
  },
  {
    id: 4,
    title: "Context-Aware Reminders",
    badge: "SMART ALERTS",
    desc: "Reminders that know when you actually need them.",
    anchorX: 50,
    anchorY: 50,
    labelPosition: { left: "-280px", top: "45%" },
    leaderPath: "M 50 50 L 15 55 L -10 60",
    highlightedCard: 'alert',
    detailedDesc: "Pulse keeps you aligned using context-aware prompts. Instead of static, annoying alerts, it nudges you when it detects the absolute best gap in your day to tackle high-effort items."
  },
  {
    id: 5,
    title: "Goal & Habit Tracking",
    badge: "HABITS & MILESTONES",
    desc: "Big goals become a clear set of milestones.",
    anchorX: 25,
    anchorY: 78,
    labelPosition: { left: "-280px", bottom: "5%" },
    leaderPath: "M 25 78 L 8 82 L -10 90",
    highlightedCard: 'goals',
    detailedDesc: "Pulse breaks down your major milestones into achievable daily tasks and links them directly to your personal coding habits. Complete tasks to keep your streak burning!"
  },
  {
    id: 6,
    title: "Personalized Recommendations",
    badge: "DAILY INSIGHTS",
    desc: "Daily insights based on your own patterns.",
    anchorX: 75,
    anchorY: 78,
    labelPosition: { right: "-280px", top: "40%" },
    leaderPath: "M 75 78 L 95 82 L 115 90",
    highlightedCard: 'insights',
    detailedDesc: "Track your cognitive peaks. By analyzing your task completion rates and mouse/keyboard focus times, Pulse reveals when you are at your absolute sharpest and adjusts recommendations."
  },
  {
    id: 7,
    title: "Voice Assistant",
    badge: "VOICE AGENT",
    desc: "Tap to talk — add or reschedule tasks by voice.",
    anchorX: 90,
    anchorY: 15,
    labelPosition: { right: "-280px", bottom: "10%" },
    leaderPath: "M 90 15 L 105 18 L 115 15",
    highlightedCard: 'voice',
    detailedDesc: "Hands busy? Simply speak to Pulse. Tap the glowing voice assistant to naturally dictate schedules, adjust tasks, or request summaries. It's like talking to a real human secretary."
  },
  {
    id: 8,
    title: "Autonomous Planning Agent",
    badge: "AUTONOMOUS FLOW",
    desc: "It replans your day when things change, and tells you why.",
    anchorX: 50,
    anchorY: 15,
    labelPosition: { right: "15%", top: "-120px" },
    leaderPath: "M 50 15 L 60 10 L 75 -10",
    highlightedCard: 'agent',
    detailedDesc: "Our autonomous background planner is always awake. If a sudden calendar conflict appears, Pulse silently re-allocates and buffers your schedule, presenting a clear summary and one-click Undo."
  }
];

export const Onboarding: React.FC<OnboardingProps> = ({ darkMode, onToggleDarkMode, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Authentication mode and custom credentials states
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleCustomAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    
    if (authMode === 'signup') {
      if (!displayName.trim()) {
        setError('Please enter your name.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }
    
    setLoading(true);
    try {
      if (authMode === 'signup') {
        const user = await signUpWithEmailAndPasswordCustom(
          email.trim(),
          password,
          displayName.trim()
        );
        onLoginSuccess(user);
      } else {
        const user = await signInWithEmailAndPasswordCustom(
          email.trim(),
          password
        );
        onLoginSuccess(user);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Scroll & 3D Tour states
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeStop, setActiveStop] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isSmallMobile, setIsSmallMobile] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Mouse reflection tracking states for glossy glassmorphic 3D lighting
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  useEffect(() => {
    if (!isClicked) return;
    const timer = setTimeout(() => {
      setIsClicked(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [isClicked]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      setIsSmallMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    // Dynamically activate scroll snapping on the html/viewport container during onboarding
    const htmlElement = document.documentElement;
    htmlElement.style.scrollSnapType = 'y mandatory';
    htmlElement.classList.add('scroll-smooth');
    
    return () => {
      htmlElement.style.scrollSnapType = '';
      htmlElement.classList.remove('scroll-smooth');
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const viewHeight = window.innerHeight;
      
      // Calculate scroll progress within this specific section
      const scrolled = -rect.top;
      const totalScrollableHeight = rect.height - viewHeight;
      
      if (totalScrollableHeight <= 0) return;
      
      const rawPct = scrolled / totalScrollableHeight;
      const pct = Math.max(0, Math.min(1, rawPct));
      setScrollProgress(pct);
      
      // Determine current active stop (0-7)
      const stopIndex = Math.min(7, Math.floor(pct * 8));
      setActiveStop(stopIndex);
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      if (user) {
        onLoginSuccess(user);
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err.message?.includes('popup-closed-by-user')
          ? 'Sign-in window was closed. Please try again.'
          : 'Google Sign-In failed. Please try Sandbox Mode instead.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSandboxLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = await loginAsDemoUser(email.trim().toLowerCase());
      onLoginSuccess(user);
    } catch (err: any) {
      console.error(err);
      setError('Sandbox login failed. Try again or check network.');
    } finally {
      setLoading(false);
    }
  };

  const useDefaultDemoUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await loginAsDemoUser('demo@pulse-companion.com');
      onLoginSuccess(user);
    } catch (err: any) {
      console.error(err);
      setError('Quick Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  const scrollToLogin = () => {
    const loginSection = document.getElementById('auth-section');
    if (loginSection) {
      loginSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToTour = () => {
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const goToStop = (index: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const absoluteTop = rect.top + window.scrollY;
    const scrollableHeight = rect.height - window.innerHeight;
    // Calculate target scroll position within the stop slot
    const targetPct = (index + 0.1) / 8;
    const targetY = absoluteTop + targetPct * scrollableHeight;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || isClicked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  const tokens = getDesignTokens(darkMode);

  // Compute 3D rotation angles tied strictly to scroll progress
  const rotateX = prefersReducedMotion || isSmallMobile || isClicked ? 0 : isMobile ? (scrollProgress * 8 - 4) : (16 - scrollProgress * 32);
  const rotateY = prefersReducedMotion || isSmallMobile || isClicked ? 0 : isMobile ? (scrollProgress * 12 - 6) : (-22 + scrollProgress * 44);
  const translateZ = prefersReducedMotion || isSmallMobile ? 0 : 20;

  const getCardStyle = (cardId: string) => {
    if (isSmallMobile) {
      return {
        transform: 'none'
      };
    }
    return {
      transform: `translateZ(${currentStop.highlightedCard === cardId ? '50px' : '15px'})`,
      transformStyle: 'preserve-3d' as const,
      transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s, border-color 0.4s'
    };
  };

  const getOverlayStyle = (cardId: string, zVal: number) => {
    if (isSmallMobile) {
      return {
        transform: 'none'
      };
    }
    return {
      transform: `translateZ(${zVal}px)`,
      transformStyle: 'preserve-3d' as const
    };
  };

  const currentStop = TOUR_STOPS[activeStop];

  return (
    <div className={`min-h-screen transition-colors duration-500 font-sans pb-16 ${darkMode ? 'bg-[#1a1d24]' : 'bg-[#e6ebf2]'}`}>
      
      {/* Floating Glassmorphic Navigation Bar */}
      <nav className={`fixed top-4 left-4 right-4 z-50 ${darkMode ? 'bg-[#1a1d24]/50' : 'bg-white/40'} backdrop-blur-md border border-white/20 dark:border-white/10 rounded-[16px] shadow-lg px-6 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#0d9488] flex items-center justify-center text-white shadow-md">
            <Zap className="w-5.5 h-5.5 animate-pulse fill-white/20" />
          </div>
          <span className="font-sans font-extrabold text-xl text-gray-900 dark:text-white tracking-tight">Pulse</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={scrollToTour}
            className="text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer"
          >
            Product Tour
          </button>
          
          {/* Neumorphic/Glassmorphic Theme Toggle Switch */}
          <NeumorphicButton
            id="toggle-theme-welcome-btn"
            darkMode={darkMode}
            onClick={onToggleDarkMode}
            rounded="full"
            className="w-10 h-10 rounded-full flex items-center justify-center !p-0 !px-0 !py-0 shadow-md flex-shrink-0"
            aria-label="Toggle visual preference theme"
          >
            {darkMode ? (
              <Moon className="w-5 h-5 text-indigo-400" />
            ) : (
              <Sun className="w-5 h-5 text-amber-500" />
            )}
          </NeumorphicButton>

          <NeumorphicButton
            darkMode={darkMode}
            variant="primary"
            onClick={scrollToLogin}
            rounded="sm"
            className="px-4 py-2 text-xs font-bold shadow-md"
          >
            Launch Pulse
          </NeumorphicButton>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 max-w-5xl mx-auto text-center relative overflow-hidden snap-start">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-64 h-64 rounded-full bg-teal-500/5 blur-3xl pointer-events-none" />
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold tracking-wide uppercase shadow-[inset_1px_1px_3px_rgba(0,0,0,0.05)] border border-indigo-500/5">
            <Zap className="w-3.5 h-3.5 animate-bounce" />
            AI-Powered Personal Copilot
          </div>
          
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-tight font-sans max-w-3xl mx-auto">
            Proactive productivity,<br />
            <span className="text-[#0d9488]">beautifully synchronized</span>.
          </h1>
          
          <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg max-w-xl mx-auto font-sans leading-relaxed">
            Pulse schedules, prioritizes, and automates your day hands-free, combining an autonomous background planning agent with real-time bidirectional calendar sync.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
            <NeumorphicButton
              darkMode={darkMode}
              variant="primary"
              onClick={scrollToLogin}
              className="px-8 py-4 text-sm font-bold flex items-center gap-2 w-full sm:w-auto"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-5 h-5" />
            </NeumorphicButton>

            <button
              onClick={scrollToTour}
              className="px-6 py-4 text-sm font-bold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Explore Features</span>
              <ArrowDown className="w-4 h-4 animate-bounce" />
            </button>
          </div>
        </motion.div>
      </section>

      {/* Scroll-Driven 3D Interactive Tour Section */}
      <section ref={containerRef} className="relative h-[680vh] bg-transparent z-10">
        
        {/* Scroll Snap Anchors (invisible, perfectly aligned at 85vh intervals to lock stops) */}
        <div className="absolute inset-x-0 top-0 bottom-0 pointer-events-none flex flex-col z-0">
          {TOUR_STOPS.map((stop) => (
            <div 
              key={`snap-${stop.id}`}
              className="w-full snap-start pointer-events-none"
              style={{ height: '85vh' }}
            />
          ))}
        </div>

        <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden py-6 lg:py-10 z-10">
          
          {/* Subtle Grid Background inside sticky panel */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />

          {/* Section Header */}
          <div className="text-center px-4 mb-3 lg:mb-6 max-w-xl relative z-40">
            <span className="text-[9px] font-mono font-black uppercase tracking-widest text-[#0d9488] bg-[#0d9488]/10 px-3 py-1 rounded-full border border-[#0d9488]/15 shadow-sm">
              INTERACTIVE 3D PRODUCT WALKTHROUGH
            </span>
            <h2 className="text-xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mt-3">
              Experience the Pulse Workspace
            </h2>
            <p className="text-gray-400 dark:text-gray-500 text-[11px] sm:text-xs mt-1.5 leading-relaxed">
              Scroll slowly to trigger high-fidelity physical 3D layer elevations, or click any indicator to jump to specific workspace modules.
            </p>
          </div>

          {/* Master Responsive Split Layout Wrapper */}
          <div className="w-full max-w-6xl mx-auto px-4 md:px-8 flex-grow flex items-center justify-center relative">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center justify-center relative w-full h-full max-h-[75vh] lg:max-h-none">
              
              {/* Left Column: Interactive Story & Narrative Panel (col-span-5) */}
              <div className="col-span-1 lg:col-span-5 flex flex-col justify-center order-2 lg:order-1 relative z-45">
                
                {/* 8-Stop Capsule Dot Track (Highly Interactive) */}
                <div className="flex gap-2 justify-center lg:justify-start mb-4">
                  {TOUR_STOPS.map((stop, index) => (
                    <button
                      key={stop.id}
                      onClick={() => goToStop(index)}
                      className={`h-2.5 rounded-full transition-all duration-300 relative cursor-pointer ${
                        activeStop === index
                          ? 'w-10 bg-[#0d9488] shadow-[0_0_10px_rgba(13,148,136,0.6)]'
                          : 'w-2.5 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600'
                      }`}
                      title={stop.title}
                    >
                      {activeStop === index && (
                        <span className="absolute inset-0 rounded-full bg-[#0d9488] animate-ping opacity-30" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Narrative Detail Board */}
                <NeumorphicContainer
                  darkMode={darkMode}
                  className="p-5 lg:p-7 border border-white/20 dark:border-white/5 flex flex-col gap-4 relative shadow-xl"
                  rounded="3xl"
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`narrative-${activeStop}`}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 15 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="space-y-3"
                    >
                      <div className="inline-flex items-center gap-1.5 text-[9px] font-mono font-black text-[#0d9488] tracking-widest uppercase bg-[#0d9488]/10 px-2 py-0.5 rounded-md border border-[#0d9488]/10">
                        <Sparkles className="w-3 h-3 animate-spin" />
                        {currentStop.badge}
                      </div>

                      <h3 className="text-lg lg:text-xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight">
                        {currentStop.title}
                      </h3>

                      <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm leading-relaxed">
                        {currentStop.detailedDesc}
                      </p>
                    </motion.div>
                  </AnimatePresence>

                  {/* Manual Step Controls */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-300/20 dark:border-gray-800/20 mt-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => activeStop > 0 && goToStop(activeStop - 1)}
                        disabled={activeStop === 0}
                        className={`p-2 rounded-xl transition-all border ${
                          activeStop === 0
                            ? 'opacity-40 cursor-not-allowed border-transparent'
                            : 'bg-white/40 dark:bg-gray-800/40 border-gray-300/10 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer'
                        }`}
                        title="Previous stop"
                      >
                        <ChevronLeft className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                      </button>

                      <button
                        onClick={() => activeStop < 7 ? goToStop(activeStop + 1) : scrollToLogin()}
                        className="p-2 rounded-xl bg-[#0d9488] hover:bg-[#0f766e] text-white transition-all shadow-md cursor-pointer flex items-center gap-1 px-3 text-xs font-bold"
                        title={activeStop === 7 ? "Launch application" : "Next stop"}
                      >
                        <span>{activeStop === 7 ? "Launch Pulse" : "Next Module"}</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <span className="text-[10px] font-mono font-extrabold text-gray-400 dark:text-gray-500">
                      Step {String(activeStop + 1).padStart(2, '0')} / 08
                    </span>
                  </div>
                </NeumorphicContainer>
              </div>

              {/* Right Column: Immersive 3D Parallax Device Deck (col-span-7) */}
              <div className="col-span-1 lg:col-span-7 flex items-center justify-center order-1 lg:order-2 h-[260px] sm:h-[350px] lg:h-[480px] relative">
                
                {/* Continuous Float Animation Wrapper */}
                <div 
                  className={`w-full max-w-[540px] aspect-[1.48/1] relative flex items-center justify-center ${prefersReducedMotion ? '' : 'animate-gentle-float'}`}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  {/* 3D Perspective Wrapper */}
                  <div 
                    onClick={() => setIsClicked(prev => !prev)}
                    onMouseMove={handleMouseMove}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => {
                      setIsHovered(false);
                      setMousePos({ x: 50, y: 50 });
                    }}
                    style={{
                      transform: isClicked 
                        ? `perspective(1000px) rotateX(0deg) rotateY(0deg) scale(${isSmallMobile ? 1.02 : 1.08})`
                        : `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
                      transformStyle: 'preserve-3d',
                      transition: prefersReducedMotion 
                        ? 'none' 
                        : isClicked 
                          ? 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.45s, border-color 0.45s' 
                          : 'transform 0.15s ease-out, box-shadow 0.15s, border-color 0.15s'
                    }}
                    className={`relative w-full h-full rounded-[24px] bg-[#e6ebf2] dark:bg-[#1a1d24] ${
                      darkMode 
                        ? 'shadow-[25px_30px_60px_#0e1014,-15px_-15px_30px_#262b34]' 
                        : 'shadow-[25px_30px_60px_#b5c1d4,-15px_-15px_30px_#ffffff]'
                    } border border-white/20 dark:border-white/5 p-3 flex flex-col gap-2.5 select-none overflow-visible animate-3d-entrance ${
                      isClicked ? 'cursor-zoom-out' : 'cursor-zoom-in'
                    }`}
                  >
                    
                    {/* Glassmorphic Ambient Light Gradient Reflection */}
                    <div 
                      style={{
                        background: `radial-gradient(circle ${isHovered ? '160px' : '100px'} at ${mousePos.x}% ${mousePos.y}%, rgba(255, 255, 255, ${isHovered ? (darkMode ? 0.12 : 0.22) : (darkMode ? 0.04 : 0.08)}), transparent)`,
                        mixBlendMode: 'overlay',
                        pointerEvents: 'none'
                      }}
                      className="absolute inset-0 rounded-[24px] z-[45] pointer-events-none transition-[background-image] duration-200"
                    />
                  
                  {/* macOS / Chrome Glass Frame Header bar */}
                  <div className="flex items-center justify-between pb-2 border-b border-gray-300/30 dark:border-gray-800/30 relative z-10">
                    <div className="flex items-center gap-1.5">
                      {/* Window Controls */}
                      <div className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 shadow-inner" />
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 shadow-inner" />
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 shadow-inner" />
                      </div>
                      {/* Slim Browser Location Bar */}
                      <div className="hidden sm:flex items-center gap-1.5 px-3 py-0.5 rounded-lg bg-gray-300/40 dark:bg-gray-900/40 text-[9px] font-mono text-gray-500 dark:text-gray-400 border border-white/10 ml-2">
                        <span className="text-teal-500">🔒</span>
                        <span>pulse.ai/workspace/dashboard</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Interactive Zoom Hint */}
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-500/10 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-[8px] font-mono font-bold uppercase transition-all duration-300">
                        <span>{isClicked ? 'Click to Tilt' : 'Click to Zoom'}</span>
                      </div>

                      {/* Status indicator */}
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#0d9488]/15 text-[#0d9488] text-[8px] font-mono font-black tracking-wider uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping" />
                        <span>LIVE AGENT</span>
                      </div>
                    </div>
                  </div>

                  {/* Device Workspace Inner Grid - Parallax Layer Container */}
                  <div className="grid grid-cols-12 gap-2.5 flex-grow overflow-hidden relative" style={{ transformStyle: 'preserve-3d' }}>
                    
                    {/* Left Panel: Tasks Backlog & Habits Tracker */}
                    <div className="col-span-6 flex flex-col gap-2.5 h-full" style={{ transformStyle: 'preserve-3d' }}>
                      
                      {/* BACKLOG CARD - Elevates to translateZ(45px) during prioritisation */}
                      <div 
                        style={getCardStyle('backlog')}
                        className={`p-3 rounded-xl flex-grow flex flex-col gap-1.5 ${
                          currentStop.highlightedCard === 'backlog'
                            ? 'bg-white dark:bg-[#20252e] border-2 border-[#0d9488]/50 shadow-[0_15px_30px_rgba(13,148,136,0.15)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.5)] z-30'
                            : 'bg-gray-200/25 dark:bg-gray-900/15 border border-transparent shadow-inner'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest font-mono">Tasks Backlog</span>
                          {currentStop.highlightedCard === 'backlog' && (
                            <span className="text-[7px] bg-[#0d9488] text-white px-1.5 py-0.5 rounded font-black uppercase animate-pulse">ACTIVE ANALYSIS</span>
                          )}
                        </div>

                        <div className="space-y-1.5 flex-grow flex flex-col justify-start">
                          
                          {/* Task 1: Highlighted in Priority State */}
                          <div className={`p-2 rounded-lg border transition-all duration-300 flex flex-col gap-0.5 ${
                            currentStop.highlightedCard === 'backlog'
                              ? 'bg-[#0d9488]/5 border-[#0d9488]/40 shadow-sm scale-[1.01]'
                              : 'bg-white/5 border-gray-300/10 dark:border-gray-800/10 opacity-70'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-extrabold text-gray-800 dark:text-gray-200 truncate max-w-[95px]">Database Core Refactor</span>
                              <span className={`text-[7px] font-extrabold px-1 py-0.2 rounded ${
                                currentStop.highlightedCard === 'backlog' ? 'bg-[#0d9488] text-white' : 'bg-gray-400/20 text-gray-400'
                              }`}>
                                A1 CRITICAL
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[7.5px] text-[#0d9488] font-bold">
                              <span>⏱️ 2.5 hrs</span>
                              {currentStop.highlightedCard === 'backlog' && (
                                <span className="animate-pulse">⚡ Auto-Prioritized</span>
                              )}
                            </div>
                          </div>

                          {/* Task 2 */}
                          <div className="p-2 rounded-lg bg-white/5 border border-gray-300/10 dark:border-gray-800/10 opacity-55 flex items-center justify-between text-[9px]">
                            <span className="text-gray-600 dark:text-gray-400 truncate max-w-[110px]">Review design mockups</span>
                            <span className="text-[7px] font-bold bg-indigo-500/20 text-indigo-400 px-1 py-0.2 rounded">B1 HIGH</span>
                          </div>

                          {/* Task 3 */}
                          <div className="p-2 rounded-lg bg-white/5 border border-gray-300/10 dark:border-gray-800/10 opacity-40 flex items-center justify-between text-[9px]">
                            <span className="text-gray-600 dark:text-gray-400 truncate max-w-[110px]">Clean email inbox</span>
                            <span className="text-[7px] font-bold bg-gray-500/20 text-gray-500 px-1 py-0.2 rounded">C3 ROUTINE</span>
                          </div>

                        </div>
                      </div>

                      {/* GOAL & HABITS CARD - Elevates to translateZ(45px) during Habits Stop */}
                      <div 
                        style={getCardStyle('goals')}
                        className={`p-3 rounded-xl flex flex-col gap-1.5 ${
                          currentStop.highlightedCard === 'goals'
                            ? 'bg-white dark:bg-[#20252e] border-2 border-[#0d9488]/50 shadow-[0_15px_30px_rgba(13,148,136,0.15)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.5)] z-30'
                            : 'bg-gray-200/25 dark:bg-gray-900/15 border border-transparent shadow-inner'
                        }`}
                      >
                        <span className="text-[8px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest font-mono">Milestones & Habits</span>
                        
                        <div className="space-y-2 flex-grow flex flex-col justify-center">
                          <div>
                            <div className="flex items-center justify-between text-[9px] mb-1">
                              <span className="font-extrabold text-gray-700 dark:text-gray-300 truncate max-w-[100px]">Hackathon Pitch Prep</span>
                              <motion.span 
                                key={`milestone-pct-${activeStop}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="font-black text-[#0d9488] font-mono text-[9.5px]"
                              >
                                {currentStop.highlightedCard === 'goals' ? '85%' : '60%'}
                              </motion.span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-300 dark:bg-gray-800 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: '60%' }}
                                animate={{ width: currentStop.highlightedCard === 'goals' ? '85%' : '60%' }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                className="h-full bg-[#0d9488] rounded-full" 
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[8px] text-gray-400 dark:text-gray-500">
                            <span className="flex items-center gap-1 font-medium">
                              <Flame className="w-3 h-3 text-orange-500" /> Coding Habit
                            </span>
                            <span className="font-black text-orange-500 flex items-center gap-0.5">
                              🔥 5-DAY STREAK
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Right Panel: Focus Schedule, Daily Insights & Voice Controls */}
                    <div className="col-span-6 flex flex-col gap-2.5 h-full" style={{ transformStyle: 'preserve-3d' }}>
                      
                      {/* FOCUS SCHEDULE CARD - Elevates to translateZ(45px) during scheduling */}
                      <div 
                        style={getCardStyle('calendar')}
                        className={`p-3 rounded-xl flex-grow flex flex-col gap-1.5 ${
                          currentStop.highlightedCard === 'calendar'
                            ? 'bg-white dark:bg-[#20252e] border-2 border-[#0d9488]/50 shadow-[0_15px_30px_rgba(13,148,136,0.15)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.5)] z-30'
                            : 'bg-gray-200/25 dark:bg-gray-900/15 border border-transparent shadow-inner'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest font-mono">Focus Timeline</span>
                          {currentStop.highlightedCard === 'calendar' && (
                            <span className="text-[7.5px] bg-[#0d9488] text-white font-black px-1.5 py-0.5 rounded">AUTO LOCK</span>
                          )}
                        </div>

                        <div className="space-y-1.5 flex-grow flex flex-col justify-center">
                          
                          {/* Calendar block 1 */}
                          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-[8.5px] text-indigo-500 relative pl-3.5">
                            <span className="absolute left-1 top-1 bottom-1 w-0.5 rounded-full bg-indigo-500" />
                            <div className="font-extrabold truncate">Team Alignment Sync</div>
                            <div className="text-[7px] font-mono opacity-80">09:00 AM - 09:30 AM</div>
                          </div>

                          {/* Calendar block 2 - Animated snapshot block */}
                          <div className={`p-1.5 rounded-lg border text-[8.5px] relative pl-3.5 transition-all duration-500 ${
                            currentStop.highlightedCard === 'calendar'
                              ? 'bg-teal-500/15 border-teal-500/35 text-[#0d9488] scale-[1.01]'
                              : 'bg-teal-500/5 border-teal-500/10 text-teal-600/60 opacity-60'
                          }`}>
                            <span className="absolute left-1 top-1 bottom-1 w-0.5 rounded-full bg-[#0d9488]" />
                            <div className="font-extrabold truncate flex items-center gap-1">
                              <span>Core DB Refactor</span>
                              {currentStop.highlightedCard === 'calendar' && <span className="text-[7px] bg-[#0d9488] text-white px-1 rounded">LOCKED</span>}
                            </div>
                            <div className="text-[7px] font-mono opacity-80">10:00 AM - 12:30 PM</div>
                          </div>

                          {/* Bidirectional Arrow flow for calendar sync stop */}
                          {activeStop === 2 && (
                            <div className="flex justify-center items-center gap-1.5 p-1 bg-[#0d9488]/10 rounded-md border border-[#0d9488]/20 text-[7px] text-[#0d9488] font-bold animate-pulse">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                              <span>2-Way GCal Sync Stream Active</span>
                            </div>
                          )}

                        </div>
                      </div>

                      {/* DAILY COGNITIVE INSIGHTS CARD - Elevates on insights stop */}
                      <div 
                        style={getCardStyle('insights')}
                        className={`p-3 rounded-xl flex flex-col gap-1.5 ${
                          currentStop.highlightedCard === 'insights'
                            ? 'bg-white dark:bg-[#20252e] border-2 border-[#0d9488]/50 shadow-[0_15px_30px_rgba(13,148,136,0.15)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.5)] z-30'
                            : 'bg-gray-200/25 dark:bg-gray-900/15 border border-transparent shadow-inner'
                        }`}
                      >
                        <span className="text-[8px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest font-mono">Cognitive Capacity Insights</span>
                        
                        {/* Interactive Sparkline graph for insights */}
                        <div className="flex-grow flex flex-col justify-between">
                          <div className="h-10 w-full relative">
                            {/* Area peak SVG */}
                            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 30" preserveAspectRatio="none">
                              <defs>
                                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#0d9488" stopOpacity="0.4" />
                                  <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              {/* Sparkline curve */}
                              <path 
                                d="M 0 25 Q 20 22 35 8 T 60 12 T 80 20 T 100 25 L 100 30 L 0 30 Z" 
                                fill="url(#chartGradient)" 
                              />
                              <path 
                                d="M 0 25 Q 20 22 35 8 T 60 12 T 80 20 T 100 25" 
                                fill="none" 
                                stroke="#0d9488" 
                                strokeWidth="1.5" 
                              />
                              {/* Glowing vertical cursor at optimal peak (10:00 AM / x: 35) */}
                              {currentStop.highlightedCard === 'insights' && (
                                <>
                                  <line x1="35" y1="0" x2="35" y2="30" stroke="#0d9488" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
                                  <circle cx="35" cy="8" r="2.5" fill="#0d9488" className="animate-ping" />
                                  <circle cx="35" cy="8" r="1.5" fill="#0d9488" />
                                </>
                              )}
                            </svg>
                          </div>
                          
                          <div className="flex items-center gap-1 text-[8px] text-gray-500 dark:text-gray-400 leading-tight">
                            <TrendingUp className="w-3.5 h-3.5 text-[#0d9488]" />
                            <span>
                              {currentStop.highlightedCard === 'insights'
                                ? "Cognitive peaks peak between 10:00 AM - 12:00 PM (+22% focus)."
                                : "Focus analytics streams active"
                              }
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>

                  </div>

                  {/* VOICE ASSIST TRANSCRIPT OVERLAY - Elevates to translateZ(60px) during Voice Step */}
                  <AnimatePresence>
                    {currentStop.highlightedCard === 'voice' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 15 }}
                        style={getOverlayStyle('voice', 65)}
                        className="absolute inset-x-4 bottom-4 bg-[#1a1d24]/95 text-white rounded-2xl p-3 flex items-center justify-between border border-[#0d9488]/40 shadow-2xl z-40"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {/* Siri-like voice wave ripple ring */}
                            <span className="absolute inset-0 rounded-full bg-[#0d9488] animate-ping opacity-60" />
                            <div className="w-8 h-8 rounded-full bg-[#0d9488] flex items-center justify-center text-white">
                              <Mic className="w-4 h-4" />
                            </div>
                          </div>
                          
                          <div className="text-left">
                            <span className="text-[8px] font-mono text-teal-400 tracking-wider font-extrabold uppercase">Voice Transcript</span>
                            <div className="text-[10px] font-medium tracking-tight mt-0.5 text-gray-200">
                              "Pulse, block 2.5 hours for database optimization..."
                              <span className="inline-block w-1.5 h-3 bg-teal-500 animate-pulse ml-0.5" />
                            </div>
                          </div>
                        </div>

                        <span className="text-[8px] font-mono bg-teal-500/20 text-teal-400 border border-teal-500/25 px-2 py-0.5 rounded font-black">
                          TRANSCRIBING
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* SMART CONTEXT ALERTS NOTIFICATION - Elevates to translateZ(60px) during Alert step */}
                  <AnimatePresence>
                    {currentStop.highlightedCard === 'alert' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.88, y: -15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.88, y: -15 }}
                        style={getOverlayStyle('alert', 70)}
                        className="absolute inset-x-4 top-14 bg-white/95 dark:bg-[#1f242d]/95 backdrop-blur-md rounded-2xl p-3 border border-amber-500/30 shadow-[0_20px_45px_rgba(245,158,11,0.15)] z-40"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-amber-500/15 rounded-xl text-amber-500">
                            <Bell className="w-4 h-4 animate-bounce" />
                          </div>
                          <div className="text-left flex-grow">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-gray-900 dark:text-white">Optimal Focus Window</span>
                              <span className="text-[7.5px] bg-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold px-1.5 py-0.2 rounded font-mono">HIGH PRIORITY</span>
                            </div>
                            <span className="text-[9.5px] text-gray-500 dark:text-gray-400 block mt-1 leading-normal">
                              Your cognitive energy peaks in 10 minutes. Lock in "Database Core Refactor" to complete it 30% faster?
                            </span>
                            <div className="flex gap-2 mt-2">
                              <button className="text-[8.5px] font-extrabold text-white bg-amber-500 hover:bg-amber-600 px-2.5 py-1 rounded-lg shadow-sm transition-all cursor-pointer">
                                Accept Focus Slot
                              </button>
                              <button className="text-[8.5px] font-extrabold text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg transition-all cursor-pointer">
                                Snooze
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* AUTONOMOUS FLOW LOG SCREEN - Elevates to translateZ(60px) during Agent step */}
                  <AnimatePresence>
                    {currentStop.highlightedCard === 'agent' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.88, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.88, y: 15 }}
                        style={getOverlayStyle('agent', 75)}
                        className="absolute inset-x-4 top-14 bg-[#0d9488]/95 text-white rounded-2xl p-3 flex flex-col gap-2.5 shadow-2xl z-40"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-white/20 rounded-lg">
                              <Bot className="w-4 h-4 text-white" />
                            </div>
                            <div className="text-left">
                              <span className="text-[10px] font-black block leading-none">Autonomous Agent Re-Prioritization</span>
                              <span className="text-[7.5px] opacity-75 font-mono block mt-1">Shield Conflict Resolver active</span>
                            </div>
                          </div>
                          <button className="text-[8.5px] font-black underline bg-white/20 hover:bg-white/30 transition-all px-2.5 py-1 rounded-md cursor-pointer">
                            Undo Shift
                          </button>
                        </div>
                        
                        <div className="p-2 rounded-xl bg-white/10 text-[8.5px] space-y-1 text-left border border-white/5">
                          <div className="flex justify-between font-bold">
                            <span className="text-red-200">⚠️ Conflict Detected:</span>
                            <span>Client sync overlapped DB focus block.</span>
                          </div>
                          <div className="flex justify-between font-black text-teal-200">
                            <span>🛡️ Auto Shield Engaged:</span>
                            <span>Shifted Client sync to 4:00 PM (DB slot fully preserved!)</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div> {/* 3D Perspective Wrapper */}

              </div> {/* Continuous Float Animation Wrapper */}

            </div> {/* col-span-1 lg:col-span-7 Column */}
          </div> {/* grid grid-cols-1 lg:grid-cols-12 */}
        </div> {/* w-full max-w-6xl */}
      </div> {/* sticky top-0 h-screen */}
      </section>

      {/* "How It Works" Loop Grid Section */}
      <section className="py-24 px-6 max-w-6xl mx-auto relative z-10 border-t border-gray-300/20 dark:border-gray-800/30 snap-start">
        <div className="text-center space-y-4 mb-16">
          <span className="text-xs font-bold text-indigo-500 uppercase font-mono tracking-wider">How Pulse Works</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            An elegant, autonomous loop
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Pulse operates quietly in the background, continuously analyzing, organizing, and shielding your productivity focus blocks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <NeumorphicContainer darkMode={darkMode} className="p-8 space-y-4 flex flex-col justify-between" rounded="3xl">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/10 flex items-center justify-center text-indigo-500 font-black text-xl">
                1
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Connect & Observe</h3>
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm leading-relaxed">
                Connect your Google Calendar and dump your standard task backlog. Pulse immediately parses dates, notes, and goals to build your base matrix.
              </p>
            </div>
          </NeumorphicContainer>

          <NeumorphicContainer darkMode={darkMode} className="p-8 space-y-4 flex flex-col justify-between" rounded="3xl">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/10 flex items-center justify-center text-[#0d9488] font-black text-xl">
                2
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Optimize & Refine</h3>
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm leading-relaxed">
                The background planner maps focus slots tailored to your peak focus energy periods and auto-locks time directly inside your calendar.
              </p>
            </div>
          </NeumorphicContainer>

          <NeumorphicContainer darkMode={darkMode} className="p-8 space-y-4 flex flex-col justify-between" rounded="3xl">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/10 flex items-center justify-center text-emerald-500 font-black text-xl">
                3
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Adapt Hands-free</h3>
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm leading-relaxed">
                Add, check, or postpone items simply by talking to your voice assistant. Our self-correcting engine automatically shifts schedules without breaking dependencies.
              </p>
            </div>
          </NeumorphicContainer>
        </div>
      </section>

      {/* Closing CTA & Authentication Panel Section */}
      <section id="auth-section" className="py-20 px-6 max-w-lg mx-auto relative z-10 snap-start">
        <div className="text-center mb-8 space-y-2">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Launch Pulse App</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
            Ready to experience a truly proactive planner? Access Pulse via secure Google sign-in or instant sandbox mode.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full"
        >
          <NeumorphicContainer darkMode={darkMode} className="p-8 sm:p-12 text-center border border-white/10" rounded="3xl">
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-2 text-left"
              >
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Core Google Sign in Button */}
            <div className="space-y-4">
              <NeumorphicButton
                id="google-signin-btn"
                darkMode={darkMode}
                variant="secondary"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-4 text-base flex justify-center items-center gap-3 border border-indigo-500/10"
              >
                <Chrome className="w-5 h-5 text-indigo-500" />
                {loading ? 'Connecting...' : 'Sign in with Google'}
              </NeumorphicButton>

              <div className="relative flex py-4 items-center">
                <div className="flex-grow border-t border-gray-300 dark:border-gray-800"></div>
                <span className="flex-shrink mx-4 text-xs text-gray-400 dark:text-gray-500 font-mono uppercase tracking-wider">
                  Or Email Credentials
                </span>
                <div className="flex-grow border-t border-gray-300 dark:border-gray-800"></div>
              </div>

              {/* Neumorphic Sign In vs Sign Up Tabs */}
              <div className="flex p-1 bg-gray-200/50 dark:bg-gray-900/40 rounded-2xl mb-6 shadow-inner">
                <button
                  type="button"
                  onClick={() => { setAuthMode('signin'); setError(null); }}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 cursor-pointer ${
                    authMode === 'signin'
                      ? darkMode
                        ? 'bg-[#1a1d24] text-white shadow-[2px_2px_5px_rgba(0,0,0,0.5),-2px_-2px_5px_rgba(255,255,255,0.05)] font-black'
                        : 'bg-white text-gray-900 shadow-[2px_2px_5px_rgba(0,0,0,0.05),-2px_-2px_5px_rgba(255,255,255,1)] font-black'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('signup'); setError(null); }}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 cursor-pointer ${
                    authMode === 'signup'
                      ? darkMode
                        ? 'bg-[#1a1d24] text-white shadow-[2px_2px_5px_rgba(0,0,0,0.5),-2px_-2px_5px_rgba(255,255,255,0.05)] font-black'
                        : 'bg-white text-gray-900 shadow-[2px_2px_5px_rgba(0,0,0,0.05),-2px_-2px_5px_rgba(255,255,255,1)] font-black'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {/* Dynamic Credentials Form */}
              <form onSubmit={handleCustomAuth} className="space-y-4 text-left">
                {authMode === 'signup' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 pl-1 font-mono uppercase tracking-wider">
                      Full Name
                    </label>
                    <NeumorphicInput
                      id="signup-name-input"
                      darkMode={darkMode}
                      type="text"
                      placeholder="e.g. Dhruv"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 pl-1 font-mono uppercase tracking-wider">
                    Email Address
                  </label>
                  <NeumorphicInput
                    id="auth-email-input"
                    darkMode={darkMode}
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 pl-1 font-mono uppercase tracking-wider">
                    Password
                  </label>
                  <NeumorphicInput
                    id="auth-password-input"
                    darkMode={darkMode}
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>

                {authMode === 'signup' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 pl-1 font-mono uppercase tracking-wider">
                      Confirm Password
                    </label>
                    <NeumorphicInput
                      id="auth-confirm-password-input"
                      darkMode={darkMode}
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>
                )}

                <NeumorphicButton
                  id="auth-submit-btn"
                  darkMode={darkMode}
                  variant="primary"
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 mt-2 flex justify-center items-center gap-2 font-bold"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </span>
                  ) : (
                    <>
                      <span>{authMode === 'signup' ? 'Create Account' : 'Sign In to Workspace'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </NeumorphicButton>
              </form>

              <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 mt-3 leading-relaxed">
                *Both real Firebase Authentication and secure local sandbox registry are supported. If Firebase Email Auth is disabled, your credentials will be hashed and secured locally.
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  id="quick-demo-btn"
                  onClick={useDefaultDemoUser}
                  disabled={loading}
                  className="text-xs text-[#0d9488] dark:text-[#0d9488] font-bold underline flex items-center justify-center gap-1.5 mx-auto hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <MonitorPlay className="w-3.5 h-3.5" />
                  Quick Launch with Test Account
                </button>
              </div>
            </div>
          </NeumorphicContainer>
        </motion.div>
      </section>

    </div>
  );
};
