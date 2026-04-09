/**
 * Script para decodificar el mensaje de historial de apuestas
 */

import { decodeMessage } from '../logic-apps/Aviator/decoder';

// ========== DECODIFICAR MENSAJE DE HISTORIAL ==========

const historyMessage = 'gAA5EgADAAFjAgEAAWEDAA0AAXASAAMAAWMIABFiZXRIaXN0b3J5SGFuZGxlcgABcgT/////AAFwEgAA';

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║        DECODIFICANDO MENSAJE DE HISTORIAL                  ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const buffer = Buffer.from(historyMessage, 'base64');
console.log(`📦 Buffer size: ${buffer.length} bytes`);
console.log(`🔍 Header bytes: ${buffer.slice(0, 10).toString('hex')}\n`);

const decoded = decodeMessage(buffer);

if (decoded) {
  console.log('✅ DECODIFICADO:');
  console.log(JSON.stringify(decoded, null, 2));

  console.log('\n📋 ANÁLISIS:');
  console.log(`  Canal (c): ${decoded.c}`);
  console.log(`  Acción (a): ${decoded.a}`);
  console.log(`  Comando: ${decoded.p?.c}`);
  console.log(`  Request ID (r): ${decoded.p?.r}`);
  console.log(`  Payload interno: ${JSON.stringify(decoded.p?.p)}`);
  
  console.log('\n🎯 ESTRUCTURA DEL MENSAJE DE HISTORIAL:');
  console.log('  Este mensaje solicita el historial de apuestas del usuario');
  console.log('  Comando: "betHistoryHandler"');
  console.log('  Se envía al WebSocket para obtener las apuestas del usuario');
} else {
  console.log('❌ No se pudo decodificar completamente');
  console.log('Intentando análisis manual...');
  
  // Análisis manual byte por byte
  console.log('\n📊 Análisis byte por byte:');
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    const char = byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
    console.log(`  [${i.toString().padStart(2, '0')}] 0x${byte.toString(16).padStart(2, '0')} ${byte.toString().padStart(3, ' ')} '${char}'`);
  }
}
