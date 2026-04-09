import { DataSource } from 'typeorm';
import { Bookmaker } from '../entities/bookmaker.entity';
import { AviatorWs } from '../entities/aviator-ws.entity';

/**
 * Script para sincronizar bookmakers existentes con aviator_ws
 * Ejecutar: npx ts-node src/scripts/sync-bookmakers-to-aviator-ws.ts
 */
export async function syncBookmakersToAviatorWs(dataSource: DataSource) {
  const bookmakerRepository = dataSource.getRepository(Bookmaker);
  const aviatorWsRepository = dataSource.getRepository(AviatorWs);

  console.log('🔄 Iniciando sincronización de bookmakers con aviator_ws...');

  try {
    // Obtener todos los bookmakers de Aviator (gameId: 1)
    const bookmakers = await bookmakerRepository.find({
      where: { gameId: 1 },
    });

    console.log(`📊 Encontrados ${bookmakers.length} bookmakers de Aviator`);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const bookmaker of bookmakers) {
      // Verificar si ya existe en aviator_ws
      let aviatorWs = await aviatorWsRepository.findOne({
        where: { bookmakerId: bookmaker.id },
      });

      if (aviatorWs) {
        // Actualizar con datos del bookmaker si existen
        let needsUpdate = false;

        if (bookmaker.urlWebsocket && !aviatorWs.url_websocket) {
          aviatorWs.url_websocket = bookmaker.urlWebsocket;
          needsUpdate = true;
        }
        if (bookmaker.apiMessage && !aviatorWs.api_message) {
          aviatorWs.api_message = bookmaker.apiMessage;
          needsUpdate = true;
        }
        if (bookmaker.authMessage && !aviatorWs.auth_message) {
          aviatorWs.auth_message = bookmaker.authMessage;
          needsUpdate = true;
        }
        if (bookmaker.pingMessage && !aviatorWs.ping_message) {
          aviatorWs.ping_message = bookmaker.pingMessage;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await aviatorWsRepository.save(aviatorWs);
          console.log(`✅ Actualizado aviator_ws para ${bookmaker.bookmaker} (ID: ${aviatorWs.id})`);
          updated++;
        } else {
          console.log(`⏭️  ${bookmaker.bookmaker} ya está sincronizado (ID: ${aviatorWs.id})`);
          skipped++;
        }
      } else {
        // Crear nuevo registro en aviator_ws
        aviatorWs = aviatorWsRepository.create({
          bookmakerId: bookmaker.id,
          gameId: 1,
          url_websocket: bookmaker.urlWebsocket || '',
          api_message: bookmaker.apiMessage || '',
          auth_message: bookmaker.authMessage || '',
          ping_message: bookmaker.pingMessage || '',
          status_ws: 'DISCONNECTED',
          is_editable: true,
        });
        await aviatorWsRepository.save(aviatorWs);
        console.log(`✅ Creado aviator_ws para ${bookmaker.bookmaker} (ID: ${aviatorWs.id})`);
        created++;
      }
    }

    console.log('\n📊 Resumen:');
    console.log(`   Creados: ${created}`);
    console.log(`   Actualizados: ${updated}`);
    console.log(`   Omitidos: ${skipped}`);
    console.log(`   Total: ${bookmakers.length}`);
    console.log('\n✅ Sincronización completada!');

  } catch (error) {
    console.error('❌ Error sincronizando bookmakers:', error);
  }
}

// Si se ejecuta directamente
if (require.main === module) {
  // Crear conexión a la base de datos
  const { AppDataSource } = require('../config/database');

  AppDataSource.initialize()
    .then(async (dataSource: DataSource) => {
      await syncBookmakersToAviatorWs(dataSource);
      await dataSource.destroy();
      process.exit(0);
    })
    .catch((error: any) => {
      console.error('❌ Error conectando a la base de datos:', error);
      process.exit(1);
    });
}
