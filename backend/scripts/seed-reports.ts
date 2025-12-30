import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';

const XLSX_DIR = '/app/reports/'; // Adjust as needed
const API_BASE = 'http://localhost:5000/api/xlsx'; // Adjust port/path as needed
const ADMIN_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImVtYWlsIjoiYWRtaW5AaWEuY2FwaXRhbCIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc2NzA5NjI2NCwiZXhwIjoxNzY3MTAzNDY0fQ.f2_CahPEwoIFkTT01BtqWL0Ul67VTTt8PCeo2S--BLA'
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  const files = fs.readdirSync(XLSX_DIR).filter(f => f.endsWith('.xlsx'));

  // Get all clients
  const clients = await usersService.findAllClients(); // Implement this if needed

  for (const client of clients) {
    const profile = client.profile;
    if (!profile?.firstName) continue;

    // Find matching file
    if (!profile.firstName) {
      console.log(`No firstName for client with id ${client.id}`);
      continue;
    }
    const match = files.find(f => f.toUpperCase().includes(profile.firstName!.toUpperCase()));
    if (!match) {
      console.log(`No XLSX found for ${profile.firstName}`);
      continue;
    }

    // Read file buffer
    const filePath = path.join(XLSX_DIR, match);
    const fileBuffer = fs.readFileSync(filePath);

    // 1. Upload
    const uploadRes = await axios.post(
      `${API_BASE}/${client.id}/upload`,
      // Simulate multipart/form-data
      (() => {
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', fileBuffer, match);
        return form;
      })(),
      {
        headers: {
          Authorization: `Bearer ${ADMIN_JWT}`,
          ...((() => {
            const FormData = require('form-data');
            return new FormData().getHeaders();
          })()),
        },
      }
    );
    const report = (uploadRes.data as { data: any }).data;

    const resumenGlobal = `
      <h2>Resumen Global del Mes</h2>
      <p>Estimados usuarios,</p>
      <p>Adjuntamos el informe global correspondiente al mes actual. Si tienen alguna duda, no duden en contactarnos.</p>
      <ul>
      <li>Fecha: ${new Date().toLocaleDateString()}</li>
      </ul>
      <p>Saludos,<br>Equipo IA Capital</p>
    `;
    const resumenTailored = `
      <h2>Resumen del mes</h2>
      <p>Estimado/a ${profile.firstName},</p>
      <p>Adjuntamos el informe correspondiente al mes actual. Si tienes alguna duda, no dudes en contactarnos.</p>
      <ul>
      <li>Cliente: ${profile.firstName} ${profile.lastName || ''}</li>
      <li>Email: ${client.email}</li>
      <li>Fecha: ${new Date().toLocaleDateString()}</li>
      </ul>
      <p>Saludos,<br>Equipo IA Capital</p>
    `;
    // 2. Publish
    const monthYear = new Date().toISOString().slice(0, 7); // Or extract from filename
    await axios.post(
      `${API_BASE}/${client.id}/publish`,
      {
        clientId: client.id,
        report,
        monthYear,
        resumenGlobal,
        resumenTailored
      },
      {
        headers: { Authorization: `Bearer ${ADMIN_JWT}` },
      }
    );

    console.log(`Uploaded and published report for ${profile.firstName} (${client.email})`);
  }

  await app.close();
}

main().catch(console.error);