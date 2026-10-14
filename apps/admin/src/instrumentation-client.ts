import { z } from 'zod';

// Qat'iy CSP'da 'unsafe-eval' yo'q: zod tezlashtirish uchun `new Function` sinab ko'rmasin
// (aks holda brauzer konsolida CSP buzilishi haqida xabar chiqadi). Boshqa modullardan oldin ishlaydi.
z.config({ jitless: true });
