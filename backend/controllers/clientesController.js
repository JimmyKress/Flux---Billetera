import { db } from '../config/db.js';

import bcrypt from 'bcryptjs';

import { crearNotificacion } from './notificacionesController.js';

const ensureCuentasBancariasClienteTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS cuentas_bancarias_cliente (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cliente_id INT NOT NULL,
      cbu VARCHAR(22) NOT NULL,
      alias VARCHAR(50) NULL,
      banco VARCHAR(120) NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_cliente_cbu (cliente_id, cbu)
    )
  `);
};

export const listarCuentasBancariasClienteAdmin = async (req, res) => {
  try {
    const { clienteId } = req.params;
    if (!clienteId) return res.status(400).json({ ok: false, msg: 'clienteId requerido' });
    await ensureCuentasBancariasClienteTable();
    const [rows] = await db.query(
      `SELECT id, cliente_id, cbu, alias, banco, is_default, created_at
       FROM cuentas_bancarias_cliente
       WHERE cliente_id = ?
       ORDER BY is_default DESC, created_at DESC`,
      [clienteId]
    );
    return res.json({ ok: true, data: rows || [] });
  } catch (e) {
    return res.status(500).json({ ok: false, msg: 'Error al listar cuentas bancarias' });
  }
};

export const crearCuentaBancariaClienteAdmin = async (req, res) => {
  try {
    const { clienteId } = req.params;
    const { cbu, alias, banco, is_default } = req.body;
    if (!clienteId) return res.status(400).json({ ok: false, msg: 'clienteId requerido' });
    if (!cbu) return res.status(400).json({ ok: false, msg: 'CBU requerido' });

    await ensureCuentasBancariasClienteTable();

    const [clientes] = await db.query('SELECT id, cuit FROM clientes WHERE id = ? LIMIT 1', [clienteId]);
    if (!clientes.length) return res.status(404).json({ ok: false, msg: 'Cliente no encontrado' });

    await db.query('START TRANSACTION');
    try {
      if (is_default) {
        await db.query('UPDATE cuentas_bancarias_cliente SET is_default = 0 WHERE cliente_id = ?', [clienteId]);
      }
      const [result] = await db.query(
        'INSERT INTO cuentas_bancarias_cliente (cliente_id, cbu, alias, banco, is_default) VALUES (?,?,?,?,?)',
        [clienteId, String(cbu), alias || null, banco || null, is_default ? 1 : 0]
      );
      await db.query('COMMIT');

      try {
        await crearNotificacion(clientes[0].cuit, 'CLIENTE_CBU_AGREGADO', 'Se agregó una cuenta bancaria a tu perfil.');
      } catch (x) {}

      return res.json({ ok: true, id: result.insertId });
    } catch (txErr) {
      await db.query('ROLLBACK');
      throw txErr;
    }
  } catch (e) {
    return res.status(500).json({ ok: false, msg: 'Error al crear cuenta bancaria' });
  }
};

export const eliminarCuentaBancariaClienteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ ok: false, msg: 'id requerido' });
    await ensureCuentasBancariasClienteTable();

    const [rows] = await db.query('SELECT cliente_id FROM cuentas_bancarias_cliente WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ ok: false, msg: 'Cuenta bancaria no encontrada' });

    await db.query('DELETE FROM cuentas_bancarias_cliente WHERE id = ?', [id]);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, msg: 'Error al eliminar cuenta bancaria' });
  }
};

const ensureRegistrosPendientesOcultosTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS registros_pendientes_ocultos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cuit VARCHAR(50) NOT NULL,
      unverified_user_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_cuit_unverified (cuit, unverified_user_id)
    )
  `);
};

