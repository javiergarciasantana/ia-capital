import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  const adminPassword = await bcrypt.hash('admin123', 10);

  // Crear admin solo si no existe
  const existingAdmin = await usersService.findByEmail('admin@ia.capital');
  if (!existingAdmin) {
    await usersService.create({
      email: 'admin@ia.capital',
      password: adminPassword,
      role: 'admin',
    });
    console.log('Admin creado');
  }

  // Lista de clientes a insertar
  const clients = [
    'cliente1@ia.capital',
    'cliente2@ia.capital',
    'cliente3@ia.capital',
  ];

  const clientPassword = await bcrypt.hash('client123', 10);

  for (const email of clients) {
    const exists = await usersService.findByEmail(email);
    if (!exists) {
      await usersService.create({
        email,
        password: clientPassword,
        role: 'client',
      });
      console.log(`Cliente ${email} creado`);
    }
  }

  await app.close();
}
seed();
