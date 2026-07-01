FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
  ffmpeg \
  libcairo2-dev \
  libpango1.0-dev \
  libglib2.0-dev \
  pkg-config \
  texlive \
  texlive-latex-extra \
  texlive-fonts-extra \
  dvipng \
  cm-super \
  curl \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y nodejs \
  && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir manim

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY src/ ./src/

EXPOSE 3031
CMD ["node", "src/index.js"]
