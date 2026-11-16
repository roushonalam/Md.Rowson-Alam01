import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Footer } from './components/Footer.tsx';
import { Navbar } from './components/Navbar.tsx';
import { ToastContainer } from './components/ToastContainer.tsx';
import { SettingsProvider } from './hooks/useSettings.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { SmartQuizPage } from './pages/SmartQuizPage.tsx';
import { StudyHubPage } from './pages/StudyHubPage.tsx';
import { TutorChatPage } from './pages/TutorChatPage.tsx';

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18 }}
        className="flex-1"
      >
        <Routes location={location}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/study-hub" element={<StudyHubPage />} />
          <Route path="/quiz" element={<SmartQuizPage />} />
          <Route path="/tutor" element={<TutorChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.main>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <div className="flex min-h-screen flex-col bg-canvas text-text-primary">
          <Navbar />
          <AnimatedRoutes />
          <Footer />
          <ToastContainer />
        </div>
      </SettingsProvider>
    </BrowserRouter>
  );
}
