-- Xodimning joriy parolini (qaytarib olinadigan shifrda) saqlash uchun ustun.
-- Login tekshiruvi hamon faqat hashed_password (bcrypt) orqali amalga oshadi;
-- bu ustun faqat superadmin xodimga joriy parolni ko'rsatib/chop etib berishi uchun ishlatiladi.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS enc_password TEXT;
