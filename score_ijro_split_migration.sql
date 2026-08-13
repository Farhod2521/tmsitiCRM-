-- Ball berish tartibi o'zgarishi: Ijro roli endi ikkita alohida ball beradi
-- (edo.ijro.uz uchun 0-32, ichki xatlar uchun 0-20). Eski ijro_ball ustuni
-- endi ishlatilmaydi (tarixiy ma'lumot sifatida bazada qoladi).
ALTER TABLE scores ADD COLUMN IF NOT EXISTS ijro_edo_ball INTEGER;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS ijro_ichki_ball INTEGER;
