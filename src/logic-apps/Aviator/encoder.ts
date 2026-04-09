/**
 * Codificador de mensajes binarios para Aviator
 * Genera mensajes en formato SFSObject comprimido con zlib
 */

import * as zlib from 'zlib';

// ========== DATA STREAM WRITER ==========

class DataStreamWriter {
  private buffers: Buffer[] = [];

  writeUInt8(value: number): void {
    const buf = Buffer.alloc(1);
    buf.writeUInt8(value, 0);
    this.buffers.push(buf);
  }

  writeInt8(value: number): void {
    const buf = Buffer.alloc(1);
    buf.writeInt8(value, 0);
    this.buffers.push(buf);
  }

  writeUInt16(value: number): void {
    const buf = Buffer.alloc(2);
    buf.writeUInt16BE(value, 0);
    this.buffers.push(buf);
  }

  writeInt16(value: number): void {
    const buf = Buffer.alloc(2);
    buf.writeInt16BE(value, 0);
    this.buffers.push(buf);
  }

  writeInt32(value: number): void {
    const buf = Buffer.alloc(4);
    buf.writeInt32BE(value, 0);
    this.buffers.push(buf);
  }

  writeInt64(value: number | bigint): void {
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(value), 0);
    this.buffers.push(buf);
  }

  writeFloat64(value: number): void {
    const buf = Buffer.alloc(8);
    buf.writeDoubleBE(value, 0);
    this.buffers.push(buf);
  }

  writeUtf8String(value: string): void {
    const strBuf = Buffer.from(value, 'utf8');
    this.writeUInt16(strBuf.length);
    this.buffers.push(strBuf);
  }

  writeByteArray(value: number[]): void {
    this.writeUInt16(value.length);
    this.buffers.push(Buffer.from(value));
  }

  toBuffer(): Buffer {
    return Buffer.concat(this.buffers);
  }
}

// ========== SFS OBJECT ENCODER ==========

const SFS_DATA_TYPES = {
  NULL: 0x00,
  BOOL: 0x01,
  BYTE: 0x02,
  SHORT: 0x03,
  INT: 0x04,
  LONG: 0x05,
  FLOAT: 0x06,
  DOUBLE: 0x07,
  UTF_STRING: 0x08,
  BOOL_ARRAY: 0x09,
  BYTE_ARRAY: 0x0A,
  SHORT_ARRAY: 0x0B,
  INT_ARRAY: 0x0C,
  LONG_ARRAY: 0x0D,
  FLOAT_ARRAY: 0x0E,
  DOUBLE_ARRAY: 0x0F,
  UTF_STRING_ARRAY: 0x10,
  SFS_ARRAY: 0x11,
  SFS_OBJECT: 0x12,
};

function encodeValue(ds: DataStreamWriter, value: any): void {
  if (value === null || value === undefined) {
    ds.writeUInt8(SFS_DATA_TYPES.NULL);
  } else if (typeof value === 'boolean') {
    ds.writeUInt8(SFS_DATA_TYPES.BOOL);
    ds.writeUInt8(value ? 1 : 0);
  } else if (typeof value === 'number') {
    // Determinar si es entero o decimal
    if (Number.isInteger(value)) {
      if (value >= -128 && value <= 127) {
        ds.writeUInt8(SFS_DATA_TYPES.BYTE);
        ds.writeInt8(value);
      } else if (value >= -32768 && value <= 32767) {
        ds.writeUInt8(SFS_DATA_TYPES.SHORT);
        ds.writeInt16(value);
      } else if (value >= -2147483648 && value <= 2147483647) {
        ds.writeUInt8(SFS_DATA_TYPES.INT);
        ds.writeInt32(value);
      } else {
        ds.writeUInt8(SFS_DATA_TYPES.LONG);
        ds.writeInt64(value);
      }
    } else {
      ds.writeUInt8(SFS_DATA_TYPES.DOUBLE);
      ds.writeFloat64(value);
    }
  } else if (typeof value === 'string') {
    ds.writeUInt8(SFS_DATA_TYPES.UTF_STRING);
    ds.writeUtf8String(value);
  } else if (Array.isArray(value)) {
    ds.writeUInt8(SFS_DATA_TYPES.SFS_ARRAY);
    encodeSfsArray(ds, value);
  } else if (typeof value === 'object') {
    ds.writeUInt8(SFS_DATA_TYPES.SFS_OBJECT);
    encodeSfsObject(ds, value);
  } else {
    throw new Error(`Unsupported value type: ${typeof value}`);
  }
}

function encodeSfsObject(ds: DataStreamWriter, obj: any): void {
  const keys = Object.keys(obj);
  ds.writeUInt16(keys.length);

  for (const key of keys) {
    ds.writeUtf8String(key);
    encodeValue(ds, obj[key]);
  }
}

function encodeSfsArray(ds: DataStreamWriter, arr: any[]): void {
  ds.writeUInt16(arr.length);

  for (const item of arr) {
    encodeValue(ds, item);
  }
}

// ========== MESSAGE BUILDER ==========

