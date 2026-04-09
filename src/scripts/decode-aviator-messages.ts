/**
 * Script para decodificar mensajes de Aviator capturados
 * Ejecutar con: npx ts-node src/scripts/decode-aviator-messages.ts
 */

import * as zlib from 'zlib';

// ========== COPIA DEL DECODER ==========
class DataStream {
  private buffer: Buffer;
  private byteOffset: number;
  public position: number;
  private byteLength: number;

  constructor(buffer: Buffer, byteOffset: number = 0) {
    this.buffer = buffer;
    this.byteOffset = byteOffset;
    this.position = 0;
    this.byteLength = buffer.length;
  }

  seek(position: number): void {
    this.position = Math.max(0, Math.min(this.byteLength, position));
  }

  isEof(): boolean {
    return this.position >= this.byteLength;
  }

  readInt8(): number {
    const value = this.buffer.readInt8(this.byteOffset + this.position);
    this.position += 1;
    return value;
  }

  readUInt8(): number {
    const value = this.buffer.readUInt8(this.byteOffset + this.position);
    this.position += 1;
    return value;
  }

  readInt16(): number {
    const value = this.buffer.readInt16BE(this.byteOffset + this.position);
    this.position += 2;
    return value;
  }

  readUInt16(): number {
    const value = this.buffer.readUInt16BE(this.byteOffset + this.position);
    this.position += 2;
    return value;
  }

  readInt32(): number {
    const value = this.buffer.readInt32BE(this.byteOffset + this.position);
    this.position += 4;
    return value;
  }

  readInt64(): number {
    const value = this.buffer.readBigInt64BE(this.byteOffset + this.position);
    this.position += 8;
    return Number(value);
  }

  readFloat64(): number {
    const value = this.buffer.readDoubleBE(this.byteOffset + this.position);
    this.position += 8;
    return value;
  }

  readUtf8String(length: number): string {
    const end = this.position + length;
    const stringBytes = this.buffer.slice(this.byteOffset + this.position, this.byteOffset + end);
    this.position = end;
    try {
      return stringBytes.toString('utf8');
    } catch (e: any) {
      console.error(`Error decoding UTF-8 string: ${e.message}`);
      return stringBytes.toString('hex');
    }
  }

  readByteArray(length: number): number[] {
    const end = this.position + length;
    const byteArray = this.buffer.slice(this.byteOffset + this.position, this.byteOffset + end);
    this.position = end;
    return Array.from(byteArray);
  }
}

function decodeSfsObject(ds: DataStream): any {
  const result: any = {};
  const numElements = ds.readUInt16();

  for (let i = 0; i < numElements; i++) {
    const keyLength = ds.readUInt16();
    const key = ds.readUtf8String(keyLength);
    const valueType = ds.readUInt8();
    const value = decodeValue(ds, valueType);
    result[key] = value;
  }
  return result;
}

function decodeSfsArray(ds: DataStream): any[] {
  const result: any[] = [];
  const numElements = ds.readUInt16();

  for (let i = 0; i < numElements; i++) {
    const valueType = ds.readUInt8();
    const value = decodeValue(ds, valueType);
    result.push(value);
  }
  return result;
}

function decodeValue(ds: DataStream, valueType: number): any {
  switch (valueType) {
    case 0x00: return null;
    case 0x01: return !!ds.readUInt8();
    case 0x02: return ds.readInt8();
    case 0x03: return ds.readInt16();
    case 0x04: return ds.readInt32();
    case 0x05: return ds.readInt64();
    case 0x06: return ds.readFloat64();
    case 0x07: return ds.readFloat64();
    case 0x08: {
      const strLength = ds.readUInt16();
      return ds.readUtf8String(strLength);
    }
    case 0x09: {
      const boolLength = ds.readUInt16();
      return Array.from({ length: boolLength }, () => !!ds.readUInt8());
    }
    case 0x0A: {
      const byteLength = ds.readUInt16();
      return ds.readByteArray(byteLength);
    }
    case 0x0B: {
      const shortLength = ds.readUInt16();
      return Array.from({ length: shortLength }, () => ds.readInt16());
    }
    case 0x0C: {
      const intLength = ds.readUInt16();
      return Array.from({ length: intLength }, () => ds.readInt32());
    }
    case 0x0D: {
      const longLength = ds.readUInt16();
      return Array.from({ length: longLength }, () => ds.readInt64());
    }
    case 0x0E: {
      const floatLength = ds.readUInt16();
      return Array.from({ length: floatLength }, () => ds.readFloat64());
    }
    case 0x0F: {
      const doubleLength = ds.readUInt16();
      return Array.from({ length: doubleLength }, () => ds.readFloat64());
    }
    case 0x10: {
      const stringLength = ds.readUInt16();
      return Array.from({ length: stringLength }, () => {
        const len = ds.readUInt16();
        return ds.readUtf8String(len);
      });
    }
    case 0x11: return decodeSfsArray(ds);
    case 0x12: return decodeSfsObject(ds);
    default: throw new Error(`Unsupported data type: 0x${valueType.toString(16)}`);
  }
}

