import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockVehiculos } from '../mocks/vehiculos';
import { CARROCERIAS } from '../types/vehiculo';
import { TarjetaVehiculo } from '../components/TarjetaVehiculo';
import { Seccion } from '../components/Seccion';
import { SimuladorCuota } from '../components/SimuladorCuota';
import { NotaSimulada } from '../components/NotaSimulada';
import { Boton } from '../components/Boton';

interface C0HomeProps {
  rateBCV: number;
}

/** Los tres caminos de entrada del modelo: comprar, vender y permutar. */
const ACCESOS = [
  {
    titulo: 'Compra un auto',
    detalle: 'Vehículos certificados con inspección de 240 puntos.',
    a: '/catalogo',
    icono: (
      <>
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </>
    ),
  },
  {
    titulo: 'Vende tu auto',
    detalle: 'Cotización instantánea con nuestro motor K-Price.',
    a: '/vender',
    icono: (
      <>
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
      </>
    ),
  },
  {
    titulo: 'Cambia tu auto',
    detalle: 'Entrega el tuyo como parte de pago del próximo.',
    a: '/vender?modo=cambio',
    icono: (
      <>
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </>
    ),
  },
];

/** Pasos del recorrido de compra. Reflejan el flujo de los módulos 002, 006 y 005. */
const PASOS = [
  {
    titulo: 'Encuentra tu auto',
    detalle: 'Explora la vitrina y filtra por precio, cuota mensual, marca o sede.',
  },
  {
    titulo: 'Verifica tu identidad',
    detalle: 'Validamos tu cédula y RIF para habilitar la compra y el financiamiento.',
  },
  {
    titulo: 'Elige cómo pagar',
    detalle: 'De contado, financiado a cuotas o bajo suscripción con opción de compra.',
  },
];