const addColumnIfMissing = async (table, column, definition) => {
  const [cols] = await db.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
  if (!cols.length) {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

const ensureUnverifiedUsersColumns = async () => {
  await addColumnIfMissing('unverified_users', 'estado', "VARCHAR(40) DEFAULT 'PENDIENTE_VERIFICACION'");
  await addColumnIfMissing('unverified_users', 'acepta_terminos', 'TINYINT(1) DEFAULT 0');
  await addColumnIfMissing('unverified_users', 'terminos_aceptados_at', 'DATETIME NULL');
  await addColumnIfMissing('unverified_users', 'firma_base64', 'LONGTEXT NULL');
  await addColumnIfMissing('unverified_users', 'firma_ip', 'VARCHAR(64) NULL');
  await addColumnIfMissing('unverified_users', 'token_verificado_at', 'DATETIME NULL');
  await addColumnIfMissing('unverified_users', 'aprobado_at', 'DATETIME NULL');
  await addColumnIfMissing('unverified_users', 'rechazado_at', 'DATETIME NULL');
  await addColumnIfMissing('unverified_users', 'rechazo_motivo', 'VARCHAR(255) NULL');
};

const ensureClientesWalletModeColumn = async () => {
  await addColumnIfMissing(
    'clientes',
    'wallet_mode',
    "VARCHAR(24) NOT NULL DEFAULT 'INTERNAL_WALLET'"
  );
};

const ensureClientesBancoColumn = async () => {
  await addColumnIfMissing('clientes', 'banco', 'VARCHAR(120) NULL');
};

export const aprobarRegistroPendiente = async (req, res) => {
  try {
    await ensureUnverifiedUsersColumns();
    const { id } = req.body;
    if (!id) return res.status(400).json({ ok: false, msg: 'ID requerido' });

    const [rows] = await db.query(
      `SELECT * FROM unverified_users WHERE id = ? AND estado = 'PENDIENTE_APROBACION'`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, msg: 'Registro pendiente no encontrado' });

    const pending = rows[0];

    const [userExists] = await db.query('SELECT id FROM users WHERE email = ? OR cuit = ?', [pending.email, pending.cuit]);
    const [clientExists] = await db.query('SELECT id FROM clientes WHERE cuit = ?', [pending.cuit]);
    if (userExists.length || clientExists.length) {
      return res.status(409).json({ ok: false, msg: 'Ya existe un usuario o cliente con esos datos' });
    }

    const [cbuCol] = await db.query("SHOW COLUMNS FROM users LIKE 'cbu'");
    const hasCbu = Array.isArray(cbuCol) ? cbuCol.length > 0 : !!cbuCol.length;

    await db.query('START TRANSACTION');
    try {
      await db.query(
        'INSERT INTO clientes (cuit, razon_social, cbu_registro, wallet_mode) VALUES (?, ?, ?, ?)',
        [pending.cuit, `${pending.nombre} ${pending.apellido}`, pending.cbu, pending.modo_acreditacion || 'INTERNAL_WALLET']
      );

      if (hasCbu) {
        await db.query(
          'INSERT INTO users (nombre, apellido, cuit, email, password, cbu, verificado, es_admin, created_at) VALUES (?,?,?,?,?,?,1,0,?)',
          [pending.nombre, pending.apellido, pending.cuit, pending.email, pending.password, pending.cbu, new Date()]
        );
      } else {
        await db.query(
          'INSERT INTO users (nombre, apellido, cuit, email, password, verificado, es_admin, created_at) VALUES (?,?,?,?,?,1,0,?)',
          [pending.nombre, pending.apellido, pending.cuit, pending.email, pending.password, new Date()]
        );
      }

      await db.query(
        `UPDATE unverified_users
         SET estado = 'APROBADO', aprobado_at = NOW()
         WHERE id = ?`,
        [pending.id]
      );

      await db.query('COMMIT');
    } catch (txError) {
      await db.query('ROLLBACK');
      throw txError;
    }
    res.json({ ok: true, msg: 'Registro aprobado y creado.' });
  } catch (error) {
    console.error('Error al aprobar registro pendiente:', error);
    res.status(500).json({ ok: false, msg: 'Error al aprobar registro' });
  }
};

export const rechazarRegistroPendiente = async (req, res) => {
  try {
    await ensureUnverifiedUsersColumns();
    const { id, motivo } = req.body;
    if (!id) return res.status(400).json({ ok: false, msg: 'ID requerido' });

    const [rows] = await db.query(
      `SELECT id FROM unverified_users WHERE id = ? AND estado = 'PENDIENTE_APROBACION'`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, msg: 'Registro pendiente no encontrado' });

    await db.query(
      `UPDATE unverified_users
       SET estado = 'RECHAZADO', rechazado_at = NOW(), rechazo_motivo = ?
       WHERE id = ?`,
      [motivo || null, id]
    );

    res.json({ ok: true, msg: 'Registro rechazado.' });
  } catch (error) {
    console.error('Error al rechazar registro pendiente:', error);
    res.status(500).json({ ok: false, msg: 'Error al rechazar registro' });
  }
};


