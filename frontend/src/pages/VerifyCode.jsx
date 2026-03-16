import { useState } from 'react';
import "../styles/PasswordReset.css";
import api from '../api/axiosClient';
import { useSearchParams } from 'react-router-dom';

export default function VerifyCode() {
  const [token, setToken] = useState('');
  const [params] = useSearchParams();
  const emailFromParams = params.get('email') || '';
  const [email, setEmail] = useState(emailFromParams);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const verify = async (e)=>{
    e.preventDefault();
    setError('');
    setInfo('');
    if (!email || !token.trim()) {
      setError('Faltan datos: email o código');
      return;
    }
    try {
      await api.post('/auth/verify', { email, token: token.trim() });
      window.location.replace(`/terminos?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err.response?.data?.msg || 'Error');
    }
  }

  const [resending, setResending] = useState(false);
  const resendCode = async ()=>{
    setError('');
    setInfo('');
    setToken(''); // Limpia el token anterior
    setResending(true);
    try {
      if (!email) {
        setError('No se puede reenviar: no hay correo en la URL.');
        return;
      }
      await api.post('/auth/resend-code', { email });
      setInfo('Código reenviado al correo.');
    } catch (err) {
      setError(err.response?.data?.msg || 'No se pudo reenviar el código');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="password-reset-container">
      <form className="password-reset-form" onSubmit={verify}>
        <div className="password-reset-title">Verificar Cuenta</div>
        {!emailFromParams && (
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
            />
          </div>
        )}
        {email && <div className="muted" style={{textAlign:'center', marginBottom:8}}>Codigo enviado al correo: {email}</div>}
        {error && <div className="error">{error}</div>}
        {info && <div className="info">{info}</div>}
        <input 
          placeholder="Código de 4 dígitos" 
          value={token} 
          onChange={(e)=>setToken(e.target.value)}
          maxLength={4}
          style={{textAlign:'center', letterSpacing:'0.3em', fontSize:'1.2em'}}
        />
        <div style={{display:'flex', flexDirection:'column', gap: '10px'}}>
          <button type="submit">Confirmar</button>
          <button 
            type="button"
            style={{background:'#e2e8f0', color:'#3182ce', borderRadius:6, padding:'8px 0', fontWeight:500, border:'none'}} 
            onClick={resendCode}
            disabled={resending}
          >
            {resending ? 'Enviando...' : 'Reenviar código'}
          </button>
        </div>
      </form>
    </div>
  );
}
