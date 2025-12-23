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
      name: 'Iñaki',
      surname: 'Arcocha',
      email: 'admin@ia.capital',
      password: adminPassword,
      role: 'admin',
    });
    console.log('Admin creado');
  } else {
    // Always update the password for admin
    await usersService.update(existingAdmin.id, { password: adminPassword });
    console.log('Admin password updated', adminPassword);
  }



  // Lista de clientes a insertar
  const clients = [
    'gongroup@ia.capital',
    'telma@ia.capital',
    'horacio@ia.capital',
    'tovar@ia.capital',
  ];

  const clientNames = [
    'GON GROUP',
    'Telma',
    'Horacio',
    'Tovar',
  ]

  const clientPassword = 'client123';

  // Actualizar el password hash para los clientes si existen
  for (let i = 0; i < clients.length && i < clientNames.length; i++) {
    const email = clients[i];
    const clientName = clientNames[i];
    const exists = await usersService.findByEmail(email);
    if (!exists) {
      await usersService.create({
        name: clientName,
        email,
        password: clientPassword,
        role: 'client',
        isActive: true,
      });
      console.log(`Cliente ${email} (${clientName}) creado`);
    } else {
      // Always update the password for client
      await usersService.update(exists.id, { password: clientPassword });
      console.log(`Cliente ${email} password updated`);
    }
  }

  await app.close();
}
seed();