function decodeMessage(binaryData: Buffer): any {
  const ds = new DataStream(binaryData);
  const header = ds.readUInt8();

  if ((header & 0x80) !== 0x80) {
    console.error('Invalid header. Expected binary message (bit 7 = 1).');
    return null;
  }

  const messageLength = ds.readUInt16();
  let bodyData = binaryData.slice(ds.position);
  let decompressedData = bodyData;

  if (bodyData.length > 1 && bodyData.readUInt8(0) === 0x78 && bodyData.readUInt8(1) === 0x9c) {
    try {
      decompressedData = Buffer.from(zlib.inflateSync(bodyData));
    } catch (e: any) {
      console.error('Error decompressing data with zlib:', e.message);
      return null;
    }
  }

  const bodyDs = new DataStream(decompressedData);
  const dataType = bodyDs.readUInt8();

  try {
    if (dataType === 0x12) {
      return decodeSfsObject(bodyDs);
    } else if (dataType === 0x11) {
      return decodeSfsArray(bodyDs);
    }
    console.error(`Unsupported root data type: 0x${dataType.toString(16)}`);
    return null;
  } catch (e: any) {
    console.error('Error decoding body:', e.message);
    return null;
  }
}

// ========== MENSAJES CAPTURADOS ==========

const messages = {
  placeBet1: 'gAB+EgADAAFjAgEAAWEDAA0AAXASAAMAAWMIAApiZXRIYW5kbGVyAAFyBP////8AAXASAAQAA2JldAc/8AAAAAAAAAAKY2xpZW50U2VlZAgAFFVGRE0yNkdBRk1vbU9WVVVPQjN6AAViZXRJZAc/8AAAAAAAAAAHZnJlZUJldAEA',
  placeBet2: 'gAB+EgADAAFjAgEAAWEDAA0AAXASAAMAAWMIAApiZXRIYW5kbGVyAAFyBP////8AAXASAAQAA2JldAc/8AAAAAAAAAAKY2xpZW50U2VlZAgAFHZXYkdxTTUxTU9QR2VtQmRLVVJHAAViZXRJZAdAAAAAAAAAAAAHZnJlZUJldAEA',
  
  autoCashout1: 'gACUEgADAAFjAgEAAWEDAA0AAXASAAMAAWMIAApiZXRIYW5kbGVyAAFyBP////8AAXASAAUAA2JldAdAJAAAAAAAAAAKY2xpZW50U2VlZAgAFFlyQ3FDcEZPbHNOZjVVTFFYZEdHAAViZXRJZAc/8AAAAAAAAAAHZnJlZUJldAEAAAthdXRvQ2FzaE91dAc/+AAAAAAAAA==',
  autoCashout2: 'gACUEgADAAFjAgEAAWEDAA0AAXASAAMAAWMIAApiZXRIYW5kbGVyAAFyBP////8AAXASAAUAA2JldAdAJAAAAAAAAAAKY2xpZW50U2VlZAgAFFVrOVZwRTl2cHhUN09xVXNVR1JQAAViZXRJZAdAAAAAAAAAAAAHZnJlZUJldAEAAAthdXRvQ2FzaE91dAc/+AAAAAAAAA==',
  
  receiveBetsCount: 'gAEZEgADAAFwEgACAAFwEgAFAAliZXRzQ291bnQEAAAAAQAEY29kZQQAAADIABJhY3RpdmVQbGF5ZXJzQ291bnQEAAAAAQAEYmV0cxEAAhIABwADYmV0B0BRBHrhR64UAAlwbGF5ZXJfaWQIAAsxMjQ3NiYmZGVtbwAFYmV0SWQEAAAAAQAJaXNGcmVlQmV0AQAACGN1cnJlbmN5CAADVVNEAAxwcm9maWxlSW1hZ2UIAAlhdi0xMC5wbmcACHVzZXJuYW1lCAAKZGVtb18xODcxMQAWdG9wUGxheWVyUHJvZmlsZUltYWdlcxEAAQgACWF2LTEwLnBuZwABYwgAEXVwZGF0ZUN1cnJlbnRCZXRzAAFhAwANAAFjAgE=',
  
  freeBet1: 'gACdEgADAAFwEgACAAFwEgAHAANiZXQHQFkAAAAAAAAABGNvZGUEAAAAyAAJcGxheWVyX2lkCAALODU5NzkmJmRlbW8AB2ZyZWVCZXQBAAAFYmV0SWQEAAAAAgAMcHJvZmlsZUltYWdlCAAJYXYtMTMucG5nAAh1c2VybmFtZQgACmRlbW9fNTkxMTYAAWMIAANiZXQAAWEDAA0AAWMCAQ==',
  freeBet2: 'gACdEgADAAFwEgACAAFwEgAHAANiZXQHQFkAAAAAAAAABGNvZGUEAAAAyAAJcGxheWVyX2lkCAALODU5NzkmJmRlbW8AB2ZyZWVCZXQBAAAFYmV0SWQEAAAAAQAMcHJvZmlsZUltYWdlCAAJYXYtMTMucG5nAAh1c2VybmFtZQgACmRlbW9fNTkxMTYAAWMIAANiZXQAAWEDAA0AAWMCAQ==',
  
  newBalance1: 'gABKEgADAAFwEgACAAFwEgACAARjb2RlBAAAAMgACm5ld0JhbGFuY2UHQN008zMzMzMAAWMIAApuZXdCYWxhbmNlAAFhAwANAAFjAgE=',
  newBalance2: 'gABKEgADAAFwEgACAAFwEgACAARjb2RlBAAAAMgACm5ld0JhbGFuY2UHQN0b8zMzMzMAAWMIAApuZXdCYWxhbmNlAAFhAwANAAFjAgE=',
};

