import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosClient';

export default function Deposit() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [token, setToken] = useState('');
  const [bankDetails, setBankDetails] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [receiptId, setReceiptId] = useState(null);

  const canContinue = useMemo(() => {
    if (step === 1) return true;
    if (step === 2) return String(token || '').trim().length > 0;
    if (step === 3) return !!selectedFile;
    if (step === 4) return !!receiptId;
    return false;
  }, [step, token, selectedFile, receiptId]);

  useEffect(() => {
    const t = sessionStorage.getItem('token');
    if (!t) navigate('/login');
  }, [navigate]);

  const requestAccessToken = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/deposit/access/request');
      if (!res?.data?.ok) throw new Error(res?.data?.msg || 'No se pudo solicitar el token');
      setSuccess(res?.data?.msg || 'Token enviado por email.');
      setStep(2);
    } catch (e) {
      setError(e?.response?.data?.msg || e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const validateTokenAndGetBank = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const tokenClean = String(token || '').trim();
      if (!tokenClean) throw new Error('Ingrese el token');

      const res = await api.post('/deposit/access/validate', { token: tokenClean });
      if (!res?.data?.ok) throw new Error(res?.data?.msg || 'Token inválido');
      setBankDetails(res?.data?.data || null);
      setSuccess('Token validado.');
      setStep(3);
    } catch (e) {
      setError(e?.response?.data?.msg || e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  };

  const uploadReceipt = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!selectedFile) throw new Error('Seleccione un archivo');

      const dataBase64 = await fileToBase64(selectedFile);
      const res = await api.post('/deposit/receipt/upload', {
        filename: selectedFile.name,
        mime: selectedFile.type,
        data_base64: dataBase64,
      });

      if (!res?.data?.ok) throw new Error(res?.data?.msg || 'No se pudo subir el comprobante');

      const rid = res?.data?.data?.receipt_id;
      if (!rid) throw new Error('No se recibió receipt_id');

      setReceiptId(rid);
      setSuccess('Comprobante subido.');
      setStep(4);
    } catch (e) {
      setError(e?.response?.data?.msg || e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const confirmDeposit = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!receiptId) throw new Error('Falta receipt_id');

      const res = await api.post('/deposit/confirm', { receipt_id: receiptId });
      if (!res?.data?.ok) throw new Error(res?.data?.msg || 'No se pudo confirmar');

      setSuccess(res?.data?.msg || 'Ingreso registrado.');
      setStep(5);
    } catch (e) {
      setError(e?.response?.data?.msg || e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Ingresar Dinero</h1>
        <button className="btn-secondary" type="button" onClick={() => navigate('/wallet')}>Volver</button>
      </div>

      <div style={{ marginTop: 10, color: '#6b7280', fontSize: 13 }}>
        Paso {step <= 4 ? step : 4} de 4
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginTop: 12 }}>{success}</div>}

      <div style={{ marginTop: 18, background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 4px 18px rgba(0,0,0,0.06)' }}>
        {step === 1 && (
          <>
            <h3 style={{ marginTop: 0 }}>Solicitar token</h3>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
              Te vamos a enviar un token por email para poder ver los datos bancarios.
            </div>
            <button className="btn-primary" disabled={loading} onClick={requestAccessToken}>
              {loading ? 'Enviando...' : 'Enviar token a mi email'}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h3 style={{ marginTop: 0 }}>Validar token</h3>
            <div className="form-group">
              <label>Token *</label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Pegá el token recibido por email"
              />
            </div>
            <button className="btn-primary" disabled={loading || !canContinue} onClick={validateTokenAndGetBank}>
              {loading ? 'Validando...' : 'Validar token'}
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <h3 style={{ marginTop: 0 }}>Transferencia bancaria</h3>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
              Realizá la transferencia con los siguientes datos y luego subí el comprobante.
            </div>

            <div style={{ background: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, fontSize: 14 }}>
                <div><b>Banco:</b> {bankDetails?.banco || '-'}</div>
                <div><b>Titular:</b> {bankDetails?.titular || '-'}</div>
                <div><b>CUIT:</b> {bankDetails?.cuit || '-'}</div>
                <div><b>CBU:</b> {bankDetails?.cbu || '-'}</div>
                <div><b>Alias:</b> {bankDetails?.alias || '-'}</div>
              </div>
            </div>

            <div className="form-group">
              <label>Comprobante (JPG/PNG/PDF) *</label>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,application/pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>

            <button className="btn-primary" disabled={loading || !canContinue} onClick={uploadReceipt}>
              {loading ? 'Subiendo...' : 'Subir comprobante'}
            </button>
          </>
        )}

        {step === 4 && (
          <>
            <h3 style={{ marginTop: 0 }}>Confirmar ingreso</h3>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
              Al confirmar, el ingreso quedará <b>pendiente de revisión</b> por un administrador.
            </div>
            <button className="btn-primary" disabled={loading || !canContinue} onClick={confirmDeposit}>
              {loading ? 'Confirmando...' : 'Confirmar ingreso'}
            </button>
          </>
        )}

        {step === 5 && (
          <>
            <h3 style={{ marginTop: 0 }}>Listo</h3>
            <div style={{ fontSize: 14, color: '#111827', marginBottom: 12 }}>
              Tu ingreso fue registrado y queda pendiente de revisión.
            </div>
            <button className="btn-primary" type="button" onClick={() => navigate('/wallet')}>
              Volver al Wallet
            </button>
          </>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: '#6b7280' }}>
        Formatos permitidos: JPG, PNG, PDF. Tamaño sugerido: hasta 5MB.
      </div>
    </div>
  );
}
