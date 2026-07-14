const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const cnt = await p.$queryRawUnsafe('SELECT COUNT(*) as c FROM reviews');
    console.log('reviews count:', cnt);
    const cols = await p.$queryRawUnsafe('DESCRIBE reviews');
    console.log('reviews schema:', JSON.stringify(cols, null, 2));
  } catch (e) { console.error('ERR', e.message); } finally { await p.$disconnect(); }
})();
