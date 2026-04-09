import { DataSource } from 'typeorm';
import { Bookmaker } from '../entities/bookmaker.entity';
import { AviatorWs } from '../entities/aviator-ws.entity';

export async function seedBookmakers(dataSource: DataSource) {
  const bookmakerRepository = dataSource.getRepository(Bookmaker);
  const aviatorWsRepository = dataSource.getRepository(AviatorWs);

  // Verificar si ya existen bookmakers
  const existingBookmakers = await bookmakerRepository.count();
  if (existingBookmakers > 0) {
    console.log('Bookmakers ya existen, saltando seeding...');
    return;
  }

  // Datos iniciales para Aviator (game_id: 1)
  const bookmakersData = [
    {
      gameId: 1,
      bookmaker: '888Starz',
      bookmakerImg: '/bookmakers/888starz.png',
      scaleImg: 65,
      isActive: true,
    },
    {
      gameId: 1,
      bookmaker: 'Betplay',
      bookmakerImg: '/bookmakers/betplay.png',
      scaleImg: 65,
      isActive: true,
    },
    {
      gameId: 1,
      bookmaker: '1xbet',
      bookmakerImg: '/bookmakers/1xbet.png',
      scaleImg: 65,
      isActive: true,
    },
    {
      gameId: 1,
      bookmaker: '1Win',
      bookmakerImg: '/bookmakers/1win.png',
      scaleImg: 65,
      isActive: false,
    },
  ];

  try {
    for (const bookmakerData of bookmakersData) {
      const bookmaker = bookmakerRepository.create(bookmakerData);
      const savedBookmaker = await bookmakerRepository.save(bookmaker);

      // Crear registro vacío en aviator_ws para cada bookmaker
      const aviatorWs = aviatorWsRepository.create({
        bookmakerId: savedBookmaker.id,
        gameId: 1,
        url_websocket: '',
        api_message: '',
        auth_message: '',
        ping_message: '',
        status_ws: 'DISCONNECTED',
        is_editable: true,
      });
      await aviatorWsRepository.save(aviatorWs);

      console.log(`✅ Bookmaker ${savedBookmaker.bookmaker} creado con aviator_ws ID: ${aviatorWs.id}`);
    }
    console.log('✅ Bookmakers sembrados exitosamente');
  } catch (error) {
    console.error('❌ Error sembrando bookmakers:', error);
  }
}
