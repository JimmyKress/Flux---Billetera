import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosClient';
import './Home/Home.css';
import fluxAdminLogo from '/Logotipo.jpeg';
 // Asegúrate de que la ruta sea correcta

export default function ResendVerify() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Ingrese su correo electrónico');
      return;
    }

    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await api.post('/auth/resend-verify', { email });
      setMessage(response.data.msg || 'Código de verificación reenviado. Revise su correo.');
      setTimeout(() => navigate('/verify'), 2000);
    } catch (err) {
      setError(err?.response?.data?.msg || err?.response?.data?.error || 'Error al reenviar código');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="logo">
          <img 
            src={fluxAdminLogo} 
            alt="FluxAdmin Logo" 
            style={{ height: '50px', marginBottom: '1rem' }} 
          />
        </div>
        <nav className="auth-buttons">
          <button className="btn btn-outline" onClick={() => navigate('/')}>Volver</button>
        </nav>
      </header>

      <main className="hero" style={{ maxWidth: 500, margin: '0 auto' }}>
        <h2>Reenviar código de verificación</h2>
        <p>Ingrese su correo electrónico para recibir un nuevo código de verificación.</p>

        <form onSubmit={handleSubmit} className="resend-verify-form" style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 32 }}>
          <div className="form-group">
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              required
            />
          </div>

          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Enviando...' : 'Reenviar código'}
          </button>
        </form>
      </main>
    </div>
  );
}