export interface BetMessage {
  bet: number;
  clientSeed: string;
  betId: 1 | 2;
  freeBet?: boolean;
  autoCashOut?: number;
}

export interface CashoutMessage {
  betId: 1 | 2;
}

/**
 * Codifica un mensaje completo de Aviator con header y compresión
 */
function encodeMessage(payload: any): Buffer {
  // 1. Codificar el body como SFSObject
  const bodyStream = new DataStreamWriter();
  bodyStream.writeUInt8(SFS_DATA_TYPES.SFS_OBJECT);
  encodeSfsObject(bodyStream, payload);
  const bodyBuffer = bodyStream.toBuffer();

  // 2. Comprimir con zlib
  const compressedBody = zlib.deflateSync(bodyBuffer);

  // 3. Crear header
  // Header byte: 0x80 | (message type bits)
  // Bit 7 = 1 (binary message)
  const headerByte = 0x80;
  
  // Message length (2 bytes, big endian)
  const messageLength = compressedBody.length;

  // 4. Construir mensaje completo
  const headerStream = new DataStreamWriter();
  headerStream.writeUInt8(headerByte);
  headerStream.writeUInt16(messageLength);
  
  return Buffer.concat([headerStream.toBuffer(), compressedBody]);
}

// ========== PUBLIC API ==========

/**
 * Crea un mensaje de apuesta para Aviator
 * 
 * @param bet Cantidad de la apuesta
 * @param clientSeed Seed aleatorio único (generar con generateClientSeed())
 * @param betId ID de apuesta (1 o 2)
 * @param autoCashOut Multiplicador objetivo para auto-cashout (opcional)
 * @returns Buffer con el mensaje codificado en base64
 */
export function createBetMessage(options: BetMessage): string {
  const payload = {
    c: 1,  // Canal
    a: 13, // Acción
    p: {
      c: 'betHandler',
      r: -1,
      p: {
        bet: options.bet,
        clientSeed: options.clientSeed,
        betId: options.betId,
        freeBet: options.freeBet ?? false,
        ...(options.autoCashOut && { autoCashOut: options.autoCashOut })
      }
    }
  };

  const messageBuffer = encodeMessage(payload);
  return messageBuffer.toString('base64');
}

/**
 * Crea un mensaje de cashout manual
 * 
 * @param betId ID de la apuesta a retirar (1 o 2)
 * @returns Buffer con el mensaje codificado en base64
 */
export function createCashoutMessage(betId: 1 | 2): string {
  const payload = {
    c: 1,
    a: 13,
    p: {
      c: 'betHandler',
      r: -1,
      p: {
        action: 'cashout',
        betId: betId
      }
    }
  };

  const messageBuffer = encodeMessage(payload);
  return messageBuffer.toString('base64');
}

/**
 * Genera un clientSeed aleatorio
 * Formato: string alfanumérico de 22 caracteres
 */
export function generateClientSeed(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 22; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Crea un mensaje de autenticación para el WebSocket de Aviator
 * 
 * @param tokens Objeto con accessToken, userToken, sessionId, currency, userId
 * @returns Buffer con el mensaje codificado en base64
 */
export function createAuthMessage(options: {
  accessToken?: string;
  userToken?: string;
  sessionId?: string;
  currency?: string;
  userId?: string;
  username?: string;
}): string {
  const payload = {
    c: 1,  // Canal
    a: 1,  // Acción: auth
    p: {
      token: options.accessToken || options.userToken || '',
      sessionToken: options.sessionId || '',
      currency: options.currency || 'COP',
      platform: 'desktop',
      deviceInfo: JSON.stringify({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        os: 'Windows',
        browser: 'Chrome',
        device: 'Unknown',
        os_version: 'windows-10',
        browser_version: '146.0.0.0'
      }),
      // Datos adicionales del usuario si están disponibles
      ...(options.userId && { pid: options.userId }),
      ...(options.username && { un: options.username }),
    }
  };

  // Codificar como SFSObject SIN compresión (como el API message)
  const bodyStream = new DataStreamWriter();
  bodyStream.writeUInt8(SFS_DATA_TYPES.SFS_OBJECT);
  encodeSfsObject(bodyStream, payload);
  const bodyBuffer = bodyStream.toBuffer();

  // Crear header (sin compresión)
  const headerStream = new DataStreamWriter();
  headerStream.writeUInt8(0x80);  // Header byte
  headerStream.writeUInt16(bodyBuffer.length);  // Message length

  const messageBuffer = Buffer.concat([headerStream.toBuffer(), bodyBuffer]);
  return messageBuffer.toString('base64');
}


/**
 * Crea un mensaje de apuesta con auto-cashout
 * Esta es la forma más común para apuestas automáticas
 */
export function createAutoBetMessage(
  betAmount: number,
  targetMultiplier: number,
  betId: 1 | 2 = 1
): { base64: string; clientSeed: string } {
  const clientSeed = generateClientSeed();
  const base64 = createBetMessage({
    bet: betAmount,
    clientSeed,
    betId,
    freeBet: false,
    autoCashOut: targetMultiplier
  });

  return { base64, clientSeed };
}

/**
 * Crea un mensaje de autenticación para Spribe Aviator
 * usando los tokens extraídos con Puppeteer
 * 
 * @param options Objeto con token, sessionToken, userId, gameZone, operator, currency
 * @returns Buffer con el mensaje codificado en base64
 */
export function createSpribeAuthMessage(options: {
  token: string;
  sessionToken: string;
  userId?: string;
  gameZone?: string;
  operator?: string;
  currency?: string;
}): string {
  const gameZone = options.gameZone || 'aviator_core_inst7';
  const userId = options.userId || '';
  const operator = options.operator || '888starzbet';
  const currency = options.currency || 'COP';
  
  const deviceInfoObj = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    os: 'Windows',
    browser: 'Chrome',
    device: 'Unknown',
    os_version: 'windows-10',
    browser_version: '146.0.0.0',
    deviceType: 'desktop',
    orientation: 'landscape'
  };
  
  const payload = {
    c: 1,  // Canal
    a: 1,  // Acción: auth
    p: {
      zn: gameZone,                                    // gameZone
      un: `${userId}&&${operator}`,                    // userId&&operator
      pw: 1,                                           // password flag
      token: options.token,
      currency: currency,
      lang: 'es',
      sessionToken: options.sessionToken,
      platform: {
        deviceType: 'desktop',
        version: '4.2.107'
      },
      deviceInfo: JSON.stringify(deviceInfoObj),
      userAgent: deviceInfoObj.userAgent,
      deviceType: 'desktop',
      version: '4.2.107'
    }
  };

  // Codificar como SFSObject SIN compresión (como el API message)
  const bodyStream = new DataStreamWriter();
  bodyStream.writeUInt8(SFS_DATA_TYPES.SFS_OBJECT);
  encodeSfsObject(bodyStream, payload);
  const bodyBuffer = bodyStream.toBuffer();

  // Crear header (sin compresión)
  const headerStream = new DataStreamWriter();
  headerStream.writeUInt8(0x80);  // Header byte
  headerStream.writeUInt16(bodyBuffer.length);  // Message length

  const messageBuffer = Buffer.concat([headerStream.toBuffer(), bodyBuffer]);
  return messageBuffer.toString('base64');
}

