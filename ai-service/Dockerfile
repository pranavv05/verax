FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN echo "Acquire::http::Pipeline-Depth 0;" > /etc/apt/apt.conf.d/99custom \
  && echo "Acquire::http::No-Cache true;" >> /etc/apt/apt.conf.d/99custom \
  && echo "Acquire::BrokenProxy true;" >> /etc/apt/apt.conf.d/99custom \
  && rm -f /etc/apt/sources.list.d/debian.sources \
  && echo "deb http://deb.debian.org/debian bookworm main" > /etc/apt/sources.list \
  && echo "deb http://deb.debian.org/debian-security bookworm-security main" >> /etc/apt/sources.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-hin \
    tesseract-ocr-eng \
    poppler-utils \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1-mesa-glx \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]