const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
         req.socket.remoteAddress || 
         'unknown';
};

export const listarClientes = async (req, res) => {
  try {
    const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');
    const adminCuit = normalizeCuit(process.env.ADMIN_CUIT);
    const [clientes] = await db.query(`
      SELECT 
        id, 
        cuit, 
        razon_social as nombre,
        config_retiro_automatico
      FROM clientes
      WHERE cuit != '20-40217205-4'
        AND ( ? = '' OR REPLACE(cuit, '-', '') != ? )
      ORDER BY razon_social ASC
    `, [adminCuit, adminCuit]);
    
    res.json({ 
      ok: true, 
      data: clientes 
    });
  } catch (error) {
    console.error('Error al listar clientes:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Error al obtener la lista de clientes' 
    });
  }
};

export const listarClientesAdmin = async (req, res) => {
  try {
    const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');
    const adminCuit = normalizeCuit(process.env.ADMIN_CUIT);
    await ensureClientesWalletModeColumn();
    await ensureClientesBancoColumn();
    const [clientes] = await db.query(`
      SELECT
        id,
        cuit,
        razon_social,
        cbu_registro,
        wallet_mode,
        banco,
        edad,
        direccion,
        ubicacion,
        sexo,
        alias,
        config_retiro_automatico,
        NULL as created_at
      FROM clientes
      WHERE cuit != '20-40217205-4'
        AND ( ? = '' OR REPLACE(cuit, '-', '') != ? )
      ORDER BY razon_social ASC
    `, [adminCuit, adminCuit]);

    res.json({ ok: true, data: clientes || [] });
  } catch (error) {
    console.error('Error al listar clientes (admin):', error);
    res.status(500).json({ ok: false, msg: 'Error al obtener la lista de clientes' });
  }
};

export const obtenerClientePorCuit = async (req, res) => {
  try {
    const { cuit } = req.params;
    
    const [clientes] = await db.query(
      'SELECT id, cuit, razon_social as nombre, config_retiro_automatico FROM clientes WHERE cuit = ?', 
      [cuit]
    );
    
    if (clientes.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        msg: 'Cliente no encontrado' 
      });
    }
    
    res.json({ 
      ok: true, 
      data: clientes[0] 
    });
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Error al obtener el cliente' 
    });
  }
};

// Obtener perfil del cliente autenticado
export const obtenerPerfilCliente = async (req, res) => {
  try {
    const cuit = req.user?.cuit || req.query.cuit;
    
    if (!cuit) {
      return res.status(400).json({ 
        ok: false, 
        msg: 'CUIT no proporcionado' 
      });
    }

    await ensureClientesWalletModeColumn();
    await ensureClientesBancoColumn();

    const [liquidacionDiariaCol] = await db.query("SHOW COLUMNS FROM clientes LIKE 'liquidacion_diaria'");
    const hasLiquidacionDiaria = Array.isArray(liquidacionDiariaCol)
      ? liquidacionDiariaCol.length > 0
      : Boolean(liquidacionDiariaCol?.length);
    const liquidacionDiariaSelect = hasLiquidacionDiaria ? 'c.liquidacion_diaria' : 'NULL AS liquidacion_diaria';

    const [clientes] = await db.query(
      `SELECT c.id, c.cuit, c.razon_social, c.cbu_registro, c.banco, c.edad, c.direccion, c.ubicacion, c.sexo, c.alias, c.config_retiro_automatico, ${liquidacionDiariaSelect}, c.wallet_mode, u.email
       FROM clientes c 
       LEFT JOIN users u ON c.cuit = u.cuit
       WHERE c.cuit = ?`, 
      [cuit]
    );
    
    if (clientes.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        msg: 'Cliente no encontrado' 
      });
    }

    // Obtener saldo del cliente
    const [saldoResult] = await db.query(
      `SELECT COALESCE(SUM(monto), 0) as saldo FROM wallet_movements WHERE cuit = ?`,
      [cuit]
    );

    const cliente = clientes[0];
    const saldo = saldoResult[0]?.saldo || 0;

    res.json({ 
      ok: true, 
      data: {
        ...cliente,
        saldo: parseFloat(saldo)
      }
    });
  } catch (error) {
    console.error('Error al obtener perfil del cliente:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Error al obtener el perfil' 
    });
  }
};