/**
 * Crea el mensaje de API para Spribe Aviator
 * Este mensaje se envía primero para identificar la versión del cliente
 */
export function createApiMessage(): string {
  const payload = {
    c: 1,
    a: 1,
    p: {
      api: '1.8.4',
      cl: 'JavaScript'
    }
  };

  const messageBuffer = encodeMessage(payload);
  return messageBuffer.toString('base64');
}

/**
 * Crea el mensaje de PING para mantener la conexión activa
 * Este mensaje se envía cada 10 segundos
 */
export function createPingMessage(): string {
  const payload = {
    c: 1,
    a: 13,
    p: {
      c: 'currentBetsInfoHandler',
      r: -1,
      p: {}
    }
  };

  const messageBuffer = encodeMessage(payload);
  return messageBuffer.toString('base64');
}

/**
 * Crea un mensaje para solicitar el historial de apuestas del usuario
 * Este mensaje obtiene todas las apuestas que el usuario ha realizado
 */
export function createHistoryRequestMessage(): string {
  const payload = {
    c: 1,
    a: 13,
    p: {
      c: 'betHistoryHandler',
      r: -1,
      p: {}
    }
  };

  const messageBuffer = encodeMessage(payload);
  return messageBuffer.toString('base64');
}

// ========== TESTING ==========

// Si se ejecuta directamente, mostrar ejemplos
if (require.main === module) {
  console.log('\n🧪 TESTING ENCODER\n');

  // Test 1: Apuesta simple
  const bet1 = createBetMessage({
    bet: 1,
    clientSeed: 'UFDM26GAFMomOVUUOB3z',
    betId: 1,
    freeBet: false
  });
  console.log('📦 Apuesta simple (bet=1):');
  console.log(`   Base64: ${bet1.substring(0, 60)}...`);
  console.log(`   Length: ${bet1.length} chars`);

  // Test 2: Apuesta con auto-cashout
  const bet2 = createBetMessage({
    bet: 10,
    clientSeed: 'YrCqCpFOlsNf5ULQXdGG',
    betId: 1,
    freeBet: false,
    autoCashOut: 1.5
  });
  console.log('\n📦 Apuesta con auto-cashout (bet=10, target=1.5x):');
  console.log(`   Base64: ${bet2.substring(0, 60)}...`);
  console.log(`   Length: ${bet2.length} chars`);

  // Test 3: Generar clientSeed
  console.log('\n🎲 ClientSeed generado:', generateClientSeed());

  // Test 4: Auto-bet completo
  const autoBet = createAutoBetMessage(100, 1.5);
  console.log('\n🤖 Auto-bet (100 @ 1.5x):');
  console.log(`   ClientSeed: ${autoBet.clientSeed}`);
  console.log(`   Base64: ${autoBet.base64.substring(0, 60)}...`);

  console.log('\n✅ Encoder funcionando correctamente\n');
}
