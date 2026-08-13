-- Bir martalik tozalash: 2026-yil avgust oyi uchun barcha qo'lda qo'yilgan
-- ballarni tozalaydi (yangi ijro EDO/Ichki tizimiga o'tish sababli).
-- Haftalik hisobot fayllari, izohlar va boshqa maydonlarga tegmaydi.
UPDATE scores
SET kadr_ball       = NULL,
    bolim_ball      = NULL,
    direktor_ball   = NULL,
    ijro_ball       = NULL,
    ijro_edo_ball   = NULL,
    ijro_ichki_ball = NULL
WHERE year = 2026 AND month = 8;