// Actualizar perfil del cliente (alias, edad, dirección, ubicación, sexo)
export const actualizarPerfilCliente = async (req, res) => {
  try {
    const cuit = req.user?.cuit || req.body.cuit;
    const { alias, banco, edad, direccion, ubicacion, sexo } = req.body;
    const ip = getClientIp(req);

    if (!cuit) {
      return res.status(400).json({ 
        ok: false, 
        msg: 'CUIT no proporcionado' 
      });
    }

    // Validar que cliente existe
    const [clientes] = await db.query(
      'SELECT id FROM clientes WHERE cuit = ?',
      [cuit]
    );

    if (clientes.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        msg: 'Cliente no encontrado' 
      });
    }

    const cliente_id = clientes[0].id;

    await ensureClientesBancoColumn();

    // Actualizar datos
    const updates = [];
    const values = [];

    if (alias !== undefined && alias !== null) {
      updates.push('alias = ?');
      values.push(alias);
    }

    if (banco !== undefined && banco !== null) {
      updates.push('banco = ?');
      values.push(String(banco).slice(0, 120));
    }

    if (edad !== undefined && edad !== null) {
      updates.push('edad = ?');
      values.push(edad);
    }

    if (direccion !== undefined && direccion !== null) {
      updates.push('direccion = ?');
      values.push(direccion);
    }

    if (ubicacion !== undefined && ubicacion !== null) {
      updates.push('ubicacion = ?');
      values.push(ubicacion);
    }

    if (sexo !== undefined && sexo !== null) {
      updates.push('sexo = ?');
      values.push(sexo);
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        ok: false, 
        msg: 'Debe proporcionar al menos un campo para actualizar' 
      });
    }

    values.push(cuit);

    const sql = `UPDATE clientes SET ${updates.join(', ')} WHERE cuit = ?`;
    const result = await db.query(sql, values);

    // Registrar auditoría
    await db.query(
      `INSERT INTO auditoria_logs (usuario, accion, ip, created_at) 
       VALUES (?, ?, ?, NOW())`,
      [cuit, `Actualizado perfil de cliente: ${updates.join(', ')}`, ip]
    );

    res.json({ 
      ok: true, 
      msg: 'Perfil actualizado exitosamente' 
    });
  } catch (error) {
    console.error('Error al actualizar perfil del cliente:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Error al actualizar el perfil' 
    });
  }
};

export const listarRegistrosPendientes = async (req, res) => {
  try {
    const adminCuit = req.user?.cuit;
    await ensureUnverifiedUsersColumns();
    await ensureRegistrosPendientesOcultosTable();

    let sql = `
      SELECT id, nombre, apellido, cuit, email, cbu, token_created_at, expires_at, created_at,
             acepta_terminos, terminos_aceptados_at, firma_base64, firma_ip, estado
      FROM unverified_users
      WHERE estado = 'PENDIENTE_APROBACION'
    `;
    const params = [];

    if (adminCuit) {
      sql += ` AND NOT EXISTS (
        SELECT 1 FROM registros_pendientes_ocultos rpo
        WHERE rpo.cuit = ? AND rpo.unverified_user_id = unverified_users.id
      )`;
      params.push(adminCuit);
    }

    sql += ' ORDER BY created_at DESC';
    const [rows] = await db.query(sql, params);
    res.json({ ok: true, data: rows || [] });
  } catch (error) {
    console.error('Error al listar registros pendientes:', error);
    res.status(500).json({ ok: false, msg: 'Error al obtener registros pendientes' });
  }
};

