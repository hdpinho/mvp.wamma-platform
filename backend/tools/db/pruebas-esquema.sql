-- ==============================================================================
-- Pruebas del esquema WAMMA. Las ejecuta tools/db/SchemaTestRunner.java dentro de una
-- transacción que siempre se revierte. Formato: ver el encabezado del runner.
-- Los datos de prueba usan UUID fijos y correos .invalid; nunca persisten.
-- ==============================================================================
-- @verdad acceso: anon y authenticated sin privilegios sobre las tablas del esquema
select not exists (
  select 1 from information_schema.role_table_grants
  where table_schema = current_schema() and grantee in ('anon', 'authenticated'));
-- @verdad acceso: RLS activo en todas las tablas del esquema (salvo el historial de Flyway)
select coalesce(bool_and(c.relrowsecurity), true) from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = current_schema() and c.relkind = 'r' and c.relname <> 'flyway_schema_history';
-- @verdad acceso: wamma_app existe, sin login y con BYPASSRLS
select exists (select 1 from pg_roles where rolname = 'wamma_app' and not rolcanlogin and rolbypassrls);
-- @verdad acceso: wamma_app lee e inserta en interaccion
select has_table_privilege('wamma_app', format('%I.interaccion', current_schema()), 'SELECT')
   and has_table_privilege('wamma_app', format('%I.interaccion', current_schema()), 'INSERT');
-- @verdad acceso: wamma_app no puede UPDATE/DELETE/TRUNCATE en ninguna tabla append-only
select not bool_or(has_table_privilege('wamma_app', format('%I.%I', current_schema(), t), p))
from unnest(array['auditoria_evento','fusion_persona','interaccion','etapa_historial','asiento','linea_asiento','movimiento_inventario']) t,
     unnest(array['UPDATE','DELETE','TRUNCATE']) p;
-- @verdad acceso: wamma_app modifica tablas mutables, incluida persona_telefono
select has_table_privilege('wamma_app', format('%I.persona', current_schema()), 'UPDATE')
   and has_table_privilege('wamma_app', format('%I.oportunidad', current_schema()), 'UPDATE')
   and has_table_privilege('wamma_app', format('%I.persona_telefono', current_schema()), 'INSERT');
-- @verdad indices: toda clave foranea tiene indice
select not exists (
  select 1 from pg_constraint c
  where c.contype = 'f' and c.connamespace = current_schema()::regnamespace
    and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]));
-- @verdad catalogo: etapas = spec 010 §8.1 con umbrales de §8.6
select array_agg(codigo || ':' || coalesce(umbral_estancada_dias::text, '-') order by orden)
     = array['nuevo:2','contactado:3','cita_confirmada:7','visito:7','negociacion:14','cerrado_ganado:-','cerrado_perdido:-']
from catalogo_etapa;
-- @verdad catalogo: motivos = spec 010 §8.2 y solo "otro" exige texto
select array_agg(codigo::text order by codigo) = array['compro_en_otra_parte','dejo_de_responder','no_califico_financiamiento','no_era_el_vehiculo_buscado','otro','precio_fuera_de_presupuesto','vehiculo_vendido_a_otro_cliente']
   and bool_and(exige_texto = (codigo = 'otro'))
from catalogo_motivo_perdida;
-- @verdad cifras: sin tasa BCV ni plan de cuentas inventados
select (select count(*) from tasa_cambio_bcv) = 0 and (select count(*) from cuenta_contable) = 0;
-- @verdad cifras: sin tasas de interes, garantia, estados ni atributos por defecto
select not exists (select 1 from information_schema.columns where table_schema = current_schema()
  and column_default is not null
  and ((table_name = 'credito' and column_name in ('tasa_interes_anual','tasa_interes_mensual'))
    or (table_name = 'publicacion' and column_name in ('garantia_meses','kilometraje_garantia'))
    or (table_name = 'vehiculo' and column_name in ('puestos','traccion'))
    or (table_name in ('pago','reserva') and column_name = 'estado')
    or (table_name = 'tasa_cambio_bcv' and column_name = 'fuente')));
