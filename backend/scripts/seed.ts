import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  // Eliminar todos los usuarios previos
  // await usersService.removeAll();

  const adminPassword = 'admin123';

  // Crear admin solo si no existe
  const existingAdmin = await usersService.findByEmail('admin@ia.capital');
  if (!existingAdmin) {
    await usersService.create({
      email: 'admin@ia.capital',
      password: adminPassword,
      role: 'admin',
      profile: {
        firstName: 'Iñaki',
        lastName: 'Arcocha',
      },
    });
    console.log('Admin creado');
  } else {
    // Always update the password for admin
    await usersService.update(existingAdmin.id, { password: adminPassword });
    // Update profile name and surname if needed
    await usersService.update(existingAdmin.id, {
      profile: {
        firstName: 'Iñaki',
        lastName: 'Arcocha',
      },
    });
    console.log('Admin password and profile updated', adminPassword);
  }

  // Lista de clientes a insertar
  const clients = [
    'gongroup@ia.capital',
    'telma@ia.capital',
    'horacio@ia.capital',
    'alex@ia.capital',
    'andrea@ia.capital',
    'jacobo@ia.capital',
    'mijares@ia.capital',
    'neranju@ia.capital',
    'nina@ia.capital',
    'tovar@ia.capital',
    'troglo@ia.capital',
    'urimer@ia.capital',
  ];

  const clientNames = [
    'GON GROUP',
    'Telma',
    'Horacio',
    'Alex',
    'Andrea',
    'Jacobo',
    'Mijares',
    'Neranju',
    'Nina',
    'Tovar',
    'Troglo',
    'Urimer',
  ]

  const clientPassword = 'client123';

  // Actualizar el password hash para los clientes si existen
  for (let i = 0; i < clients.length && i < clientNames.length; i++) {
    const email = clients[i];
    const clientName = clientNames[i];
    const exists = await usersService.findByEmail(email);
    if (!exists) {
      await usersService.create({
        email,
        password: clientPassword,
        role: 'client',
        isActive: true,
        profile: {
          firstName: clientNames[i],
          feePercentage: Number( 0.00315),
          feeInterval: 'quarterly',
          preferredCurrency: 'USD'
        }
      });
      console.log(`Cliente ${email} (${clientName}) creado`);
    } else {
      // Always update the password for client
      await usersService.update(exists.id, { password: clientPassword });
      console.log(`Cliente ${email} password updated`);

      await usersService.update(exists.id, {
        profile: {
          firstName: clientNames[i],
          feePercentage: Number( 0.0035),
          feeInterval: 'quarterly',
          preferredCurrency: 'USD'
        },
      })
    }

  }
  await app.close();
}
seed();
