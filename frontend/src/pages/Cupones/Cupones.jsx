import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiRefreshCw, FiX, FiCheck, FiCopy } from 'react-icons/fi';
import api from '../../api/axiosClient';
import './Cupones.css';

export default function Cupones() {
  const [cupones, setCupones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    codigo: '',
    descuento: '',
    fechaVencimiento: '',
    maxUsos: 1,
    activo: true
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCupones();
  }, []);

  const fetchCupones = async () => {
    try {
      setLoading(true);
      const response = await api.get('/cupones');
      setCupones(response.data);
    } catch (error) {
      console.error('Error al obtener los cupones:', error);
      setError('Error al cargar los cupones');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await api.post('/cupones', formData);
      setSuccess('Cupón creado exitosamente');
      setFormData({
        codigo: '',
        descuento: '',
        fechaVencimiento: '',
        maxUsos: 1,
        activo: true
      });
      setShowForm(false);
      fetchCupones();
    } catch (error) {
      console.error('Error al crear el cupón:', error);
      setError(error.response?.data?.message || 'Error al crear el cupón');
    }
  };

  const toggleEstado = async (id, estadoActual) => {
    try {
      await api.patch(`/cupones/${id}`, { activo: !estadoActual });
      fetchCupones();
    } catch (error) {
      console.error('Error al actualizar el estado del cupón:', error);
      setError('Error al actualizar el cupón');
    }
  };

  const copiarCodigo = (codigo) => {
    navigator.clipboard.writeText(codigo);
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-AR');
  };

  return (
    <div className="cupones-container">
      <div className="cupones-header">
        <h1>Gestión de Cupones</h1>
        <div className="actions">
          <button 
            className="btn btn-primary"
            onClick={() => setShowForm(!showForm)}
          >
            <FiPlus /> {showForm ? 'Cancelar' : 'Nuevo Cupón'}
          </button>
          <button 
            className="btn btn-secondary"
            onClick={fetchCupones}
            disabled={loading}
          >
            <FiRefreshCw className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <div className="form-container">
          <h2>Crear Nuevo Cupón</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Código del Cupón</label>
              <input
                type="text"
                name="codigo"
                value={formData.codigo}
                onChange={handleChange}
                placeholder="Ej: DESCUENTO20"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Descuento (%)</label>
              <input
                type="number"
                name="descuento"
                value={formData.descuento}
                onChange={handleChange}
                min="1"
                max="100"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Fecha de Vencimiento</label>
              <input
                type="date"
                name="fechaVencimiento"
                value={formData.fechaVencimiento}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Usos Máximos</label>
              <input
                type="number"
                name="maxUsos"
                value={formData.maxUsos}
                onChange={handleChange}
                min="1"
                required
              />
            </div>
            
            <div className="form-group checkbox-group">
              <input
                type="checkbox"
                id="activo"
                name="activo"
                checked={formData.activo}
                onChange={handleChange}
              />
              <label htmlFor="activo">Cupón Activo</label>
            </div>
            
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                Crear Cupón
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="cupones-list">
        <h2>Lista de Cupones</h2>
        
        {loading ? (
          <div className="loading">Cargando cupones...</div>
        ) : cupones.length === 0 ? (
          <div className="empty-state">No hay cupones creados</div>
        ) : (
          <table className="cupones-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descuento</th>
                <th>Vencimiento</th>
                <th>Usados / Máx</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cupones.map((cupon) => (
                <tr key={cupon.id}>
                  <td>
                    <div className="codigo-cupon">
                      {cupon.codigo}
                      <button 
                        className="btn-icon" 
                        onClick={() => copiarCodigo(cupon.codigo)}
                        title="Copiar código"
                      >
                        <FiCopy />
                      </button>
                    </div>
                  </td>
                  <td>{cupon.descuento}%</td>
                  <td>{formatearFecha(cupon.fechaVencimiento)}</td>
                  <td>{cupon.usos || 0} / {cupon.maxUsos}</td>
                  <td>
                    <span className={`badge ${cupon.activo ? 'active' : 'inactive'}`}>
                      {cupon.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className={`btn-icon ${cupon.activo ? 'danger' : 'success'}`}
                      onClick={() => toggleEstado(cupon.id, cupon.activo)}
                      title={cupon.activo ? 'Desactivar' : 'Activar'}
                    >
                      {cupon.activo ? <FiX /> : <FiCheck />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