-- @verdad dinero: toda tabla con montos tiene fecha de la tasa
select not exists (select 1 from unnest(array['vehiculo','oportunidad','publicacion','reserva','solicitud_credito','credito','cuota','pago','conciliacion','linea_asiento','decision_riesgo']) t
  where not exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = t and column_name like 'fecha_tasa%'));
-- @verdad dinero: ninguna columna numerica en float
select not exists (select 1 from information_schema.columns where table_schema = current_schema() and data_type in ('real', 'double precision'));
-- @ok fixture: usuario, sede, vehiculo, persona
insert into usuario (id, nombre_usuario, email, password_hash, nombre, apellido) values ('00000000-0000-0000-0000-000000000001', 'ensayo', 'ensayo@wamma.invalid', 'x', 'Ensayo', 'Rollback');
insert into sede (id, codigo, nombre, direccion, ciudad, estado_geografico) values ('00000000-0000-0000-0000-000000000002', 'ENS', 'Sede ensayo', 'n/a', 'n/a', 'n/a');
insert into vehiculo (id, vin, placa, marca, modelo, anio, color, kilometraje, transmision, combustible, carroceria, traccion, puestos, sede_id, precio_adquisicion, moneda_adquisicion, tasa_bcv_adquisicion, fecha_tasa_adquisicion)
values ('00000000-0000-0000-0000-000000000003', 'ENSAYO00000000001', 'ENS001', 'Marca', 'Modelo', 2020, 'Gris', 1000, 'manual', 'gasolina', 'sedan', '4x2', 5, '00000000-0000-0000-0000-000000000002', 1, 'USD', 1.12345678, current_date);
insert into persona (id, nombre_apellido, canal_origen, criterio_resolucion) values ('00000000-0000-0000-0000-000000000004', 'Persona Ensayo', 'catalogo_web', 'nueva');
-- @verdad identidad: seis roles, trece permisos y la matriz aprobada (25 asignaciones, D-24)
select (select count(*) from rol) = 6 and (select count(*) from permiso) = 13 and (select count(*) from rol_permiso) = 25;
-- @verdad identidad: el usuario ya no tiene tipo, ni requiere_2fa, ni secreto TOTP en claro
select not exists (select 1 from information_schema.columns where table_schema = current_schema()
  and table_name = 'usuario' and column_name in ('tipo', 'requiere_2fa', 'secreto_2fa_totp'));
-- @error identidad: nombre de usuario con mayusculas
insert into usuario (nombre_usuario, email, password_hash, nombre, apellido) values ('Mayuscula', 'm@wamma.invalid', 'x', 'M', 'M');
-- @error identidad: nombre de usuario repetido
insert into usuario (nombre_usuario, email, password_hash, nombre, apellido) values ('ensayo', 'otro@wamma.invalid', 'x', 'O', 'O');
-- @error identidad: 2FA activado sin secreto
update usuario set totp_activado_en = now() where id = '00000000-0000-0000-0000-000000000001';
-- @ok sesion: sesion parcial guardada como hash del token
insert into sesion (usuario_id, token_hash, nivel, expira_en) values ('00000000-0000-0000-0000-000000000001', repeat('e', 64), 'parcial', now() + interval '5 minutes');
-- @error sesion: nivel desconocido
insert into sesion (usuario_id, token_hash, nivel, expira_en) values ('00000000-0000-0000-0000-000000000001', repeat('f', 64), 'total', now());
-- @error sesion: el mismo token dos veces
insert into sesion (usuario_id, token_hash, nivel, expira_en) values ('00000000-0000-0000-0000-000000000001', repeat('e', 64), 'completa', now());
-- @error sesion: revocada sin motivo
update sesion set revocada_en = now() where token_hash = repeat('e', 64);
-- @ok sesion: revocada con motivo
update sesion set revocada_en = now(), motivo_revocacion = 'salida' where token_hash = repeat('e', 64);
-- @ok recuperacion: codigo de recuperacion guardado como hash
insert into codigo_recuperacion (usuario_id, codigo_hash) values ('00000000-0000-0000-0000-000000000001', repeat('1', 64));
-- @error recuperacion: el mismo codigo dos veces para el mismo usuario
insert into codigo_recuperacion (usuario_id, codigo_hash) values ('00000000-0000-0000-0000-000000000001', repeat('1', 64));
-- @ok auditoria: evento sin entidad (ingreso fallido de un usuario inexistente)
insert into auditoria_evento (accion, entidad) values ('sesion.fallida', 'sesion');
-- @verdad acceso: wamma_app escribe sesiones y codigos de recuperacion
select has_table_privilege('wamma_app', format('%I.sesion', current_schema()), 'UPDATE')
   and has_table_privilege('wamma_app', format('%I.codigo_recuperacion', current_schema()), 'INSERT');
