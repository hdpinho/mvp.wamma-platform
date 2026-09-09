import React, { useState } from 'react';
import { PasosKYC } from '../components/PasosKYC';
import { Campo } from '../components/Campo';
import { Boton } from '../components/Boton';
import type { UsuarioData } from '../mocks/usuario';

interface C4OnboardingKYCProps {
  setKycLevel: (level: 'básico' | 'verificado') => void;
  usuario: UsuarioData;
  setUsuario: React.Dispatch<React.SetStateAction<UsuarioData>>;
}

export const C4_OnboardingKYC: React.FC<C4OnboardingKYCProps> = ({
  setKycLevel,
  usuario,
  setUsuario,
}) => {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form Step 1 States
  const [nombre, setNombre] = useState(usuario.nombre);
  const [correo, setCorreo] = useState(usuario.correo);
  const [telefono, setTelefono] = useState(usuario.telefono);

  // Form Step 2 States (OCR)
  const [cedulaFile, setCedulaFile] = useState<string | null>(null);
  const [rifFile, setRifFile] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<{ cedula: string; RIF: string; nombre: string } | null>(null);

  // Form Step 3 States (Facial Scan)
  const [facialStep, setFacialStep] = useState<'idle' | 'scanning' | 'blink' | 'smile' | 'done'>('idle');

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !correo || !telefono) return;
    
    setUsuario({
      ...usuario,
      nombre,
      correo,
      telefono,
    });
    setStep(2);
  };

  const handleSimulateOCR = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setCedulaFile('cedula_scanned.jpg');
      setRifFile('rif_scanned.jpg');
      setOcrResult({
        cedula: 'V-18.456.789',
        RIF: 'J-41234567-8',
        nombre: nombre,
      });
      setIsProcessing(false);
    }, 1500);
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ocrResult) return;
    setStep(3);
  };

  const handleStartFacialScan = () => {
    setFacialStep('scanning');
    
    // Step 3.1 Scanning
    setTimeout(() => {
      setFacialStep('blink');
      
      // Step 3.2 Blink challenge
      setTimeout(() => {
        setFacialStep('smile');
        
        // Step 3.3 Smile challenge
        setTimeout(() => {
          setFacialStep('done');
          // Promote User to Verified!
          setKycLevel('verificado');
          setUsuario({
            ...usuario,
            kycLevel: 'verificado',
            cedula: ocrResult?.cedula,
            rif: ocrResult?.RIF,
          });
        }, 1500);
      }, 1500);
    }, 2000);
  };

  const handleRestart = () => {
    setStep(1);
    setCedulaFile(null);
    setRifFile(null);
    setOcrResult(null);
    setFacialStep('idle');
  };

  return (
    <div style={{ maxWidth: '550px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <div style={{ textAlign: 'center' }}>
        <h2>Verificación de Identidad (KYC)</h2>
        <p style={{ color: 'var(--texto-secundario)', fontSize: '13px', marginTop: '4px' }}>
          De acuerdo con Sudeban (Res. 119.18), requerimos verificar tu identidad para transacciones crediticias.
        </p>
      </div>

      {/* Stepper component */}
      <PasosKYC currentStep={step} />

      {/* STEP 1: Basic registration */}
      {step === 1 && (
        <form onSubmit={handleStep1Submit} className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Registro de Datos Personales</h3>
          
          <Campo
            label="Nombre Completo"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
          <Campo
            label="Correo Electrónico"
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
          />
          <Campo
            label="Teléfono Móvil"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            required
          />

          <Boton type="submit" variant="primary" fullWidth style={{ marginTop: '12px' }}>
            Continuar
          </Boton>
        </form>
      )}

      {/* STEP 2: OCR Upload & Extraction */}
      {step === 2 && (
        <form onSubmit={handleStep2Submit} className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Carga de Documentos (Cédula y RIF)</h3>
          <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', marginBottom: '16px' }}>
            Sube fotos claras de tu Cédula de Identidad y tu RIF vigente para extraer tu información vía OCR.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: '16px' }}>
            {/* Cedula dropzone */}
            <div
              style={{
                border: '2px dashed var(--borde)',
                borderRadius: 'var(--radius-md)',
                padding: '20px 10px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: cedulaFile ? 'var(--naranja-50)' : 'transparent',
                borderColor: cedulaFile ? 'var(--naranja-500)' : 'var(--borde)',
              }}
              onClick={handleSimulateOCR}
            >
              <span style={{ fontSize: '24px' }}>🪪</span>
              <p style={{ fontSize: '11px', fontWeight: 700, margin: '8px 0 4px 0' }}>Cédula de Identidad</p>
              <p style={{ fontSize: '9px', color: 'var(--texto-mudo)' }}>{cedulaFile ? 'Cédula Cargada ✓' : 'Presiona para subir'}</p>
            </div>

            {/* RIF dropzone */}
            <div
              style={{
                border: '2px dashed var(--borde)',
                borderRadius: 'var(--radius-md)',
                padding: '20px 10px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: rifFile ? 'var(--naranja-50)' : 'transparent',
                borderColor: rifFile ? 'var(--naranja-500)' : 'var(--borde)',
              }}
              onClick={handleSimulateOCR}
            >
              <span style={{ fontSize: '24px' }}>📄</span>
              <p style={{ fontSize: '11px', fontWeight: 700, margin: '8px 0 4px 0' }}>Registro RIF</p>
              <p style={{ fontSize: '9px', color: 'var(--texto-mudo)' }}>{rifFile ? 'RIF Cargado ✓' : 'Presiona para subir'}</p>
            </div>
          </div>

          {isProcessing && (
            <div style={{ textAlign: 'center', padding: '12px', color: 'var(--naranja-700)', fontSize: '12px', fontWeight: 500 }}>
              🤖 Extrayendo datos mediante OCR...
            </div>
          )}

          {ocrResult && (
            <div
              style={{
                backgroundColor: 'var(--superficie)',
                border: '1px solid var(--borde-claro)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                fontSize: '12px',
                marginBottom: '16px',
              }}
            >
              <strong style={{ display: 'block', marginBottom: '8px', fontSize: '13px' }}>Datos Extraídos:</strong>
              <div><strong>Nombre:</strong> {ocrResult.nombre}</div>
              <div><strong>Cédula:</strong> {ocrResult.cedula}</div>
              <div><strong>RIF:</strong> {ocrResult.RIF}</div>
              <span style={{ color: 'var(--exito-texto)', display: 'block', marginTop: '6px', fontWeight: 700 }}>
                ✓ Datos validados y correctos
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <Boton type="button" variant="secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>
              Atrás
            </Boton>
            <Boton type="submit" variant="primary" style={{ flex: 2 }} disabled={!ocrResult}>
              Continuar
            </Boton>
          </div>
        </form>
      )}

      {/* STEP 3: Facial scan */}
      {step === 3 && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Reconocimiento Facial (Prueba de Vida)</h3>
          
          {facialStep === 'idle' && (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '180px',
                  height: '180px',
                  borderRadius: '50%',
                  border: '3px solid var(--borde)',
                  margin: '0 auto 24px auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--superficie)',
                  color: 'var(--texto-mudo)',
                  fontSize: '48px',
                }}
              >
                👤
              </div>
              <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', marginBottom: '24px' }}>
                Posiciona tu rostro en el centro del marco para iniciar la prueba biométrica.
              </p>
              <Boton onClick={handleStartFacialScan} variant="primary" fullWidth>
                Iniciar Escaneo Facial
              </Boton>
            </div>
          )}

          {facialStep === 'scanning' && (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '180px',
                  height: '180px',
                  borderRadius: '50%',
                  border: '3px solid var(--naranja-500)',
                  margin: '0 auto 24px auto',
                  position: 'relative',
                  overflow: 'hidden',
                  backgroundColor: '#ECEAE6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '48px',
                }}
              >
                👤
                {/* Scanner bar animation */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    backgroundColor: 'var(--naranja-500)',
                    animation: 'scanAnimation 2s linear infinite',
                  }}
                />
              </div>
              <p style={{ color: 'var(--naranja-700)', fontWeight: 700, fontSize: '14px' }}>
                Escaneando rostro...
              </p>
            </div>
          )}

          {facialStep === 'blink' && (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '180px',
                  height: '180px',
                  borderRadius: '50%',
                  border: '3px solid var(--aviso-texto)',
                  margin: '0 auto 24px auto',
                  backgroundColor: '#FAEEDA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '48px',
                }}
              >
                😉
              </div>
              <p style={{ color: 'var(--aviso-texto)', fontWeight: 700, fontSize: '16px', animation: 'pulse 1s infinite' }}>
                ¡Pestañee ahora!
              </p>
            </div>
          )}

          {facialStep === 'smile' && (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '180px',
                  height: '180px',
                  borderRadius: '50%',
                  border: '3px solid var(--aviso-texto)',
                  margin: '0 auto 24px auto',
                  backgroundColor: '#FAEEDA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '48px',
                }}
              >
                😀
              </div>
              <p style={{ color: 'var(--aviso-texto)', fontWeight: 700, fontSize: '16px', animation: 'pulse 1s infinite' }}>
                ¡Sonría frente a la cámara!
              </p>
            </div>
          )}

          {facialStep === 'done' && (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--exito-fondo)',
                  color: 'var(--exito-texto)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                }}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 style={{ color: 'var(--exito-texto)', marginBottom: '8px' }}>¡Verificación Exitosa!</h3>
              <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', marginBottom: '24px' }}>
                Tu nivel de KYC ahora es **Verificado**. Ya puedes solicitar financiamiento para comprar tu vehículo.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Boton variant="secondary" onClick={handleRestart} style={{ flex: 1 }}>
                  Volver a Empezar
                </Boton>
                <Boton variant="primary" onClick={() => setStep(4)} style={{ flex: 1 }}>
                  Ver Resultados
                </Boton>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success result view */}
      {step === 4 && (
        <div className="card" style={{ padding: '32px 24px', textAlign: 'center', border: '2px solid var(--exito-texto)' }}>
          <h3 style={{ color: 'var(--exito-texto)', fontSize: '20px', marginBottom: '16px' }}>
            ✓ Identidad Completamente Verificada
          </h3>
          
          <div
            style={{
              textAlign: 'left',
              backgroundColor: 'var(--superficie)',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              marginBottom: '24px',
            }}
          >
            <div><strong>Nivel de Acceso:</strong> Verificado (Sudeban Completo)</div>
            <div><strong>Cédula:</strong> {usuario.cedula}</div>
            <div><strong>RIF:</strong> {usuario.rif}</div>
            <div><strong>Fecha de Aprobación:</strong> {new Date().toLocaleDateString()}</div>
          </div>

          <Boton variant="primary" fullWidth onClick={() => setStep(1)}>
            Volver a Formulario de Inicio
          </Boton>
        </div>
      )}

      <style>{`
        @keyframes scanAnimation {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}</style>
    </div>
  );
};
