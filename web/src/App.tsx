import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from '@/pages/Home';
import Game from '@/pages/Game';
import Auth from '@/pages/Auth';
import { I18nProvider } from '@/lib/i18n';

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game" element={<Game />} />
          <Route path="/auth" element={<Auth />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}
