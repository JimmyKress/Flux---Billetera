import { useState, useEffect } from 'react';
import api from '../api/axiosClient';

export default function EditarPerfil({ cliente }) {
  const [sucursales, setSucursales] = useState([]);
  const [nuevaSucursal, setNuevaSucursal] = useState({ nombre: '', direccion: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (cliente?.id) {
      cargarSucursales();
    }
  }, [cliente]);

  const cargarSucursales = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/clientes/${cliente.id}/sucursales`);
      setSucursales(res.data.data || []);
    } catch (err) {
      setError('Error al cargar sucursales');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = e => {
    setNuevaSucursal({ ...nuevaSucursal, [e.target.name]: e.target.value });
  };

  const handleAgregar = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!nuevaSucursal.nombre || !nuevaSucursal.direccion) {
      setError('Completa nombre y dirección');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/clientes/${cliente.id}/sucursales`, nuevaSucursal);
      setSuccess('Sucursal agregada correctamente');
      setNuevaSucursal({ nombre: '', direccion: '' });
      cargarSucursales();
    } catch (err) {
      setError('No se pudo agregar la sucursal');
    } finally {
      setLoading(false);
    }
  };

  const handleEliminar = async (id) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.delete(`/clientes/${cliente.id}/sucursales/${id}`);
      setSuccess('Sucursal eliminada');
      cargarSucursales();
    } catch (err) {
      setError('No se pudo eliminar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="editar-perfil">
      <h2>Gestionar Sucursales</h2>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      <form onSubmit={handleAgregar} className="form-agregar-sucursal">
        <input name="nombre" value={nuevaSucursal.nombre} onChange={handleChange} placeholder="Nombre de sucursal" />
        <input name="direccion" value={nuevaSucursal.direccion} onChange={handleChange} placeholder="Dirección" />
        <button type="submit" disabled={loading}>Agregar</button>
      </form>
      <h3>Mis sucursales</h3>
      {loading ? <p>Cargando...</p> : (
        <ul>
          {sucursales.map(s => (
            <li key={s.id}>
              <strong>{s.nombre}</strong> - {s.direccion}
              <button onClick={() => handleEliminar(s.id)} disabled={loading}>Eliminar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
