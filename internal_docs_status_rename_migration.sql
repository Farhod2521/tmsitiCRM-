-- Status granulyarligini oshirish: "oqilgan" ikkiga bo'lindi (bolim_oqidi /
-- zamdirektor_oqidi), qo'shimcha "ijrochi_oqidi" bosqichi qo'shildi. Eski test
-- ma'lumotlari bo'lsa, ularni yangi nomga o'tkazamiz (status ustuni VARCHAR,
-- ALTER TYPE kerak emas).
UPDATE internal_documents SET status = 'bolim_oqidi' WHERE status = 'oqilgan';

UPDATE internal_document_log SET action = 'bolim_oqidi' WHERE action = 'oqildi';
