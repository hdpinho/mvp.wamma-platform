import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  avisoDictamen,
  avisoEnlaceFinanciamiento,
  avisoRecaudosPendientes,
  enlaceCorreo,
  enlaceWhatsApp,
  textoAvisoCredito,
} from './avisos.ts';

test('el enlace de WhatsApp lleva el número venezolano normalizado y el texto codificado', () => {
  const url = enlaceWhatsApp('0414-1234567', 'Hola, ¿cómo estás?');
  assert.equal(url, `https://wa.me/584141234567?text=${encodeURIComponent('Hola, ¿cómo estás?')}`);
});

test('el enlace de correo codifica el asunto y el cuerpo', () => {
  const url = enlaceCorreo('ana@ejemplo.invalid', 'WAMMA · Hola', 'Línea 1\nLínea 2');
  assert.ok(url.startsWith('mailto:ana@ejemplo.invalid?subject='));
  assert.ok(url.includes(encodeURIComponent('Línea 1\nLínea 2')));
});

test('los tres avisos del dictamen son los textos aprobados por el PO (D-72)', () => {
  const aprobada = textoAvisoCredito('aprobada', 'Lucía', 'SOL-2026-0002', 'Toyota Yaris 2018');
  assert.equal(
    aprobada?.texto,
    '¡Hola Lucía! Tu solicitud de financiamiento SOL-2026-0002 para el Toyota Yaris 2018 fue aprobada. Te escribimos para coordinar los siguientes pasos de tu compra.',
  );
  const rechazada = textoAvisoCredito('rechazada', 'Lucía', 'SOL-2026-0002', 'Toyota Yaris 2018');
  assert.match(rechazada?.texto ?? '', /no pudimos aprobarla/);
  const condicionada = textoAvisoCredito('condicionada', 'Lucía', 'SOL-2026-0002', 'Toyota Yaris 2018');
  assert.match(condicionada?.texto ?? '', /necesita información adicional/);
});

test('un estado sin texto aprobado no genera aviso (no se inventa uno)', () => {
  assert.equal(textoAvisoCredito('enviada', 'Lucía', 'SOL-1', 'Auto'), null);
  assert.equal(avisoDictamen('en_evaluacion', 'Lucía', 'SOL-1', 'Auto', '04141234567', ''), null);
});

test('el aviso del dictamen sale por WhatsApp y por correo con el mismo texto, sin cifras del crédito', () => {
  const aviso = avisoDictamen('aprobada', 'Lucía', 'SOL-2026-0002', 'Toyota Yaris 2018', '04141234567', 'lucia@ejemplo.invalid');
  assert.ok(aviso);
  assert.equal(aviso.telefono, '04141234567');
  assert.ok(aviso.cuerpo.startsWith(aviso.texto));
  assert.match(aviso.asunto, /SOL-2026-0002/);
  assert.doesNotMatch(aviso.texto, /€|EUR|\d+[.,]\d{2}/, 'la capa comercial no recibe cifras del expediente (CA-010.7)');
});

test('al condicionar, el aviso suma el enlace para completar los documentos', () => {
  const aviso = avisoRecaudosPendientes(
    'Lucía',
    'SOL-2026-0002',
    'Toyota Yaris 2018',
    'http://localhost:5174/solicitud-credito?vehiculo=veh-001&enlace=ABC',
    '04141234567',
    '',
  );
  assert.match(aviso.texto, /necesita información adicional/);
  assert.ok(aviso.texto.endsWith('enlace=ABC'));
  assert.match(aviso.cuerpo, /no lo compartas/);
});

test('el enlace de financiamiento conserva el texto que ya usaba el asesor', () => {
  const aviso = avisoEnlaceFinanciamiento('Lucía', 'Toyota Yaris 2018', 'http://x/y', '04141234567', 'lucia@ejemplo.invalid');
  assert.equal(
    aviso.texto,
    '¡Hola Lucía! Gracias por tu visita a WAMMA. Este es tu enlace personal para solicitar el financiamiento del Toyota Yaris 2018: http://x/y',
  );
  assert.equal(aviso.asunto, 'WAMMA · Tu enlace para solicitar el financiamiento');
});
