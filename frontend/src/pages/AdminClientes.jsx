import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosClient';
import './Admin/Admin.css';

export default function AdminClientes() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showDeleteClienteModal, setShowDeleteClienteModal] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState(null);

  const [clientes, setClientes] = useState([]);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    id: null,
    cuit: '',
    razon_social: '',
    cbu_registro: '',
    config_retiro_automatico: false,
    alias: '',
    edad: '',
    direccion: '',
    ubicacion: '',
    sexo: ''
  });

  const isEditing = !!form.id;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(c => {
      const cuit = String(c.cuit ?? '').toLowerCase();
      const rs = String(c.nombre ?? c.razon_social ?? '').toLowerCase();
      return cuit.includes(q) || rs.includes(q);
    });
  }, [clientes, search]);

  const resetForm = () => {
    setForm({
      id: null,
      cuit: '',
      razon_social: '',
      cbu_registro: '',
      config_retiro_automatico: false,
      alias: '',
      edad: '',
      direccion: '',
      ubicacion: '',
      sexo: ''
    });
  };

  const fetchClientes = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/clientes/admin');
      setClientes(res?.data?.data || []);
    } catch (e) {
      setError(e?.response?.data?.msg || e?.response?.data?.error || e.message || 'Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      navigate('/login/admin');
      return;
    }
    fetchClientes();
  }, []);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.cuit || !form.razon_social) {
      setError('CUIT y Razón social son obligatorios');
      return;
    }

    try {
      setLoading(true);
      await api.put(`/clientes/admin/${form.id}`, {
        cuit: form.cuit,
        razon_social: form.razon_social,
        cbu_registro: form.cbu_registro,
        config_retiro_automatico: form.config_retiro_automatico,
        alias: form.alias,
        edad: form.edad === '' ? null : Number(form.edad),
        direccion: form.direccion,
        ubicacion: form.ubicacion,
        sexo: form.sexo
      });
      setSuccess('Cliente actualizado');
      resetForm();
      await fetchClientes();
    } catch (e2) {
      setError(e2?.response?.data?.msg || e2?.response?.data?.error || e2.message || 'Error al actualizar');
    } finally {
      setLoading(false);
    }
  };

  const onEdit = (c) => {
    setError('');
    setSuccess('');
    setForm({
      id: c.id,
      cuit: String(c.cuit ?? ''),
      razon_social: String(c.razon_social ?? c.nombre ?? ''),
      cbu_registro: String(c.cbu_registro ?? ''),
      config_retiro_automatico: !!c.config_retiro_automatico,
      alias: String(c.alias ?? ''),
      edad: c.edad ?? '',
      direccion: String(c.direccion ?? ''),
      ubicacion: String(c.ubicacion ?? ''),
      sexo: String(c.sexo ?? '')
    });
  };

  const onDelete = async (c) => {
    setError('');
    setSuccess('');
    setClienteToDelete(c);
    setShowDeleteClienteModal(true);
  };

  const closeDeleteClienteModal = () => {
    setShowDeleteClienteModal(false);
    setClienteToDelete(null);
  };

  const confirmDeleteCliente = async () => {
    if (!clienteToDelete) return;
    try {
      setLoading(true);
      await api.delete(`/clientes/admin/${clienteToDelete.id}`);
      setSuccess('Cliente eliminado');
      if (form.id === clienteToDelete.id) resetForm();
      closeDeleteClienteModal();
      await fetchClientes();
    } catch (e) {
      setError(e?.response?.data?.msg || e?.response?.data?.error || e.message || 'Error al eliminar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div className="admin-title-group">
          <h1 className="admin-title">Administración de Clientes</h1>
        </div>
        <div className="header-actions">
          <button type="button" className="refresh-btn" onClick={fetchClientes} disabled={loading}>
            Refrescar
          </button>
          <button type="button" className="logout-btn" onClick={() => navigate('/admin')}>
            Volver al panel
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="filtros-container">
        <div className="filtros-grid">
          <div className="form-group">
            <label>Buscar (CUIT / Razón social)</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." />
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="registro-movimiento">
          <h3>Editar cliente</h3>
          <form onSubmit={onSubmit} className="form-grid">
            <div className="form-group">
              <label>CUIT</label>
              <input name="cuit" value={form.cuit} onChange={onChange} placeholder="20304567891" />
            </div>
            <div className="form-group">
              <label>Razón social</label>
              <input name="razon_social" value={form.razon_social} onChange={onChange} placeholder="Razón social" />
            </div>
            <div className="form-group">
              <label>CBU registro</label>
              <input name="cbu_registro" value={form.cbu_registro} onChange={onChange} placeholder="22 dígitos" />
            </div>
            <div className="form-group" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ marginBottom: 0 }}>Retiro automático</label>
              <input name="config_retiro_automatico" type="checkbox" checked={form.config_retiro_automatico} onChange={onChange} />
            </div>

            <div className="form-group">
              <label>Alias</label>
              <input name="alias" value={form.alias} onChange={onChange} placeholder="Alias" />
            </div>
            <div className="form-group">
              <label>Edad</label>
              <input name="edad" value={form.edad} onChange={onChange} placeholder="Edad" />
            </div>
            <div className="form-group">
              <label>Dirección</label>
              <input name="direccion" value={form.direccion} onChange={onChange} placeholder="Dirección" />
            </div>
            <div className="form-group">
              <label>Ubicación</label>
              <input name="ubicacion" value={form.ubicacion} onChange={onChange} placeholder="Ubicación" />
            </div>
            <div className="form-group">
              <label>Sexo</label>
              <input name="sexo" value={form.sexo} onChange={onChange} placeholder="Sexo" />
            </div>

            <div className="form-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                Actualizar
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={loading}>
                Limpiar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="clientes-container">
        <div className="clientes-lista">
          <h3>Clientes registrados ({filtered.length})</h3>
        </div>

        {loading ? (
          <div className="loading-clients">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="no-clients">No hay clientes para mostrar</div>
        ) : (
          <div style={{ padding: '1rem' }}>
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>CUIT</th>
                  <th>Razón social</th>
                  <th>Retiro automático</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td><code>{c.cuit}</code></td>
                    <td>{c.nombre ?? c.razon_social}</td>
                    <td>{c.config_retiro_automatico ? 'Sí' : 'No'}</td>
                    <td className="admin-actions-cell">
                      <button type="button" className="btn btn-primary btn-sm admin-action-btn" onClick={() => onEdit(c)}>
                        Editar
                      </button>
                      <button type="button" className="btn btn-danger btn-sm admin-action-btn" onClick={() => onDelete(c)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDeleteClienteModal && (
        <div className="modal-overlay">
          <div className="modal-confirm">
            <h3>Confirmar eliminación</h3>
            <p>
              ¿Estás seguro que deseas eliminar el cliente{' '}
              <strong>{clienteToDelete?.cuit}</strong>{' '}
              {'-'}{' '}
              <strong>{clienteToDelete?.nombre ?? clienteToDelete?.razon_social ?? ''}</strong>?
            </p>
            <p>
              Esta acción elimina también sucursales/terminales y el usuario asociado.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeDeleteClienteModal} disabled={loading}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={confirmDeleteCliente} disabled={loading}>
                {loading ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
