# SantexGo backup: kunlik pg_dump va yuklangan fayllar nusxasi (docker-compose.prod.yml, "backup").
# pg_dump versiyasi baza versiyasi bilan bir xil bo'lishi uchun xuddi shu postgres image'i ishlatiladi.
FROM postgres:16-alpine
COPY entrypoint.sh backup.sh restore.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/entrypoint.sh /usr/local/bin/backup.sh /usr/local/bin/restore.sh
# Oxirgi 26 soatda muvaffaqiyatli zaxira bo'lmasa — konteyner "unhealthy"
HEALTHCHECK --interval=10m --timeout=10s --start-period=5m \
  CMD find /backups/db -name 'santexgo-*.dump' -mmin -1560 | grep -q .
ENTRYPOINT ["entrypoint.sh"]