export const ocultarRegistrosPendientesAdmin = async (req, res) => {
  try {
    const adminCuit = req.user?.cuit;
    const { ids } = req.body;

    if (!adminCuit) return res.status(400).json({ ok: false, msg: 'CUIT no proporcionado' });
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ ok: false, msg: 'Faltan ids' });

    await ensureRegistrosPendientesOcultosTable();

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT id FROM unverified_users WHERE id IN (${placeholders})`,
      [...ids]
    );

    if (!rows || rows.length === 0) {
      return res.json({ ok: true, ocultados: 0 });
    }

    const values = rows.map(r => [adminCuit, r.id]);
    await db.query(
      'INSERT IGNORE INTO registros_pendientes_ocultos (cuit, unverified_user_id) VALUES ?',
      [values]
    );

    res.json({ ok: true, ocultados: rows.length });
  } catch (error) {
    console.error('Error al ocultar registros pendientes:', error);
    res.status(500).json({ ok: false, msg: 'Error al ocultar registros pendientes' });
  }
};

export const crearClienteAdmin = async (req, res) => {
  try {
    const {
      cuit,
      razon_social,
      cbu_registro,
      config_retiro_automatico,

      nombre,
      apellido,
      email,
      cbu,
      password,
    } = req.body;

    const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');
    const normalizedCuit = normalizeCuit(cuit);

    const hasRegisterPayload = Boolean(nombre || apellido || email || cbu || password);

    if (hasRegisterPayload) {
      if (!nombre || !apellido || !cuit || !email || !cbu || !password) {
        return res.status(400).json({ ok: false, msg: 'Faltan datos' });
      }

      if (String(cbu).length !== 22 || !/^\d+$/.test(String(cbu))) {
        return res.status(400).json({ ok: false, msg: 'CBU debe tener 22 dígitos' });
      }

      const passRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
      if (!passRegex.test(String(password))) {
        return res.status(400).json({ ok: false, msg: 'Contraseña no cumple requisitos' });
      }

      // Validar existencia en users / clientes / pendientes
      const [userExists] = await db.query(
        'SELECT id FROM users WHERE email = ? OR REPLACE(cuit, "-", "") = ? LIMIT 1',
        [email, normalizedCuit]
      );

      const [clientExists] = await db.query(
        'SELECT id FROM clientes WHERE REPLACE(cuit, "-", "") = ? LIMIT 1',
        [normalizedCuit]
      );

      const [pendingExists] = await db.query(
        'SELECT id FROM unverified_users WHERE email = ? OR REPLACE(cuit, "-", "") = ? LIMIT 1',
        [email, normalizedCuit]
      );

      if (userExists.length || clientExists.length || pendingExists.length) {
        return res.status(409).json({ ok: false, msg: 'Usuario ya existe o pendiente de verificación' });
      }

      const hashed = await bcrypt.hash(String(password), 10);

      // Compatibilidad con esquemas donde users puede o no tener columna `cbu`
      const [cbuCol] = await db.query("SHOW COLUMNS FROM users LIKE 'cbu'");
      const hasUserCbu = Array.isArray(cbuCol) ? cbuCol.length > 0 : !!cbuCol.length;

      await db.query('START TRANSACTION');
      try {
        await db.query(
          `INSERT INTO clientes (cuit, razon_social, cbu_registro, config_retiro_automatico)
           VALUES (?, ?, ?, ?)`
          , [cuit, `${nombre} ${apellido}`, cbu, config_retiro_automatico ? 1 : 0]
        );

        if (hasUserCbu) {
          await db.query(
            'INSERT INTO users (nombre, apellido, cuit, email, password, cbu, verificado, es_admin, created_at) VALUES (?,?,?,?,?,?,1,0,NOW())',
            [nombre, apellido, cuit, email, hashed, cbu]
          );
        } else {
          await db.query(
            'INSERT INTO users (nombre, apellido, cuit, email, password, verificado, es_admin, created_at) VALUES (?,?,?,?,?,1,0,NOW())',
            [nombre, apellido, cuit, email, hashed]
          );
        }

        await db.query('COMMIT');
      } catch (txErr) {
        await db.query('ROLLBACK');
        throw txErr;
      }

      return res.json({ ok: true, msg: 'Cliente creado correctamente' });
    }

    // Comportamiento anterior (solo tabla clientes)
    if (!cuit || !razon_social) {
      return res.status(400).json({ ok: false, msg: 'Faltan datos obligatorios' });
    }

    const [exists] = await db.query('SELECT id FROM clientes WHERE REPLACE(cuit, "-", "") = ? LIMIT 1', [normalizedCuit]);
    if (exists.length) {
      return res.status(409).json({ ok: false, msg: 'Ya existe un cliente con ese CUIT' });
    }

    await db.query(
      `INSERT INTO clientes (cuit, razon_social, cbu_registro, config_retiro_automatico)
       VALUES (?, ?, ?, ?)`
      , [cuit, razon_social, cbu_registro || null, config_retiro_automatico ? 1 : 0]
    );

    res.json({ ok: true, msg: 'Cliente creado correctamente' });
  } catch (error) {
    console.error('Error al crear cliente (admin):', error);
    res.status(500).json({ ok: false, msg: 'Error al crear cliente' });
  }
};

export const actualizarClienteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      cuit,
      razon_social,
      cbu_registro,
      config_retiro_automatico,
      banco,
      alias,
      edad,
      direccion,
      ubicacion,
      sexo
    } = req.body;

    if (!id) return res.status(400).json({ ok: false, msg: 'ID requerido' });

    const [currentRows] = await db.query('SELECT cuit FROM clientes WHERE id = ?', [id]);
    if (!currentRows.length) return res.status(404).json({ ok: false, msg: 'Cliente no encontrado' });
    const currentCuit = currentRows[0].cuit;

    await ensureClientesBancoColumn();

    if (cuit !== undefined && cuit !== null && cuit !== currentCuit) {
      const [cuitExists] = await db.query('SELECT id FROM clientes WHERE cuit = ? AND id != ?', [cuit, id]);
      if (cuitExists.length) {
        return res.status(409).json({ ok: false, msg: 'Ya existe un cliente con ese CUIT' });
      }
      const [userCuitExists] = await db.query('SELECT id FROM users WHERE cuit = ?', [cuit]);
      if (userCuitExists.length) {
        return res.status(409).json({ ok: false, msg: 'Ya existe un usuario con ese CUIT' });
      }
    }

    const updates = [];
    const values = [];

    if (cuit !== undefined) {
      updates.push('cuit = ?');
      values.push(cuit);
    }
    if (razon_social !== undefined) {
      updates.push('razon_social = ?');
      values.push(razon_social);
    }
    if (cbu_registro !== undefined) {
      updates.push('cbu_registro = ?');
      values.push(cbu_registro);
    }
    if (config_retiro_automatico !== undefined) {
      updates.push('config_retiro_automatico = ?');
      values.push(config_retiro_automatico ? 1 : 0);
    }
    if (banco !== undefined) {
      updates.push('banco = ?');
      values.push(banco);
    }
    if (alias !== undefined) {
      updates.push('alias = ?');
      values.push(alias);
    }
    if (edad !== undefined) {
      updates.push('edad = ?');
      values.push(edad);
    }
    if (direccion !== undefined) {
      updates.push('direccion = ?');
      values.push(direccion);
    }
    if (ubicacion !== undefined) {
      updates.push('ubicacion = ?');
      values.push(ubicacion);
    }
    if (sexo !== undefined) {
      updates.push('sexo = ?');
      values.push(sexo);
    }

    if (!updates.length) {
      return res.status(400).json({ ok: false, msg: 'No hay campos para actualizar' });
    }

    await db.query('START TRANSACTION');
    try {
      values.push(id);
      await db.query(`UPDATE clientes SET ${updates.join(', ')} WHERE id = ?`, values);

      if (cuit !== undefined && cuit !== null && cuit !== currentCuit) {
        await db.query('UPDATE users SET cuit = ? WHERE cuit = ?', [cuit, currentCuit]);
        await db.query('UPDATE movimientos SET cuit = ? WHERE cuit = ?', [cuit, currentCuit]);
        await db.query('UPDATE wallet_movements SET cuit = ? WHERE cuit = ?', [cuit, currentCuit]);
        await db.query('UPDATE retiros SET cuit = ? WHERE cuit = ?', [cuit, currentCuit]);
        await db.query('UPDATE notificaciones SET cuit = ? WHERE cuit = ?', [cuit, currentCuit]);
        await db.query('UPDATE cupones SET cuit = ? WHERE cuit = ?', [cuit, currentCuit]);
      }

      await db.query('COMMIT');
    } catch (txError) {
      await db.query('ROLLBACK');
      throw txError;
    }

    try {
      const targetCuit = cuit !== undefined && cuit !== null ? cuit : currentCuit;
      const changed = updates
        .map((u) => String(u).split('=')[0].trim())
        .filter(Boolean)
        .join(', ');
      await crearNotificacion(
        targetCuit,
        'CLIENTE_EDITADO',
        `Se actualizaron datos de tu cuenta: ${changed}`
      );
    } catch (e) {
      // No bloquear actualización si falla la notificación
    }

    res.json({ ok: true, msg: 'Cliente actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar cliente (admin):', error);
    res.status(500).json({ ok: false, msg: 'Error al actualizar cliente' });
  }
};

export const eliminarClienteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ ok: false, msg: 'ID requerido' });

    const [rows] = await db.query('SELECT id, cuit FROM clientes WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ ok: false, msg: 'Cliente no encontrado' });
    }

    const clienteCuit = rows[0].cuit;
    const clienteEmail = null;

    await db.query('START TRANSACTION');
    try {
      // Desasociar cupones que apunten a sucursales/terminales del cliente (por si quedan huérfanos)
      await db.query(
        `UPDATE cupones c
         LEFT JOIN terminales t ON t.id = c.terminal_id
         LEFT JOIN sucursales s_by_terminal ON s_by_terminal.id = t.sucursal_id
         LEFT JOIN sucursales s ON s.id = c.sucursal_id
         SET c.sucursal_id = NULL,
             c.terminal_id = NULL
         WHERE s.cliente_id = ?
            OR s_by_terminal.cliente_id = ?`,
        [id, id]
      );

      // Asegurar que no queden cupones apuntando a sucursales del cliente (FK sucursal_id)
      await db.query(
        `UPDATE cupones c
         JOIN sucursales s ON s.id = c.sucursal_id
         SET c.sucursal_id = NULL
         WHERE s.cliente_id = ?`,
        [id]
      );

      // Asegurar que no queden cupones apuntando a terminales del cliente (FK terminal_id)
      await db.query(
        `UPDATE cupones c
         JOIN terminales t ON t.id = c.terminal_id
         JOIN sucursales s ON s.id = t.sucursal_id
         SET c.terminal_id = NULL
         WHERE s.cliente_id = ?`,
        [id]
      );

      // cliente_id es NOT NULL, no se puede poner NULL. Se borran cupones del cliente.
      await db.query(
        `DELETE FROM cupones
         WHERE cliente_id = ?`,
        [id]
      );

      // Eliminar retiros asociados
      await db.query('DELETE FROM retiros WHERE cliente_id = ? OR cuit = ?', [id, clienteCuit]);

      // Eliminar movimientos y sus relaciones
      const [movimientos] = await db.query('SELECT id FROM movimientos WHERE cliente_id = ? OR cuit = ?', [id, clienteCuit]);
      const movimientoIds = (movimientos || []).map((m) => m.id);
      if (movimientoIds.length) {
        const placeholders = movimientoIds.map(() => '?').join(',');
        await db.query(`DELETE FROM movimientos_ocultos WHERE movimiento_id IN (${placeholders})`, movimientoIds);
        await db.query(`DELETE FROM wallet_movements WHERE movimiento_id IN (${placeholders})`, movimientoIds);
      }

      await db.query('DELETE FROM movimientos WHERE cliente_id = ? OR cuit = ?', [id, clienteCuit]);

      // Eliminar notificaciones del cliente
      await db.query('DELETE FROM notificaciones WHERE cliente_id = ? OR cuit = ?', [id, clienteCuit]);

      await db.query(
        `DELETE t FROM terminales t
         INNER JOIN sucursales s ON s.id = t.sucursal_id
         WHERE s.cliente_id = ?`,
        [id]
      );
      await db.query('DELETE FROM sucursales WHERE cliente_id = ?', [id]);
      await db.query('DELETE FROM clientes WHERE id = ?', [id]);
      await db.query(
        `DELETE FROM users
         WHERE REPLACE(cuit, '-', '') = REPLACE(?, '-', '')`,
        [clienteCuit]
      );
      if (clienteEmail) {
        await db.query(
          `DELETE FROM unverified_users
           WHERE email = ? OR REPLACE(cuit, '-', '') = REPLACE(?, '-', '')`,
          [clienteEmail, clienteCuit]
        );
      } else {
        await db.query(
          `DELETE FROM unverified_users
           WHERE REPLACE(cuit, '-', '') = REPLACE(?, '-', '')`,
          [clienteCuit]
        );
      }
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }

    res.json({ ok: true, msg: 'Cliente eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar cliente (admin):', error);
    res.status(500).json({ ok: false, msg: 'Error al eliminar cliente' });
  }
};