-- @verdad dinero: la tasa conserva 8 decimales
select tasa_bcv_adquisicion = 1.12345678 from vehiculo where id = '00000000-0000-0000-0000-000000000003';
-- @ok persona: telefono cifrado con indice ciego, principal
insert into persona_telefono (persona_id, telefono_cifrado, indice_ciego_telefono, es_principal) values ('00000000-0000-0000-0000-000000000004', '\x01'::bytea, repeat('a', 64), true);
-- @ok persona: segundo telefono no principal
insert into persona_telefono (persona_id, telefono_cifrado, indice_ciego_telefono, es_principal) values ('00000000-0000-0000-0000-000000000004', '\x02'::bytea, repeat('b', 64), false);
-- @error persona: dos telefonos principales
insert into persona_telefono (persona_id, telefono_cifrado, indice_ciego_telefono, es_principal) values ('00000000-0000-0000-0000-000000000004', '\x03'::bytea, repeat('d', 64), true);
-- @error persona: el mismo telefono dos veces
insert into persona_telefono (persona_id, telefono_cifrado, indice_ciego_telefono) values ('00000000-0000-0000-0000-000000000004', '\x04'::bytea, repeat('b', 64));
-- @error persona: cedula cifrada sin indice ciego
update persona set cedula_cifrada = '\x01'::bytea where id = '00000000-0000-0000-0000-000000000004';
-- @error persona: sin criterio de resolucion
insert into persona (nombre_apellido, canal_origen) values ('Sin criterio', 'whatsapp');
-- @ok oportunidad: nueva con valor, moneda, tasa y fecha de la tasa
insert into oportunidad (id, persona_id, vehiculo_id, modalidad_pago, valor_estimado, moneda, tasa_bcv, fecha_tasa) values ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'contado', 10000, 'USD', 1, current_date);
-- @verdad oportunidad: nace en 'nuevo', sin asesor y version 0
select etapa = 'nuevo' and asesor_id is null and version = 0 from oportunidad where id = '00000000-0000-0000-0000-000000000005';
-- @error oportunidad: cerrar como perdida sin motivo (CA-010.2)
update oportunidad set etapa = 'cerrado_perdido' where id = '00000000-0000-0000-0000-000000000005';
-- @error oportunidad: motivo de perdida en una etapa abierta
update oportunidad set motivo_perdida = 'otro' where id = '00000000-0000-0000-0000-000000000005';
-- @error oportunidad: etapa fuera del catalogo (las de V0004 ya no existen)
update oportunidad set etapa = 'contacto_inicial' where id = '00000000-0000-0000-0000-000000000005';
-- @error oportunidad: moneda fuera de las admitidas
insert into oportunidad (persona_id, vehiculo_id, modalidad_pago, valor_estimado, moneda, tasa_bcv, fecha_tasa) values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'contado', 1, 'XYZ', 1, current_date);
-- @error oportunidad: sin fecha de la tasa
insert into oportunidad (persona_id, vehiculo_id, modalidad_pago, valor_estimado, tasa_bcv) values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'contado', 1, 1);
-- @ok oportunidad: cerrar como perdida con motivo del catalogo
update oportunidad set etapa = 'cerrado_perdido', motivo_perdida = 'otro', detalle_perdida = 'ensayo' where id = '00000000-0000-0000-0000-000000000005';
-- @error enlace: hash sin vencimiento
insert into oportunidad (persona_id, vehiculo_id, modalidad_pago, valor_estimado, tasa_bcv, fecha_tasa, enlace_token_hash, enlace_emitido_en) values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'financiamiento', 1, 1, current_date, repeat('c', 64), now());
-- @ok enlace: hash, emision y vencimiento
insert into oportunidad (id, persona_id, vehiculo_id, modalidad_pago, valor_estimado, tasa_bcv, fecha_tasa, enlace_token_hash, enlace_emitido_en, enlace_expira_en) values ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'financiamiento', 1, 1, current_date, repeat('c', 64), now(), now() + interval '1 day');
-- @error enlace: el mismo hash en dos oportunidades
insert into oportunidad (persona_id, vehiculo_id, modalidad_pago, valor_estimado, tasa_bcv, fecha_tasa, enlace_token_hash, enlace_emitido_en, enlace_expira_en) values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'financiamiento', 1, 1, current_date, repeat('c', 64), now(), now() + interval '1 day');
-- @ok cita: ligada a la oportunidad, con dia y franja
insert into cita_inspeccion (persona_id, oportunidad_id, vehiculo_id, sede_id, dia_preferido, franja) values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', current_date + 1, 'manana');
-- @verdad cita: nace pendiente
select estado = 'pendiente' from cita_inspeccion where oportunidad_id = '00000000-0000-0000-0000-000000000006';
-- @error cita: franja invalida
insert into cita_inspeccion (persona_id, oportunidad_id, vehiculo_id, sede_id, dia_preferido, franja) values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', current_date, 'noche');
-- @error cita: sin oportunidad
insert into cita_inspeccion (persona_id, vehiculo_id, sede_id, dia_preferido, franja) values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', current_date, 'tarde');
-- @ok crm: interaccion sin autor e historial de etapa sin actor (hasta el modulo 001)
insert into interaccion (id, persona_id, oportunidad_id, canal, direccion, nota, ocurrido_en, idempotency_key) values ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000006', 'whatsapp', 'saliente', 'nota de ensayo', now(), 'ensayo-1');
insert into etapa_historial (oportunidad_id, etapa_anterior, etapa_nueva) values ('00000000-0000-0000-0000-000000000006', null, 'nuevo');
-- @error crm: canal de interaccion fuera de la maqueta
insert into interaccion (persona_id, canal, direccion, nota, ocurrido_en) values ('00000000-0000-0000-0000-000000000004', 'visita_sede', 'saliente', 'x', now());
-- @error crm: reintento con la misma Idempotency-Key
insert into interaccion (persona_id, canal, direccion, nota, ocurrido_en, idempotency_key) values ('00000000-0000-0000-0000-000000000004', 'llamada', 'saliente', 'x', now(), 'ensayo-1');
-- @error append-only: UPDATE de interaccion (CA-010.4)
update interaccion set nota = 'editada' where id = '00000000-0000-0000-0000-000000000007';
-- @error append-only: DELETE de interaccion (CA-010.4)
delete from interaccion where id = '00000000-0000-0000-0000-000000000007';
-- @error append-only: UPDATE de etapa_historial
update etapa_historial set nota = 'x';
-- @error append-only: TRUNCATE de interaccion
truncate interaccion;
-- @error append-only: TRUNCATE de etapa_historial
truncate etapa_historial;
-- @error append-only: TRUNCATE de la auditoria
truncate auditoria_evento;
-- @error append-only: TRUNCATE ... CASCADE desde persona
truncate persona cascade;
-- @error append-only: borrar oportunidad referenciada por historial (RESTRICT)
delete from oportunidad where id = '00000000-0000-0000-0000-000000000006';
-- @ok ledger: cuentas de ensayo
insert into cuenta_contable (id, codigo, nombre, tipo, naturaleza, nivel, moneda) values
  ('00000000-0000-0000-0000-000000000008', 'ENS.1', 'Caja ensayo', 'activo', 'deudora', 1, 'USD'),
  ('00000000-0000-0000-0000-000000000009', 'ENS.2', 'Ingreso ensayo', 'ingreso', 'acreedora', 1, 'USD');
