import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import api from '../../api/axiosClient';
import './Terminos.css';

const Terminos = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const email = params.get('email') || '';
  const [terminosHtml, setTerminosHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [acepta, setAcepta] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [waitingApproval, setWaitingApproval] = useState(false);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const loadTerminos = async () => {
      try {
        const res = await fetch('/terminos.html');
        const html = await res.text();
        setTerminosHtml(html);
      } catch (e) {
        setTerminosHtml('<p>No se pudieron cargar los términos.</p>');
      } finally {
        setLoading(false);
      }
    };
    loadTerminos();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.scale(ratio, ratio);
  }, []);

  useEffect(() => {
    if (!waitingApproval || !email) return;

    let active = true;
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get('/auth/estado-terminos', { params: { email } });
        if (!active) return;
        if (data?.estado === 'APROBADO') {
          navigate('/login?approved=1');
        } else if (data?.estado === 'RECHAZADO') {
          setWaitingApproval(false);
          setError('Tu registro fue rechazado. Contactá al área administrativa.');
        }
      } catch (err) {
        if (!active) return;
        setWaitingApproval(false);
        setError(err.response?.data?.msg || 'Error al consultar el estado del registro.');
      }
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [waitingApproval, email, navigate]);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const source = event.touches ? event.touches[0] : event;
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    return {
      x: (source.clientX - rect.left) / scaleX,
      y: (source.clientY - rect.top) / scaleY,
    };
  };

  const startDraw = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getPoint(e.nativeEvent || e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawingRef.current = true;
  };

  const draw = (e) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getPoint(e.nativeEvent || e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    setHasSignature(true);
  };

  const endDraw = () => {
    drawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const submit = async () => {
    setError('');
    setSuccess('');
    if (waitingApproval) return;
    if (!email) {
      setError('Falta el email. Vuelve a verificar tu cuenta.');
      return;
    }
    if (!acepta) {
      setError('Debes aceptar los términos y condiciones.');
      return;
    }
    if (!hasSignature) {
      setError('La firma es obligatoria.');
      return;
    }

    const canvas = canvasRef.current;
    const firma_base64 = canvas.toDataURL('image/png');

    try {
      await api.post('/auth/aceptar-terminos', { email, firma_base64 });
      setSuccess('Ya falta poco. Aguarde un momento mientras el área administrativa valida el registro.');
      setWaitingApproval(true);
    } catch (err) {
      setError(err.response?.data?.msg || 'Error al guardar los términos.');
    }
  };

  return (
    <div className="terminos-page">
      <div className="terminos-card">
        <h1>Términos y condiciones</h1>
        <p className="terminos-subtitle">Leé y aceptá para continuar con el registro.</p>

        <div className="terminos-content">
          {loading ? (
            <p>Cargando términos...</p>
          ) : (
            <div
              className="terminos-html"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(terminosHtml) }}
            />
          )}
        </div>

        <label className="terminos-checkbox">
          <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
          Acepto los términos y condiciones.
        </label>

        <div className="firma-section">
          <div className="firma-header">
            <h3>Firma digital (obligatoria)</h3>
            <button type="button" className="btn-clear" onClick={clearSignature}>Limpiar</button>
          </div>
          <canvas
            ref={canvasRef}
            className="firma-canvas"
            width={640}
            height={220}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={(e) => {
              e.preventDefault();
              startDraw(e);
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              draw(e);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              endDraw();
            }}
          />
          <p className="firma-hint">Firmá dentro del recuadro.</p>
        </div>

        {error && <div className="terminos-error">{error}</div>}
        {success && <div className="terminos-success">{success}</div>}

        <button type="button" className="btn-primary" onClick={submit} disabled={waitingApproval}>
          {waitingApproval ? 'Validando registro...' : 'Enviar a validación'}
        </button>
      </div>
    </div>
  );
};

export default Terminos;
