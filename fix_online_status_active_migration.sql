-- Bir martalik tuzatish: "online" (masofada ishlaydi) holatidagi xodimlar
-- avvalgi xato mantiq sababli is_active=false bo'lib qolgan edi — bu ularni
-- ball berish/davomat kabi ro'yxatlardan yashirib qo'ygan. Endi tuzatiladi.
UPDATE employees
SET is_active = TRUE
WHERE status = 'online' AND is_active = FALSE;