-- @ok ledger: asiento cuadrado se confirma (CA-007.2)
set constraints all deferred;
insert into asiento (id, transaccion_ref, modulo_origen, descripcion, fecha_asiento, creado_por) values ('00000000-0000-0000-0000-00000000000a', 'ENS-1', 'ajuste', 'ensayo', current_date, '00000000-0000-0000-0000-000000000001');
insert into linea_asiento (asiento_id, cuenta_id, debe, haber, moneda, tasa_bcv, fecha_tasa) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000008', 100, 0, 'USD', 1, current_date),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000009', 0, 100, 'USD', 1, current_date);
set constraints all immediate;
-- @error ledger: asiento descuadrado
set constraints all deferred;
insert into asiento (id, transaccion_ref, modulo_origen, descripcion, fecha_asiento, creado_por) values ('00000000-0000-0000-0000-00000000000b', 'ENS-2', 'ajuste', 'ensayo', current_date, '00000000-0000-0000-0000-000000000001');
insert into linea_asiento (asiento_id, cuenta_id, debe, haber, moneda, tasa_bcv, fecha_tasa) values
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000008', 100, 0, 'USD', 1, current_date),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000009', 0, 90, 'USD', 1, current_date);
set constraints all immediate;
-- @error ledger: asiento con una sola linea
set constraints all deferred;
insert into asiento (id, transaccion_ref, modulo_origen, descripcion, fecha_asiento, creado_por) values ('00000000-0000-0000-0000-00000000000c', 'ENS-3', 'ajuste', 'ensayo', current_date, '00000000-0000-0000-0000-000000000001');
insert into linea_asiento (asiento_id, cuenta_id, debe, haber, moneda, tasa_bcv, fecha_tasa) values
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000008', 100, 0, 'USD', 1, current_date);
set constraints all immediate;
-- @error ledger: asiento sin lineas
set constraints all deferred;
insert into asiento (id, transaccion_ref, modulo_origen, descripcion, fecha_asiento, creado_por) values ('00000000-0000-0000-0000-00000000000d', 'ENS-4', 'ajuste', 'ensayo', current_date, '00000000-0000-0000-0000-000000000001');
set constraints all immediate;
-- @error ledger: cuadra en total pero no por moneda
set constraints all deferred;
insert into asiento (id, transaccion_ref, modulo_origen, descripcion, fecha_asiento, creado_por) values ('00000000-0000-0000-0000-00000000000e', 'ENS-5', 'ajuste', 'ensayo', current_date, '00000000-0000-0000-0000-000000000001');
insert into linea_asiento (asiento_id, cuenta_id, debe, haber, moneda, tasa_bcv, fecha_tasa) values
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000008', 100, 0, 'USD', 1, current_date),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000009', 0, 100, 'VES', 1, current_date);
set constraints all immediate;
-- @error ledger: linea con debe y haber a la vez
insert into linea_asiento (asiento_id, cuenta_id, debe, haber, moneda, tasa_bcv, fecha_tasa) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000008', 5, 5, 'USD', 1, current_date);
-- @error ledger: UPDATE de un asiento confirmado
update asiento set descripcion = 'retocado' where id = '00000000-0000-0000-0000-00000000000a';
-- @error ledger: DELETE de una linea
delete from linea_asiento where asiento_id = '00000000-0000-0000-0000-00000000000a';
-- @error ledger: TRUNCATE del ledger
truncate linea_asiento;
-- @error cifras: plazo de credito cero
insert into solicitud_credito (numero_solicitud, oportunidad_id, persona_id, vehiculo_id, monto_solicitado, cuota_inicial, plazo_meses, tasa_bcv, fecha_tasa, datos_laborales_json, datos_financieros_json, capacidad_pago_mensual) values ('ENS-S1', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 1, 0, 0, 1, current_date, '{}', '{}', 0);
-- @ok cifras: un plazo que no estaba en la lista inventada (36 meses) ya no se rechaza
insert into solicitud_credito (numero_solicitud, oportunidad_id, persona_id, vehiculo_id, monto_solicitado, cuota_inicial, plazo_meses, tasa_bcv, fecha_tasa, datos_laborales_json, datos_financieros_json, capacidad_pago_mensual) values ('ENS-S2', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 1, 0, 36, 1, current_date, '{}', '{}', 0);
-- @error dinero: limite aprobado con moneda pero sin tasa ni fecha
insert into decision_riesgo (solicitud_id, score_interno, riesgo_nivel, resultado, limite_aprobado, justificacion, moneda)
select id, 1, 'bajo', 'aprobado', 100, 'ensayo', 'USD' from solicitud_credito where numero_solicitud = 'ENS-S2';
-- @ok dinero: limite aprobado con moneda, tasa y fecha
insert into decision_riesgo (solicitud_id, score_interno, riesgo_nivel, resultado, limite_aprobado, justificacion, moneda, tasa_bcv, fecha_tasa)
select id, 1, 'bajo', 'aprobado', 100, 'ensayo', 'USD', 1, current_date from solicitud_credito where numero_solicitud = 'ENS-S2';
-- @error catalogo: etapa abierta sin umbral de estancamiento
insert into catalogo_etapa (codigo, nombre, orden, es_terminal) values ('ensayo_sin_umbral', 'Ensayo', 99, false);
-- @error catalogo: etapa terminal con umbral
insert into catalogo_etapa (codigo, nombre, orden, es_terminal, umbral_estancada_dias) values ('ensayo_terminal', 'Ensayo', 98, true, 5);
-- @verdad inventario: sede unica Distrito Capital, sin direccion inventada (D-23)
select exists (select 1 from sede where codigo = 'DC' and nombre = 'Distrito Capital' and direccion is null);
-- @verdad inventario: un alta sin codigo recibe el siguiente WAM- de la secuencia
select codigo ~ '^WAM-[0-9]{5}$' from vehiculo where id = '00000000-0000-0000-0000-000000000003';
-- @verdad acceso: wamma_app usa la secuencia de codigos de inventario
select has_sequence_privilege('wamma_app', format('%I.vehiculo_codigo_seq', current_schema()), 'USAGE');
-- @error inventario: codigo con otro formato
update vehiculo set codigo = 'X-1' where id = '00000000-0000-0000-0000-000000000003';
-- @error inventario: VIN en minusculas
update vehiculo set vin = 'abc123' where id = '00000000-0000-0000-0000-000000000003';
-- @error inventario: carroceria fuera de las de la maqueta
update vehiculo set carroceria = 'limusina' where id = '00000000-0000-0000-0000-000000000003';
-- @ok inventario: placa y adquisicion opcionales (D-12), con codigo de demostracion
insert into vehiculo (id, codigo, vin, marca, modelo, anio, color, kilometraje, transmision, combustible, carroceria, traccion, puestos, sede_id, es_demostracion)
select '00000000-0000-0000-0000-00000000000f', 'veh-099', 'ENSAYO00000000002', 'Marca', 'Modelo', 2019, '#303F9F', 2000, 'automatica', 'gasolina', 'suv', '4x4', 7, id, true from sede where codigo = 'DC';
-- @error inventario: adquisicion con precio pero sin moneda, tasa ni fecha
update vehiculo set precio_adquisicion = 1000 where id = '00000000-0000-0000-0000-00000000000f';
-- @ok inventario: adquisicion completa en euros
update vehiculo set precio_adquisicion = 1000, moneda_adquisicion = 'EUR', tasa_bcv_adquisicion = 45.12345678, fecha_tasa_adquisicion = current_date where id = '00000000-0000-0000-0000-00000000000f';
-- @ok publicacion: borrador en euros, sin tasa todavia
insert into publicacion (id, vehiculo_id, titulo, precio_venta, moneda, estado, etiqueta) values ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-00000000000f', 'Marca Modelo 2019', 8900, 'EUR', 'borrador', 'recien_ingresado');
-- @error publicacion: publicada sin fijar la tasa
update publicacion set estado = 'publicado' where id = '00000000-0000-0000-0000-000000000010';
-- @ok publicacion: publicada con la tasa y su fecha
update publicacion set estado = 'publicado', tasa_bcv = 45.12345678, fecha_tasa = current_date, publicado_en = now() where id = '00000000-0000-0000-0000-000000000010';
-- @error publicacion: precio en dolares (D-21)
insert into publicacion (vehiculo_id, titulo, precio_venta, moneda, estado) values ('00000000-0000-0000-0000-000000000003', 'x', 1, 'USD', 'borrador');
-- @error publicacion: sin moneda declarada
insert into publicacion (vehiculo_id, titulo, precio_venta, estado) values ('00000000-0000-0000-0000-000000000003', 'x', 1, 'borrador');
-- @error publicacion: sin estado declarado
insert into publicacion (vehiculo_id, titulo, precio_venta, moneda) values ('00000000-0000-0000-0000-000000000003', 'x', 1, 'EUR');
-- @error publicacion: etiqueta fuera de la maqueta
update publicacion set etiqueta = 'oferta' where id = '00000000-0000-0000-0000-000000000010';
-- @ok fotos: principal con miniatura y dimensiones
insert into publicacion_foto (publicacion_id, clave, clave_miniatura, ancho, alto, orden, es_principal) values ('00000000-0000-0000-0000-000000000010', 'vehiculos/veh-099/a-1600.jpg', 'vehiculos/veh-099/a-640.jpg', 1600, 1200, 0, true);
-- @error fotos: dos principales en la misma publicacion
insert into publicacion_foto (publicacion_id, clave, clave_miniatura, ancho, alto, orden, es_principal) values ('00000000-0000-0000-0000-000000000010', 'vehiculos/veh-099/b-1600.jpg', 'vehiculos/veh-099/b-640.jpg', 1600, 1200, 1, true);
-- @error fotos: orden fuera de las diez posiciones
insert into publicacion_foto (publicacion_id, clave, clave_miniatura, ancho, alto, orden) values ('00000000-0000-0000-0000-000000000010', 'vehiculos/veh-099/c-1600.jpg', 'vehiculos/veh-099/c-640.jpg', 1600, 1200, 10);
-- @error fotos: credito sin licencia
insert into publicacion_foto (publicacion_id, clave, clave_miniatura, ancho, alto, orden, credito_autor) values ('00000000-0000-0000-0000-000000000010', 'vehiculos/veh-099/d-1600.jpg', 'vehiculos/veh-099/d-640.jpg', 1600, 1200, 2, 'Autor');
-- @ok fotos: foto referencial con autor, licencia y origen (D-25)
insert into publicacion_foto (publicacion_id, clave, clave_miniatura, ancho, alto, orden, credito_autor, credito_licencia, credito_origen) values ('00000000-0000-0000-0000-000000000010', 'vehiculos/veh-099/e-1600.jpg', 'vehiculos/veh-099/e-640.jpg', 1000, 750, 1, 'Autor', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/');
-- @error inspeccion: sin inspector fuera de la carga inicial
insert into inspeccion (vehiculo_id, estado, origen) values ('00000000-0000-0000-0000-00000000000f', 'certificada', 'manual');
-- @error inspeccion: sin origen declarado
insert into inspeccion (vehiculo_id, inspector_id, estado) values ('00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000001', 'iniciada');
-- @ok inspeccion: carga inicial sin inspector
insert into inspeccion (id, vehiculo_id, estado, resultado, origen) values ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-00000000000f', 'certificada', 'con_observaciones', 'carga_inicial');
-- @ok inspeccion: imperfeccion con ubicacion y posicion en el diagrama
insert into inspeccion_punto (inspeccion_id, codigo_punto, categoria, nombre_punto, resultado, severidad, zona, ubicacion, posicion_x, posicion_y, notas) values ('00000000-0000-0000-0000-000000000011', 'IMP-01', 'estetica', 'Rayon', 'no_conforme', 'leve', 'exterior', 'Puerta trasera izquierda', 35.5, 60, 'Rayon superficial');
-- @error inspeccion: imperfeccion fuera del diagrama
insert into inspeccion_punto (inspeccion_id, codigo_punto, categoria, nombre_punto, resultado, posicion_x, posicion_y) values ('00000000-0000-0000-0000-000000000011', 'IMP-02', 'estetica', 'Abolladura', 'no_conforme', 120, 50);
-- @ok tasa: la del euro y la del dolar del mismo dia
insert into tasa_cambio_bcv (fecha, moneda, tasa_ves, fuente) values (current_date, 'EUR', 45.12345678, 'BCV'), (current_date, 'USD', 40.5, 'BCV');
-- @verdad tasa: conserva 8 decimales
select tasa_ves = 45.12345678 from tasa_cambio_bcv where fecha = current_date and moneda = 'EUR';
-- @error tasa: la misma fecha y moneda dos veces
insert into tasa_cambio_bcv (fecha, moneda, tasa_ves, fuente) values (current_date, 'EUR', 46, 'BCV');
-- @error tasa: el bolivar no tiene tasa contra si mismo
insert into tasa_cambio_bcv (fecha, moneda, tasa_ves, fuente) values (current_date - 1, 'VES', 1, 'BCV');