export const C0_Home: React.FC<C0HomeProps> = ({ rateBCV }) => {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');

  /** Respeta la preferencia del sistema de reducir animaciones. */
  const menosMovimiento = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const destacados = mockVehiculos.filter((v) => v.certificado).slice(0, 4);

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(busqueda.trim() ? `/catalogo?q=${encodeURIComponent(busqueda.trim())}` : '/catalogo');
  };

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="hero">
        {/*
          Capa base: la fotografía. Se pinta de inmediato y queda de respaldo si
          el video no llega a cargar o el visitante pidió menos movimiento.
        */}
        <picture>
          <source media="(max-width: 640px)" srcSet="/hero/carro-playa-movil.webp" />
          <img
            src="/hero/carro-playa.webp"
            alt=""
            aria-hidden="true"
            /* Es la primera imagen visible: se carga con prioridad, no en diferido */
            fetchPriority="high"
            decoding="async"
            className="hero-foto"
          />
        </picture>

        {/*
          Capa de video, encima de la foto. Silenciado y en bucle: es la única
          forma en que los navegadores permiten la reproducción automática.
          No se monta si el visitante pidió reducir el movimiento, así tampoco
          gasta sus datos.
        */}
        {!menosMovimiento && (
          <video
            className="hero-video"
            src="/video/portada-wamma.mp4"
            poster="/hero/carro-playa.webp"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
          />
        )}

        {/*
          Velo de contraste. Sobre video no se puede medir el fondo real, así que
          está calibrado contra el PEOR CASO posible —un fotograma blanco puro—:
          con 0.72 de opacidad el texto blanco queda en 7.4:1, por encima del
          4.5:1 que exige AA, sea cual sea el contenido del video.
        */}
        <div className="hero-velo" />

        <div className="hero-contenido">
          <h1
            style={{
              color: 'var(--blanco)',
              fontSize: 'clamp(26px, 3.4vw, 44px)',
              lineHeight: 1.08,
              marginBottom: 'var(--space-md)',
              textShadow: '0 2px 12px rgba(0,0,0,0.35)',
            }}
          >
            Certificado, financiado y tuyo hoy mismo. Búscalo aquí.
          </h1>
          <p
            style={{
              color: 'var(--blanco)',
              opacity: 0.94,
              fontSize: '17px',
              marginBottom: 'var(--space-xl)',
              maxWidth: '46ch',
              textShadow: '0 1px 8px rgba(0,0,0,0.4)',
            }}
          >
            Compra, vende y financia vehículos usados certificados en Venezuela. Todo bajo un mismo
            techo.
          </p>

          {/* Buscador rápido */}
          <form
            onSubmit={buscar}
            style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', maxWidth: '560px' }}
          >
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Busca por marca o modelo. Ej. Toyota Corolla"
              aria-label="Buscar vehículos"
              style={{
                flex: '1 1 240px',
                padding: 'var(--space-md) var(--space-lg)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-sans)',
                fontSize: '15px',
                color: 'var(--texto-primario)',
              }}
            />
            <Boton type="submit" style={{ padding: '12px 32px', fontSize: '15px' }}>
              Ver autos
            </Boton>
          </form>
        </div>

        <style>{`
          .hero {
            position: relative;
            overflow: hidden;
            border-radius: var(--radius-lg);
            margin-bottom: var(--space-xxxl);
            min-height: 440px;
            display: flex;
            align-items: center;
            background-color: #221B16;
          }
          .hero-foto, .hero-video {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center 55%;
          }
          /* El video es decorativo: no debe recibir foco ni puntero */
          .hero-video { pointer-events: none; }
          /*
            Velo de contraste calibrado sobre esta fotografía en concreto:
            se mantiene alto hasta el 40%, cae a 0.26 en el 52% y deja limpia
            la placa WAMMA (ocupa del 53% al 58%). Medido: texto blanco a
            7.45:1 con la columna al 44%. Si se cambia la foto hay que volver
            a medir — con el velo anterior el texto caía a 2.88:1.
          */
          .hero-velo {
            position: absolute;
            inset: 0;
            background:
              linear-gradient(90deg,
                rgba(24,18,13,0.90) 0%,
                rgba(24,18,13,0.80) 30%,
                rgba(24,18,13,0.72) 44%,
                rgba(24,18,13,0.34) 62%,
                rgba(24,18,13,0.12) 100%);
          }
          .hero-contenido {
            position: relative;
            padding: var(--space-xxxl) var(--space-xxl);
            max-width: 44%;
          }

          /* Por debajo de 900px la columna del 44% es demasiado angosta:
             el texto pasa al pie, sobre la carretera, que es zona oscura. */
          @media (max-width: 900px) {
            .hero { min-height: 480px; align-items: flex-end; }
            .hero-foto { object-position: center 42%; }
            .hero-velo {
              background:
                linear-gradient(to top,
                  rgba(24,18,13,0.94) 0%,
                  rgba(24,18,13,0.88) 40%,
                  rgba(24,18,13,0.72) 56%,
                  rgba(24,18,13,0.35) 76%,
                  rgba(24,18,13,0.12) 100%);
            }
            .hero-contenido { max-width: 100%; padding: var(--space-xl); }
          }
        `}</style>
      </section>

      {/* ── Tres accesos ─────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--space-lg)',
          marginBottom: 'var(--space-xxxl)',
        }}
      >
        {ACCESOS.map((acceso) => (
          <button
            key={acceso.titulo}
            type="button"
            onClick={() => navigate(acceso.a)}
            style={{
              textAlign: 'left',
              cursor: 'pointer',
              backgroundColor: 'var(--blanco)',
              border: '1px solid var(--borde-claro)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-xl)',
              fontFamily: 'var(--font-sans)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-sm)',
            }}
          >
            <span
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--naranja-50)',
                color: 'var(--naranja-500)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {acceso.icono}
              </svg>
            </span>
            <span style={{ fontSize: '17px', fontWeight: 700 }}>{acceso.titulo}</span>
            <span style={{ fontSize: '13px', color: 'var(--texto-secundario)' }}>
              {acceso.detalle}
            </span>
          </button>
        ))}
      </div>

      {/* ── Explora por carrocería ───────────────────────────── */}
      <Seccion
        titulo="Explora por tipo"
        bajada="Encuentra el vehículo que se ajusta a tu día a día."
        enlace={{ texto: 'Ver toda la vitrina', a: '/catalogo' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 'var(--space-md)',
          }}
        >
          {CARROCERIAS.filter((tipo) =>
            mockVehiculos.some((v) => v.carroceria === tipo),
          ).map((tipo) => {
            const cantidad = mockVehiculos.filter((v) => v.carroceria === tipo).length;
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => navigate(`/catalogo?carroceria=${encodeURIComponent(tipo)}`)}
                style={{
                  cursor: 'pointer',
                  backgroundColor: 'var(--blanco)',
                  border: '1px solid var(--borde-claro)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-lg)',
                  fontFamily: 'var(--font-sans)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '15px', fontWeight: 700 }}>{tipo}</div>
                <div style={{ fontSize: '12px', color: 'var(--texto-mudo)' }}>
                  {cantidad} {cantidad === 1 ? 'unidad' : 'unidades'}
                </div>
              </button>
            );
          })}
        </div>
      </Seccion>

      {/* ── Destacados ───────────────────────────────────────── */}
      <Seccion
        titulo="Certificados y listos para entrega"
        bajada="Cada unidad supera la inspección de 240 puntos y la validación legal de sus documentos."
        enlace={{ texto: 'Ver todos', a: '/catalogo' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: 'var(--space-lg)',
          }}
        >
          {destacados.map((veh) => (
            <TarjetaVehiculo
              key={veh.id}
              vehiculo={veh}
              rateBCV={rateBCV}
              onSelect={(id) => navigate(`/vehiculo/${id}`)}
            />
          ))}
        </div>
      </Seccion>

      {/* ── Proceso en 3 pasos ───────────────────────────────── */}
      <Seccion titulo="Cómo funciona" bajada="Tres pasos desde la vitrina hasta las llaves.">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--space-lg)',
          }}
        >
          {PASOS.map((paso, i) => (
            <div
              key={paso.titulo}
              style={{
                backgroundColor: 'var(--blanco)',
                border: '1px solid var(--borde-claro)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-xl)',
              }}
            >
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'var(--naranja-500)',
                  color: 'var(--blanco)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  marginBottom: 'var(--space-md)',
                }}
              >
                {i + 1}
              </div>
              <h3 style={{ fontSize: '16px', marginBottom: 'var(--space-xs)' }}>{paso.titulo}</h3>
              <p style={{ fontSize: '13px', color: 'var(--texto-secundario)' }}>{paso.detalle}</p>
            </div>
          ))}
        </div>
      </Seccion>

      {/* ── Financiamiento ───────────────────────────────────── */}
      <Seccion
        titulo="Paga tu próximo auto a cuotas"
        bajada="Financiamiento propio de WAMMA. Calcula tu cuota antes de solicitar."
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 'var(--space-xl)',
            alignItems: 'start',
          }}
        >
          <SimuladorCuota
            precioEditable
            rateBCV={rateBCV}
            onSolicitar={(datos) =>
              navigate('/financiamiento', {
                state: {
                  montoFinanciado: Math.round(datos.montoFinanciado),
                  plazo: datos.plazo,
                  cuotaInicialUSD: Math.round(datos.cuotaInicialUSD),
                },
              })
            }
          />

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-lg)',
              padding: 'var(--space-xl)',
              backgroundColor: 'var(--blanco)',
              border: '1px solid var(--borde-claro)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <h3 style={{ fontSize: '18px' }}>Financiamiento bajo el mismo techo</h3>
            <p style={{ fontSize: '14px', color: 'var(--texto-secundario)' }}>
              WAMMA evalúa, aprueba y cobra su propio crédito. No dependes de un banco externo para
              llevarte el carro.
            </p>
            <ul
              style={{
                listStyle: 'none',
                display: 'grid',
                gap: 'var(--space-md)',
                fontSize: '14px',
                color: 'var(--texto-secundario)',
              }}
            >
              {[
                'Precios en USD con equivalencia a tasa BCV en cada operación.',
                'Cuotas fijas con tabla de amortización visible desde el primer día.',
                'Seguimiento de tu crédito y tus pagos en Mi Panel.',
              ].map((item) => (
                <li key={item} style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--naranja-500)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    style={{ flexShrink: 0, marginTop: '2px' }}
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Seccion>

      {/* ── Suscripción OCN (Fase 2) ─────────────────────────── */}
      <Seccion
        titulo="¿Prefieres suscribirte en vez de comprar?"
        bajada="Paga una cuota mensual, usa el vehículo y decide más adelante si te quedas con él."
        enlace={{ texto: 'Conocer la suscripción', a: '/suscripcion' }}
      >
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'var(--negro)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-xxl) var(--space-xl)',
            color: 'var(--blanco)',
          }}
        >
          <div style={{ position: 'relative', maxWidth: '620px' }}>
            <span
              style={{
                display: 'inline-block',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                backgroundColor: 'var(--naranja-500)',
                color: 'var(--blanco)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                marginBottom: 'var(--space-md)',
              }}
            >
              Suscripción OCN
            </span>
            <h3 style={{ color: 'var(--blanco)', fontSize: '24px', marginBottom: 'var(--space-sm)' }}>
              El carro que necesitas, sin comprarlo de una vez
            </h3>
            <p style={{ fontSize: '15px', opacity: 0.85, marginBottom: 'var(--space-lg)' }}>
              Una cuota mensual que incluye el uso del vehículo, con opción de compra al final del
              período. Es el modelo propio de WAMMA, no existe en el resto del mercado.
            </p>
            <Boton variant="primary" onClick={() => navigate('/suscripcion')}>
              Ver planes de suscripción
            </Boton>
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-lg)' }}>
          <NotaSimulada variante="bloque">
            La suscripción / rent-to-own (OCN) corresponde al módulo 10, planificado para la Fase 2.
            Se muestra aquí como maqueta visual por decisión del Product Owner. Las condiciones y
            montos no están definidos.
          </NotaSimulada>
        </div>
      </Seccion>
    </div>
  );
};
