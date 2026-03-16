import { useState, useEffect } from 'react';
import { FaArrowLeft, FaMoneyBillWave, FaCheckCircle, FaExclamationTriangle, FaUser, FaCreditCard, FaShieldAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosClient';
import '../styles/SolicitarRetiro.css';

export default function SolicitarRetiro() {
  const navigate = useNavigate();
  const [paso, setPaso] = useState(1); // 1: Saldo, 2: Datos destino, 3: Token 1, 4: Resumen, 5: Token 2, 6: Estado final
  const [monto, setMonto] = useState('');
  const [cbu, setCbu] = useState('');
  const [cuit, setCuit] = useState('');
  const [saldoDisponible, setSaldoDisponible] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [retiroId, setRetiroId] = useState(null);
  const [token1, setToken1] = useState('');
  const [token2, setToken2] = useState('');
  const [datosResumen, setDatosResumen] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      // Obtener datos del usuario autenticado
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        navigate('/login');
        return;
      }

      const user = JSON.parse(userStr);
      setCuit(user.cuit);

      // Obtener saldo actual
      const { data } = await api.get(`/retiros/saldo/${user.cuit}`);
      setSaldoDisponible(data.saldo || 0);

      // Obtener CBU del usuario
      setCbu(user.cbu || '');
    } catch (err) {
      console.error('Error:', err);
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const validarPaso1 = () => {
    if (!monto || isNaN(monto) || parseFloat(monto) <= 0) {
      setError('Ingrese un monto válido');
      return false;
    }
    if (parseFloat(monto) > saldoDisponible) {
      setError(`Saldo insuficiente. Disponible: $${saldoDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
      return false;
    }
    return true;
  };

  const validarPaso2 = () => {
    if (!cuit || cuit.length < 8) {
      setError('CUIT no válido');
      return false;
    }
    if (!cbu || cbu.length < 22) {
      setError('CBU/CVU no válido (debe tener 22 dígitos)');
      return false;
    }
    return true;
  };

  const solicitarRetiro = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.post('/retiros/solicitar', {
        cuit: cuit,
        monto: parseFloat(monto),
        cbu: cbu
      });

      if (response.data.ok) {
        setRetiroId(response.data.id);
        setPaso(3); // Ir a paso 3: Token 1
        setSuccess('Te enviamos un código a tu correo para autorizar el retiro.');
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  const confirmarToken1 = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.post('/retiros/confirmar-token', {
        id: retiroId,
        token: token1
      });

      if (response.data.ok) {
        setPaso(4); // Ir a paso 4: Resumen
        setDatosResumen({
          cuit: cuit,
          cbu: cbu,
          monto: parseFloat(monto),
          titular: 'Usuario' // Podríamos obtener el nombre del cliente
        });
        setSuccess('Primer factor validado. Revisa el resumen y confirma.');
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Token inválido');
    } finally {
      setLoading(false);
    }
  };

  const confirmarResumen = async () => {
    try {
      setLoading(true);
      setError('');
      setPaso(5); // Ir a paso 5: Token 2
      setSuccess('Te enviamos un segundo código para confirmar el retiro.');
    } catch (err) {
      setError(err.response?.data?.msg || 'Error al procesar');
    } finally {
      setLoading(false);
    }
  };

  const confirmarToken2 = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.post('/retiros/confirmar-token2', {
        id: retiroId,
        token: token2
      });

      if (response.data.ok) {
        setPaso(6); // Ir a paso 6: Estado final
        setSuccess('Pago procesado. La acreditación puede demorar hasta 72 horas hábiles.');
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Token inválido');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (paso === 1 && !validarPaso1()) return;
    if (paso === 2 && !validarPaso2()) return;

    if (paso === 2) {
      await solicitarRetiro();
    } else if (paso === 3) {
      await confirmarToken1();
    } else if (paso === 4) {
      await confirmarResumen();
    } else if (paso === 5) {
      await confirmarToken2();
    }
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(valor);
  };

  const renderPaso1 = () => (
    <div className="paso-retiro">
      <div className="paso-header">
        <FaMoneyBillWave className="paso-icono" />
        <h3>Paso 1: Visualización de saldo</h3>
      </div>
      <div className="resumen-saldo">
        <div className="tarjeta-saldo">
          <div className="etiqueta">Disponible total</div>
          <div className="monto">{formatearMoneda(saldoDisponible)}</div>
          <div className="nota">No puede retirar más del saldo disponible</div>
        </div>
      </div>
      <div className="campo-formulario">
        <label htmlFor="monto">Monto a retirar</label>
        <div className="input-con-prefijo">
          <span className="prefijo">$</span>
          <input
            type="number"
            id="monto"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0,00"
            step="0.01"
            min="0"
            disabled={loading}
          />
        </div>
        <div className="monto-minimo">Disponible: {formatearMoneda(saldoDisponible)}</div>
      </div>
    </div>
  );

  const renderPaso2 = () => (
    <div className="paso-retiro">
      <div className="paso-header">
        <FaCreditCard className="paso-icono" />
        <h3>Paso 2: Datos de destino</h3>
      </div>
      <div className="campos-destino">
        <div className="campo-formulario">
          <label htmlFor="cuit">CUIT</label>
          <input
            type="text"
            id="cuit"
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
            placeholder="Ej: 20-12345678-9"
            disabled={loading}
          />
        </div>
        <div className="campo-formulario">
          <label htmlFor="cbu">CBU o CVU</label>
          <input
            type="text"
            id="cbu"
            value={cbu}
            onChange={(e) => setCbu(e.target.value)}
            placeholder="Ej: 0140001904023139001903"
            maxLength="22"
            disabled={loading}
          />
          <div className="nota-campo">Debe tener 22 dígitos numéricos</div>
        </div>
        <div className="campo-formulario">
          <label htmlFor="monto2">Monto</label>
          <div className="input-con-prefijo">
            <span className="prefijo">$</span>
            <input
              type="number"
              id="monto2"
              value={monto}
              readOnly
              disabled
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderPaso3 = () => (
    <div className="paso-retiro">
      <div className="paso-header">
        <FaShieldAlt className="paso-icono" />
        <h3>Paso 3: Seguridad (primera validación)</h3>
      </div>
      <div className="seguridad-descripcion">
        <p>Te enviamos un código de seguridad a tu correo electrónico.</p>
        <p>Ingresa el código de 6 dígitos para continuar.</p>
      </div>
      <div className="campo-formulario">
        <label htmlFor="token1">Código de seguridad</label>
        <input
          type="text"
          id="token1"
          value={token1}
          onChange={(e) => setToken1(e.target.value)}
          placeholder="000000"
          maxLength={6}
          disabled={loading}
          className="token-input"
        />
      </div>
    </div>
  );

  const renderPaso4 = () => (
    <div className="paso-retiro">
      <div className="paso-header">
        <FaUser className="paso-icono" />
        <h3>Paso 4: Resumen final</h3>
      </div>
      <div className="resumen-final">
        <div className="resumen-item">
          <span className="resumen-label">Cuenta destino:</span>
          <span className="resumen-value">{datosResumen?.cbu}</span>
        </div>
        <div className="resumen-item">
          <span className="resumen-label">Titular:</span>
          <span className="resumen-value">{datosResumen?.titular}</span>
        </div>
        <div className="resumen-item">
          <span className="resumen-label">CUIT:</span>
          <span className="resumen-value">{datosResumen?.cuit}</span>
        </div>
        <div className="resumen-item total">
          <span className="resumen-label">Monto a retirar:</span>
          <span className="resumen-value">{formatearMoneda(datosResumen?.monto)}</span>
        </div>
      </div>
      <div className="confirmacion-aviso">
        <p>Por favor, confirma que todos los datos son correctos.</p>
        <p>Al continuar, generaremos un segundo código de seguridad.</p>
      </div>
    </div>
  );

  const renderPaso5 = () => (
    <div className="paso-retiro">
      <div className="paso-header">
        <FaShieldAlt className="paso-icono" />
        <h3>Paso 5: Seguridad (segunda validación)</h3>
      </div>
      <div className="seguridad-descripcion">
        <p>Te enviamos un segundo código de seguridad a tu correo.</p>
        <p>Ingresa el código final para confirmar la operación.</p>
      </div>
      <div className="campo-formulario">
        <label htmlFor="token2">Código final</label>
        <input
          type="text"
          id="token2"
          value={token2}
          onChange={(e) => setToken2(e.target.value)}
          placeholder="000000"
          maxLength={6}
          disabled={loading}
          className="token-input"
        />
      </div>
    </div>
  );

  const renderPaso6 = () => (
    <div className="paso-retiro">
      <div className="paso-header">
        <FaCheckCircle className="paso-icono exito" />
        <h3>Paso 6: Estado de operación</h3>
      </div>
      <div className="estado-final">
        <div className="estado-badge">VALIDACIÓN</div>
        <div className="estado-mensaje">
          <p><strong>Pago procesado:</strong> la acreditación es inmediata.</p>
          <p>En algunos casos puede demorar hasta 72 hs hábiles bancarias según banco o billetera receptora.</p>
        </div>
        <div className="resumen-estado">
          <div className="resumen-item">
            <span className="resumen-label">Monto retirado:</span>
            <span className="resumen-value">{formatearMoneda(monto)}</span>
          </div>
          <div className="resumen-item">
            <span className="resumen-label">Cuenta destino:</span>
            <span className="resumen-value">{cbu}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPasoActual = () => {
    switch (paso) {
      case 1: return renderPaso1();
      case 2: return renderPaso2();
      case 3: return renderPaso3();
      case 4: return renderPaso4();
      case 5: return renderPaso5();
      case 6: return renderPaso6();
      default: return renderPaso1();
    }
  };

  if (loading && saldoDisponible === 0) {
    return (
      <div className="cargando">
        <div className="spinner"></div>
        <p>Cargando información de su cuenta...</p>
      </div>
    );
  }

  return (
    <div className="contenedor-solicitud-retiro">
      <div className="encabezado">
        <button className="btn-volver" onClick={() => navigate('/wallet')}>
          <FaArrowLeft /> Volver al Wallet
        </button>
        <h1>Solicitar Retiro</h1>
        <div className="progreso-indicador">
          <div className={`paso-indicador ${paso >= 1 ? 'activo' : ''}`}>1</div>
          <div className={`paso-indicador ${paso >= 2 ? 'activo' : ''}`}>2</div>
          <div className={`paso-indicador ${paso >= 3 ? 'activo' : ''}`}>3</div>
          <div className={`paso-indicador ${paso >= 4 ? 'activo' : ''}`}>4</div>
          <div className={`paso-indicador ${paso >= 5 ? 'activo' : ''}`}>5</div>
          <div className={`paso-indicador ${paso >= 6 ? 'activo' : ''}`}>6</div>
        </div>
      </div>

      {error && (
        <div className="alerta error">
          <FaExclamationTriangle /> {error}
        </div>
      )}

      {success && (
        <div className="alerta exito">
          <FaCheckCircle /> {success}
        </div>
      )}

      {loading && paso !== 6 && (
        <div className="cargando">
          <div className="spinner"></div>
          <p>Procesando...</p>
        </div>
      )}

      {!loading && (
        <form onSubmit={handleSubmit} className="formulario-retiro">
          {renderPasoActual()}
          
          {paso < 6 && (
            <div className="acciones-formulario">
              {paso > 1 && paso < 6 && (
                <button 
                  type="button" 
                  className="btn-anterior"
                  onClick={() => setPaso(paso - 1)}
                  disabled={loading}
                >
                  Anterior
                </button>
              )}
              <button 
                type="submit" 
                className="btn-solicitar"
                disabled={loading}
              >
                {loading ? 'Procesando...' : paso === 4 ? 'Confirmar y generar código final' : paso === 5 ? 'Confirmar retiro' : 'Continuar'}
              </button>
            </div>
          )}
          
          {paso === 6 && (
            <div className="acciones-formulario">
              <button 
                type="button" 
                className="btn-final"
                onClick={() => navigate('/wallet')}
              >
                Volver al Wallet
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
