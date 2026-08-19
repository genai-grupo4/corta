const { crearApp } = require('./src/app');
const { crearStorage } = require('./src/storage');

const PORT = Number(process.env.PORT) || 3000;

async function main() {
  const storage = crearStorage();
  await storage.init();

  const app = crearApp({ storage });
  const server = app.listen(PORT, () => {
    console.log(`Corta escuchando en http://localhost:${PORT}`);
  });

  // Railway manda SIGTERM en cada redeploy: cerramos ordenado para no cortar
  // requests en vuelo ni dejar conexiones colgadas.
  for (const senal of ['SIGTERM', 'SIGINT']) {
    process.on(senal, () => {
      console.log(`\n${senal} recibido, cerrando...`);
      server.close(async () => {
        await storage.cerrar();
        process.exit(0);
      });
    });
  }
}

main().catch((error) => {
  console.error('No se pudo levantar Corta:', error);
  process.exit(1);
});
