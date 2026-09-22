import fs from 'fs';
import path from 'path';

/**
 * Teardown global de Playwright.
 * Se ejecuta automáticamente al finalizar toda la suite de pruebas (hayan pasado o fallado).
 * Elimina de forma definitiva el archivo user.json y el directorio .auth del disco
 * para no dejar persistido ningún token, cookie o estado de sesión.
 */
export default async function globalTeardown() {
  const authDir = path.resolve(__dirname, '../.auth');
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true });
    console.log('\n🧹 [Teardown] Estado de autenticación temporal (user.json) eliminado exitosamente del disco.');
  }
}
