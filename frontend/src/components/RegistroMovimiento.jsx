import { useState, useEffect } from 'react';
import { FiDollarSign, FiUser, FiFileText, FiPlus } from 'react-icons/fi';
import api from '../api/axiosClient';

const RegistroMovimiento = ({ onMovimientoCreado }) => {
  const [tipoMovimiento, setTipoMovimiento] = useState('cupon');
  const [clientes, setClientes] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [terminales, setTerminales] = useState([]);
  
  const [clienteSeleccionado, setClienteSeleccionado] = useState('');
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState('');
  const [terminalSeleccionada, setTerminalSeleccionada] = useState('');
  
  const [formData, setFormData] = useState({
    montoBruto: '',
    arancel: '',
    ajuste: '',
    comision: '',
    marca_tarjeta: '',
    numero_lote: '',
    numero_autorizacion: '',
    fecha_transaccion: new Date().toISOString().split('T')[0],
    motivo: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [neto, setNeto] = useState(0);

  // Cargar clientes
  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const res = await api.get('/clientes');
        if (res.data.data) {
          setClientes(res.data.data);
        }
      } catch (err) {
        // Error cargando clientes
      }
    };
    fetchClientes();
  }, []);

  // Cargar sucursales cuando cambia cliente
  useEffect(() => {
    if (clienteSeleccionado) {
      const cliente = clientes.find(c => c.id == clienteSeleccionado);
      if (cliente) {
        fetchSucursales(cliente.id);
      }
    }
  }, [clienteSeleccionado]);

  const fetchSucursales = async (clienteId) => {
    try {
      const res = await api.get(`/clientes/${clienteId}/sucursales`);
      setSucursales(res.data.data || []);
      setSucursalSeleccionada('');
      setTerminales([]);
    } catch (err) {
      // Error cargando sucursales
      setSucursales([]);
    }
  };

  // Cargar terminales cuando cambia sucursal
  useEffect(() => {
    if (sucursalSeleccionada) {
      fetchTerminales(sucursalSeleccionada);
    }
  }, [sucursalSeleccionada]);

  const fetchTerminales = async (sucursalId) => {
    try {
      const res = await api.get(`/clientes/sucursal/${sucursalId}/terminales`);
      setTerminales(res.data.data || []);
      setTerminalSeleccionada('');
    } catch (err) {
      // Error cargando terminales
      setTerminales([]);
    }
  };

  // Calcular neto en tiempo real
  useEffect(() => {
    if (tipoMovimiento === 'cupon') {
      const monto = Number(formData.montoBruto) || 0;
      const arancel = Number(formData.arancel) || 0;
      const ajuste = Number(formData.ajuste) || 0;
      const comision = Number(formData.comision) || 0;
      const calculado = monto - arancel - ajuste - comision;
      setNeto(calculado);
    } else if (tipoMovimiento === 'ajuste') {
      setNeto(Number(formData.montoBruto) || 0);
    }
  }, [formData.montoBruto, formData.arancel, formData.ajuste, formData.comision, tipoMovimiento]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (tipoMovimiento === 'cupon') {
        if (!clienteSeleccionado || !sucursalSeleccionada || !terminalSeleccionada) {
          throw new Error('Debe seleccionar cliente, sucursal y terminal');
        }

        const cliente = clientes.find(c => c.id == clienteSeleccionado);
        const response = await api.post('/transacciones/cupon', {
          cuit: cliente.cuit,
          sucursal_id: parseInt(sucursalSeleccionada),
          terminal_id: parseInt(terminalSeleccionada),
          montoBruto: parseFloat(formData.montoBruto),
          arancel: parseFloat(formData.arancel) || 0,
          ajuste: parseFloat(formData.ajuste) || 0,
          comision: parseFloat(formData.comision) || 0,
          marca_tarjeta: formData.marca_tarjeta,
          numero_lote: formData.numero_lote,
          numero_autorizacion: formData.numero_autorizacion,
          fecha_transaccion: formData.fecha_transaccion
        });
        
        //agrego icono para cupon
        setSuccess(`✅ Cupón creado ID ${response.data.id} - Neto: $${response.data.neto}`);
        resetForm();
        if (onMovimientoCreado) onMovimientoCreado();
        
      } else if (tipoMovimiento === 'ajuste') {
        if (!clienteSeleccionado) {
          throw new Error('Debe seleccionar un cliente');
        }

        const cliente = clientes.find(c => c.id == clienteSeleccionado);
        const response = await api.post('/transacciones/ajuste', {
          cuit: cliente.cuit,
          sucursal_id: sucursalSeleccionada ? parseInt(sucursalSeleccionada) : null,
          terminal_id: null,
          monto: -Math.abs(parseFloat(formData.montoBruto)),
          motivo: formData.motivo
        });
        //agrego icono para ajuste negativo
        setSuccess(`✅ Ajuste negativo creado ID ${response.data.id}`);
        resetForm();
        if (onMovimientoCreado) onMovimientoCreado();
      }
    } catch (err) {
      setError(`❌ ${err.response?.data?.msg || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      montoBruto: '',
      arancel: '',
      ajuste: '',
      comision: '',
      marca_tarjeta: '',
      numero_lote: '',
      numero_autorizacion: '',
      fecha_transaccion: new Date().toISOString().split('T')[0],
      motivo: ''
    });
    setClienteSeleccionado('');
    setSucursalSeleccionada('');
    setTerminalSeleccionada('');
  };

  return (
    <div className="registro-movimiento">
      <h2>Registrar {tipoMovimiento === 'cupon' ? 'Cupón' : 'Ajuste'}</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Tipo de Movimiento</label>
          <select value={tipoMovimiento} onChange={(e) => setTipoMovimiento(e.target.value)}>
            <option value="cupon">Cupón</option>
            <option value="ajuste">Ajuste Negativo</option>
          </select>
        </div>

        <div className="form-group">
          <label>Cliente *</label>
          <select 
            value={clienteSeleccionado} 
            onChange={(e) => setClienteSeleccionado(e.target.value)}
            required
          >
            <option value="">Seleccionar cliente...</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>
                {c.razon_social || c.nombre} - {c.cuit}
              </option>
            ))}
          </select>
        </div>

        {tipoMovimiento === 'cupon' && (
          <>
            <div className="form-group">
              <label>Sucursal *</label>
              <select 
                value={sucursalSeleccionada} 
                onChange={(e) => setSucursalSeleccionada(e.target.value)}
                required
                disabled={!clienteSeleccionado}
              >
                <option value="">Seleccionar sucursal...</option>
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Terminal *</label>
              <select 
                value={terminalSeleccionada} 
                onChange={(e) => setTerminalSeleccionada(e.target.value)}
                required
                disabled={!sucursalSeleccionada}
              >
                <option value="">Seleccionar terminal...</option>
                {terminales.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} ({t.tipo})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Monto Bruto *</label>
              <input 
                type="number" 
                name="montoBruto"
                value={formData.montoBruto}
                onChange={handleInputChange}
                step="0.01"
                required
              />
            </div>

            <div className="form-group">
              <label>Arancel Tarjeta</label>
              <input 
                type="number" 
                name="arancel"
                value={formData.arancel}
                onChange={handleInputChange}
                step="0.01"
              />
            </div>

            <div className="form-group">
              <label>Ajuste Conciliación</label>
              <input 
                type="number" 
                name="ajuste"
                value={formData.ajuste}
                onChange={handleInputChange}
                step="0.01"
              />
            </div>

            <div className="form-group">
              <label>Comisión Administrativa</label>
              <input 
                type="number" 
                name="comision"
                value={formData.comision}
                onChange={handleInputChange}
                step="0.01"
              />
            </div>

            <div className="form-group neto-display">
              <label>Neto Liquidado</label>
              <div className="neto-value">${neto.toFixed(2)}</div>
            </div>

            <div className="form-group">
              <label>Marca Tarjeta</label>
              <input 
                type="text" 
                name="marca_tarjeta"
                value={formData.marca_tarjeta}
                onChange={handleInputChange}
                placeholder="Visa, Mastercard, etc."
              />
            </div>

            <div className="form-group">
              <label>Número Lote</label>
              <input 
                type="text" 
                name="numero_lote"
                value={formData.numero_lote}
                onChange={handleInputChange}
                placeholder="LOTE001"
              />
            </div>

            <div className="form-group">
              <label>Número Autorización</label>
              <input 
                type="text" 
                name="numero_autorizacion"
                value={formData.numero_autorizacion}
                onChange={handleInputChange}
                placeholder="AUTH123456"
              />
            </div>

            <div className="form-group">
              <label>Fecha Transacción</label>
              <input 
                type="date" 
                name="fecha_transaccion"
                value={formData.fecha_transaccion}
                onChange={handleInputChange}
              />
            </div>
          </>
        )}

        {tipoMovimiento === 'ajuste' && (
          <>
            <div className="form-group">
              <label>Monto a Descontar *</label>
              <input 
                type="number" 
                name="montoBruto"
                value={formData.montoBruto}
                onChange={handleInputChange}
                step="0.01"
                required
              />
            </div>

            <div className="form-group">
              <label>Motivo *</label>
              <textarea
                name="motivo"
                value={formData.motivo}
                onChange={handleInputChange}
                placeholder="Ej: Mantenimiento de terminal, penalización, etc."
                required
              />
            </div>
          </>
        )}

        <div className="form-actions">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Registrando...' : 'Registrar'}
          </button>
          <button type="button" onClick={resetForm} className="btn-secondary">
            Limpiar
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegistroMovimiento;
