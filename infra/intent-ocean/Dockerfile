FROM python:3.13-slim
WORKDIR /app
COPY services/intent-ocean/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && useradd -u 10001 -M -s /usr/sbin/nologin ocean && mkdir /data && chown ocean: /data
COPY services/intent-ocean /app/services/intent-ocean
COPY mobile-web /app/mobile-web
RUN python mobile-web/build.py
USER 10001:10001
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 OSMINOG_CONTAINER=1 OSMINOG_ORIGIN=https://osminog.red OSMINOG_DB=/data/ocean.sqlite3
EXPOSE 8080
CMD ["python","services/intent-ocean/server.py"]