// ========== FUNCIÓN PARA ANALIZAR ==========

function analyzeMessage(name: string, base64: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`📦 MENSAJE: ${name}`);
  console.log('='.repeat(80));
  console.log(`Base64 (${base64.length} chars): ${base64.substring(0, 60)}...`);
  
  try {
    const buffer = Buffer.from(base64, 'base64');
    console.log(`\n📏 Tamaño buffer: ${buffer.length} bytes`);
    console.log(`🔍 Header bytes: ${buffer.slice(0, 10).toString('hex')}`);
    
    const decoded = decodeMessage(buffer);
    
    if (decoded) {
      console.log('\n✅ DECODIFICADO:');
      console.log(JSON.stringify(decoded, null, 2));
      
      // Análisis específico
      if (decoded.c !== undefined) console.log(`  📌 Canal (c): ${decoded.c}`);
      if (decoded.a !== undefined) console.log(`  📌 Acción (a): ${decoded.a}`);
      if (decoded.p) {
        console.log(`  📌 Payload (p):`);
        analyzePayload(decoded.p);
      }
    } else {
      console.log('\n❌ No se pudo decodificar');
    }
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
  }
}

function analyzePayload(p: any, indent: string = '    ') {
  if (!p || typeof p !== 'object') return;
  
  for (const [key, value] of Object.entries(p)) {
    if (key === 'bet' || key === 'betId') {
      console.log(`${indent}💰 ${key}: ${value}`);
    } else if (key === 'clientSeed') {
      console.log(`${indent}🎲 ${key}: ${value}`);
    } else if (key === 'freeBet') {
      console.log(`${indent}🎁 ${key}: ${value}`);
    } else if (key === 'autoCashOut') {
      console.log(`${indent}🎯 ${key}: ${value}`);
    } else if (key === 'player_id') {
      console.log(`${indent}👤 ${key}: ${value}`);
    } else if (key === 'username') {
      console.log(`${indent}👤 ${key}: ${value}`);
    } else if (key === 'newBalance') {
      console.log(`${indent}💵 ${key}: ${value}`);
    } else if (key === 'code') {
      console.log(`${indent}🔢 ${key}: ${value} (código de evento)`);
    } else if (typeof value === 'object' && value !== null) {
      console.log(`${indent}📁 ${key}:`);
      analyzePayload(value, indent + '  ');
    } else {
      console.log(`${indent}📌 ${key}: ${value}`);
    }
  }
}

// ========== EJECUTAR ANÁLISIS ==========

console.log('\n');
console.log('╔══════════════════════════════════════════════════════════════════════════╗');
console.log('║         DECODIFICADOR DE MENSAJES AVIATOR - ANÁLISIS PROFUNDO            ║');
console.log('╚══════════════════════════════════════════════════════════════════════════╝');

// Analizar cada tipo de mensaje
console.log('\n\n🔴 ====== PLACE BET (APUESTA) ======');
analyzeMessage('placeBet1', messages.placeBet1);
analyzeMessage('placeBet2', messages.placeBet2);

console.log('\n\n🟢 ====== AUTO CASHOUT ======');
analyzeMessage('autoCashout1', messages.autoCashout1);
analyzeMessage('autoCashout2', messages.autoCashout2);

console.log('\n\n🔵 ====== RECEIVE BETS (RESPUESTA SERVIDOR) ======');
analyzeMessage('receiveBetsCount', messages.receiveBetsCount);

console.log('\n\n🟡 ====== FREE BET ======');
analyzeMessage('freeBet1', messages.freeBet1);
analyzeMessage('freeBet2', messages.freeBet2);

console.log('\n\n🟣 ====== NEW BALANCE ======');
analyzeMessage('newBalance1', messages.newBalance1);
analyzeMessage('newBalance2', messages.newBalance2);

console.log('\n\n');
console.log('╔══════════════════════════════════════════════════════════════════════════╗');
console.log('║                        RESUMEN DE HALLAZGOS                              ║');
console.log('╚══════════════════════════════════════════════════════════════════════════╝');
